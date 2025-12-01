/**
 * CloudPod Quota Engine
 * 
 * Manages tenant quota enforcement for CloudPods.
 * Checks capacity before create/scale operations and updates usage after operations complete.
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 9
 */

import { prisma } from '../config/database.js';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  current: {
    cloudPods: number;
    cpuCores: number;
    ramMb: number;
    diskGb: number;
  };
  limits: {
    maxCloudPods: number;
    maxCpuCores: number;
    maxRamMb: number;
    maxDiskGb: number;
  };
  requested?: {
    cpuCores: number;
    ramMb: number;
    diskGb: number;
  };
}

/**
 * Get or create quota record for a tenant
 * If no quota exists, creates one with default limits
 */
export async function getOrCreateQuota(tenantId: string) {
  let quota = await prisma.cloudPodQuota.findUnique({
    where: { tenantId },
  });

  if (!quota) {
    // Create default quota
    quota = await prisma.cloudPodQuota.create({
      data: {
        tenantId,
        maxCloudPods: 5,
        maxCpuCores: 8,
        maxRamMb: 16384,
        maxDiskGb: 100,
        usedCloudPods: 0,
        usedCpuCores: 0,
        usedRamMb: 0,
        usedDiskGb: 0,
      },
    });
  }

  return quota;
}

/**
 * Check if tenant has capacity for a new CloudPod
 */
export async function checkCreateCapacity(
  tenantId: string,
  cores: number,
  ramMb: number,
  diskGb: number = 8
): Promise<QuotaCheckResult> {
  const quota = await getOrCreateQuota(tenantId);

  const result: QuotaCheckResult = {
    allowed: true,
    current: {
      cloudPods: quota.usedCloudPods,
      cpuCores: quota.usedCpuCores,
      ramMb: quota.usedRamMb,
      diskGb: quota.usedDiskGb,
    },
    limits: {
      maxCloudPods: quota.maxCloudPods,
      maxCpuCores: quota.maxCpuCores,
      maxRamMb: quota.maxRamMb,
      maxDiskGb: quota.maxDiskGb,
    },
    requested: {
      cpuCores: cores,
      ramMb,
      diskGb,
    },
  };

  // Check each limit
  if (quota.usedCloudPods + 1 > quota.maxCloudPods) {
    result.allowed = false;
    result.reason = `CloudPod limit reached: ${quota.usedCloudPods}/${quota.maxCloudPods}`;
    return result;
  }

  if (quota.usedCpuCores + cores > quota.maxCpuCores) {
    result.allowed = false;
    result.reason = `CPU cores limit would be exceeded: ${quota.usedCpuCores + cores}/${quota.maxCpuCores}`;
    return result;
  }

  if (quota.usedRamMb + ramMb > quota.maxRamMb) {
    result.allowed = false;
    result.reason = `RAM limit would be exceeded: ${quota.usedRamMb + ramMb}/${quota.maxRamMb} MB`;
    return result;
  }

  if (quota.usedDiskGb + diskGb > quota.maxDiskGb) {
    result.allowed = false;
    result.reason = `Disk limit would be exceeded: ${quota.usedDiskGb + diskGb}/${quota.maxDiskGb} GB`;
    return result;
  }

  return result;
}

/**
 * Check if tenant has capacity for scaling a CloudPod
 */
export async function checkScaleCapacity(
  tenantId: string,
  currentCores: number,
  currentRamMb: number,
  newCores: number,
  newRamMb: number
): Promise<QuotaCheckResult> {
  const quota = await getOrCreateQuota(tenantId);

  // Calculate delta
  const coresDelta = newCores - currentCores;
  const ramDelta = newRamMb - currentRamMb;

  const result: QuotaCheckResult = {
    allowed: true,
    current: {
      cloudPods: quota.usedCloudPods,
      cpuCores: quota.usedCpuCores,
      ramMb: quota.usedRamMb,
      diskGb: quota.usedDiskGb,
    },
    limits: {
      maxCloudPods: quota.maxCloudPods,
      maxCpuCores: quota.maxCpuCores,
      maxRamMb: quota.maxRamMb,
      maxDiskGb: quota.maxDiskGb,
    },
    requested: {
      cpuCores: newCores,
      ramMb: newRamMb,
      diskGb: 0,
    },
  };

  // Only check if increasing
  if (coresDelta > 0 && quota.usedCpuCores + coresDelta > quota.maxCpuCores) {
    result.allowed = false;
    result.reason = `CPU cores limit would be exceeded: ${quota.usedCpuCores + coresDelta}/${quota.maxCpuCores}`;
    return result;
  }

  if (ramDelta > 0 && quota.usedRamMb + ramDelta > quota.maxRamMb) {
    result.allowed = false;
    result.reason = `RAM limit would be exceeded: ${quota.usedRamMb + ramDelta}/${quota.maxRamMb} MB`;
    return result;
  }

  return result;
}

/**
 * Increment quota usage after successful create
 */
