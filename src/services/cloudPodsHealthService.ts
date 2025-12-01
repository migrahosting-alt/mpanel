/**
 * CloudPods Health Service
 * Health monitoring and auto-healing for CloudPods
 */

import { PrismaClient } from '@prisma/client';
import { CloudPodsAuditService } from './cloudPodsAuditService';
import type { HealthStatus, HealthCheckResult, CloudPodAuditContext } from './cloudPodsEnterpriseTypes';

const prisma = new PrismaClient();

// Auto-heal after this many consecutive failures
const AUTO_HEAL_FAILURE_THRESHOLD = 3;

interface PodForHealthCheck {
  id: string;
  vmid: number;
  tenantId: string;
  pveNode: string;
  status: string;
}

/**
 * Check health of a single pod by querying Proxmox QEMU agent
 */
export async function checkPodHealth(
  pod: PodForHealthCheck,
  sshExec: (node: string, cmd: string) => Promise<string>
): Promise<HealthCheckResult> {
  const { id: podId, vmid, tenantId, pveNode } = pod;

  try {
    // Query QEMU agent for VM status
    const statusCmd = `qm agent ${vmid} ping 2>/dev/null && echo "OK" || echo "FAIL"`;
    const result = await sshExec(pveNode, statusCmd);
    const isHealthy = result.trim() === 'OK';

    // Get or create health status record
    let healthStatus = await prisma.cloudPodHealthStatus.findUnique({
      where: { podId },
    });

    if (!healthStatus) {
      healthStatus = await prisma.cloudPodHealthStatus.create({
        data: {
          podId,
          lastStatus: isHealthy ? 'healthy' : 'unhealthy',
          lastCheckedAt: new Date(),
          consecutiveFailures: isHealthy ? 0 : 1,
        },
      });
    } else {
      // Update health status
      const newFailures = isHealthy ? 0 : healthStatus.consecutiveFailures + 1;
      healthStatus = await prisma.cloudPodHealthStatus.update({
        where: { podId },
        data: {
          lastStatus: isHealthy ? 'healthy' : 'unhealthy',
          lastCheckedAt: new Date(),
          lastError: isHealthy ? null : 'QEMU agent ping failed',
          consecutiveFailures: newFailures,
        },
      });
    }

    // Log status change
    const action = isHealthy ? 'HEALTH_CHECK_PASSED' : 'HEALTH_CHECK_FAILED';
    await CloudPodsAuditService.log({
      action,
      category: 'health',
      ctx: { tenantId, podId, vmid },
      details: { status: healthStatus.lastStatus, consecutiveFailures: healthStatus.consecutiveFailures },
    });

    // Check if auto-heal should be triggered
    let autoHealTriggered = false;
    if (healthStatus.consecutiveFailures >= AUTO_HEAL_FAILURE_THRESHOLD) {
      autoHealTriggered = await triggerAutoHeal(pod, sshExec);
    }

    return {
      podId,
      vmid,
      status: healthStatus.lastStatus as HealthStatus,
      lastCheckedAt: healthStatus.lastCheckedAt,
      lastError: healthStatus.lastError || undefined,
      consecutiveFailures: healthStatus.consecutiveFailures,
      autoHealTriggered,
    };
  } catch (err) {
    // Update health status as unknown on error
    await prisma.cloudPodHealthStatus.upsert({
      where: { podId },
      create: {
        podId,
        lastStatus: 'unknown',
        lastCheckedAt: new Date(),
        lastError: String(err),
        consecutiveFailures: 0,
      },
      update: {
        lastStatus: 'unknown',
        lastCheckedAt: new Date(),
        lastError: String(err),
      },
    });

    return {
      podId,
      vmid,
      status: 'unknown',
      lastCheckedAt: new Date(),
      lastError: String(err),
      consecutiveFailures: 0,
    };
  }
}

/**
 * Trigger auto-healing for an unhealthy pod
 */
