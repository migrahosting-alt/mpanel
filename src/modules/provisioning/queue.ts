/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Provisioning Queue - Job queue for infrastructure operations.
 * 
 * All heavy or infra-changing operations must go through this queue:
 * - CloudPod provisioning
 * - DNS updates
 * - SSL certificate issuance
 * - Backups
 */

import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

// ============================================
// TYPES
// ============================================

export interface CreateCloudPodJobPayload {
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  requestedDomain?: string;
  addOns?: string[];
  triggeredByUserId: string;
  source: 'billing_webhook' | 'admin_panel' | 'tenant_portal' | 'api';
}

export interface ScaleCloudPodJobPayload {
  tenantId: string;
  cloudPodId: string;
  newPlanCode: string;
  triggeredByUserId: string;
}

export interface DestroyCloudPodJobPayload {
  tenantId: string;
  cloudPodId: string;
  createFinalBackup: boolean;
  triggeredByUserId: string;
  reason?: string;
}

export interface IssueSslJobPayload {
  tenantId: string;
  cloudPodId: string;
  domain: string;
}

export interface BackupCloudPodJobPayload {
  tenantId: string;
  cloudPodId: string;
  backupType: 'scheduled' | 'manual' | 'pre_destruction';
  triggeredByUserId?: string;
}

export type JobPayload =
  | { type: 'CREATE_CLOUDPOD'; data: CreateCloudPodJobPayload }
  | { type: 'SCALE_CLOUDPOD'; data: ScaleCloudPodJobPayload }
  | { type: 'DESTROY_CLOUDPOD'; data: DestroyCloudPodJobPayload }
  | { type: 'ISSUE_SSL'; data: IssueSslJobPayload }
  | { type: 'BACKUP_CLOUDPOD'; data: BackupCloudPodJobPayload };

export interface Job {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: Date;
}

// ============================================
// QUEUE CONFIGURATION
// ============================================

const JOB_OPTIONS = {
  CREATE_CLOUDPOD: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 10_000 },
    timeout: 600_000, // 10 minutes
    removeOnComplete: true,
    removeOnFail: false,
  },
  SCALE_CLOUDPOD: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5_000 },
    timeout: 300_000, // 5 minutes
    removeOnComplete: true,
    removeOnFail: false,
  },
  DESTROY_CLOUDPOD: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 10_000 },
    timeout: 300_000, // 5 minutes
    removeOnComplete: true,
    removeOnFail: false,
  },
  ISSUE_SSL: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 30_000 },
    timeout: 180_000, // 3 minutes
    removeOnComplete: true,
    removeOnFail: false,
  },
  BACKUP_CLOUDPOD: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 60_000 },
    timeout: 1800_000, // 30 minutes
    removeOnComplete: true,
    removeOnFail: false,
  },
};

// ============================================
// QUEUE FUNCTIONS
// ============================================

/**
 * Get the queue instance.
 * Lazy-loaded to avoid circular dependencies.
 */
async function getQueue() {
  // Import the existing queue service
  const queueService = await import('../../services/queueService.js');
  return queueService.default;
}

/**
 * Generate a unique job ID.
 */
