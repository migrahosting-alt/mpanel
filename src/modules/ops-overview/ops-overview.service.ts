/**
 * OPS OVERVIEW Service
 * Real-time platform health aggregation - NO MOCK DATA
 * 
 * Spec: MODULE_OPS_OVERVIEW.ix.md
 * 
 * Data Sources (REAL ONLY):
 * 1. CoreNode + metrics from Server Management module
 * 2. Queues from Provisioning/QueueService (BullMQ)
 * 3. ProvisioningJob table (failed/stuck jobs)
 * 4. ShieldEvent + ShieldPolicy from Migra Shield
 * 5. GuardianFinding from Guardian
 * 6. Backup tracking tables
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import type {
  OpsOverviewSummary,
  CoreNodeOverview,
  QueueOverview,
  ProvisioningOverview,
  SecurityOverview,
  BackupOverview,
} from './ops-overview.types.js';

export async function getOpsOverview(): Promise<OpsOverviewSummary> {
  const [coreNodes, queues, provisioning, security, backups] = await Promise.all([
    getCoreNodesOverview(),
    getQueuesOverview(),
    getProvisioningOverview(),
    getSecurityOverview(),
    getBackupsOverview(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    coreNodes,
    queues,
    provisioning,
    security,
    backups,
  };
}

/**
 * Core Nodes Overview
 * Source: CoreNode table (Server Management module)
 * Includes: SRV1-WEB, MAIL-CORE, DNS-CORE, CLOUD-CORE, DB-CORE, MPANEL-CORE, VOIP-CORE, MIGRAGUARD-QUANTUM
 */
async function getCoreNodesOverview(): Promise<CoreNodeOverview[]> {
  try {
    // @ts-ignore - CoreNode table from Server Management module
    const nodes = await prisma.coreNode.findMany({
      select: {
        id: true,
        hostname: true,
        role: true,
        status: true,
        metrics: true,
        lastMetricsAt: true,
      },
      orderBy: { hostname: 'asc' },
    });

    return nodes.map((node: any) => ({
      id: node.id,
      label: node.hostname, // "SRV1-WEB", "MAIL-CORE", etc.
      role: node.role || 'UNKNOWN',
      status: node.status || 'UNKNOWN',
      cpuPercent: node.metrics?.cpuPercent || 0,
      ramPercent: node.metrics?.ramPercent || 0,
      diskPercent: node.metrics?.diskPercent || 0,
      lastMetricsAt: node.lastMetricsAt ? new Date(node.lastMetricsAt).toISOString() : undefined,
    }));
  } catch (error) {
    logger.error('Failed to fetch core nodes overview', { error });
    return [];
  }
}

/**
 * Queues Overview
 * Source: ProvisioningJob table + BullMQ queue stats
 * Groups jobs by type to show queue health
 */
async function getQueuesOverview(): Promise<QueueOverview[]> {
  try {
    // @ts-ignore - ProvisioningJob table
    const queueStats = await prisma.provisioningJob.groupBy({
      by: ['type', 'status'],
      _count: true,
      where: {
        status: { in: ['PENDING', 'RUNNING', 'FAILED', 'DELAYED'] },
      },
    });

    // Group by queue name (job type)
    const queueMap = new Map<string, { waiting: number; active: number; failed: number; delayed: number }>();

    queueStats.forEach((stat: any) => {
      const queueName = stat.type || 'unknown';
      if (!queueMap.has(queueName)) {
        queueMap.set(queueName, { waiting: 0, active: 0, failed: 0, delayed: 0 });
      }

      const queue = queueMap.get(queueName)!;
      const count = stat._count || 0;

      if (stat.status === 'PENDING') queue.waiting += count;
      else if (stat.status === 'RUNNING') queue.active += count;
      else if (stat.status === 'FAILED') queue.failed += count;
      else if (stat.status === 'DELAYED') queue.delayed += count;
    });

    // Calculate oldest waiting job for each queue
    const queuesWithAge = await Promise.all(
      Array.from(queueMap.entries()).map(async ([name, stats]) => {
        let oldestWaitingSeconds: number | undefined;

        try {
          // @ts-ignore
          const oldestJob = await prisma.provisioningJob.findFirst({
            where: { type: name, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          });

          if (oldestJob?.createdAt) {
            const ageMs = Date.now() - new Date(oldestJob.createdAt).getTime();
            oldestWaitingSeconds = Math.floor(ageMs / 1000);
          }
        } catch (err) {
          // Ignore - queue might not have waiting jobs
        }

        return {
          name,
          ...stats,
          oldestWaitingSeconds,
        };
      })
    );

    return queuesWithAge;
  } catch (error) {
    logger.error('Failed to fetch queues overview', { error });
    return [];
  }
}

/**
 * Provisioning Overview
 * Source: ProvisioningJob table
 * Shows failed/stuck jobs in last 24h
 */
async function getProvisioningOverview(): Promise<ProvisioningOverview> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stuckThresholdMinutes = 15;
  const stuckThreshold = new Date(now.getTime() - stuckThresholdMinutes * 60 * 1000);

  try {
    // @ts-ignore
    const [failedJobs, stuckJobs, recentFailuresRaw] = await Promise.all([
      // Failed jobs in last 24h
      prisma.provisioningJob.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: yesterday },
        },
      }),
      // Stuck jobs (PENDING/RUNNING > 15 minutes)
      prisma.provisioningJob.count({
        where: {
          status: { in: ['PENDING', 'RUNNING'] },
          createdAt: { lt: stuckThreshold },
        },
      }),
      // Recent failures (last 10)
      // @ts-ignore
      prisma.provisioningJob.findMany({
        where: {
          status: 'FAILED',
          createdAt: { gte: yesterday },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          tenantId: true,
          createdAt: true,
          error: true,
        },
      }),
    ]);

    const recentFailures = recentFailuresRaw.map((job: any) => ({
      id: job.id,
      action: job.action || 'unknown',
      resourceType: job.resourceType || 'unknown',
      resourceId: job.resourceId || undefined,
      tenantId: job.tenantId || undefined,
      createdAt: new Date(job.createdAt).toISOString(),
      errorMessage: job.error || undefined,
    }));

    return {
      failedLast24h: failedJobs,
      stuckLast24h: stuckJobs,
      recentFailures,
    };
  } catch (error) {
    logger.error('Failed to fetch provisioning overview', { error });
    return {
      failedLast24h: 0,
      stuckLast24h: 0,
      recentFailures: [],
    };
  }
}

