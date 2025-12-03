/**
 * CloudPods Metrics Service
 * Usage metering and metrics collection for CloudPods
 */

import { prisma } from '../config/database.js';
import type { UsageSample, TenantUsageSummary } from './cloudPodsEnterpriseTypes';

interface ProxmoxMetrics {
  cpu: number;      // CPU usage percentage (0-100)
  mem: number;      // Memory used in bytes
  maxmem: number;   // Max memory in bytes
  disk: number;     // Disk used in bytes
  maxdisk: number;  // Max disk in bytes
  netin: number;    // Network in bytes
  netout: number;   // Network out bytes
}

/**
 * Collect a usage sample for a pod from Proxmox
 */
export async function collectSampleForPod(
  tenantId: string,
  podId: string,
  metrics: ProxmoxMetrics
): Promise<UsageSample> {
  const sample = await prisma.cloudPodUsageSample.create({
    data: {
      tenantId,
      podId,
      timestamp: new Date(),
      cpuPct: metrics.cpu,
      memoryMb: Math.round(metrics.mem / 1024 / 1024),
      diskGb: Number((metrics.disk / 1024 / 1024 / 1024).toFixed(2)),
      netInMb: Number((metrics.netin / 1024 / 1024).toFixed(2)),
      netOutMb: Number((metrics.netout / 1024 / 1024).toFixed(2)),
    },
  });

  return {
    tenantId: sample.tenantId,
    podId: sample.podId,
    timestamp: sample.timestamp,
    cpuPct: sample.cpuPct,
    memoryMb: sample.memoryMb,
    diskGb: sample.diskGb,
    netInMb: sample.netInMb,
    netOutMb: sample.netOutMb,
  };
}

/**
 * Collect metrics from Proxmox API for a VM
 */
export async function collectFromProxmox(
  vmid: number,
  pveNode: string,
  sshExec: (node: string, cmd: string) => Promise<string>
): Promise<ProxmoxMetrics> {
  // Use pvesh to get VM status from Proxmox
  const cmd = `pvesh get /nodes/${pveNode}/qemu/${vmid}/status/current --output-format json`;
  const result = await sshExec(pveNode, cmd);
  const data = JSON.parse(result);

  return {
    cpu: Number((data.cpu * 100).toFixed(2)),
    mem: data.mem || 0,
    maxmem: data.maxmem || 0,
    disk: data.disk || 0,
    maxdisk: data.maxdisk || 0,
    netin: data.netin || 0,
    netout: data.netout || 0,
  };
}

/**
 * Get recent metrics for a pod
 */
export async function getPodMetrics(
  podId: string,
  options: { limit?: number; startDate?: Date; endDate?: Date } = {}
) {
  const { limit = 100, startDate, endDate } = options;

  const where: Record<string, unknown> = { podId };
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) (where.timestamp as Record<string, Date>).gte = startDate;
    if (endDate) (where.timestamp as Record<string, Date>).lte = endDate;
  }

  return prisma.cloudPodUsageSample.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get daily aggregated metrics for a pod
 */
export async function getPodDailyMetrics(
  podId: string,
  options: { startDate?: Date; endDate?: Date } = {}
) {
  const where: Record<string, unknown> = { podId };
  if (options.startDate || options.endDate) {
    where.date = {};
    if (options.startDate) (where.date as Record<string, Date>).gte = options.startDate;
    if (options.endDate) (where.date as Record<string, Date>).lte = options.endDate;
  }

  return prisma.cloudPodUsageDaily.findMany({
    where,
    orderBy: { date: 'desc' },
  });
}

/**
 * Get usage summary for a tenant over a period
 */