export async function triggerAutoHeal(
  pod: PodForHealthCheck,
  sshExec: (node: string, cmd: string) => Promise<string>
): Promise<boolean> {
  const { id: podId, vmid, tenantId, pveNode } = pod;

  try {
    // Log auto-heal trigger
    await CloudPodsAuditService.log({
      action: 'AUTO_HEAL_TRIGGERED',
      category: 'health',
      ctx: { tenantId, podId, vmid },
      details: { reason: 'consecutive_failures_threshold' },
    });

    // Attempt VM restart
    const restartCmd = `qm stop ${vmid} --timeout 30 2>/dev/null; sleep 5; qm start ${vmid}`;
    await sshExec(pveNode, restartCmd);

    // Wait for VM to come up
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check if restart was successful
    const checkCmd = `qm status ${vmid} | grep -q running && echo "OK" || echo "FAIL"`;
    const result = await sshExec(pveNode, checkCmd);
    const success = result.trim() === 'OK';

    if (success) {
      // Reset failure counter
      await prisma.cloudPodHealthStatus.update({
        where: { podId },
        data: {
          lastStatus: 'healthy',
          lastCheckedAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
        },
      });

      await CloudPodsAuditService.log({
        action: 'AUTO_HEAL_COMPLETED',
        category: 'health',
        ctx: { tenantId, podId, vmid },
        details: { result: 'success' },
      });
    } else {
      await CloudPodsAuditService.log({
        action: 'AUTO_HEAL_FAILED',
        category: 'health',
        ctx: { tenantId, podId, vmid },
        details: { result: 'vm_failed_to_start' },
      });
    }

    return success;
  } catch (err) {
    await CloudPodsAuditService.log({
      action: 'AUTO_HEAL_FAILED',
      category: 'health',
      ctx: { tenantId, podId, vmid },
      details: { error: String(err) },
    });
    return false;
  }
}

/**
 * Get current health status for a pod
 */
export async function getPodHealth(podId: string): Promise<HealthCheckResult | null> {
  const healthStatus = await prisma.cloudPodHealthStatus.findUnique({
    where: { podId },
  });

  if (!healthStatus) {
    return null;
  }

  // Get pod info for vmid
  const pod = await prisma.cloudPod.findUnique({
    where: { id: podId },
    select: { vmid: true },
  });

  return {
    podId,
    vmid: pod?.vmid || 0,
    status: healthStatus.lastStatus as HealthStatus,
    lastCheckedAt: healthStatus.lastCheckedAt,
    lastError: healthStatus.lastError || undefined,
    consecutiveFailures: healthStatus.consecutiveFailures,
  };
}

/**
 * Get health status for all pods of a tenant
 */
export async function getTenantPodsHealth(tenantId: string): Promise<HealthCheckResult[]> {
  const pods = await prisma.cloudPod.findMany({
    where: { tenantId },
    select: { id: true, vmid: true },
  });

  const healthStatuses = await prisma.cloudPodHealthStatus.findMany({
    where: {
      podId: { in: pods.map(p => p.id) },
    },
  });

  const healthMap = new Map(healthStatuses.map(h => [h.podId, h]));

  return pods.map(pod => {
    const health = healthMap.get(pod.id);
    return {
      podId: pod.id,
      vmid: pod.vmid || 0,
      status: (health?.lastStatus || 'unknown') as HealthStatus,
      lastCheckedAt: health?.lastCheckedAt || new Date(0),
      lastError: health?.lastError || undefined,
      consecutiveFailures: health?.consecutiveFailures || 0,
    };
  });
}

/**
 * Get unhealthy pods that need attention
 */
export async function getUnhealthyPods(): Promise<{ podId: string; consecutiveFailures: number }[]> {
  const unhealthy = await prisma.cloudPodHealthStatus.findMany({
    where: {
      OR: [
        { lastStatus: 'unhealthy' },
        { consecutiveFailures: { gte: 1 } },
      ],
    },
    select: {
      podId: true,
      consecutiveFailures: true,
    },
    orderBy: { consecutiveFailures: 'desc' },
  });

  return unhealthy;
}

export const CloudPodsHealthService = {
  checkPodHealth,
  triggerAutoHeal,
  getPodHealth,
  getTenantPodsHealth,
  getUnhealthyPods,
  AUTO_HEAL_FAILURE_THRESHOLD,
};

export default CloudPodsHealthService;
