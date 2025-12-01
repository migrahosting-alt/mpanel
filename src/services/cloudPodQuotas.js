// src/services/cloudPodQuotas.js
// ============================================================================
// CloudPod Quota Service - Real Implementation
// 
// Enforces per-tenant resource limits before creating or scaling CloudPods.
// Uses Prisma for database access.
// ============================================================================

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';

// Default quota if no row exists in cloud_pod_quotas for a tenant
export const DEFAULT_TENANT_QUOTA = {
  max_pods: 2,
  max_cpu_cores: 4,
  max_memory_mb: 8192, // 8 GB
  max_disk_gb: 200,
};

// Active statuses that count toward usage
const ACTIVE_STATUSES = ['provisioning', 'active'];

/**
 * Load quota limits for a tenant.
 * If none exists, return DEFAULT_TENANT_QUOTA.
 * 
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<{max_pods: number, max_cpu_cores: number, max_memory_mb: number, max_disk_gb: number}>}
 */
export async function getTenantQuota(tenantId) {
  if (!tenantId) {
    throw new Error('getTenantQuota: tenantId is required');
  }

  try {
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
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to load tenant quota, falling back to defaults');
    return { ...DEFAULT_TENANT_QUOTA };
  }
}

/**
 * Compute current resource usage for a tenant from cloud_pods.
 * Only counts pods in active-ish states (provisioning, active).
 * 
 * @param {string} tenantId - UUID of the tenant
 * @returns {Promise<{pods: number, cpuCores: number, memoryMb: number, diskGb: number}>}
 */
export async function getTenantUsage(tenantId) {
  if (!tenantId) {
    throw new Error('getTenantUsage: tenantId is required');
  }

  try {
    const pods = await prisma.cloudPod.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_STATUSES },
      },
      select: {
        cores: true,
        memoryMb: true,
        diskGb: true,
      },
    });

    let podCount = 0;
    let cpuCores = 0;
    let memoryMb = 0;
    let diskGb = 0;

    for (const pod of pods) {
      podCount += 1;
      cpuCores += Number(pod.cores || 0);
      memoryMb += Number(pod.memoryMb || 0);
      diskGb += Number(pod.diskGb || 0);
    }

    return {
      pods: podCount,
      cpuCores,
      memoryMb,
      diskGb,
    };
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to compute tenant usage, treating as zero');
    // On error, treat as no usage so we don't accidentally block everyone
    return {
      pods: 0,
      cpuCores: 0,
      memoryMb: 0,
      diskGb: 0,
    };
  }
}

/**
 * Check if the requested additional resources fit within the tenant quota.
 *
 * @param {Object} params
 * @param {string} params.tenantId - UUID of the tenant
 * @param {Object} params.requested - additional resources requested
 * @param {number} params.requested.pods - number of pods (usually 1 when creating)
 * @param {number} params.requested.cpuCores - CPU cores requested
 * @param {number} params.requested.memoryMb - RAM in MB requested
 * @param {number} params.requested.diskGb - Disk in GB requested
 *
 * @returns {Promise<{allowed: boolean, message?: string, details?: Object}>}
 */