function generateJobId(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Enqueue a CREATE_CLOUDPOD job.
 * 
 * @example
 * const job = await enqueueCreateCloudPodJob({
 *   tenantId: tenant.id,
 *   subscriptionId: subscription.id,
 *   planCode: 'cloudpod-starter',
 *   triggeredByUserId: user.id,
 *   source: 'billing_webhook',
 * });
 */
export async function enqueueCreateCloudPodJob(
  payload: CreateCloudPodJobPayload
): Promise<Job> {
  const jobId = generateJobId('cpod');
  
  logger.info('Enqueueing CREATE_CLOUDPOD job', {
    jobId,
    tenantId: payload.tenantId,
    subscriptionId: payload.subscriptionId,
    planCode: payload.planCode,
  });

  try {
    const queue = await getQueue();
    
    await queue.addProvisioningJob({
      jobId,
      type: 'CREATE_CLOUDPOD',
      ...payload,
      createdAt: new Date().toISOString(),
    });

    await writeAuditEvent({
      actorUserId: payload.triggeredByUserId,
      tenantId: payload.tenantId,
      type: 'JOB_STARTED',
      metadata: {
        jobId,
        jobType: 'CREATE_CLOUDPOD',
        subscriptionId: payload.subscriptionId,
        planCode: payload.planCode,
        source: payload.source,
      },
    });

    return {
      id: jobId,
      name: 'CREATE_CLOUDPOD',
      status: 'queued',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to enqueue CREATE_CLOUDPOD job', {
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Enqueue a SCALE_CLOUDPOD job.
 */
export async function enqueueScaleCloudPodJob(
  payload: ScaleCloudPodJobPayload
): Promise<Job> {
  const jobId = generateJobId('scale');
  
  logger.info('Enqueueing SCALE_CLOUDPOD job', {
    jobId,
    tenantId: payload.tenantId,
    cloudPodId: payload.cloudPodId,
    newPlanCode: payload.newPlanCode,
  });

  const queue = await getQueue();
  
  await queue.addProvisioningJob({
    jobId,
    type: 'SCALE_CLOUDPOD',
    ...payload,
    createdAt: new Date().toISOString(),
  });

  await writeAuditEvent({
    actorUserId: payload.triggeredByUserId,
    tenantId: payload.tenantId,
    type: 'JOB_STARTED',
    metadata: {
      jobId,
      jobType: 'SCALE_CLOUDPOD',
      cloudPodId: payload.cloudPodId,
      newPlanCode: payload.newPlanCode,
    },
  });

  return {
    id: jobId,
    name: 'SCALE_CLOUDPOD',
    status: 'queued',
    createdAt: new Date(),
  };
}

/**
 * Enqueue a DESTROY_CLOUDPOD job.
 */
export async function enqueueDestroyCloudPodJob(
  payload: DestroyCloudPodJobPayload
): Promise<Job> {
  const jobId = generateJobId('destroy');
  
  logger.info('Enqueueing DESTROY_CLOUDPOD job', {
    jobId,
    tenantId: payload.tenantId,
    cloudPodId: payload.cloudPodId,
    createFinalBackup: payload.createFinalBackup,
  });

  const queue = await getQueue();
  
  await queue.addProvisioningJob({
    jobId,
    type: 'DESTROY_CLOUDPOD',
    ...payload,
    createdAt: new Date().toISOString(),
  });

  await writeAuditEvent({
    actorUserId: payload.triggeredByUserId,
    tenantId: payload.tenantId,
    type: 'CLOUDPOD_DESTROY_REQUESTED',
    severity: 'warning',
    metadata: {
      jobId,
      cloudPodId: payload.cloudPodId,
      createFinalBackup: payload.createFinalBackup,
      reason: payload.reason,
    },
  });

  return {
    id: jobId,
    name: 'DESTROY_CLOUDPOD',
    status: 'queued',
    createdAt: new Date(),
  };
}

/**
 * Enqueue an ISSUE_SSL job.
 */
export async function enqueueIssueSslJob(
  payload: IssueSslJobPayload
): Promise<Job> {
  const jobId = generateJobId('ssl');
  
  logger.info('Enqueueing ISSUE_SSL job', {
    jobId,
    tenantId: payload.tenantId,
    cloudPodId: payload.cloudPodId,
    domain: payload.domain,
  });

  const queue = await getQueue();
  
  await queue.addProvisioningJob({
    jobId,
    type: 'ISSUE_SSL',
    ...payload,
    createdAt: new Date().toISOString(),
  });

  await writeAuditEvent({
    actorUserId: null,
    tenantId: payload.tenantId,
    type: 'SSL_ISSUE_REQUESTED',
    metadata: {
      jobId,
      cloudPodId: payload.cloudPodId,
      domain: payload.domain,
    },
  });

  return {
    id: jobId,
    name: 'ISSUE_SSL',
    status: 'queued',
    createdAt: new Date(),
  };
}

/**
 * Enqueue a BACKUP_CLOUDPOD job.
 */
export async function enqueueBackupCloudPodJob(
  payload: BackupCloudPodJobPayload
): Promise<Job> {
  const jobId = generateJobId('backup');
  
  logger.info('Enqueueing BACKUP_CLOUDPOD job', {
    jobId,
    tenantId: payload.tenantId,
    cloudPodId: payload.cloudPodId,
    backupType: payload.backupType,
  });

  const queue = await getQueue();
  
  await queue.addProvisioningJob({
    jobId,
    type: 'BACKUP_CLOUDPOD',
    ...payload,
    createdAt: new Date().toISOString(),
  });

  await writeAuditEvent({
    actorUserId: payload.triggeredByUserId ?? null,
    tenantId: payload.tenantId,
    type: 'CLOUDPOD_BACKUP_STARTED',
    metadata: {
      jobId,
      cloudPodId: payload.cloudPodId,
      backupType: payload.backupType,
    },
  });

  return {
    id: jobId,
    name: 'BACKUP_CLOUDPOD',
    status: 'queued',
    createdAt: new Date(),
  };
}

export default {
  enqueueCreateCloudPodJob,
  enqueueScaleCloudPodJob,
  enqueueDestroyCloudPodJob,
  enqueueIssueSslJob,
  enqueueBackupCloudPodJob,
};
