import type { Request, Response } from 'express';
import logger from '../../config/logger.js';
import env from '../../config/env.js';
import { writeAuditEvent } from '../security/auditService.js';
import * as guardianSecurityService from './guardianSecurity.service.js';
import { enqueueGuardianAgentEvent } from './guardianSecurity.queue.js';
import { GuardianSecurityAgentEventSchema } from './guardianSecurity.types.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

function requireTenantContext(req: AuthenticatedRequest): string {
  if (!req.user?.tenantId) {
    throw new Error('Tenant context is required for Guardian Security endpoints');
  }
  return req.user.tenantId;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function handleError(res: Response, error: unknown, message = 'Unexpected error') {
  logger.error(message, { error: error instanceof Error ? error.message : error });
  if (error instanceof Error && error.message.includes('tenant')) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  if (error instanceof Error && error.message.includes('not found')) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }
  return res.status(500).json({ success: false, error: message });
}

export async function listSecurityInstances(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { status, dataRegion, search } = req.query;
    const instances = await guardianSecurityService.listInstances({
      tenantId,
      status: typeof status === 'string' ? status : undefined,
      dataRegion: typeof dataRegion === 'string' ? dataRegion : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
    });

    return res.json({ success: true, ...instances });
  } catch (error) {
    return handleError(res, error, 'Failed to list Guardian security instances');
  }
}

export async function ingestGuardianAgentEvent(req: Request, res: Response) {
  try {
    const sharedSecret = env.GUARDIAN_AGENT_SHARED_SECRET;
    if (!sharedSecret) {
      return res.status(503).json({ success: false, error: 'Guardian agent ingestion not configured' });
    }

    const token =
      (req.header('x-guardian-agent-token') ??
        req.header('x-guardian-agent-key') ??
        (typeof req.body?.agentToken === 'string' ? req.body.agentToken : undefined)) ??
      '';

    if (token !== sharedSecret) {
      return res.status(401).json({ success: false, error: 'Invalid agent token' });
    }

    const parseResult = GuardianSecurityAgentEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: 'Invalid agent payload', details: parseResult.error.errors });
    }

    await enqueueGuardianAgentEvent(parseResult.data);

    return res.status(202).json({ success: true, queued: true });
  } catch (error) {
    return handleError(res, error, 'Failed to ingest Guardian agent event');
  }
}

export async function createSecurityInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { name, dataRegion, environment, mode, policyPack, autoRemediationSettings, detectionSources, notificationSettings, metadata } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Instance name is required' });
    }

    const instance = await guardianSecurityService.createInstance({
      tenantId,
      name,
      dataRegion,
      environment,
      mode,
      policyPack,
      autoRemediationSettings,
      detectionSources,
      notificationSettings,
      metadata,
    });

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId,
      type: 'GUARDIAN_SECURITY_INSTANCE_CREATED',
      metadata: { instanceId: instance.id, name: instance.name },
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      guardianInstanceId: instance.id,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'INSTANCE_CREATED',
      severity: 'info',
      metadata: { environment: instance.environment },
    });

    return res.status(201).json({ success: true, data: instance });
  } catch (error) {
    return handleError(res, error, 'Failed to create Guardian security instance');
  }
}

export async function getSecurityInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { id } = req.params;
    const instance = await guardianSecurityService.getInstance(id, tenantId);

    if (!instance) {
      return res.status(404).json({ success: false, error: 'Instance not found' });
    }

    return res.json({ success: true, data: instance });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch Guardian security instance');
  }
}

export async function updateSecurityInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { id } = req.params;

    const instance = await guardianSecurityService.updateInstance(id, tenantId, req.body ?? {});

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId,
      type: 'GUARDIAN_SECURITY_INSTANCE_UPDATED',
      metadata: { instanceId: id },
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      guardianInstanceId: instance.id,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'INSTANCE_UPDATED',
      severity: 'info',
      metadata: { status: instance.status, mode: instance.mode },
    });

    return res.json({ success: true, data: instance });
  } catch (error) {
    return handleError(res, error, 'Failed to update Guardian security instance');
  }
}

export async function archiveSecurityInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { id } = req.params;

    const instance = await guardianSecurityService.archiveInstance(id, tenantId);

    await writeAuditEvent({
      actorUserId: req.user?.userId ?? null,
      tenantId,
      type: 'GUARDIAN_SECURITY_INSTANCE_ARCHIVED',
      metadata: { instanceId: id },
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      guardianInstanceId: instance.id,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'INSTANCE_ARCHIVED',
      severity: 'warning',
    });

    return res.json({ success: true, data: instance });
  } catch (error) {
    return handleError(res, error, 'Failed to archive Guardian security instance');
  }
}

