import { createQueue, type QueueJob } from '../queue.js';
import logger from '../../config/logger.js';
import * as guardianSecurityService from '../../modules/guardian-security/guardianSecurity.service.js';
import { GUARDIAN_SECURITY_JOB_TYPES, GUARDIAN_SECURITY_QUEUE } from '../../modules/guardian-security/guardianSecurity.queue.js';
import type { GuardianSecurityAgentEventJobPayload, GuardianSecurityAgentFindingPayload, GuardianSecurityAgentRemediationPayload } from '../../modules/guardian-security/guardianSecurity.types.js';

const guardianSecurityQueue = createQueue({
  name: GUARDIAN_SECURITY_QUEUE,
  concurrency: 4,
  pollInterval: 3000,
});

function parseDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function buildSeveritySummary(findings: GuardianSecurityAgentFindingPayload[]) {
  const summary: Record<string, number> = {};
  for (const finding of findings) {
    const severity = (finding.severity ?? 'low').toLowerCase();
    summary[severity] = (summary[severity] ?? 0) + 1;
  }
  return summary;
}

async function handleGuardianAgentEvent(payload: GuardianSecurityAgentEventJobPayload) {
  const {
    tenantId,
    guardianInstanceId,
    dataRegion = 'us',
    serverId,
    serverName,
    serverIp,
    agentId = 'guardian-agent',
    agentVersion,
    agentRunId,
    metadata = {},
    scan,
    findings = [],
    remediationTasks = [],
  } = payload;

  if (!tenantId) {
    throw new Error('tenantId is required for Guardian agent events');
  }

  logger.info('Processing Guardian agent event', {
    tenantId,
    guardianInstanceId,
    agentId,
    findings: findings.length,
  });

  let scanRecord: { id: string } | null = null;

  if (scan) {
    const scanRecordInput = await guardianSecurityService.createScan({
      tenantId,
      dataRegion,
      guardianInstanceId,
      serverId,
      sourceType: scan.sourceType ?? 'guardian_agent',
      scanType: scan.scanType ?? 'agent_push',
      mode: scan.mode ?? 'report_only',
      triggeredBy: scan.triggeredBy ?? agentId,
      triggeredByType: scan.triggeredByType ?? 'agent',
      metadata: {
        ...scan.metadata,
        agentId,
        agentVersion,
        agentRunId,
        serverName,
        serverIp,
      },
    });

    const severitySummary = scan.severitySummary ?? buildSeveritySummary(findings);
    const findingsCount = typeof scan.findingsCount === 'number' ? scan.findingsCount : findings.length;

    await guardianSecurityService.updateScan(scanRecordInput.id, tenantId, {
      status: scan.status ?? 'completed',
      findingsCount,
      severitySummary,
      startedAt: parseDate(scan.startedAt),
      completedAt: parseDate(scan.completedAt) ?? new Date(),
      metadata: {
        ...(scan.metadata ?? {}),
        agentRunId,
        processedAt: new Date().toISOString(),
      },
    });

    scanRecord = scanRecordInput;
  }

  const createdFindingMap: Record<string, string> = {};

  for (const finding of findings) {
    if (!finding.title) {
      logger.warn('Skipping Guardian finding without title', { agentRunId });
      continue;
    }

    const newFinding = await guardianSecurityService.createFinding({
      tenantId,
      dataRegion,
      guardianInstanceId,
      scanId: scanRecord?.id,
      serverId: finding.serverId ?? serverId,
      title: finding.title,
      severity: finding.severity ?? 'low',
      description: finding.description,
      category: finding.category,
      signatureId: finding.signatureId ?? finding.externalId ?? undefined,
      recommendedAction: finding.recommendedAction,
      evidence: finding.evidence,
      context: {
        agentId,
        agentVersion,
        agentRunId,
        serverName,
        serverIp,
        externalFindingId: finding.externalId,
        ...(finding.context ?? {}),
      },
      metadata: {
        ...(metadata ?? {}),
        ...(finding.metadata ?? {}),
      },
    });

    if (finding.status || finding.remediationStatus || finding.remediationMode || finding.recommendedAction !== undefined) {
      await guardianSecurityService.updateFinding(newFinding.id, tenantId, {
        status: finding.status,
        remediationStatus: finding.remediationStatus,
        remediationMode: finding.remediationMode,
        recommendedAction: finding.recommendedAction,
        evidence: finding.evidence,
        context: finding.context,
        metadata: finding.metadata,
      });
    }

    if (finding.autoCreateTask || finding.remediationTask) {
      await guardianSecurityService.createRemediationTask({
        tenantId,
        dataRegion,
        guardianInstanceId,
        serverId: finding.serverId ?? serverId,
        scanId: scanRecord?.id,
        findingId: newFinding.id,
        mode: finding.remediationTask?.mode ?? 'request_only',
        severity: finding.remediationTask?.severity ?? finding.severity,
        requestedBy: agentId,
        requestedByType: 'agent',
        metadata: {
          autoCreated: true,
          agentVersion,
          agentRunId,
          ...(finding.remediationTask?.metadata ?? {}),
        },
      });
    }

    if (finding.externalId) {
      createdFindingMap[finding.externalId] = newFinding.id;
    }
  }

  for (const task of remediationTasks) {
    await createStandaloneRemediationTask(task, {
      tenantId,
      dataRegion,
      guardianInstanceId,
      defaultServerId: serverId,
      defaultScanId: scanRecord?.id ?? undefined,
      agentId,
      agentVersion,
      agentRunId,
      createdFindingMap,
    });
  }

  await guardianSecurityService.recordSecurityAuditEvent({
    tenantId,
    dataRegion,
    guardianInstanceId,
    actorType: 'guardian_agent',
    actorId,
    action: 'AGENT_EVENT_PROCESSED',
    severity: findings.some((f) => (f.severity ?? '').toLowerCase() === 'critical') ? 'warning' : 'info',
    resourceType: scanRecord ? 'SCAN' : 'AGENT_EVENT',
    resourceId: scanRecord?.id,
    context: {
      agentRunId,
      findings: findings.length,
      tasks: remediationTasks.length,
    },
    metadata: {
      agentVersion,
      serverName,
      serverIp,
    },
  });
}