export async function getTenantUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<TenantUsageSummary> {
  // Get all pods for the tenant
  const pods = await prisma.cloudPod.findMany({
    where: { tenantId },
    select: {
      id: true,
      cores: true,
      ramMb: true,
      diskGb: true,
    },
  });

  // Get daily usage for all pods in the period
  const dailyUsage = await prisma.cloudPodUsageDaily.findMany({
    where: {
      tenantId,
      date: { gte: startDate, lte: endDate },
    },
  });

  // Calculate totals
  const totalCpuCores = pods.reduce((sum, p) => sum + (p.cores || 0), 0);
  const totalRamMb = pods.reduce((sum, p) => sum + (p.ramMb || 0), 0);
  const totalDiskGb = pods.reduce((sum, p) => sum + (p.diskGb || 0), 0);

  // Calculate averages and totals from daily usage
  const avgCpuUtilization = dailyUsage.length > 0
    ? dailyUsage.reduce((sum, d) => sum + d.avgCpuPct, 0) / dailyUsage.length
    : 0;

  const avgRamUtilization = dailyUsage.length > 0
    ? dailyUsage.reduce((sum, d) => sum + (d.avgMemoryMb / totalRamMb * 100), 0) / dailyUsage.length
    : 0;

  const totalNetworkInMb = dailyUsage.reduce((sum, d) => sum + d.totalNetInMb, 0);
  const totalNetworkOutMb = dailyUsage.reduce((sum, d) => sum + d.totalNetOutMb, 0);

  return {
    tenantId,
    period: { start: startDate, end: endDate },
    totalPods: pods.length,
    totalCpuCores,
    totalRamMb,
    totalDiskGb,
    avgCpuUtilization: Number(avgCpuUtilization.toFixed(2)),
    avgRamUtilization: Number(avgRamUtilization.toFixed(2)),
    totalNetworkInMb: Number(totalNetworkInMb.toFixed(2)),
    totalNetworkOutMb: Number(totalNetworkOutMb.toFixed(2)),
  };
}

/**
 * Aggregate samples into daily records (run by cron)
 */
export async function aggregateDailySamples(targetDate: Date): Promise<number> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get distinct pod IDs for the day
  const samples = await prisma.cloudPodUsageSample.findMany({
    where: {
      timestamp: { gte: startOfDay, lte: endOfDay },
    },
    select: { podId: true, tenantId: true },
    distinct: ['podId'],
  });

  let aggregatedCount = 0;

  for (const { podId, tenantId } of samples) {
    // Get all samples for this pod on this day
    const podSamples = await prisma.cloudPodUsageSample.findMany({
      where: {
        podId,
        timestamp: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (podSamples.length === 0) continue;

    // Calculate aggregates
    const avgCpuPct = podSamples.reduce((sum, s) => sum + s.cpuPct, 0) / podSamples.length;
    const maxCpuPct = Math.max(...podSamples.map(s => s.cpuPct));
    const avgMemoryMb = Math.round(podSamples.reduce((sum, s) => sum + s.memoryMb, 0) / podSamples.length);
    const maxMemoryMb = Math.max(...podSamples.map(s => s.memoryMb));
    const diskGb = podSamples[podSamples.length - 1].diskGb; // Latest disk value
    const totalNetInMb = podSamples.reduce((sum, s) => sum + s.netInMb, 0);
    const totalNetOutMb = podSamples.reduce((sum, s) => sum + s.netOutMb, 0);

    // Upsert daily record
    await prisma.cloudPodUsageDaily.upsert({
      where: {
        tenantId_podId_date: { tenantId, podId, date: startOfDay },
      },
      create: {
        tenantId,
        podId,
        date: startOfDay,
        avgCpuPct: Number(avgCpuPct.toFixed(2)),
        maxCpuPct: Number(maxCpuPct.toFixed(2)),
        avgMemoryMb,
        maxMemoryMb,
        diskGb,
        totalNetInMb: Number(totalNetInMb.toFixed(2)),
        totalNetOutMb: Number(totalNetOutMb.toFixed(2)),
      },
      update: {
        avgCpuPct: Number(avgCpuPct.toFixed(2)),
        maxCpuPct: Number(maxCpuPct.toFixed(2)),
        avgMemoryMb,
        maxMemoryMb,
        diskGb,
        totalNetInMb: Number(totalNetInMb.toFixed(2)),
        totalNetOutMb: Number(totalNetOutMb.toFixed(2)),
      },
    });

    aggregatedCount++;
  }

  return aggregatedCount;
}

/**
 * Clean up old samples (keep configurable days)
 */
export async function cleanupOldSamples(retentionDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const result = await prisma.cloudPodUsageSample.deleteMany({
    where: {
      timestamp: { lt: cutoffDate },
    },
  });

  return result.count;
}

export const CloudPodsMetricsService = {
  collectSampleForPod,
  collectFromProxmox,
  getPodMetrics,
  getPodDailyMetrics,
  getTenantUsageSummary,
  aggregateDailySamples,
  cleanupOldSamples,
};

export default CloudPodsMetricsService;