export async function getSecurityOverview(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const overview = await guardianSecurityService.getSecurityOverview(tenantId);
    return res.json({ success: true, data: overview });
  } catch (error) {
    return handleError(res, error, 'Failed to load Guardian security overview');
  }
}

export async function listSecurityScans(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { status, serverId, instanceId } = req.query;

    const scans = await guardianSecurityService.listScans({
      tenantId,
      status: typeof status === 'string' ? status : undefined,
      serverId: typeof serverId === 'string' ? serverId : undefined,
      instanceId: typeof instanceId === 'string' ? instanceId : undefined,
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
    });

    return res.json({ success: true, ...scans });
  } catch (error) {
    return handleError(res, error, 'Failed to list Guardian security scans');
  }
}

export async function createSecurityScan(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { instanceId } = req.params;
    const { serverId, dataRegion, sourceType, scanType, mode, triggeredBy, triggeredByType, metadata } = req.body ?? {};

    const scan = await guardianSecurityService.createScan({
      tenantId,
      dataRegion: dataRegion ?? 'us',
      guardianInstanceId: instanceId !== 'null' ? instanceId : undefined,
      serverId,
      sourceType,
      scanType,
      mode,
      triggeredBy: triggeredBy ?? req.user?.userId,
      triggeredByType: triggeredByType ?? 'user',
      metadata,
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: scan.dataRegion,
      guardianInstanceId: scan.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'SCAN_CREATED',
      severity: 'info',
      resourceType: 'SCAN',
      resourceId: scan.id,
    });

    return res.status(201).json({ success: true, data: scan });
  } catch (error) {
    return handleError(res, error, 'Failed to create Guardian security scan');
  }
}

export async function updateSecurityScan(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { scanId } = req.params;

    const scan = await guardianSecurityService.updateScan(scanId, tenantId, req.body ?? {});

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: scan.dataRegion,
      guardianInstanceId: scan.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'SCAN_UPDATED',
      severity: 'info',
      resourceType: 'SCAN',
      resourceId: scan.id,
    });

    return res.json({ success: true, data: scan });
  } catch (error) {
    return handleError(res, error, 'Failed to update Guardian security scan');
  }
}

export async function listSecurityFindings(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { status, severity, serverId, instanceId, scanId } = req.query;

    const findings = await guardianSecurityService.listFindings({
      tenantId,
      status: typeof status === 'string' ? status : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      serverId: typeof serverId === 'string' ? serverId : undefined,
      instanceId: typeof instanceId === 'string' ? instanceId : undefined,
      scanId: typeof scanId === 'string' ? scanId : undefined,
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
    });

    return res.json({ success: true, ...findings });
  } catch (error) {
    return handleError(res, error, 'Failed to list Guardian security findings');
  }
}

export async function createFindingForScan(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { scanId } = req.params;
    const { title, severity, description, guardianInstanceId, serverId, category, signatureId, recommendedAction, evidence, context, metadata, dataRegion } = req.body ?? {};

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'Finding title is required' });
    }

    const finding = await guardianSecurityService.createFinding({
      tenantId,
      dataRegion: dataRegion ?? 'us',
      title,
      severity,
      description,
      guardianInstanceId,
      scanId,
      serverId,
      category,
      signatureId,
      recommendedAction,
      evidence,
      context,
      metadata,
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: finding.dataRegion,
      guardianInstanceId: finding.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'FINDING_CREATED',
      severity: 'warning',
      resourceType: 'FINDING',
      resourceId: finding.id,
      metadata: { severity: finding.severity },
    });

    return res.status(201).json({ success: true, data: finding });
  } catch (error) {
    return handleError(res, error, 'Failed to create Guardian security finding');
  }
}

export async function updateSecurityFinding(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { findingId } = req.params;

    const finding = await guardianSecurityService.updateFinding(findingId, tenantId, req.body ?? {});

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: finding.dataRegion,
      guardianInstanceId: finding.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'FINDING_UPDATED',
      severity: finding.status === 'resolved' ? 'info' : 'warning',
      resourceType: 'FINDING',
      resourceId: finding.id,
      metadata: { status: finding.status },
    });

    return res.json({ success: true, data: finding });
  } catch (error) {
    return handleError(res, error, 'Failed to update Guardian security finding');
  }
}