async function createStandaloneRemediationTask(
  task: GuardianSecurityAgentRemediationPayload,
  options: {
    tenantId: string;
    dataRegion: string;
    guardianInstanceId?: string;
    defaultServerId?: string;
    defaultScanId?: string;
    agentId: string;
    agentVersion?: string;
    agentRunId?: string;
    createdFindingMap: Record<string, string>;
  }
) {
  const findingId =
    task.findingId || (task.findingExternalId ? options.createdFindingMap[task.findingExternalId] : undefined);

  await guardianSecurityService.createRemediationTask({
    tenantId: options.tenantId,
    dataRegion: options.dataRegion,
    guardianInstanceId: options.guardianInstanceId,
    serverId: task.serverId ?? options.defaultServerId,
    scanId: task.scanId ?? options.defaultScanId,
    findingId,
    mode: task.mode ?? 'request_only',
    severity: task.severity,
    requestedBy: options.agentId,
    requestedByType: 'agent',
    metadata: {
      agentRunId: options.agentRunId,
      agentVersion: options.agentVersion,
      externalTaskId: task.externalId,
      ...(task.metadata ?? {}),
    },
  });
}

guardianSecurityQueue.process(
  GUARDIAN_SECURITY_JOB_TYPES.AGENT_EVENT,
  async (job: QueueJob<GuardianSecurityAgentEventJobPayload>) => {
    await handleGuardianAgentEvent(job.payload);
  }
);

export async function startGuardianSecurityWorker(): Promise<void> {
  logger.info('Starting Guardian security worker');
  await guardianSecurityQueue.start();
}

export async function stopGuardianSecurityWorker(): Promise<void> {
  logger.info('Stopping Guardian security worker');
  await guardianSecurityQueue.stop();
}

export default guardianSecurityQueue;
