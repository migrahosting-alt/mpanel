/**
 * CloudPods Backup Service
 * Scheduled backups and snapshot management for CloudPods
 */

import { PrismaClient } from '@prisma/client';
import { CloudPodsAuditService } from './cloudPodsAuditService';
import type { BackupPolicyInput, BackupResult, BackupType, CloudPodAuditContext } from './cloudPodsEnterpriseTypes';

const prisma = new PrismaClient();

/**
 * List backup policies for a pod
 */
export async function listPoliciesForPod(podId: string) {
  return prisma.cloudPodBackupPolicy.findMany({
    where: { podId },
    include: {
      backups: {
        orderBy: { createdAt: 'desc' },
        take: 5, // Include last 5 backups
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * List all backup policies for a tenant
 */
export async function listPoliciesForTenant(tenantId: string) {
  return prisma.cloudPodBackupPolicy.findMany({
    where: { tenantId },
    include: {
      backups: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a backup policy by ID
 */
export async function getPolicy(id: string) {
  return prisma.cloudPodBackupPolicy.findUnique({
    where: { id },
    include: { backups: true },
  });
}

/**
 * Create a new backup policy
 */
export async function createPolicy(
  input: BackupPolicyInput,
  auditCtx?: CloudPodAuditContext
) {
  const policy = await prisma.cloudPodBackupPolicy.create({
    data: {
      tenantId: input.tenantId,
      podId: input.podId,
      name: input.name,
      schedule: input.schedule,
      retentionCount: input.retentionCount ?? 7,
      type: input.type,
      isActive: input.isActive ?? true,
    },
  });

  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'BACKUP_POLICY_CREATED',
      category: 'backup',
      ctx: { ...auditCtx, podId: input.podId },
      details: { policyId: policy.id, name: input.name, schedule: input.schedule },
    });
  }

  return policy;
}

/**
 * Update a backup policy
 */
export async function updatePolicy(
  id: string,
  input: Partial<BackupPolicyInput>,
  auditCtx?: CloudPodAuditContext
) {
  const policy = await prisma.cloudPodBackupPolicy.update({
    where: { id },
    data: {
      name: input.name,
      schedule: input.schedule,
      retentionCount: input.retentionCount,
      type: input.type,
      isActive: input.isActive,
    },
  });

  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'BACKUP_POLICY_UPDATED',
      category: 'backup',
      ctx: auditCtx,
      details: { policyId: id, changes: input },
    });
  }

  return policy;
}

/**
 * Delete a backup policy
 */
export async function deletePolicy(
  id: string,
  auditCtx?: CloudPodAuditContext
) {
  const policy = await prisma.cloudPodBackupPolicy.delete({
    where: { id },
  });

  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'BACKUP_POLICY_DELETED',
      category: 'backup',
      ctx: auditCtx,
      details: { policyId: id, name: policy.name },
    });
  }

  return { success: true };
}

/**
 * Trigger a backup for a pod
 */
export async function triggerBackup(
  podId: string,
  tenantId: string,
  policyId: string | undefined,
  backupType: BackupType,
  sshExec: (node: string, cmd: string) => Promise<string>,
  auditCtx?: CloudPodAuditContext
): Promise<BackupResult> {
  // Get pod info
  const pod = await prisma.cloudPod.findUnique({
    where: { id: podId },
    select: { vmid: true, pveNode: true },
  });

  if (!pod || !pod.vmid || !pod.pveNode) {
    throw new Error('Pod not found or missing VM info');
  }

  const { vmid, pveNode } = pod;
  const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
  const snapshotName = `backup_${timestamp}`;

  // Create backup record
  const backup = await prisma.cloudPodBackup.create({
    data: {
      podId,
      policyId,
      backupType,
      location: snapshotName,
      status: 'pending',
    },
  });

  try {
    // Update status to running
    await prisma.cloudPodBackup.update({
      where: { id: backup.id },
      data: { status: 'running' },
    });

    if (backupType === 'snapshot') {
      // Create Proxmox snapshot
      const cmd = `qm snapshot ${vmid} ${snapshotName} --description "Automated backup"`;
      await sshExec(pveNode, cmd);
    } else {
      // Full backup to vzdump
      const cmd = `vzdump ${vmid} --compress zstd --mode snapshot --storage local`;
      await sshExec(pveNode, cmd);
    }

    // Get snapshot size (approximate)
    let sizeGb: number | undefined;
    try {
      const sizeCmd = `qm config ${vmid} | grep -E "^(virtio|scsi|ide|sata)0:" | grep -oP 'size=\\K[0-9]+' | head -1`;
      const sizeResult = await sshExec(pveNode, sizeCmd);
      sizeGb = Number(sizeResult.trim()) || undefined;
    } catch {
      // Size estimation failed, not critical
    }

    // Update backup as completed
    const completedBackup = await prisma.cloudPodBackup.update({
      where: { id: backup.id },
      data: {
        status: 'completed',
        sizeGb,
        completedAt: new Date(),
      },
    });

    // Audit log
    if (auditCtx) {
      await CloudPodsAuditService.log({
        action: 'BACKUP_CREATED',
        category: 'backup',
        ctx: { ...auditCtx, podId, vmid },
        details: { backupId: backup.id, type: backupType, snapshotName, sizeGb },
      });
    }

    return {
      id: completedBackup.id,
      podId: completedBackup.podId,
      policyId: completedBackup.policyId || undefined,
      backupType: completedBackup.backupType as BackupType,
      location: completedBackup.location,
      status: 'completed',
      sizeGb: completedBackup.sizeGb || undefined,
      createdAt: completedBackup.createdAt,
      completedAt: completedBackup.completedAt || undefined,
    };
  } catch (err) {
    // Update backup as failed
    await prisma.cloudPodBackup.update({
      where: { id: backup.id },
      data: {
        status: 'failed',
        errorMessage: String(err),
      },
    });

    throw err;
  }
}

