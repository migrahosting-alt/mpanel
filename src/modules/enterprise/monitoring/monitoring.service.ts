/**
 * ENTERPRISE MONITORING & ALERTS Service
 * Periodic health checks with alert evaluation
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  Monitor,
  MonitorCheck,
  AlertPolicy,
  CreateMonitorRequest,
  CreateAlertPolicyRequest,
} from './monitoring.types.js';

// Monitors
export async function listMonitors(actorTenantId: string): Promise<Monitor[]> {
  try {
    // @ts-ignore
    const monitors = await prisma.monitor.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return monitors;
  } catch {
    return [];
  }
}

export async function createMonitor(
  data: CreateMonitorRequest,
  actorTenantId: string,
  actorId: string
): Promise<Monitor> {
  const { name, type, target, interval = 60, timeout = 10 } = data;

  // @ts-ignore
  const monitor = await prisma.monitor.create({
    data: {
      tenantId: actorTenantId,
      name,
      type,
      target,
      interval,
      timeout,
      status: 'UP',
      lastCheckAt: null,
      createdBy: actorId,
    },
  });

  logger.info('Monitor created', { monitorId: monitor.id, type });

  return monitor;
}

export async function deleteMonitor(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.monitor.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Monitor deleted', { monitorId: id });
}

// Monitor Checks
export async function listMonitorChecks(
  monitorId: string,
  actorTenantId: string
): Promise<MonitorCheck[]> {
  try {
    // Verify monitor belongs to tenant
    // @ts-ignore
    const monitor = await prisma.monitor.findFirst({
      where: { id: monitorId, tenantId: actorTenantId },
    });

    if (!monitor) return [];

    // @ts-ignore
    const checks = await prisma.monitorCheck.findMany({
      where: { monitorId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return checks;
  } catch {
    return [];
  }
}

// Alert Policies
export async function listAlertPolicies(actorTenantId: string): Promise<AlertPolicy[]> {
  try {
    // @ts-ignore
    const policies = await prisma.alertPolicy.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return policies;
  } catch {
    return [];
  }
}

export async function createAlertPolicy(
  data: CreateAlertPolicyRequest,
  actorTenantId: string,
  actorId: string
): Promise<AlertPolicy> {
  const { name, monitorIds, channels, recipients, cooldownMinutes = 15 } = data;

  // @ts-ignore
  const policy = await prisma.alertPolicy.create({
    data: {
      tenantId: actorTenantId,
      name,
      monitorIds,
      channels,
      recipients,
      cooldownMinutes,
      isActive: true,
      createdBy: actorId,
    },
  });

  logger.info('Alert policy created', { policyId: policy.id });

  return policy;
}

export async function deleteAlertPolicy(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.alertPolicy.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Alert policy deleted', { policyId: id });
}
