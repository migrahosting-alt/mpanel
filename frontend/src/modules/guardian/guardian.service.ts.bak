import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { GuardianQueueService } from './guardian.queue.service';

export type ActorContext = {
  userId: string | null;
  tenantId: string | null;
  roles: string[];
  isPlatform?: boolean;
};

@Injectable()
export class GuardianService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly queues: GuardianQueueService,
  ) {}

  private ensurePermission(ctx: ActorContext, permission: string, tenantId?: string) {
    const allowed = this.rbac.hasPermission(ctx.roles, permission, {
      tenantId: tenantId ?? ctx.tenantId ?? undefined,
      isPlatform: ctx.isPlatform,
    });
    if (!allowed) throw new ForbiddenException('Insufficient Guardian permissions');
  }

  // --- Summary for SOC / tenant dashboards ---
  async tenantSummary(ctx: ActorContext, tenantId: string) {
    this.ensurePermission(ctx, 'tenant:guardian:read', tenantId);

    const [activeInstances, openFindings, pendingTasks, recentScans] = await Promise.all([
      this.prisma.guardianInstance.count({ where: { tenantId, enabled: true } }),
      this.prisma.guardianFinding.count({ where: { tenantId, status: 'open' } }),
      this.prisma.guardianRemediationTask.count({
        where: {
          tenantId,
          status: { in: ['pending', 'approved', 'executing'] },
        },
      }),
      this.prisma.guardianScan.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      activeInstances,
      openFindings,
      pendingTasks,
      recentScansCount: recentScans.length,
      recentScans,
    };
  }

  // --- Instance management ---
  async getInstanceForTenant(ctx: ActorContext, tenantId: string) {
    this.ensurePermission(ctx, 'tenant:guardian:read', tenantId);
    return this.prisma.guardianInstance.findFirst({ where: { tenantId } });
  }

  async upsertInstanceForTenant(ctx: ActorContext, tenantId: string, body: any) {
    this.ensurePermission(ctx, 'tenant:guardian:manage', tenantId);

    const instance = await this.prisma.guardianInstance.upsert({
      where: { tenantId },
      create: {
        tenantId,
        dataRegion: body.dataRegion ?? 'us',
        environment: body.environment ?? 'production',
        enabled: body.enabled ?? true,
        policyPack: body.policyPack ?? 'default',
        policyVersion: body.policyVersion ?? 'v1',
        autoRemediationEnabled: body.autoRemediationEnabled ?? false,
        autoRemediationAllowedSeverities: body.autoRemediationAllowedSeverities ?? 'low,medium',
        allowProdAutoRemediation: body.allowProdAutoRemediation ?? false,
        createdByUserId: ctx.userId ?? undefined,
        updatedByUserId: ctx.userId ?? undefined,
      },
      update: {
        dataRegion: body.dataRegion ?? undefined,
        environment: body.environment ?? undefined,
        enabled: body.enabled ?? undefined,
        policyPack: body.policyPack ?? undefined,
        policyVersion: body.policyVersion ?? undefined,
        autoRemediationEnabled: body.autoRemediationEnabled ?? undefined,
        autoRemediationAllowedSeverities: body.autoRemediationAllowedSeverities ?? undefined,
        allowProdAutoRemediation: body.allowProdAutoRemediation ?? undefined,
        updatedByUserId: ctx.userId ?? undefined,
      },
    });

    await this.createAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      actorUserId: ctx.userId,
      actorRole: ctx.isPlatform ? 'platform_soc' : 'tenant_admin',
      eventType: 'guardian.instance.upserted',
      entityType: 'GuardianInstance',
      entityId: instance.id,
    });

    return instance;
  }

  // --- Scan orchestration ---
  async triggerScan(ctx: ActorContext, tenantId: string, body: { type: string; serverId?: string }) {
    this.ensurePermission(ctx, 'tenant:guardian:scan', tenantId);

    const instance = await this.prisma.guardianInstance.findFirst({
      where: { tenantId, enabled: true },
    });
    if (!instance) throw new Error('Guardian is not enabled for this tenant');

    const server = body.serverId
      ? await this.prisma.server.findFirst({ where: { id: body.serverId, tenantId } })
      : null;

    const scan = await this.prisma.guardianScan.create({
      data: {
        tenantId,
        instanceId: instance.id,
        serverId: server?.id,
        dataRegion: instance.dataRegion,
        type: body.type,
        status: 'queued',
        triggeredByUserId: ctx.userId ?? undefined,
        triggeredByRole: ctx.isPlatform ? 'platform_soc' : 'tenant_admin',
      },
    });

    await this.createAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      actorUserId: ctx.userId,
      actorRole: ctx.isPlatform ? 'platform_soc' : 'tenant_admin',
      eventType: 'guardian.scan.triggered',
      entityType: 'GuardianScan',
      entityId: scan.id,
      serverId: server?.id,
    });

    await this.queues.enqueueScan({
      scanId: scan.id,
      tenantId,
      serverId: server?.id ?? null,
      dataRegion: instance.dataRegion,
      type: body.type,
    });

    return scan;
  }

  async listScans(ctx: ActorContext, tenantId: string, limit = 50) {
    this.ensurePermission(ctx, 'tenant:guardian:read', tenantId);
    return this.prisma.guardianScan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async listFindings(ctx: ActorContext, tenantId: string, filters?: { status?: string; severity?: string }) {
    this.ensurePermission(ctx, 'tenant:guardian:read', tenantId);
    return this.prisma.guardianFinding.findMany({
      where: {
        tenantId,
        status: filters?.status ?? undefined,
        severity: filters?.severity ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async listRemediations(ctx: ActorContext, tenantId: string, status?: string) {
    this.ensurePermission(ctx, 'tenant:guardian:read', tenantId);
    return this.prisma.guardianRemediationTask.findMany({
      where: {
        tenantId,
        status: status ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // --- Remediation lifecycle ---
  async requestRemediation(
    ctx: ActorContext,
    tenantId: string,
    data: {
      scanId?: string;
      findingId?: string;
      serverId?: string;
      severity?: string;
      actionType: string;
      actionPayloadJson?: string;
    },
  ) {
    this.ensurePermission(ctx, 'tenant:guardian:remediate', tenantId);

    const instance = await this.prisma.guardianInstance.findFirst({
      where: { tenantId, enabled: true },
    });
    if (!instance) throw new Error('Guardian is not enabled for this tenant');

    const task = await this.prisma.guardianRemediationTask.create({
      data: {
        tenantId,
        instanceId: instance.id,
        scanId: data.scanId,
        findingId: data.findingId,
        serverId: data.serverId,
        dataRegion: instance.dataRegion,
        severity: data.severity,
        status: 'pending',
        mode: 'request',
        actionType: data.actionType,
        actionPayloadJson: data.actionPayloadJson,
        requestedByUserId: ctx.userId ?? undefined,
      },
    });

    await this.createAuditEvent({
      tenantId,
      dataRegion: instance.dataRegion,
      actorUserId: ctx.userId,
      actorRole: ctx.isPlatform ? 'platform_soc' : 'tenant_admin',
      eventType: 'guardian.remediation.requested',
      entityType: 'GuardianRemediationTask',
      entityId: task.id,
    });

    return task;
  }

  async approveRemediation(ctx: ActorContext, remediationId: string, scope: 'tenant' | 'platform') {
    const task = await this.prisma.guardianRemediationTask.findUnique({ where: { id: remediationId } });
    if (!task) throw new Error('Remediation task not found');

    if (scope === 'tenant') {
      this.ensurePermission(ctx, 'tenant:guardian:approve', task.tenantId);
    } else {
      this.ensurePermission(ctx, 'platform:guardian:approve', task.tenantId);
    }

    const data: any = {};
    if (scope === 'tenant') {
      data.tenantApprovedByUserId = ctx.userId ?? undefined;
      data.tenantApprovedAt = new Date();
    } else {
      data.platformApprovedByUserId = ctx.userId ?? undefined;
      data.platformApprovedAt = new Date();
    }

    const updated = await this.prisma.guardianRemediationTask.update({
      where: { id: remediationId },
      data,
    });

    await this.createAuditEvent({
      tenantId: updated.tenantId,
      dataRegion: updated.dataRegion,
      actorUserId: ctx.userId,
      actorRole: scope === 'tenant' ? 'tenant_admin' : 'platform_soc',
      eventType: 'guardian.remediation.approved',
      entityType: 'GuardianRemediationTask',
      entityId: remediationId,
    });

    if (updated.tenantApprovedAt && updated.platformApprovedAt && updated.status === 'pending') {
      await this.queues.enqueueRemediationExecution({
        remediationId: updated.id,
        tenantId: updated.tenantId,
        serverId: updated.serverId ?? null,
        dataRegion: updated.dataRegion,
      });
    }

    return updated;
  }

  // --- Platform metrics for SOC ---
  async platformMetrics(ctx: ActorContext) {
    this.ensurePermission(ctx, 'platform:guardian:read');

    const [bySeverity, openRemediations, tenantsWithGuardian] = await Promise.all([
      this.prisma.guardianFinding.groupBy({
        by: ['severity'],
        _count: { _all: true },
      }),
      this.prisma.guardianRemediationTask.count({
        where: { status: { in: ['pending', 'approved', 'executing'] } },
      }),
      this.prisma.guardianInstance.count({ where: { enabled: true } }),
    ]);

    return {
      bySeverity,
      openRemediations,
      tenantsWithGuardian,
    };
  }

  // --- Audit helper ---
  async createAuditEvent(data: {
    tenantId?: string | null;
    dataRegion?: string | null;
    actorUserId?: string | null;
    actorRole?: string | null;
    eventType: string;
    entityType?: string | null;
    entityId?: string | null;
    serverId?: string | null;
    metadataJson?: string | null;
  }) {
    return this.prisma.guardianAuditEvent.create({
      data: {
        tenantId: data.tenantId ?? undefined,
        dataRegion: data.dataRegion ?? undefined,
        actorUserId: data.actorUserId ?? undefined,
        actorRole: data.actorRole ?? undefined,
        eventType: data.eventType,
        entityType: data.entityType ?? undefined,
        entityId: data.entityId ?? undefined,
        serverId: data.serverId ?? undefined,
        metadataJson: data.metadataJson ?? undefined,
      },
    });
  }
}
