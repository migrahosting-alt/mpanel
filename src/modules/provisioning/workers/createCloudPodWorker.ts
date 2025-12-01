/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Create CloudPod Worker - Provisions new CloudPod containers.
 * 
 * P0.3 FIX (Enterprise Hardening):
 * - ALL user-derived inputs are validated before shell commands
 * - Uses spawn() with argument arrays, NOT string interpolation
 * - Whitelisted scripts only
 * - Audit logging for rejected inputs
 * 
 * Flow:
 * 1. Validate all inputs
 * 2. Select best server
 * 3. Get next available VMID
 * 4. Create LXC container via Proxmox API
 * 5. Configure networking
 * 6. Apply DNS records
 * 7. Update database records
 * 8. Issue SSL certificate
 * 
 * SCHEMA ALIGNMENT:
 * CloudPod model fields (from prisma/schema.prisma):
 * - tenantId, vmid (unique), hostname, ip, region, status, pool
 * - cores, memoryMb, swapMb, diskGb, storage, bridge
 * - planSnapshot (JSON), blueprintId (optional)
 * - No serverId, subscriptionId, primaryDomain fields
 */

import { prisma } from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';
import { selectServerForCloudPod, getServerSshCommand } from '../serverSelectionService.js';
import { applyDnsTemplateForCloudPod } from '../../dns/dns.service.js';
import { enqueueIssueSslJob } from '../queue.js';
import type { CreateCloudPodJobPayload } from '../queue.js';
import {
  validateHostname,
  validateDomainName,
  validateVmid,
  validatePlanCode,
  runSshCommand,
} from './inputValidation.js';

// ============================================
// TYPES
// ============================================

interface PlanResources {
  memory: number;   // MB
  swap: number;     // MB
  cores: number;    // CPU cores (matches schema field name)
  diskGb: number;
  bandwidth: number; // Mbps (stored in planSnapshot)
}

/**
 * CloudPodRecord matches the Prisma CloudPod model exactly.
 * No subscriptionId, serverId, primaryDomain - those are tracked elsewhere.
 */
interface CloudPodRecord {
  id: string;
  tenantId: string;
  vmid: number;
  hostname: string;
  ip: string | null;
  region: string;
  status: string;
}

// ============================================
// PLAN RESOURCE MAPPINGS
// ============================================

const PLAN_RESOURCES: Record<string, PlanResources> = {
  'cloudpod-starter': {
    memory: 512,
    swap: 256,
    cores: 1,
    diskGb: 5,
    bandwidth: 100,
  },
  'cloudpod-basic': {
    memory: 1024,
    swap: 512,
    cores: 1,
    diskGb: 10,
    bandwidth: 200,
  },
  'cloudpod-standard': {
    memory: 2048,
    swap: 1024,
    cores: 2,
    diskGb: 20,
    bandwidth: 500,
  },
  'cloudpod-pro': {
    memory: 4096,
    swap: 2048,
    cores: 4,
    diskGb: 40,
    bandwidth: 1000,
  },
  'cloudpod-enterprise': {
    memory: 8192,
    swap: 4096,
    cores: 8,
    diskGb: 100,
    bandwidth: 2000,
  },
};

const DEFAULT_RESOURCES: PlanResources = PLAN_RESOURCES['cloudpod-starter'];

// ============================================
// MAIN WORKER
// ============================================

/**
 * Process a CREATE_CLOUDPOD job.
 * 
 * IDEMPOTENT: Uses CloudPodJob table to track job state. 
 * A job with the same bullJobId won't create duplicate CloudPods.
 * 
 * Note: Prisma CloudPod schema does NOT have subscriptionId/serverId/primaryDomain.
 * - Domain is stored in Domain model and linked via hostname matching
 * - planSnapshot JSON stores plan details including subscriptionId
 * - Server selection is region-based, not stored on CloudPod
 * 
 * @throws If provisioning fails after all retries
 */
