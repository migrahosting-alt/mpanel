/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Create CloudPod Worker - Provisions new CloudPod containers.
 * 
 * Flow:
 * 1. Select best server
 * 2. Get next available VMID
 * 3. Create LXC container via Proxmox API
 * 4. Configure networking
 * 5. Apply DNS records
 * 6. Update database records
 * 7. Issue SSL certificate
 */

import { prisma } from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';
import { selectServerForCloudPod, getServerSshCommand } from '../serverSelectionService.js';
import { applyDnsTemplateForCloudPod } from '../../dns/dnsService.js';
import { enqueueIssueSslJob } from '../queue.js';
import type { CreateCloudPodJobPayload } from '../queue.js';

// ============================================
// TYPES
// ============================================

interface PlanResources {
  memory: number;   // MB
  swap: number;     // MB
  cpuCores: number;
  diskGb: number;
  bandwidth: number; // Mbps
}

interface CloudPodRecord {
  id: string;
  vmid: number;
  serverId: string;
  hostname: string;
  primaryDomain: string;
  ipv4: string | null;
  status: string;
}

// ============================================
// PLAN RESOURCE MAPPINGS
// ============================================

const PLAN_RESOURCES: Record<string, PlanResources> = {
  'cloudpod-starter': {
    memory: 512,
    swap: 256,
    cpuCores: 1,
    diskGb: 5,
    bandwidth: 100,
  },
  'cloudpod-basic': {
    memory: 1024,
    swap: 512,
    cpuCores: 1,
    diskGb: 10,
    bandwidth: 200,
  },
  'cloudpod-standard': {
    memory: 2048,
    swap: 1024,
    cpuCores: 2,
    diskGb: 20,
    bandwidth: 500,
  },
  'cloudpod-pro': {
    memory: 4096,
    swap: 2048,
    cpuCores: 4,
    diskGb: 40,
    bandwidth: 1000,
  },
  'cloudpod-enterprise': {
    memory: 8192,
    swap: 4096,
    cpuCores: 8,
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

  let cloudPodRecord: CloudPodRecord | null = null;

  try {
    // 1) Get plan resources
    const resources = PLAN_RESOURCES[planCode] ?? DEFAULT_RESOURCES;

    // 2) Select best server
    const server = await selectServerForCloudPod({
      requiredMemoryMb: resources.memory,
      requiredDiskGb: resources.diskGb,
      preferredRegion: null, // TODO: Support region preference
    });

    if (!server) {
      throw new Error('No server available for CloudPod provisioning');
    }

    logger.info('Selected server for CloudPod', {
      jobId,
      serverId: server.id,
      serverHostname: server.hostname,
    });

    // 3) Get next available VMID
    const vmid = await getNextVmid(server.id);

    // 4) Generate hostname
    const hostname = generateHostname(vmid);

    // 5) Create CloudPod database record (PROVISIONING status)
    cloudPodRecord = await createCloudPodRecord({
      tenantId,
      subscriptionId,
      serverId: server.id,
      vmid,
      hostname,
      requestedDomain,
      planCode,
      resources,
    });

    logger.info('CloudPod record created', {
      jobId,
      cloudPodId: cloudPodRecord.id,
      vmid,
      hostname,
    });

    // 6) Create LXC container on Proxmox
    await createLxcContainer({
      serverId: server.id,
      serverHostname: server.hostname,
      vmid,
      hostname,
      resources,
    });

    // 7) Update CloudPod status to STARTING
    await updateCloudPodStatus(cloudPodRecord.id, 'STARTING');

    // 8) Start the container
    await startContainer(server.hostname, vmid);

    // 9) Wait for container to get IP
    const ipv4 = await waitForContainerIp(server.hostname, vmid);

    // 10) Update record with IP
    await prisma.cloudPod.update({
      where: { id: cloudPodRecord.id },
      data: { 
        ipv4,
        updatedAt: new Date(),
      },
    });

    cloudPodRecord.ipv4 = ipv4;

    // 11) Apply DNS records
    if (cloudPodRecord.primaryDomain) {
      await applyDnsTemplateForCloudPod({
        cloudPodId: cloudPodRecord.id,
        domain: cloudPodRecord.primaryDomain,
        ipv4,
      });
    }

    // 12) Update CloudPod status to RUNNING
    await updateCloudPodStatus(cloudPodRecord.id, 'RUNNING');

    // 13) Enqueue SSL issuance job
    if (cloudPodRecord.primaryDomain) {
      await enqueueIssueSslJob({
        tenantId,
        cloudPodId: cloudPodRecord.id,
        domain: cloudPodRecord.primaryDomain,
      });
    }

    // 14) Audit success
    await writeAuditEvent({
      actorUserId: triggeredByUserId,
      tenantId,
      type: 'CLOUDPOD_PROVISIONED',
      metadata: {
        jobId,
        cloudPodId: cloudPodRecord.id,
        vmid,
        hostname,
        serverId: server.id,
        planCode,
        ipv4,
      },
    });

    logger.info('CloudPod provisioning completed', {
      jobId,
      cloudPodId: cloudPodRecord.id,
      vmid,
      hostname,
      ipv4,
    });
  } catch (error) {
    logger.error('CloudPod provisioning failed', {
      jobId,
      tenantId,
      cloudPodId: cloudPodRecord?.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update CloudPod status to FAILED if record exists
    if (cloudPodRecord) {
      await updateCloudPodStatus(cloudPodRecord.id, 'FAILED');
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
 * Get next available VMID for a server.
 */
async function getNextVmid(serverId: string): Promise<number> {
  const lastCloudPod = await prisma.cloudPod.findFirst({
    where: { serverId },
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
 */
async function createCloudPodRecord(params: {
  tenantId: string;
  subscriptionId: string;
  serverId: string;
  vmid: number;
  hostname: string;
  requestedDomain?: string;
  planCode: string;
  resources: PlanResources;
}): Promise<CloudPodRecord> {
  const { tenantId, subscriptionId, serverId, vmid, hostname, requestedDomain, planCode, resources } = params;

  const cloudPod = await prisma.cloudPod.create({
    data: {
      tenantId,
      subscriptionId,
      serverId,
      vmid,
      hostname,
      primaryDomain: requestedDomain ?? hostname,
      planCode,
      status: 'PROVISIONING',
      memoryMb: resources.memory,
      swapMb: resources.swap,
      cpuCores: resources.cpuCores,
      diskGb: resources.diskGb,
      bandwidthMbps: resources.bandwidth,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    select: {
      id: true,
      vmid: true,
      serverId: true,
      hostname: true,
      primaryDomain: true,
      ipv4: true,
      status: true,
    },
  });

  return cloudPod as CloudPodRecord;
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
 */
async function createLxcContainer(params: {
  serverId: string;
  serverHostname: string;
  vmid: number;
  hostname: string;
  resources: PlanResources;
}): Promise<void> {
  const { serverHostname, vmid, hostname, resources } = params;

  const sshCmd = await getServerSshCommand(serverHostname);
  
  // Use the cloudpod-create.sh script
  const createCommand = `
    cd /opt/migra-scripts && \\
    ./cloudpod-create.sh \\
      --vmid ${vmid} \\
      --hostname ${hostname} \\
      --memory ${resources.memory} \\
      --swap ${resources.swap} \\
      --cores ${resources.cpuCores} \\
      --disk ${resources.diskGb} \\
      --template debian-12-standard_12.2-1_amd64.tar.zst \\
      --bridge vmbr0
  `.trim();

  const { execSync } = await import('child_process');

  try {
    execSync(`${sshCmd} '${createCommand}'`, {
      timeout: 300_000, // 5 minutes
      encoding: 'utf-8',
    });
  } catch (error) {
    throw new Error(`Failed to create LXC container: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Start a container.
 */
async function startContainer(serverHostname: string, vmid: number): Promise<void> {
  const sshCmd = await getServerSshCommand(serverHostname);
  const { execSync } = await import('child_process');

  try {
    execSync(`${sshCmd} 'pct start ${vmid}'`, {
      timeout: 60_000,
      encoding: 'utf-8',
    });
  } catch (error) {
    throw new Error(`Failed to start container ${vmid}: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Wait for container to get an IP address.
 */
async function waitForContainerIp(
  serverHostname: string,
  vmid: number,
  maxAttempts = 30
): Promise<string> {
  const sshCmd = await getServerSshCommand(serverHostname);
  const { execSync } = await import('child_process');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const output = execSync(
        `${sshCmd} 'pct exec ${vmid} -- hostname -I 2>/dev/null || echo ""'`,
        { timeout: 10_000, encoding: 'utf-8' }
      );

      const ip = output.trim().split(/\s+/)[0];
      
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