/**
 * Security Overview
 * Sources:
 * - ShieldEvent table (Migra Shield events)
 * - ShieldPolicy table (policy distribution)
 * - GuardianFinding table (security findings)
 */
async function getSecurityOverview(): Promise<SecurityOverview> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // @ts-ignore - ShieldEvent from Migra Shield module
    const [shieldEventsRaw, shieldPoliciesRaw, guardianFindingsRaw] = await Promise.all([
      // Shield events last 24h, grouped by decision
      prisma.shieldEvent.groupBy({
        by: ['decision'],
        where: { timestamp: { gte: yesterday } },
        _count: true,
      }).catch(() => []),
      // Shield policies by mode
      prisma.shieldPolicy.groupBy({
        by: ['mode'],
        _count: true,
      }).catch(() => []),
      // Guardian findings (open, by severity)
      // @ts-ignore
      prisma.guardianFinding.groupBy({
        by: ['severity'],
        where: { status: 'OPEN' },
        _count: true,
      }).catch(() => []),
    ]);

    // Aggregate Shield events
    const byDecision = { ALLOW: 0, BLOCK: 0, CHALLENGE: 0, RATE_LIMITED: 0 };
    let totalEvents = 0;

    shieldEventsRaw.forEach((event: any) => {
      const decision = event.decision || 'ALLOW';
      const count = event._count || 0;
      totalEvents += count;
      if (decision in byDecision) {
        byDecision[decision as keyof typeof byDecision] = count;
      }
    });

    // Aggregate Shield policies
    const policies = { enforceCount: 0, monitorCount: 0, disabledCount: 0 };
    shieldPoliciesRaw.forEach((policy: any) => {
      const mode = policy.mode || 'MONITOR';
      const count = policy._count || 0;
      if (mode === 'ENFORCE') policies.enforceCount = count;
      else if (mode === 'MONITOR') policies.monitorCount = count;
      else if (mode === 'DISABLED') policies.disabledCount = count;
    });

    // Aggregate Guardian findings
    const guardianFindings = { criticalOpen: 0, highOpen: 0, mediumOpen: 0 };
    guardianFindingsRaw.forEach((finding: any) => {
      const severity = (finding.severity || '').toLowerCase();
      const count = finding._count || 0;
      if (severity === 'critical') guardianFindings.criticalOpen = count;
      else if (severity === 'high') guardianFindings.highOpen = count;
      else if (severity === 'medium') guardianFindings.mediumOpen = count;
    });

    return {
      shieldEventsLast24h: {
        total: totalEvents,
        byDecision,
      },
      shieldPolicies: policies,
      guardianFindings: guardianFindingsRaw.length > 0 ? guardianFindings : undefined,
    };
  } catch (error) {
    logger.error('Failed to fetch security overview', { error });
    return {
      shieldEventsLast24h: {
        total: 0,
        byDecision: { ALLOW: 0, BLOCK: 0, CHALLENGE: 0, RATE_LIMITED: 0 },
      },
      shieldPolicies: {
        enforceCount: 0,
        monitorCount: 0,
        disabledCount: 0,
      },
      guardianFindings: undefined,
    };
  }
}

/**
 * Backup Overview
 * Source: Backup tracking tables
 * Shows last successful backups for critical systems
 */
async function getBackupsOverview(): Promise<BackupOverview> {
  try {
    // @ts-ignore - Backup table
    const [dbCoreBackup, mpanelBackup, cloudPodsBackup] = await Promise.all([
      // DB-CORE last successful backup
      prisma.backup.findFirst({
        where: {
          resourceType: 'DB_CORE',
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }).catch(() => null),
      // MPANEL-CORE last successful backup
      prisma.backup.findFirst({
        where: {
          resourceType: 'MPANEL_CORE',
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }).catch(() => null),
      // CloudPods last successful backup
      prisma.backup.findFirst({
        where: {
          resourceType: 'CLOUDPOD',
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }).catch(() => null),
    ]);

    return {
      dbCoreLastSuccess: dbCoreBackup?.completedAt
        ? new Date(dbCoreBackup.completedAt).toISOString()
        : undefined,
      mpanelCoreLastSuccess: mpanelBackup?.completedAt
        ? new Date(mpanelBackup.completedAt).toISOString()
        : undefined,
      cloudPodsLastSuccess: cloudPodsBackup?.completedAt
        ? new Date(cloudPodsBackup.completedAt).toISOString()
        : undefined,
      notes: !dbCoreBackup && !mpanelBackup && !cloudPodsBackup
        ? 'Backup tracking not yet configured'
        : undefined,
    };
  } catch (error) {
    logger.error('Failed to fetch backup overview', { error });
    return {
      notes: 'Backup tracking not available',
    };
  }
}