/**
 * Restore from a backup
 */
export async function restoreBackup(
  backupId: string,
  sshExec: (node: string, cmd: string) => Promise<string>,
  auditCtx?: CloudPodAuditContext
): Promise<{ success: boolean }> {
  const backup = await prisma.cloudPodBackup.findUnique({
    where: { id: backupId },
  });

  if (!backup || backup.status !== 'completed') {
    throw new Error('Backup not found or not completed');
  }

  const pod = await prisma.cloudPod.findUnique({
    where: { id: backup.podId },
    select: { id: true, vmid: true, pveNode: true, tenantId: true },
  });

  if (!pod || !pod.vmid || !pod.pveNode) {
    throw new Error('Pod not found or missing VM info');
  }

  const { vmid, pveNode } = pod;

  if (backup.backupType === 'snapshot') {
    // Rollback to snapshot
    const cmd = `qm rollback ${vmid} ${backup.location}`;
    await sshExec(pveNode, cmd);
  } else {
    // Full restore would require more complex logic
    throw new Error('Full backup restore not implemented - use Proxmox GUI');
  }

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'BACKUP_RESTORED',
      category: 'backup',
      ctx: { ...auditCtx, podId: backup.podId, vmid },
      details: { backupId, snapshotName: backup.location },
    });
  }

  return { success: true };
}

/**
 * Delete a backup
 */
export async function deleteBackup(
  backupId: string,
  sshExec: (node: string, cmd: string) => Promise<string>,
  auditCtx?: CloudPodAuditContext
): Promise<{ success: boolean }> {
  const backup = await prisma.cloudPodBackup.findUnique({
    where: { id: backupId },
  });

  if (!backup) {
    throw new Error('Backup not found');
  }

  const pod = await prisma.cloudPod.findUnique({
    where: { id: backup.podId },
    select: { vmid: true, pveNode: true },
  });

  if (!pod || !pod.vmid || !pod.pveNode) {
    throw new Error('Pod not found or missing VM info');
  }

  if (backup.backupType === 'snapshot') {
    // Delete Proxmox snapshot
    const cmd = `qm delsnapshot ${pod.vmid} ${backup.location}`;
    await sshExec(pod.pveNode, cmd);
  }

  // Delete backup record
  await prisma.cloudPodBackup.delete({
    where: { id: backupId },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'BACKUP_DELETED',
      category: 'backup',
      ctx: { ...auditCtx, podId: backup.podId, vmid: pod.vmid },
      details: { backupId, snapshotName: backup.location },
    });
  }

  return { success: true };
}

/**
 * Enforce retention policy - delete old backups
 */
export async function enforceRetention(
  policyId: string,
  sshExec: (node: string, cmd: string) => Promise<string>
): Promise<number> {
  const policy = await prisma.cloudPodBackupPolicy.findUnique({
    where: { id: policyId },
    include: {
      backups: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!policy) {
    throw new Error('Policy not found');
  }

  // Get backups exceeding retention
  const backupsToDelete = policy.backups.slice(policy.retentionCount);
  let deletedCount = 0;

  for (const backup of backupsToDelete) {
    try {
      await deleteBackup(backup.id, sshExec);
      deletedCount++;
    } catch (err) {
      console.error(`Failed to delete backup ${backup.id}:`, err);
    }
  }

  return deletedCount;
}

/**
 * List backups for a pod
 */
export async function listBackupsForPod(podId: string) {
  return prisma.cloudPodBackup.findMany({
    where: { podId },
    orderBy: { createdAt: 'desc' },
    include: { policy: true },
  });
}

/**
 * Get policies that need to run based on schedule
 */
export async function getPoliciesDueForBackup(): Promise<Array<{ id: string; podId: string | null; schedule: string }>> {
  // This is a simplified version - in production you'd want a proper cron parser
  const activePolicies = await prisma.cloudPodBackupPolicy.findMany({
    where: { isActive: true },
    select: { id: true, podId: true, schedule: true },
  });

  // Filter based on schedule - for now, return all active policies
  // In production, compare schedule against current time
  return activePolicies;
}

export const CloudPodsBackupService = {
  listPoliciesForPod,
  listPoliciesForTenant,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  triggerBackup,
  restoreBackup,
  deleteBackup,
  enforceRetention,
  listBackupsForPod,
  getPoliciesDueForBackup,
};

export default CloudPodsBackupService;
