/**
 * CloudPod Quota Engine
 * 
 * Manages tenant quota enforcement for CloudPods.
 * Checks capacity before create/scale operations and updates usage after operations complete.
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 9
 */

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

const ACTIVE_STATUSES = ['provisioning', 'active'];

export const DEFAULT_TENANT_QUOTA = {
  max_pods: 2,
  max_cpu_cores: 4,
  max_memory_mb: 8192,
  max_disk_gb: 200,
};

export interface TenantQuotaLimits {
  max_pods: number;
  max_cpu_cores: number;
  max_memory_mb: number;
  max_disk_gb: number;
}

export interface TenantQuotaUsage {
  pods: number;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}

export interface TenantQuotaCheckRequest {
  tenantId: string;
  requested: {
    pods?: number;
    cpuCores?: number;
    memoryMb?: number;
    diskGb?: number;
  };
}

export interface TenantQuotaCheckResult {
  allowed: boolean;
  message?: string;
  details: {
    max_pods: number;
    current_pods: number;
    requested_pods: number;
    max_cpu_cores: number;
    current_cpu_cores: number;
    requested_cpu_cores: number;
    max_memory_mb: number;
    current_memory_mb: number;
    requested_memory_mb: number;
    max_disk_gb: number;
    current_disk_gb: number;
    requested_disk_gb: number;
    error_field?: string;
    error_code?: string;
  };
}

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

export async function getTenantQuota(tenantId: string): Promise<TenantQuotaLimits> {
  if (!tenantId) {
    throw new Error('getTenantQuota: tenantId is required');
  }

  const quota = await prisma.cloudPodQuota.findUnique({
    where: { tenantId },
  });

  if (!quota) {
    logger.info(`[cloudPodQuotas] No quota row for tenant ${tenantId}, using defaults`);
    return { ...DEFAULT_TENANT_QUOTA };
  }

  return {
    max_pods: quota.maxCloudPods ?? DEFAULT_TENANT_QUOTA.max_pods,
    max_cpu_cores: quota.maxCpuCores ?? DEFAULT_TENANT_QUOTA.max_cpu_cores,
    max_memory_mb: quota.maxRamMb ?? DEFAULT_TENANT_QUOTA.max_memory_mb,
    max_disk_gb: quota.maxDiskGb ?? DEFAULT_TENANT_QUOTA.max_disk_gb,
  };
}

export async function getTenantUsage(tenantId: string): Promise<TenantQuotaUsage> {
  if (!tenantId) {
    throw new Error('getTenantUsage: tenantId is required');
  }

  const pods = await prisma.cloudPod.findMany({
    where: {
      tenantId,
      status: { in: ACTIVE_STATUSES },
      deletedAt: null,
    },
    select: {
      cores: true,
      memoryMb: true,
      diskGb: true,
    },
  });

  return pods.reduce<TenantQuotaUsage>(
    (acc, pod) => ({
      pods: acc.pods + 1,
      cpuCores: acc.cpuCores + Number(pod.cores || 0),
      memoryMb: acc.memoryMb + Number(pod.memoryMb || 0),
      diskGb: acc.diskGb + Number(pod.diskGb || 0),
    }),
    { pods: 0, cpuCores: 0, memoryMb: 0, diskGb: 0 }
  );
}

