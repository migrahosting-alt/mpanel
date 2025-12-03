/**
 * MODULE_SERVER_METRICS Service
 * Query metrics from TSDB or cached snapshots
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  ServerMetricSummary,
  TimeseriesQuery,
  TimeseriesDataPoint,
  AlertQuery,
  MetricAlert,
  HealthState,
} from './serverMetrics.types.js';

/**
 * Get server metric summary (last snapshot + health state)
 */
export async function getServerMetricSummary(
  serverId: string,
  actorTenantId: string | null,
  isPlatformAdmin: boolean
): Promise<ServerMetricSummary | null> {
  // Verify server access
  const where: any = { id: serverId };
  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  }

  const server = await prisma.server.findFirst({ where });

  if (!server) {
    return null;
  }

  // Get latest metric snapshot (table may not exist yet)
  let lastSnapshot = null;
  try {
    // @ts-ignore - ServerMetricSnapshot table may not exist yet
    lastSnapshot = await prisma.serverMetricSnapshot.findFirst({
      where: { serverId },
      orderBy: { timestamp: 'desc' },
    });
  } catch (error) {
    logger.debug('ServerMetricSnapshot table not available', { serverId });
  }

  // Derive health state from metrics
  let healthState: HealthState = 'UNKNOWN';
  if (lastSnapshot) {
    const cpuUsage = lastSnapshot.cpuUsagePct;
    const memUsagePct =
      (Number(lastSnapshot.memUsedBytes) / Number(lastSnapshot.memTotalBytes)) * 100;
    const diskUsagePct =
      (Number(lastSnapshot.diskUsedBytes) / Number(lastSnapshot.diskTotalBytes)) * 100;

    if (cpuUsage > 90 || memUsagePct > 90 || diskUsagePct > 90) {
      healthState = 'CRITICAL';
    } else if (cpuUsage > 70 || memUsagePct > 80 || diskUsagePct > 80) {
      healthState = 'WARN';
    } else {
      healthState = 'OK';
    }
  }

  // Parse services from snapshot metadata
  const servicesStatus =
    lastSnapshot?.services && typeof lastSnapshot.services === 'object'
      ? Object.entries(lastSnapshot.services as Record<string, any>).map(([name, data]) => ({
          name,
          status: data.status || 'unknown',
          pid: data.pid || null,
          uptime: data.uptime || null,
        }))
      : [];

  return {
    serverId: server.id,
    serverName: server.name,
    lastSnapshot,
    healthState,
    uptime: lastSnapshot?.services?.system?.uptime || null,
    servicesStatus,
  };
}

/**
 * Get timeseries data for a specific metric
 * In production, this would query Prometheus/InfluxDB/TimescaleDB
 * For now, return mock structure to show API contract
 */
export async function getMetricTimeseries(
  query: TimeseriesQuery,
  actorTenantId: string | null,
  isPlatformAdmin: boolean
): Promise<TimeseriesDataPoint[]> {
  const { serverId, metric, from, to } = query;

  // Verify server access
  const where: any = { id: serverId };
  if (!isPlatformAdmin) {
    where.tenantId = actorTenantId;
  }

  const server = await prisma.server.findFirst({ where });

  if (!server) {
    throw new Error('Server not found or access denied');
  }

  // TODO: Query actual TSDB (Prometheus, InfluxDB, etc.)
  // For now, return empty array with proper structure
  logger.debug('Timeseries query (TSDB not yet wired)', { serverId, metric, from, to });

  return [];
}

/**
 * Get metric alerts for servers
 */
export async function getMetricAlerts(
  query: AlertQuery,
  actorTenantId: string | null,
  isPlatformAdmin: boolean
): Promise<MetricAlert[]> {
  const { serverId, status } = query;

  // Build where clause for server access
  const serverWhere: any = {};
  if (!isPlatformAdmin) {
    serverWhere.tenantId = actorTenantId;
  }
  if (serverId) {
    serverWhere.id = serverId;
  }

  // Get accessible servers
  const servers = await prisma.server.findMany({
    where: serverWhere,
    select: { id: true },
  });

  const serverIds = servers.map((s) => s.id);

  if (serverIds.length === 0) {
    return [];
  }

  // Query alerts (table may not exist yet)
  try {
    const where: any = { serverId: { in: serverIds } };
    if (status) {
      where.status = status;
    }

    // @ts-ignore - MetricAlert table may not exist yet
    const alerts = await prisma.metricAlert.findMany({
      where,
      orderBy: { firedAt: 'desc' },
      take: 100,
    });

    return alerts;
  } catch (error) {
    logger.debug('MetricAlert table not available');
    return [];
  }
}