export async function listRemediationTasks(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { status, serverId, findingId } = req.query;

    const tasks = await guardianSecurityService.listRemediationTasks({
      tenantId,
      status: typeof status === 'string' ? status : undefined,
      serverId: typeof serverId === 'string' ? serverId : undefined,
      findingId: typeof findingId === 'string' ? findingId : undefined,
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
    });

    return res.json({ success: true, ...tasks });
  } catch (error) {
    return handleError(res, error, 'Failed to list Guardian security remediation tasks');
  }
}

export async function createRemediationTask(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { findingId } = req.params;
    const { guardianInstanceId, serverId, scanId, mode, severity, requestedByType, metadata, dataRegion } = req.body ?? {};

    const task = await guardianSecurityService.createRemediationTask({
      tenantId,
      dataRegion: dataRegion ?? 'us',
      guardianInstanceId,
      serverId,
      scanId,
      findingId,
      mode,
      severity,
      requestedBy: req.user?.userId,
      requestedByType: requestedByType ?? 'user',
      metadata,
    });

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: task.dataRegion,
      guardianInstanceId: task.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'REMEDIATION_TASK_CREATED',
      severity: 'warning',
      resourceType: 'REMEDIATION_TASK',
      resourceId: task.id,
      metadata: { findingId: task.findingId },
    });

    return res.status(201).json({ success: true, data: task });
  } catch (error) {
    return handleError(res, error, 'Failed to create Guardian security remediation task');
  }
}

export async function updateRemediationTask(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { taskId } = req.params;

    const task = await guardianSecurityService.updateRemediationTask(taskId, tenantId, req.body ?? {});

    await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: task.dataRegion,
      guardianInstanceId: task.guardianInstanceId ?? undefined,
      userId: req.user?.userId,
      actorType: 'user',
      actorId: req.user?.userId,
      action: 'REMEDIATION_TASK_UPDATED',
      severity: task.status === 'completed' ? 'info' : 'warning',
      resourceType: 'REMEDIATION_TASK',
      resourceId: task.id,
      metadata: { status: task.status },
    });

    return res.json({ success: true, data: task });
  } catch (error) {
    return handleError(res, error, 'Failed to update Guardian security remediation task');
  }
}

export async function listSecurityAuditEvents(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { guardianInstanceId, actorType, severity } = req.query;

    const events = await guardianSecurityService.listSecurityAuditEvents({
      tenantId,
      guardianInstanceId: typeof guardianInstanceId === 'string' ? guardianInstanceId : undefined,
      actorType: typeof actorType === 'string' ? actorType : undefined,
      severity: typeof severity === 'string' ? severity : undefined,
      page: parseNumber(req.query.page),
      pageSize: parseNumber(req.query.pageSize),
    });

    return res.json({ success: true, ...events });
  } catch (error) {
    return handleError(res, error, 'Failed to list Guardian security audit events');
  }
}

export async function recordSecurityAuditEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const tenantId = requireTenantContext(req);
    const { guardianInstanceId, actorType, actorId, action, severity, resourceType, resourceId, impersonationTenantId, context, metadata, dataRegion } = req.body ?? {};

    if (!actorType || !action) {
      return res.status(400).json({ success: false, error: 'actorType and action are required' });
    }

    const event = await guardianSecurityService.recordSecurityAuditEvent({
      tenantId,
      dataRegion: dataRegion ?? 'us',
      guardianInstanceId,
      userId: req.user?.userId,
      actorType,
      actorId: actorId ?? req.user?.userId,
      action,
      severity,
      resourceType,
      resourceId,
      impersonationTenantId,
      context,
      metadata,
    });

    return res.status(201).json({ success: true, data: event });
  } catch (error) {
    return handleError(res, error, 'Failed to record Guardian security audit event');
  }
}

export default {
  listSecurityInstances,
  createSecurityInstance,
  getSecurityInstance,
  updateSecurityInstance,
  archiveSecurityInstance,
  getSecurityOverview,
  listSecurityScans,
  createSecurityScan,
  updateSecurityScan,
  listSecurityFindings,
  createFindingForScan,
  updateSecurityFinding,
  listRemediationTasks,
  createRemediationTask,
  updateRemediationTask,
  listSecurityAuditEvents,
  recordSecurityAuditEvent,
  ingestGuardianAgentEvent,
};
