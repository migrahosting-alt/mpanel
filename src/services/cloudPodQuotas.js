// src/services/cloudPodQuotas.js
// TEMP SAFE VERSION - all stub functions so mPanel can boot without crashing.
// Real quota logic will be implemented later.

/**
 * Check if tenant has capacity to create a new CloudPod
 */
export async function checkCreateCapacity(tenantId, cores, memoryMb) {
  console.log(`[cloudPodQuotas] STUB checkCreateCapacity: tenant=${tenantId}, cores=${cores}, mem=${memoryMb}MB`);
  return { allowed: true, reason: null };
}

/**
 * Check if tenant has capacity to scale an existing CloudPod
 */
export async function checkScaleCapacity(tenantId, podId, newCores, newMemoryMb) {
  console.log(`[cloudPodQuotas] STUB checkScaleCapacity: tenant=${tenantId}, pod=${podId}, cores=${newCores}, mem=${newMemoryMb}MB`);
  return { allowed: true, reason: null };
}

/**
 * Get quota summary for a tenant
 */
export async function getQuotaSummary(tenantId) {
  console.log(`[cloudPodQuotas] STUB getQuotaSummary: tenant=${tenantId}`);
  return {
    tenantId,
    maxPods: 100,
    usedPods: 0,
    maxCores: 1000,
    usedCores: 0,
    maxMemoryMb: 102400,
    usedMemoryMb: 0,
  };
}

/**
 * Recalculate usage for a tenant
 */
export async function recalculateUsage(tenantId) {
  console.log(`[cloudPodQuotas] STUB recalculateUsage: tenant=${tenantId}`);
  return { success: true };
}

/**
 * Ensure the tenant has enough remaining capacity (CloudPods, CPU, RAM).
 * Legacy function for backwards compatibility.
 */
export async function ensureTenantHasCapacity(tenantId, cores, memoryMb) {
  console.log(`[cloudPodQuotas] STUB ensureTenantHasCapacity: tenant=${tenantId}, cores=${cores}, mem=${memoryMb}MB`);
  return true;
}
