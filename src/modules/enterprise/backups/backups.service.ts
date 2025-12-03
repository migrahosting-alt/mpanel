/**
 * ENTERPRISE BACKUPS & DR Service
 * Cron scheduling with retention management
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  BackupPolicy,
  BackupRun,
  RestoreJob,
  CreateBackupPolicyRequest,
  TriggerBackupRequest,
  RestoreBackupRequest,
} from './backups.types.js';

// Policies
export async function listPolicies(actorTenantId: string): Promise<BackupPolicy[]> {
  try {
    // @ts-ignore
    const policies = await prisma.backupPolicy.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return policies;
  } catch {
    return [];
  }
}

export async function createPolicy(
  data: CreateBackupPolicyRequest,
  actorTenantId: string,
  actorId: string
): Promise<BackupPolicy> {
  const { name, resourceType, resourceIds, schedule, backupType, retentionDays } = data;

  // @ts-ignore
  const policy = await prisma.backupPolicy.create({
    data: {
      tenantId: actorTenantId,
      name,
      resourceType,
      resourceIds,
      schedule,
      backupType,
      retentionDays,
      storageConfig: {
        bucket: `tenant-${actorTenantId}-backups`,
        encryption: true,
      },
      isActive: true,
      createdBy: actorId,
    },
  });

  logger.info('Backup policy created', { policyId: policy.id });

  return policy;
}

export async function deletePolicy(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.backupPolicy.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Backup policy deleted', { policyId: id });
}

// Backup Runs
export async function listBackupRuns(actorTenantId: string): Promise<BackupRun[]> {
  try {
    // @ts-ignore
    const runs = await prisma.backupRun.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return runs;
  } catch {
    return [];
  }
}

export async function triggerBackup(
  data: TriggerBackupRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  const { policyId, resourceIds } = data;

  // Verify policy
  // @ts-ignore
  const policy = await prisma.backupPolicy.findFirst({
    where: { id: policyId, tenantId: actorTenantId },
  });

  if (!policy) {
    throw new Error('Backup policy not found');
  }

  // Enqueue backup job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'backup.run',
      status: 'pending',
      payload: {
        policyId,
        resourceIds: resourceIds || policy.resourceIds,
      },
      createdBy: actorId,
    },
  });

  logger.info('Backup triggered', { policyId, jobId: job.id });

  return { jobId: job.id };
}

// Restore
export async function restoreBackup(
  data: RestoreBackupRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ restoreJob: RestoreJob; jobId: string }> {
  const { backupRunId, targetResourceId } = data;

  // Verify backup exists
  // @ts-ignore
  const backupRun = await prisma.backupRun.findFirst({
    where: { id: backupRunId, tenantId: actorTenantId },
  });

  if (!backupRun) {
    throw new Error('Backup not found');
  }

  if (backupRun.status !== 'COMPLETED') {
    throw new Error('Backup is not completed');
  }

  // Create restore job record
  // @ts-ignore
  const restoreJob = await prisma.restoreJob.create({
    data: {
      tenantId: actorTenantId,
      backupRunId,
      targetResourceId: targetResourceId || backupRun.resourceId,
      status: 'PENDING',
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      createdBy: actorId,
    },
  });

  // Enqueue restore job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'backup.restore',
      status: 'pending',
      payload: {
        restoreJobId: restoreJob.id,
        backupRunId,
        targetResourceId,
      },
      createdBy: actorId,
    },
  });

  logger.info('Restore initiated', { restoreJobId: restoreJob.id, jobId: job.id });

  return { restoreJob, jobId: job.id };
}

export async function listRestoreJobs(actorTenantId: string): Promise<RestoreJob[]> {
  try {
    // @ts-ignore
    const jobs = await prisma.restoreJob.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return jobs;
  } catch {
    return [];
  }
}