export async function checkTenantQuota(
  params: TenantQuotaCheckRequest
): Promise<TenantQuotaCheckResult> {
  const { tenantId, requested } = params;

  if (!tenantId) {
    throw new Error('checkTenantQuota: tenantId is required');
  }

  if (!requested) {
    throw new Error('checkTenantQuota: requested resources are required');
  }

  const reqPods = Number(requested.pods || 0);
  const reqCpu = Number(requested.cpuCores || 0);
  const reqMem = Number(requested.memoryMb || 0);
  const reqDisk = Number(requested.diskGb || 0);

  const limits = await getTenantQuota(tenantId);
  const usage = await getTenantUsage(tenantId);

  const result: TenantQuotaCheckResult = {
    allowed: true,
    message: '',
    details: {
      max_pods: limits.max_pods,
      current_pods: usage.pods,
      requested_pods: reqPods,
      max_cpu_cores: limits.max_cpu_cores,
      current_cpu_cores: usage.cpuCores,
      requested_cpu_cores: reqCpu,
      max_memory_mb: limits.max_memory_mb,
      current_memory_mb: usage.memoryMb,
      requested_memory_mb: reqMem,
      max_disk_gb: limits.max_disk_gb,
      current_disk_gb: usage.diskGb,
      requested_disk_gb: reqDisk,
    },
  };

  const deny = (field: string, code: string, msg: string) => {
    result.allowed = false;
    result.message = msg;
    result.details.error_field = field;
    result.details.error_code = code;
  };

  if (limits.max_pods >= 0 && usage.pods + reqPods > limits.max_pods) {
    deny('pods', 'MAX_PODS_EXCEEDED', 'You have reached the maximum number of CloudPods for your account.');
    return result;
  }

  if (limits.max_cpu_cores >= 0 && usage.cpuCores + reqCpu > limits.max_cpu_cores) {
    deny('cpu_cores', 'MAX_CPU_EXCEEDED', 'You do not have enough CPU quota to create or scale this CloudPod.');
    return result;
  }

  if (limits.max_memory_mb >= 0 && usage.memoryMb + reqMem > limits.max_memory_mb) {
    deny('memory_mb', 'MAX_MEMORY_EXCEEDED', 'You do not have enough RAM quota to create or scale this CloudPod.');
    return result;
  }

  if (limits.max_disk_gb >= 0 && usage.diskGb + reqDisk > limits.max_disk_gb) {
    deny('disk_gb', 'MAX_DISK_EXCEEDED', 'You do not have enough disk quota to create or scale this CloudPod.');
    return result;
  }

  logger.info(`[cloudPodQuotas] Quota check passed for tenant ${tenantId}`, {
    limits,
    usage,
    requested: { pods: reqPods, cpuCores: reqCpu, memoryMb: reqMem, diskGb: reqDisk },
  });

  return result;
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
  const result = await checkTenantQuota({
    tenantId,
    requested: {
      pods: 1,
      cpuCores: cores,
      memoryMb: ramMb,
      diskGb,
    },
  });

  return {
    allowed: result.allowed,
    reason: result.message,
    current: {
      cloudPods: result.details.current_pods,
      cpuCores: result.details.current_cpu_cores,
      ramMb: result.details.current_memory_mb,
      diskGb: result.details.current_disk_gb,
    },
    limits: {
      maxCloudPods: result.details.max_pods,
      maxCpuCores: result.details.max_cpu_cores,
      maxRamMb: result.details.max_memory_mb,
      maxDiskGb: result.details.max_disk_gb,
    },
    requested: {
      cpuCores: cores,
      ramMb,
      diskGb,
    },
  };
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
  const coresDelta = Math.max(0, newCores - currentCores);
  const ramDelta = Math.max(0, newRamMb - currentRamMb);

  const result = await checkTenantQuota({
    tenantId,
    requested: {
      pods: 0,
      cpuCores: coresDelta,
      memoryMb: ramDelta,
      diskGb: 0,
    },
  });

  return {
    allowed: result.allowed,
    reason: result.message,
    current: {
      cloudPods: result.details.current_pods,
      cpuCores: result.details.current_cpu_cores,
      ramMb: result.details.current_memory_mb,
      diskGb: result.details.current_disk_gb,
    },
    limits: {
      maxCloudPods: result.details.max_pods,
      maxCpuCores: result.details.max_cpu_cores,
      maxRamMb: result.details.max_memory_mb,
      maxDiskGb: result.details.max_disk_gb,
    },
    requested: {
      cpuCores: newCores,
      ramMb: newRamMb,
      diskGb: 0,
    },
  };
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

export async function ensureTenantHasCapacity(tenantId: string, cores: number, memoryMb: number) {
  const result = await checkCreateCapacity(tenantId, cores, memoryMb);
  return result.allowed;
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