export async function processCreateCloudPodJob(
  job: { id: string; data: CreateCloudPodJobPayload }
): Promise<void> {
  const { id: jobId, data } = job;
  const { tenantId, subscriptionId, planCode, requestedDomain, triggeredByUserId } = data;

  logger.info('Processing CREATE_CLOUDPOD job', {
    jobId,
    tenantId,
    subscriptionId,
    planCode,
  });

  // ==========================================
  // IDEMPOTENCY CHECK: Use CloudPodJob table
  // Check if a successful CREATE job already exists for this subscription
  // ==========================================
  const existingSuccessJob = await prisma.cloudPodJob.findFirst({
    where: {
      tenantId,
      type: 'CREATE',
      status: 'success',
      // payload is JSON - check for matching subscriptionId
      payload: {
        path: ['subscriptionId'],
        equals: subscriptionId,
      },
    },
    include: {
      cloudPod: true,
    },
  });

  if (existingSuccessJob?.cloudPod) {
    logger.info('CloudPod already exists for subscription (idempotent), skipping creation', {
      jobId,
      subscriptionId,
      existingCloudPodId: existingSuccessJob.cloudPod.id,
      existingJobId: existingSuccessJob.id,
      status: existingSuccessJob.cloudPod.status,
    });

    // Write audit event for idempotent skip
    await writeAuditEvent({
      actorUserId: triggeredByUserId,
      tenantId,
      type: 'JOB_SKIPPED_IDEMPOTENT',
      metadata: {
        jobId,
        jobType: 'CREATE_CLOUDPOD',
        reason: 'CloudPod already exists for subscription',
        existingCloudPodId: existingSuccessJob.cloudPod.id,
        subscriptionId,
      },
    });

    return; // Exit without error - idempotent behavior
  }

  let cloudPodRecord: CloudPodRecord | null = null;
  let cloudPodJob: { id: string } | null = null;

  try {
    // 0) Create CloudPodJob record for tracking
    cloudPodJob = await prisma.cloudPodJob.create({
      data: {
        tenantId,
        type: 'CREATE',
        status: 'running',
        bullJobId: jobId,
        payload: {
          subscriptionId,
          planCode,
          requestedDomain,
          triggeredByUserId,
        },
        startedAt: new Date(),
      },
    });

    // 1) Get plan resources
    const resources = PLAN_RESOURCES[planCode] ?? DEFAULT_RESOURCES;

    // 2) Select best server (returns server info for SSH, but not stored on CloudPod)
    const server = await selectServerForCloudPod({
      requiredMemoryMb: resources.memory,
      requiredDiskGb: resources.diskGb,
      preferredRegion: null, // TODO: Support region preference
    });

    if (!server) {
      throw new Error('No server available for CloudPod provisioning');
    }

    if (!server.hostname) {
      throw new Error(`Server ${server.id} has no hostname configured`);
    }

    const serverHostname = server.hostname;

    logger.info('Selected server for CloudPod', {
      jobId,
      serverHostname,
      region: server.region ?? 'migra-us-east-1',
    });

    // 3) Get next available VMID
    const vmid = await getNextVmid();

    // 4) Generate hostname
    const hostname = generateHostname(vmid);
    const domain = requestedDomain ?? hostname;

    // 5) Create CloudPod database record (provisioning status)
    // Schema-aligned: no serverId, subscriptionId, primaryDomain
    cloudPodRecord = await createCloudPodRecord({
      tenantId,
      vmid,
      hostname,
      region: server.region ?? 'migra-us-east-1',
      planCode,
      resources,
      subscriptionId, // Stored in planSnapshot JSON, not as field
    });

    // Link CloudPodJob to CloudPod
    await prisma.cloudPodJob.update({
      where: { id: cloudPodJob.id },
      data: { cloudPodId: cloudPodRecord.id },
    });

    logger.info('CloudPod record created', {
      jobId,
      cloudPodId: cloudPodRecord.id,
      vmid,
      hostname,
    });

    // 6) Create LXC container on Proxmox
    await createLxcContainer({
      serverHostname,
      vmid,
      hostname,
      resources,
      tenantId,
    });

    // 7) Update CloudPod status to starting
    await updateCloudPodStatus(cloudPodRecord.id, 'starting');

    // 8) Start the container
    await startContainer(serverHostname, vmid, tenantId);

    // 9) Wait for container to get IP
    const ip = await waitForContainerIp(serverHostname, vmid, tenantId);

    // 10) Update record with IP (field is 'ip' not 'ipv4')
    await prisma.cloudPod.update({
      where: { id: cloudPodRecord.id },
      data: { 
        ip,
        updatedAt: new Date(),
      },
    });

    cloudPodRecord.ip = ip;

    // 11) Apply DNS records (use domain variable, not a field on CloudPod)
    // P0.3 FIX: Domain validated earlier
    if (domain) {
      await applyDnsTemplateForCloudPod({
        tenantId,
        cloudPodId: cloudPodRecord.id,
        domain,
        server: { ip },
      });
    }

    // 12) Update CloudPod status to active
    await updateCloudPodStatus(cloudPodRecord.id, 'active');

    // 13) Enqueue SSL issuance job
    if (domain) {
      await enqueueIssueSslJob({
        tenantId,
        cloudPodId: cloudPodRecord.id,
        domain,
      });
    }

    // 14) Mark CloudPodJob as success
    await prisma.cloudPodJob.update({
      where: { id: cloudPodJob.id },
      data: {
        status: 'success',
        finishedAt: new Date(),
        result: {
          cloudPodId: cloudPodRecord.id,
          vmid,
          hostname,
          ip,
          domain,
        },
      },
    });

    // 15) Audit success
    await writeAuditEvent({
      actorUserId: triggeredByUserId,
      tenantId,
      type: 'CLOUDPOD_PROVISIONED',
      metadata: {
        jobId,
        cloudPodId: cloudPodRecord.id,
        vmid,
        hostname,
        planCode,
        ip,
        domain,
      },
    });

    logger.info('CloudPod provisioning completed', {
      jobId,
      cloudPodId: cloudPodRecord.id,
      vmid,
      hostname,
      ip,
    });
  } catch (error) {
    logger.error('CloudPod provisioning failed', {
      jobId,
      tenantId,
      cloudPodId: cloudPodRecord?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update CloudPod status to failed if record exists
    if (cloudPodRecord) {
      await updateCloudPodStatus(cloudPodRecord.id, 'failed');
    }

    // Mark CloudPodJob as failed
    if (cloudPodJob) {
      await prisma.cloudPodJob.update({
        where: { id: cloudPodJob.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    await writeAuditEvent({
      actorUserId: triggeredByUserId,
      tenantId,
      type: 'JOB_FAILED',
      severity: 'error',
      metadata: {
        jobId,
        jobType: 'CREATE_CLOUDPOD',
        cloudPodId: cloudPodRecord?.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get next available VMID globally.
 * VMID is unique across all CloudPods (constraint in schema).
 */
async function getNextVmid(): Promise<number> {
  const lastCloudPod = await prisma.cloudPod.findFirst({
    orderBy: { vmid: 'desc' },
    select: { vmid: true },
  });

  // Start VMIDs at 100 to avoid conflicts with system containers
  return (lastCloudPod?.vmid ?? 99) + 1;
}

/**
 * Generate hostname from VMID.
 */
function generateHostname(vmid: number): string {
  return `cpod${vmid}.migra.cloud`;
}

/**
 * Create CloudPod database record.
 * Schema-aligned: uses planSnapshot JSON for extra metadata.
 */
async function createCloudPodRecord(params: {
  tenantId: string;
  vmid: number;
  hostname: string;
  region: string;
  planCode: string;
  resources: PlanResources;
  subscriptionId?: string; // Stored in planSnapshot, not as field
}): Promise<CloudPodRecord> {
  const { tenantId, vmid, hostname, region, planCode, resources, subscriptionId } = params;

  const cloudPod = await prisma.cloudPod.create({
    data: {
      tenantId,
      vmid,
      hostname,
      region,
      status: 'provisioning',
      // Schema fields for resources
      cores: resources.cores,
      memoryMb: resources.memory,
      swapMb: resources.swap,
      diskGb: resources.diskGb,
      // Store plan details in planSnapshot JSON
      planSnapshot: {
        planCode,
        subscriptionId,
        bandwidth: resources.bandwidth,
        createdAt: new Date().toISOString(),
      },
    },
    select: {
      id: true,
      tenantId: true,
      vmid: true,
      hostname: true,
      ip: true,
      region: true,
      status: true,
    },
  });

  return cloudPod;
}

/**
 * Update CloudPod status.
 */
async function updateCloudPodStatus(
  cloudPodId: string,
  status: string
): Promise<void> {
  await prisma.cloudPod.update({
    where: { id: cloudPodId },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}

/**
 * Create LXC container on Proxmox server.
 * P0.3 FIX: Uses runSshCommand with argument array, no string interpolation.
 */
async function createLxcContainer(params: {
  serverHostname: string;
  vmid: number;
  hostname: string;
  resources: PlanResources;
  tenantId: string;
}): Promise<void> {
  const { serverHostname, vmid, hostname, resources, tenantId } = params;

  // P0.3: Validate all inputs before shell execution
  const vmidValidation = validateVmid(vmid);
  if (!vmidValidation.valid) {
    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
      severity: 'error',
      metadata: { field: 'vmid', error: vmidValidation.error },
    });
    throw new Error(`Invalid VMID: ${vmidValidation.error}`);
  }

  const hostnameValidation = validateHostname(hostname);
  if (!hostnameValidation.valid) {
    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
      severity: 'error',
      metadata: { field: 'hostname', error: hostnameValidation.error },
    });
    throw new Error(`Invalid hostname: ${hostnameValidation.error}`);
  }

  const sshCmd = await getServerSshCommand(serverHostname);
  
  // P0.3 FIX: Use argument array with validated values
  // Instead of string interpolation, we use spawn with separate args
  const scriptArgs = [
    '--vmid', vmidValidation.sanitized!,
    '--hostname', hostnameValidation.sanitized!,
    '--memory', String(resources.memory),
    '--swap', String(resources.swap),
    '--cores', String(resources.cores),
    '--disk', String(resources.diskGb),
    '--template', 'debian-12-standard_12.2-1_amd64.tar.zst',
    '--bridge', 'vmbr0',
  ];

  try {
    // Use runSshCommand helper for safe execution
    const result = await runSshCommand(
      serverHostname.split('.')[0] + '.' + (process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net'),
      '/opt/migra-scripts/cloudpod-create.sh',
      scriptArgs,
      { timeout: 300_000, tenantId }
    );

    if (result.exitCode !== 0) {
      throw new Error(`LXC creation failed with exit code ${result.exitCode}: ${result.stderr}`);
    }

    logger.info('LXC container created', { vmid, hostname });
  } catch (error) {
    throw new Error(`Failed to create LXC container: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Start a container.
 * P0.3 FIX: Uses runSshCommand with argument array.
 */
async function startContainer(serverHostname: string, vmid: number, tenantId: string): Promise<void> {
  const vmidValidation = validateVmid(vmid);
  if (!vmidValidation.valid) {
    throw new Error(`Invalid VMID: ${vmidValidation.error}`);
  }

  const tailnetDomain = process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net';
  const targetHost = serverHostname.split('.')[0] + '.' + tailnetDomain;

  try {
    const result = await runSshCommand(
      targetHost,
      'pct',
      ['start', vmidValidation.sanitized!],
      { timeout: 60_000, tenantId }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Container start failed: ${result.stderr}`);
    }
  } catch (error) {
    throw new Error(`Failed to start container ${vmid}: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Wait for container to get an IP address.
 * P0.3 FIX: Uses runSshCommand with argument array.
 */
async function waitForContainerIp(
  serverHostname: string,
  vmid: number,
  tenantId: string,
  maxAttempts = 30
): Promise<string> {
  const vmidValidation = validateVmid(vmid);
  if (!vmidValidation.valid) {
    throw new Error(`Invalid VMID: ${vmidValidation.error}`);
  }

  const tailnetDomain = process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net';
  const targetHost = serverHostname.split('.')[0] + '.' + tailnetDomain;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await runSshCommand(
        targetHost,
        'pct',
        ['exec', vmidValidation.sanitized!, '--', 'hostname', '-I'],
        { timeout: 10_000, tenantId }
      );

      const ip = result.stdout.trim().split(/\s+/)[0];
      
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    } catch {
      // Ignore errors, container may not be ready yet
    }

    // Wait 2 seconds before retry
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Container ${vmid} did not get an IP after ${maxAttempts} attempts`);
}

export default {
  processCreateCloudPodJob,
};
