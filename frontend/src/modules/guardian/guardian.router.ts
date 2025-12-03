/**
 * Guardian Router - Security engine endpoints per master spec
 */
import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantRole, requirePlatformPermission } from '../../middleware/rbac.middleware.js';
import { prisma } from '../../config/database.js';

const router = express.Router();
router.use(authMiddleware);

function getCtx(req: any) {
  const user = req.user || {};
  return {
    userId: user.userId,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
  };
}

// GET /guardian/summary
router.get('/summary', async (req, res) => {
  try {
    const { tenantId } = getCtx(req);

    const [activeInstances, openFindings, pendingTasks, recentScans] = await Promise.all([
      prisma.guardianInstance.count({ where: { tenantId, enabled: true } }),
      prisma.guardianFinding.count({ where: { tenantId, status: 'open' } }),
      prisma.guardianRemediationTask.count({ where: { tenantId, status: 'pending' } }),
      prisma.guardianScan.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true, tenantId: true, instanceId: true, serverId: true, dataRegion: true,
          type: true, status: true, findingsCount: true, severityMax: true,
          startedAt: true, completedAt: true,
        },
      }),
    ]);

    res.json({
      activeInstances,
      openFindings,
      pendingTasks,
      recentScansCount: recentScans.length,
      recentScans,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

// GET /guardian/instance
router.get('/instance', async (req, res) => {
  try {
    const { tenantId } = getCtx(req);
    const instance = await prisma.guardianInstance.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(instance ?? null);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load instance' });
  }
});

// POST /guardian/instance
router.post(
  '/instance',
  requireTenantRole(['OWNER', 'ADMIN']),
  async (req, res) => {
    try {
      const { tenantId } = getCtx(req);
      const {
        dataRegion = 'us',
        enabled = true,
        environment = 'production',
        policyPack = 'default',
        policyVersion = 'v1',
        autoRemediationEnabled = false,
        autoRemediationAllowedSeverities = 'low,medium',
        allowProdAutoRemediation = false,
      } = req.body || {};

      const instance = await prisma.guardianInstance.create({
        data: {
          tenantId,
          dataRegion,
          enabled,
          environment,
          policyPack,
          policyVersion,
          autoRemediationEnabled,
          autoRemediationAllowedSeverities,
          allowProdAutoRemediation,
        },
      });
      res.status(201).json(instance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create instance' });
    }
  }
);

// POST /guardian/scan
router.post('/scan', requireTenantRole(['OWNER', 'ADMIN', 'MEMBER']), async (req, res): Promise<void> => {
  try {
    const { tenantId } = getCtx(req);
    const { type, serverId } = req.body || {};
    if (!type) {
      res.status(400).json({ error: 'type is required' });
      return;
    }

    const instance = await prisma.guardianInstance.findFirst({ where: { tenantId, enabled: true } });
    if (!instance) {
      res.status(400).json({ error: 'GuardianInstance not configured' });
      return;
    }

    const scan = await prisma.guardianScan.create({
      data: {
        tenantId,
        instanceId: instance.id,
        serverId: serverId ?? null,
        dataRegion: instance.dataRegion,
        type,
        status: 'queued',
      },
    });

    // TODO: Enqueue scan job when queue service is ready

    res.status(201).json({ id: scan.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger scan' });
  }
});

// GET /guardian/scans
router.get('/scans', async (req, res) => {
  try {
    const { tenantId } = getCtx(req);
    const limit = Number(req.query.limit ?? 20);
    const scans = await prisma.guardianScan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 100)),
    });
    res.json(scans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list scans' });
  }
});

// GET /guardian/findings
router.get('/findings', async (req, res) => {
  try {
    const { tenantId } = getCtx(req);
    const { status, severity } = req.query as { status?: string; severity?: string };

    const where: any = { tenantId };
    if (status) where.status = String(status);
    if (severity) where.severity = String(severity);

    const findings = await prisma.guardianFinding.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(findings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list findings' });
  }
});

// GET /guardian/remediations
router.get('/remediations', async (req, res) => {
  try {
    const { tenantId } = getCtx(req);
    const { status } = req.query as { status?: string };
    const where: any = { tenantId };
    if (status) where.status = String(status);

    const tasks = await prisma.guardianRemediationTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list remediations' });
  }
});

// POST /guardian/remediations/request
router.post('/remediations/request', requireTenantRole(['OWNER', 'ADMIN']), async (req, res): Promise<void> => {
  try {
    const { tenantId, userId } = getCtx(req);
    const {
      scanId,
      findingId,
      serverId,
      severity,
      actionType,
      actionPayloadJson,
    } = req.body || {};

    if (!actionType) {
      res.status(400).json({ error: 'actionType is required' });
      return;
    }

    const instance = await prisma.guardianInstance.findFirst({ where: { tenantId, enabled: true } });
    if (!instance) {
      res.status(400).json({ error: 'GuardianInstance not configured' });
      return;
    }

    const task = await prisma.guardianRemediationTask.create({
      data: {
        tenantId,
        instanceId: instance.id,
        scanId: scanId ?? null,
        findingId: findingId ?? null,
        serverId: serverId ?? null,
        dataRegion: instance.dataRegion,
        status: 'pending',
        mode: 'request',
        severity: severity ?? null,
        actionType,
        actionPayloadJson: actionPayloadJson ?? null,
        requestedByUserId: userId ?? null,
      },
    });

    res.status(201).json({ id: task.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request remediation' });
  }
});

// POST /guardian/remediations/:id/approve-tenant
router.post('/remediations/:id/approve-tenant', requireTenantRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId, userId } = getCtx(req);

    const updated = await prisma.guardianRemediationTask.update({
      where: { id },
      data: {
        tenantId,
        tenantApprovedAt: new Date(),
        tenantApprovedByUserId: userId ?? null,
      },
    });

    res.json({ id: updated.id, status: updated.status, tenantApprovedAt: updated.tenantApprovedAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve remediation (tenant)' });
  }
});

// POST /guardian/remediations/:id/approve-platform
router.post('/remediations/:id/approve-platform', requirePlatformPermission('platform:guardian:approve'), async (req, res): Promise<void> => {
  try {
    // Platform-only; enforce via role check or later via requirePlatformPermission
    const { id } = req.params;
    const { userId } = getCtx(req);
    const task = await prisma.guardianRemediationTask.findUnique({ where: { id } });
    if (!task) {
      res.status(404).json({ error: 'Remediation task not found' });
      return;
    }

    const updated = await prisma.guardianRemediationTask.update({
      where: { id },
      data: {
        platformApprovedAt: new Date(),
        platformApprovedByUserId: userId ?? null,
      },
    });

    // TODO: Enqueue execution when queue service is ready

    res.json({ id: updated.id, status: updated.status, platformApprovedAt: updated.platformApprovedAt });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve remediation (platform)' });
  }
});

// GET /guardian/platform/metrics (platform-only)
router.get('/platform/metrics', requirePlatformPermission('platform:guardian:read'), async (req, res) => {
  try {
    // Basic aggregate; backend must enforce platform-only access
    const [instances, findings, remediations, scans] = await Promise.all([
      prisma.guardianInstance.count(),
      prisma.guardianFinding.count(),
      prisma.guardianRemediationTask.count(),
      prisma.guardianScan.count(),
    ]);

    res.json({ instances, findings, remediations, scans });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load platform metrics' });
  }
});

export default router;