export async function incrementUsage(
  tenantId: string,
  cores: number,
  ramMb: number,
  diskGb: number = 8
) {
  return prisma.cloudPodQuota.update({
    where: { tenantId },
    data: {
      usedCloudPods: { increment: 1 },
      usedCpuCores: { increment: cores },
      usedRamMb: { increment: ramMb },
      usedDiskGb: { increment: diskGb },
    },
  });
}

/**
 * Decrement quota usage after successful destroy
 */
export async function decrementUsage(
  tenantId: string,
  cores: number,
  ramMb: number,
  diskGb: number = 8
) {
  const quota = await getOrCreateQuota(tenantId);

  // Ensure we don't go negative
  return prisma.cloudPodQuota.update({
    where: { tenantId },
    data: {
      usedCloudPods: { decrement: Math.min(1, quota.usedCloudPods) },
      usedCpuCores: { decrement: Math.min(cores, quota.usedCpuCores) },
      usedRamMb: { decrement: Math.min(ramMb, quota.usedRamMb) },
      usedDiskGb: { decrement: Math.min(diskGb, quota.usedDiskGb) },
    },
  });
}

/**
 * Update quota usage after scaling
 */
export async function updateUsageAfterScale(
  tenantId: string,
  currentCores: number,
  currentRamMb: number,
  newCores: number,
  newRamMb: number
) {
  const coresDelta = newCores - currentCores;
  const ramDelta = newRamMb - currentRamMb;

  if (coresDelta === 0 && ramDelta === 0) {
    return; // No change
  }

  return prisma.cloudPodQuota.update({
    where: { tenantId },
    data: {
      usedCpuCores: { increment: coresDelta },
      usedRamMb: { increment: ramDelta },
    },
  });
}

/**
 * Recalculate quota usage from actual CloudPods
 * Use this to fix any discrepancies
 */
export async function recalculateUsage(tenantId: string) {
  const pods = await prisma.cloudPod.findMany({
    where: {
      tenantId,
      status: { in: ['active', 'provisioning'] },
      deletedAt: null,
    },
    select: {
      cores: true,
      memoryMb: true,
      diskGb: true,
    },
  });

  const usage = pods.reduce(
    (acc, pod) => ({
      cloudPods: acc.cloudPods + 1,
      cpuCores: acc.cpuCores + pod.cores,
      ramMb: acc.ramMb + pod.memoryMb,
      diskGb: acc.diskGb + pod.diskGb,
    }),
    { cloudPods: 0, cpuCores: 0, ramMb: 0, diskGb: 0 }
  );

  return prisma.cloudPodQuota.update({
    where: { tenantId },
    data: {
      usedCloudPods: usage.cloudPods,
      usedCpuCores: usage.cpuCores,
      usedRamMb: usage.ramMb,
      usedDiskGb: usage.diskGb,
    },
  });
}

/**
 * Set quota limits for a tenant (e.g., when upgrading plan)
 */
export async function setQuotaLimits(
  tenantId: string,
  limits: {
    maxCloudPods?: number;
    maxCpuCores?: number;
    maxRamMb?: number;
    maxDiskGb?: number;
  }
) {
  return prisma.cloudPodQuota.upsert({
    where: { tenantId },
    create: {
      tenantId,
      maxCloudPods: limits.maxCloudPods ?? 5,
      maxCpuCores: limits.maxCpuCores ?? 8,
      maxRamMb: limits.maxRamMb ?? 16384,
      maxDiskGb: limits.maxDiskGb ?? 100,
    },
    update: {
      ...(limits.maxCloudPods !== undefined && { maxCloudPods: limits.maxCloudPods }),
      ...(limits.maxCpuCores !== undefined && { maxCpuCores: limits.maxCpuCores }),
      ...(limits.maxRamMb !== undefined && { maxRamMb: limits.maxRamMb }),
      ...(limits.maxDiskGb !== undefined && { maxDiskGb: limits.maxDiskGb }),
    },
  });
}

/**
 * Get quota summary for a tenant
 */
export async function getQuotaSummary(tenantId: string) {
  const quota = await getOrCreateQuota(tenantId);

  return {
    tenant: tenantId,
    limits: {
      cloudPods: quota.maxCloudPods,
      cpuCores: quota.maxCpuCores,
      ramMb: quota.maxRamMb,
      diskGb: quota.maxDiskGb,
    },
    used: {
      cloudPods: quota.usedCloudPods,
      cpuCores: quota.usedCpuCores,
      ramMb: quota.usedRamMb,
      diskGb: quota.usedDiskGb,
    },
    available: {
      cloudPods: quota.maxCloudPods - quota.usedCloudPods,
      cpuCores: quota.maxCpuCores - quota.usedCpuCores,
      ramMb: quota.maxRamMb - quota.usedRamMb,
      diskGb: quota.maxDiskGb - quota.usedDiskGb,
    },
    percentUsed: {
      cloudPods: Math.round((quota.usedCloudPods / quota.maxCloudPods) * 100),
      cpuCores: Math.round((quota.usedCpuCores / quota.maxCpuCores) * 100),
      ramMb: Math.round((quota.usedRamMb / quota.maxRamMb) * 100),
      diskGb: Math.round((quota.usedDiskGb / quota.maxDiskGb) * 100),
    },
  };
}