export async function checkTenantQuota({ tenantId, requested }) {
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

  const result = {
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

  // Helper to set failure state
  const deny = (field, code, msg) => {
    result.allowed = false;
    result.message = msg;
    result.details.error_field = field;
    result.details.error_code = code;
  };

  // Pods
  if (limits.max_pods >= 0 && usage.pods + reqPods > limits.max_pods) {
    deny(
      'pods',
      'MAX_PODS_EXCEEDED',
      'You have reached the maximum number of CloudPods for your account.',
    );
    return result;
  }

  // CPU
  if (limits.max_cpu_cores >= 0 && usage.cpuCores + reqCpu > limits.max_cpu_cores) {
    deny(
      'cpu_cores',
      'MAX_CPU_EXCEEDED',
      'You do not have enough CPU quota to create or scale this CloudPod.',
    );
    return result;
  }

  // Memory
  if (limits.max_memory_mb >= 0 && usage.memoryMb + reqMem > limits.max_memory_mb) {
    deny(
      'memory_mb',
      'MAX_MEMORY_EXCEEDED',
      'You do not have enough RAM quota to create or scale this CloudPod.',
    );
    return result;
  }

  // Disk
  if (limits.max_disk_gb >= 0 && usage.diskGb + reqDisk > limits.max_disk_gb) {
    deny(
      'disk_gb',
      'MAX_DISK_EXCEEDED',
      'You do not have enough disk quota to create or scale this CloudPod.',
    );
    return result;
  }

  logger.info(`[cloudPodQuotas] Quota check passed for tenant ${tenantId}`, {
    limits,
    usage,
    requested: { pods: reqPods, cpuCores: reqCpu, memoryMb: reqMem, diskGb: reqDisk },
  });

  return result;
}

// ============================================================================
// Legacy / Backward Compatibility Functions
// ============================================================================

/**
 * Check if tenant has capacity to create a new CloudPod
 * @deprecated Use checkTenantQuota instead
 */
export async function checkCreateCapacity(tenantId, cores, memoryMb) {
  const result = await checkTenantQuota({
    tenantId,
    requested: {
      pods: 1,
      cpuCores: cores,
      memoryMb: memoryMb,
      diskGb: 0, // Ignored for legacy
    },
  });
  return { allowed: result.allowed, reason: result.message || null };
}

/**
 * Check if tenant has capacity to scale an existing CloudPod
 * @deprecated Use checkTenantQuota with delta resources instead
 */
export async function checkScaleCapacity(tenantId, podId, newCores, newMemoryMb) {
  try {
    // Get current pod resources
    const pod = await prisma.cloudPod.findUnique({
      where: { id: podId },
      select: { cores: true, memoryMb: true },
    });

    if (!pod) {
      return { allowed: false, reason: 'Pod not found' };
    }

    // Calculate delta
    const deltaCores = Math.max(0, newCores - pod.cores);
    const deltaMemory = Math.max(0, newMemoryMb - pod.memoryMb);

    const result = await checkTenantQuota({
      tenantId,
      requested: {
        pods: 0, // Not adding a new pod
        cpuCores: deltaCores,
        memoryMb: deltaMemory,
        diskGb: 0,
      },
    });

    return { allowed: result.allowed, reason: result.message || null };
  } catch (err) {
    logger.error({ err, tenantId, podId }, 'checkScaleCapacity failed');
    return { allowed: false, reason: err.message };
  }
}

/**
 * Get quota summary for a tenant
 */
export async function getQuotaSummary(tenantId) {
  const limits = await getTenantQuota(tenantId);
  const usage = await getTenantUsage(tenantId);

  return {
    tenantId,
    maxPods: limits.max_pods,
    usedPods: usage.pods,
    maxCores: limits.max_cpu_cores,
    usedCores: usage.cpuCores,
    maxMemoryMb: limits.max_memory_mb,
    usedMemoryMb: usage.memoryMb,
    maxDiskGb: limits.max_disk_gb,
    usedDiskGb: usage.diskGb,
    // Calculated remaining
    remainingPods: Math.max(0, limits.max_pods - usage.pods),
    remainingCores: Math.max(0, limits.max_cpu_cores - usage.cpuCores),
    remainingMemoryMb: Math.max(0, limits.max_memory_mb - usage.memoryMb),
    remainingDiskGb: Math.max(0, limits.max_disk_gb - usage.diskGb),
  };
}

/**
 * Recalculate usage for a tenant and update the quota row
 */
export async function recalculateUsage(tenantId) {
  try {
    const usage = await getTenantUsage(tenantId);

    // Upsert the quota row with recalculated usage
    await prisma.cloudPodQuota.upsert({
      where: { tenantId },
      update: {
        usedCloudPods: usage.pods,
        usedCpuCores: usage.cpuCores,
        usedRamMb: usage.memoryMb,
        usedDiskGb: usage.diskGb,
      },
      create: {
        tenantId,
        maxCloudPods: DEFAULT_TENANT_QUOTA.max_pods,
        maxCpuCores: DEFAULT_TENANT_QUOTA.max_cpu_cores,
        maxRamMb: DEFAULT_TENANT_QUOTA.max_memory_mb,
        maxDiskGb: DEFAULT_TENANT_QUOTA.max_disk_gb,
        usedCloudPods: usage.pods,
        usedCpuCores: usage.cpuCores,
        usedRamMb: usage.memoryMb,
        usedDiskGb: usage.diskGb,
      },
    });

    logger.info(`[cloudPodQuotas] Recalculated usage for tenant ${tenantId}`, usage);
    return { success: true, usage };
  } catch (err) {
    logger.error({ err, tenantId }, 'Failed to recalculate usage');
    return { success: false, error: err.message };
  }
}

/**
 * Ensure the tenant has enough remaining capacity (CloudPods, CPU, RAM).
 * @deprecated Use checkTenantQuota instead
 */
export async function ensureTenantHasCapacity(tenantId, cores, memoryMb) {
  const result = await checkCreateCapacity(tenantId, cores, memoryMb);
  return result.allowed;
}
