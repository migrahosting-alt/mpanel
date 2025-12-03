import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function toJsonValue(
  value?: Record<string, unknown> | null
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function getPagination(page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : DEFAULT_PAGE_SIZE;
  const take = Math.min(safePageSize, MAX_PAGE_SIZE);
  const skip = (safePage - 1) * take;

  return { skip, take, page: safePage, pageSize: take };
}

function ensureTenantScope<T extends { tenantId: string | null }>(record: T | null, tenantId: string) {
  if (!record || record.tenantId !== tenantId) {
    throw new Error('Resource not found in this tenant context');
  }
  return record;
}

export interface ListInstancesOptions {
  tenantId: string;
  dataRegion?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listInstances(options: ListInstancesOptions) {
  const { tenantId, dataRegion, status, search, page, pageSize } = options;
  const pagination = getPagination(page, pageSize);

  const where: Prisma.GuardianSecurityInstanceWhereInput = {
    tenantId,
    deletedAt: null,
  };

  if (dataRegion) {
    where.dataRegion = dataRegion;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { environment: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.guardianSecurityInstance.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.guardianSecurityInstance.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export async function getInstance(instanceId: string, tenantId: string) {
  const instance = await prisma.guardianSecurityInstance.findFirst({
    where: {
      id: instanceId,
      tenantId,
      deletedAt: null,
    },
    include: {
      scans: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          findingsCount: true,
          createdAt: true,
        },
      },
      findings: {
        where: { status: 'open' },
        select: { id: true },
      },
      remediationTasks: {
        where: { status: { not: 'completed' } },
        select: { id: true, status: true },
      },
    },
  });

  return instance;
}

export interface CreateInstanceInput {
  tenantId: string;
  name: string;
  dataRegion?: string;
  environment?: string;
  mode?: string;
  policyPack?: Record<string, unknown>;
  autoRemediationSettings?: Record<string, unknown>;
  detectionSources?: Record<string, unknown>;
  notificationSettings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createInstance(input: CreateInstanceInput) {
  const instance = await prisma.guardianSecurityInstance.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      dataRegion: input.dataRegion ?? 'us',
      environment: input.environment ?? 'production',
      mode: input.mode ?? 'report_only',
      policyPack: toJsonValue(input.policyPack ?? {}),
      autoRemediationSettings: toJsonValue(input.autoRemediationSettings ?? {}),
      detectionSources: toJsonValue(input.detectionSources ?? {}),
      notificationSettings: toJsonValue(input.notificationSettings ?? {}),
      metadata: toJsonValue(input.metadata ?? {}),
      status: 'active',
    },
  });

  logger.info('Guardian security instance created', {
    instanceId: instance.id,
    tenantId: input.tenantId,
  });

  return instance;
}

export interface UpdateInstanceInput {
  name?: string;
  status?: string;
  mode?: string;
  policyPack?: Record<string, unknown> | null;
  autoRemediationSettings?: Record<string, unknown> | null;
  detectionSources?: Record<string, unknown> | null;
  notificationSettings?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateInstance(
  instanceId: string,
  tenantId: string,
  input: UpdateInstanceInput
) {
  await ensureTenantScope(
    await prisma.guardianSecurityInstance.findFirst({ where: { id: instanceId, tenantId } }),
    tenantId
  );

  const data: Prisma.GuardianSecurityInstanceUpdateInput = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.mode !== undefined) {
    data.mode = input.mode;
  }
  if (input.policyPack !== undefined) {
    data.policyPack = toJsonValue(input.policyPack);
  }
  if (input.autoRemediationSettings !== undefined) {
    data.autoRemediationSettings = toJsonValue(input.autoRemediationSettings);
  }
  if (input.detectionSources !== undefined) {
    data.detectionSources = toJsonValue(input.detectionSources);
  }
  if (input.notificationSettings !== undefined) {
    data.notificationSettings = toJsonValue(input.notificationSettings);
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  const instance = await prisma.guardianSecurityInstance.update({
    where: { id: instanceId },
    data,
  });

  return instance;
}

export async function archiveInstance(instanceId: string, tenantId: string) {
  await ensureTenantScope(
    await prisma.guardianSecurityInstance.findFirst({ where: { id: instanceId, tenantId } }),
    tenantId
  );

  const instance = await prisma.guardianSecurityInstance.update({
    where: { id: instanceId },
    data: {
      status: 'archived',
      deletedAt: new Date(),
    },
  });

  return instance;
}

export interface ListScansOptions {
  tenantId: string;
  status?: string;
  serverId?: string;
  instanceId?: string;
  page?: number;
  pageSize?: number;
}

export async function listScans(options: ListScansOptions) {
  const { tenantId, status, serverId, instanceId, page, pageSize } = options;
  const pagination = getPagination(page, pageSize);

  const where: Prisma.GuardianSecurityScanWhereInput = {
    tenantId,
  };

  if (status) {
    where.status = status;
  }

  if (serverId) {
    where.serverId = serverId;
  }

  if (instanceId) {
    where.guardianInstanceId = instanceId;
  }

  const [items, total] = await Promise.all([
    prisma.guardianSecurityScan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        securityInstance: {
          select: { id: true, name: true },
        },
        server: {
          select: { id: true, name: true, ipAddress: true },
        },
      },
    }),
    prisma.guardianSecurityScan.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export interface CreateScanInput {
  tenantId: string;
  dataRegion: string;
  guardianInstanceId?: string;
  serverId?: string;
  sourceType?: string;
  scanType?: string;
  mode?: string;
  triggeredBy?: string;
  triggeredByType?: string;
  metadata?: Record<string, unknown>;
}

export async function createScan(input: CreateScanInput) {
  if (input.guardianInstanceId) {
    await ensureTenantScope(
      await prisma.guardianSecurityInstance.findFirst({
        where: { id: input.guardianInstanceId, tenantId: input.tenantId },
      }),
      input.tenantId
    );
  }

  const scan = await prisma.guardianSecurityScan.create({
    data: {
      tenantId: input.tenantId,
      dataRegion: input.dataRegion,
      guardianInstanceId: input.guardianInstanceId ?? null,
      serverId: input.serverId ?? null,
      sourceType: input.sourceType ?? 'migra_agent',
      scanType: input.scanType ?? 'scheduled',
      mode: input.mode ?? 'report_only',
      triggeredBy: input.triggeredBy ?? null,
      triggeredByType: input.triggeredByType ?? null,
      metadata: toJsonValue(input.metadata ?? {}),
      status: 'pending',
    },
  });

  return scan;
}

export interface UpdateScanInput {
  status?: string;
  findingsCount?: number;
  severitySummary?: Record<string, unknown> | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateScan(scanId: string, tenantId: string, input: UpdateScanInput) {
  await ensureTenantScope(
    await prisma.guardianSecurityScan.findFirst({ where: { id: scanId, tenantId } }),
    tenantId
  );

  const data: Prisma.GuardianSecurityScanUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (typeof input.findingsCount === 'number') {
    data.findingsCount = input.findingsCount;
  }
  if (input.severitySummary !== undefined) {
    data.severitySummary = toJsonValue(input.severitySummary);
  }
  if (input.startedAt !== undefined) {
    data.startedAt = input.startedAt;
  }
  if (input.completedAt !== undefined) {
    data.completedAt = input.completedAt;
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  const scan = await prisma.guardianSecurityScan.update({
    where: { id: scanId },
    data,
  });

  return scan;
}

export interface ListFindingsOptions {
  tenantId: string;
  status?: string;
  severity?: string;
  serverId?: string;
  instanceId?: string;
  scanId?: string;
  page?: number;
  pageSize?: number;
}

export async function listFindings(options: ListFindingsOptions) {
  const { tenantId, status, severity, serverId, instanceId, scanId, page, pageSize } = options;
  const pagination = getPagination(page, pageSize);

  const where: Prisma.GuardianSecurityFindingWhereInput = {
    tenantId,
  };

  if (status) {
    where.status = status;
  }

  if (severity) {
    where.severity = severity;
  }

  if (serverId) {
    where.serverId = serverId;
  }

  if (instanceId) {
    where.guardianInstanceId = instanceId;
  }

  if (scanId) {
    where.scanId = scanId;
  }

  const [items, total] = await Promise.all([
    prisma.guardianSecurityFinding.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        server: {
          select: { id: true, name: true, ipAddress: true },
        },
        scan: {
          select: { id: true, status: true },
        },
        remediationTasks: {
          select: { id: true, status: true },
        },
      },
    }),
    prisma.guardianSecurityFinding.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export interface CreateFindingInput {
  tenantId: string;
  dataRegion: string;
  title: string;
  severity?: string;
  description?: string;
  guardianInstanceId?: string;
  scanId?: string;
  serverId?: string;
  category?: string;
  signatureId?: string;
  recommendedAction?: string;
  evidence?: Record<string, unknown>;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function createFinding(input: CreateFindingInput) {
  if (input.guardianInstanceId) {
    await ensureTenantScope(
      await prisma.guardianSecurityInstance.findFirst({
        where: { id: input.guardianInstanceId, tenantId: input.tenantId },
      }),
      input.tenantId
    );
  }

  if (input.scanId) {
    await ensureTenantScope(
      await prisma.guardianSecurityScan.findFirst({ where: { id: input.scanId, tenantId: input.tenantId } }),
      input.tenantId
    );
  }

  const finding = await prisma.guardianSecurityFinding.create({
    data: {
      tenantId: input.tenantId,
      dataRegion: input.dataRegion,
      guardianInstanceId: input.guardianInstanceId ?? null,
      scanId: input.scanId ?? null,
      serverId: input.serverId ?? null,
      title: input.title,
      severity: input.severity ?? 'low',
      description: input.description ?? null,
      category: input.category ?? null,
      signatureId: input.signatureId ?? null,
      recommendedAction: input.recommendedAction ?? null,
      evidence: toJsonValue(input.evidence ?? {}),
      context: toJsonValue(input.context ?? {}),
      metadata: toJsonValue(input.metadata ?? {}),
    },
  });

  if (input.scanId) {
    await prisma.guardianSecurityScan.update({
      where: { id: input.scanId },
      data: {
        findingsCount: { increment: 1 },
      },
    });
  }

  return finding;
}

export interface UpdateFindingInput {
  status?: string;
  remediationStatus?: string;
  remediationMode?: string | null;
  recommendedAction?: string | null;
  evidence?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateFinding(findingId: string, tenantId: string, input: UpdateFindingInput) {
  await ensureTenantScope(
    await prisma.guardianSecurityFinding.findFirst({ where: { id: findingId, tenantId } }),
    tenantId
  );

  const now = new Date();
  const data: Prisma.GuardianSecurityFindingUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.remediationStatus !== undefined) {
    data.remediationStatus = input.remediationStatus;
  }
  if (input.remediationMode !== undefined) {
    data.remediationMode = input.remediationMode;
  }
  if (input.recommendedAction !== undefined) {
    data.recommendedAction = input.recommendedAction;
  }
  if (input.evidence !== undefined) {
    data.evidence = toJsonValue(input.evidence);
  }
  if (input.context !== undefined) {
    data.context = toJsonValue(input.context);
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  if (input.status === 'resolved') {
    data.resolvedAt = now;
  }

  const finding = await prisma.guardianSecurityFinding.update({
    where: { id: findingId },
    data,
  });

  return finding;
}

export interface ListRemediationTasksOptions {
  tenantId: string;
  status?: string;
  serverId?: string;
  findingId?: string;
  page?: number;
  pageSize?: number;
}

export async function listRemediationTasks(options: ListRemediationTasksOptions) {
  const { tenantId, status, serverId, findingId, page, pageSize } = options;
  const pagination = getPagination(page, pageSize);

  const where: Prisma.GuardianSecurityRemediationTaskWhereInput = {
    tenantId,
  };

  if (status) {
    where.status = status;
  }

  if (serverId) {
    where.serverId = serverId;
  }

  if (findingId) {
    where.findingId = findingId;
  }

  const [items, total] = await Promise.all([
    prisma.guardianSecurityRemediationTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
      include: {
        finding: {
          select: { id: true, title: true, severity: true },
        },
        server: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.guardianSecurityRemediationTask.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export interface CreateRemediationTaskInput {
  tenantId: string;
  dataRegion: string;
  guardianInstanceId?: string;
  serverId?: string;
  scanId?: string;
  findingId?: string;
  mode?: string;
  severity?: string;
  requestedBy?: string;
  requestedByType?: string;
  metadata?: Record<string, unknown>;
}

export async function createRemediationTask(input: CreateRemediationTaskInput) {
  if (input.findingId) {
    await ensureTenantScope(
      await prisma.guardianSecurityFinding.findFirst({ where: { id: input.findingId, tenantId: input.tenantId } }),
      input.tenantId
    );
  }

  const task = await prisma.guardianSecurityRemediationTask.create({
    data: {
      tenantId: input.tenantId,
      dataRegion: input.dataRegion,
      guardianInstanceId: input.guardianInstanceId ?? null,
      serverId: input.serverId ?? null,
      scanId: input.scanId ?? null,
      findingId: input.findingId ?? null,
      mode: input.mode ?? 'request_only',
      severity: input.severity ?? null,
      requestedBy: input.requestedBy ?? null,
      requestedByType: input.requestedByType ?? null,
      metadata: toJsonValue(input.metadata ?? {}),
      status: 'pending',
    },
  });

  return task;
}

export interface UpdateRemediationTaskInput {
  status?: string;
  approvals?: Record<string, unknown> | null;
  requiredApprovals?: Record<string, unknown> | null;
  approvedTenantBy?: string | null;
  approvedPlatformBy?: string | null;
  approvedTenantAt?: Date | null;
  approvedPlatformAt?: Date | null;
  executedBy?: string | null;
  executedAt?: Date | null;
  completedAt?: Date | null;
  result?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function updateRemediationTask(
  taskId: string,
  tenantId: string,
  input: UpdateRemediationTaskInput
) {
  await ensureTenantScope(
    await prisma.guardianSecurityRemediationTask.findFirst({ where: { id: taskId, tenantId } }),
    tenantId
  );

  const data: Prisma.GuardianSecurityRemediationTaskUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }
  if (input.approvals !== undefined) {
    data.approvals = toJsonValue(input.approvals);
  }
  if (input.requiredApprovals !== undefined) {
    data.requiredApprovals = toJsonValue(input.requiredApprovals);
  }
  if (input.approvedTenantBy !== undefined) {
    data.approvedTenantBy = input.approvedTenantBy;
  }
  if (input.approvedPlatformBy !== undefined) {
    data.approvedPlatformBy = input.approvedPlatformBy;
  }
  if (input.approvedTenantAt !== undefined) {
    data.approvedTenantAt = input.approvedTenantAt;
  }
  if (input.approvedPlatformAt !== undefined) {
    data.approvedPlatformAt = input.approvedPlatformAt;
  }
  if (input.executedBy !== undefined) {
    data.executedBy = input.executedBy;
  }
  if (input.executedAt !== undefined) {
    data.executedAt = input.executedAt;
  }
  if (input.completedAt !== undefined) {
    data.completedAt = input.completedAt;
  }
  if (input.result !== undefined) {
    data.result = toJsonValue(input.result);
  }
  if (input.metadata !== undefined) {
    data.metadata = toJsonValue(input.metadata);
  }

  const task = await prisma.guardianSecurityRemediationTask.update({
    where: { id: taskId },
    data,
  });

  return task;
}

export interface RecordSecurityAuditEventInput {
  tenantId: string;
  dataRegion: string;
  guardianInstanceId?: string;
  userId?: string;
  actorType: string;
  actorId?: string;
  action: string;
  severity?: string;
  resourceType?: string;
  resourceId?: string;
  impersonationTenantId?: string;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function recordSecurityAuditEvent(input: RecordSecurityAuditEventInput) {
  const event = await prisma.guardianSecurityAuditEvent.create({
    data: {
      tenantId: input.tenantId,
      dataRegion: input.dataRegion,
      guardianInstanceId: input.guardianInstanceId ?? null,
      userId: input.userId ?? null,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      severity: input.severity ?? 'info',
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      impersonationTenantId: input.impersonationTenantId ?? null,
      context: toJsonValue(input.context ?? {}),
      metadata: toJsonValue(input.metadata ?? {}),
    },
  });

  return event;
}

export interface ListSecurityAuditEventsOptions {
  tenantId: string;
  guardianInstanceId?: string;
  actorType?: string;
  severity?: string;
  page?: number;
  pageSize?: number;
}

export async function listSecurityAuditEvents(options: ListSecurityAuditEventsOptions) {
  const { tenantId, guardianInstanceId, actorType, severity, page, pageSize } = options;
  const pagination = getPagination(page, pageSize);

  const where: Prisma.GuardianSecurityAuditEventWhereInput = {
    tenantId,
  };

  if (guardianInstanceId) {
    where.guardianInstanceId = guardianInstanceId;
  }

  if (actorType) {
    where.actorType = actorType;
  }

  if (severity) {
    where.severity = severity;
  }

  const [items, total] = await Promise.all([
    prisma.guardianSecurityAuditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.guardianSecurityAuditEvent.count({ where }),
  ]);

  return {
    data: items,
    meta: {
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalPages: Math.ceil(total / pagination.pageSize),
    },
  };
}

export async function getSecurityOverview(tenantId: string) {
  const [activeInstances, openFindings, pendingTasks, recentScans] = await Promise.all([
    prisma.guardianSecurityInstance.count({
      where: { tenantId, status: 'active', deletedAt: null },
    }),
    prisma.guardianSecurityFinding.count({
      where: { tenantId, status: { in: ['open', 'acknowledged'] } },
    }),
    prisma.guardianSecurityRemediationTask.count({
      where: {
        tenantId,
        status: { in: ['pending', 'awaiting_approval', 'in_progress'] },
      },
    }),
    prisma.guardianSecurityScan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        findingsCount: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    activeInstances,
    openFindings,
    pendingTasks,
    recentScans,
  };
}

export default {
  listInstances,
  getInstance,
  createInstance,
  updateInstance,
  archiveInstance,
  listScans,
  createScan,
  updateScan,
  listFindings,
  createFinding,
  updateFinding,
  listRemediationTasks,
  createRemediationTask,
  updateRemediationTask,
  recordSecurityAuditEvent,
  listSecurityAuditEvents,
  getSecurityOverview,
};
