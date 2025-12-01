/**
 * CloudPods REST API Routes
 * 
 * Internal API endpoints for CloudPod management.
 * All routes require authentication and tenant authorization.
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 5
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import {
  enqueueCloudPodCreate,
  enqueueCloudPodDestroy,
  enqueueCloudPodBackup,
  enqueueCloudPodHealth,
  enqueueCloudPodScale,
  getQueueStats,
} from '../services/cloudPodQueues.js';
import {
  checkCreateCapacity,
  checkScaleCapacity,
  getQuotaSummary,
  recalculateUsage,
} from '../services/cloudPodQuotas.js';
import { getNextVmid, getCloudPodHealth } from '../services/proxmoxSsh.js';

const router = Router();

// ============================================
// Helper Functions
// ============================================

function sendError(res: Response, status: number, message: string, details?: any) {
  res.status(status).json({ success: false, error: message, details });
}

function sendSuccess(res: Response, data: any, status: number = 200) {
  res.status(status).json({ success: true, ...data });
}

// ============================================
// CloudPod CRUD
// ============================================

/**
 * POST /internal/cloudpods
 * Create a new CloudPod
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      tenantId,
      hostname,
      vmid: requestedVmid,
      planId,
      region = 'migra-us-east-1',
      cores = 2,
      memoryMb = 2048,
      swapMb = 512,
      diskGb = 8,
      autoIp = true,
      ip,
      blueprintId,
    } = req.body;

    // Validation
    if (!tenantId) {
      return sendError(res, 400, 'tenantId is required');
    }
    if (!hostname) {
      return sendError(res, 400, 'hostname is required');
    }

    // Check quota capacity
    const quotaCheck = await checkCreateCapacity(tenantId, cores, memoryMb, diskGb);
    if (!quotaCheck.allowed) {
      return sendError(res, 403, 'Quota exceeded', {
        reason: quotaCheck.reason,
        current: quotaCheck.current,
        limits: quotaCheck.limits,
      });
    }

    // Get next VMID if not provided
    const vmid = requestedVmid ?? await getNextVmid();

    // Check if VMID already in use
    const existing = await prisma.cloudPod.findUnique({ where: { vmid } });
    if (existing) {
      return sendError(res, 409, `VMID ${vmid} is already in use`);
    }

    // Create job record
    const jobPayload = {
      tenantId,
      vmid,
      hostname,
      ip,
      autoIp,
      cores,
      memoryMb,
      swapMb,
      diskGb,
      region,
      requestedBy: (req as any).user?.id ?? 'api',
      blueprintId,
      planId,
    };

    // Enqueue create job
    const job = await enqueueCloudPodCreate(jobPayload);

    // Record job in DB
    const dbJob = await prisma.cloudPodJob.create({
      data: {
        tenantId,
        type: 'CREATE',
        status: 'queued',
        payload: jobPayload as any,
        bullJobId: job.id,
      },
    });

    sendSuccess(res, {
      message: 'CloudPod creation queued',
      jobId: dbJob.id,
      bullJobId: job.id,
      vmid,
      hostname,
      estimatedWait: '30-60 seconds',
    }, 202);

  } catch (error: any) {
    console.error('[API] Create CloudPod error:', error);
    sendError(res, 500, 'Failed to queue CloudPod creation', error.message);
  }
});

/**
 * GET /internal/cloudpods
 * List CloudPods for a tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, status, includeDeleted } = req.query;

    if (!tenantId) {
      return sendError(res, 400, 'tenantId query parameter is required');
    }

    const where: any = {
      tenantId: tenantId as string,
    };

    if (status) {
      where.status = status;
    }

    if (includeDeleted !== 'true') {
      where.deletedAt = null;
    }

    const pods = await prisma.cloudPod.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        blueprint: { select: { name: true, slug: true } },
      },
    });

    sendSuccess(res, { cloudPods: pods, count: pods.length });

  } catch (error: any) {
    console.error('[API] List CloudPods error:', error);
    sendError(res, 500, 'Failed to list CloudPods', error.message);
  }
});

/**
 * GET /internal/cloudpods/:vmid
 * Get a specific CloudPod by VMID
 */
router.get('/:vmid', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({
      where: { vmid },
      include: {
        blueprint: { select: { name: true, slug: true } },
        events: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        jobs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    sendSuccess(res, { cloudPod: pod });

  } catch (error: any) {
    console.error('[API] Get CloudPod error:', error);
    sendError(res, 500, 'Failed to get CloudPod', error.message);
  }
});

/**
 * POST /internal/cloudpods/:vmid/destroy
 * Destroy a CloudPod
 */
router.post('/:vmid/destroy', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { reason } = req.body;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    if (pod.status === 'deleted') {
      return sendError(res, 400, 'CloudPod is already deleted');
    }

    if (pod.status === 'deleting') {
      return sendError(res, 400, 'CloudPod destruction already in progress');
    }

    const jobPayload = {
      tenantId: pod.tenantId,
      vmid,
      cloudPodId: pod.id,
      requestedBy: (req as any).user?.id ?? 'api',
      reason,
    };

    const job = await enqueueCloudPodDestroy(jobPayload);

    // Update status immediately
    await prisma.cloudPod.update({
      where: { vmid },
      data: { status: 'deleting' },
    });

    sendSuccess(res, {
      message: 'CloudPod destruction queued',
      jobId: job.id,
      vmid,
    }, 202);

  } catch (error: any) {
    console.error('[API] Destroy CloudPod error:', error);
    sendError(res, 500, 'Failed to queue CloudPod destruction', error.message);
  }
});

// ============================================
// Backup Operations
// ============================================

/**
 * POST /internal/cloudpods/:vmid/backup
 * Create a backup/snapshot
 */
router.post('/:vmid/backup', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { mode = 'snapshot', snapshotName, reason } = req.body;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    if (pod.status !== 'active') {
      return sendError(res, 400, `Cannot backup CloudPod in '${pod.status}' state`);
    }

    const jobPayload = {
      tenantId: pod.tenantId,
      vmid,
      cloudPodId: pod.id,
      mode: mode as 'snapshot' | 'suspend' | 'stop',
      snapshotName,
      reason,
      triggeredBy: 'manual' as const,
    };

    const job = await enqueueCloudPodBackup(jobPayload);

    sendSuccess(res, {
      message: 'Backup job queued',
      jobId: job.id,
      vmid,
    }, 202);

  } catch (error: any) {
    console.error('[API] Backup CloudPod error:', error);
    sendError(res, 500, 'Failed to queue backup', error.message);
  }
});

// ============================================
// Health Operations
// ============================================

/**
 * GET /internal/cloudpods/:vmid/health
 * Get health status (from DB, optionally triggers refresh)
 */
router.get('/:vmid/health', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { refresh } = req.query;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    // If refresh requested, get live data
    if (refresh === 'true') {
      try {
        const liveHealth = await getCloudPodHealth(vmid);

        // Update DB
        await prisma.cloudPod.update({
          where: { vmid },
          data: {
            lastHealthStatus: liveHealth.healthy ? 'ok' : 'warning',
            lastHealthChecked: new Date(),
          },
        });

        return sendSuccess(res, {
          health: liveHealth,
          source: 'live',
          refreshedAt: new Date().toISOString(),
        });
      } catch (healthError: any) {
        // Return stale data with error
        return sendSuccess(res, {
          health: {
            status: pod.lastHealthStatus ?? 'unknown',
            lastChecked: pod.lastHealthChecked,
          },
          source: 'cached',
          refreshError: healthError.message,
        });
      }
    }

    // Return cached data
    sendSuccess(res, {
      health: {
        status: pod.lastHealthStatus ?? 'unknown',
        lastChecked: pod.lastHealthChecked,
      },
      source: 'cached',
    });

  } catch (error: any) {
    console.error('[API] Get CloudPod health error:', error);
    sendError(res, 500, 'Failed to get health status', error.message);
  }
});

/**
 * POST /internal/cloudpods/:vmid/health
 * Trigger a health check job
 */
router.post('/:vmid/health', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    const job = await enqueueCloudPodHealth({
      tenantId: pod.tenantId,
      vmid,
      cloudPodId: pod.id,
      triggeredBy: 'manual',
    });

    sendSuccess(res, {
      message: 'Health check queued',
      jobId: job.id,
      vmid,
    }, 202);

  } catch (error: any) {
    console.error('[API] Queue health check error:', error);
    sendError(res, 500, 'Failed to queue health check', error.message);
  }
});

// ============================================
// Scale Operations
// ============================================

/**
 * POST /internal/cloudpods/:vmid/scale
 * Scale a CloudPod (change CPU/RAM)
 */
router.post('/:vmid/scale', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { cores, memoryMb, reason, backupFirst = true } = req.body;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    if (!cores && !memoryMb) {
      return sendError(res, 400, 'Either cores or memoryMb must be provided');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    if (pod.status !== 'active') {
      return sendError(res, 400, `Cannot scale CloudPod in '${pod.status}' state`);
    }

    const newCores = cores ?? pod.cores;
    const newMemoryMb = memoryMb ?? pod.memoryMb;

    // Check quota for scale-up
    const quotaCheck = await checkScaleCapacity(
      pod.tenantId,
      pod.cores,
      pod.memoryMb,
      newCores,
      newMemoryMb
    );

    if (!quotaCheck.allowed) {
      return sendError(res, 403, 'Quota exceeded', {
        reason: quotaCheck.reason,
        current: quotaCheck.current,
        limits: quotaCheck.limits,
      });
    }

    const jobPayload = {
      tenantId: pod.tenantId,
      vmid,
      cloudPodId: pod.id,
      currentCores: pod.cores,
      currentMemoryMb: pod.memoryMb,
      newCores,
      newMemoryMb,
      requestedBy: (req as any).user?.id ?? 'api',
      reason,
      backupFirst,
    };

    const job = await enqueueCloudPodScale(jobPayload);

    sendSuccess(res, {
      message: 'Scale operation queued',
      jobId: job.id,
      vmid,
      scaling: {
        from: { cores: pod.cores, memoryMb: pod.memoryMb },
        to: { cores: newCores, memoryMb: newMemoryMb },
      },
    }, 202);

  } catch (error: any) {
    console.error('[API] Scale CloudPod error:', error);
    sendError(res, 500, 'Failed to queue scale operation', error.message);
  }
});

// ============================================
// Quota Operations
// ============================================

/**
 * GET /internal/tenants/:tenantId/quota
 * Get quota summary for a tenant
 */
router.get('/tenants/:tenantId/quota', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const summary = await getQuotaSummary(tenantId);
    sendSuccess(res, { quota: summary });
  } catch (error: any) {
    console.error('[API] Get quota error:', error);
    sendError(res, 500, 'Failed to get quota', error.message);
  }
});

/**
 * POST /internal/tenants/:tenantId/quota/recalculate
 * Recalculate quota usage from actual CloudPods
 */
router.post('/tenants/:tenantId/quota/recalculate', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    await recalculateUsage(tenantId);
    const summary = await getQuotaSummary(tenantId);
    sendSuccess(res, { message: 'Quota recalculated', quota: summary });
  } catch (error: any) {
    console.error('[API] Recalculate quota error:', error);
    sendError(res, 500, 'Failed to recalculate quota', error.message);
  }
});

// ============================================
// Job & Event History
// ============================================

/**
 * GET /internal/cloudpods/:vmid/jobs
 * Get job history for a CloudPod
 */
router.get('/:vmid/jobs', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { limit = '20' } = req.query;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    const jobs = await prisma.cloudPodJob.findMany({
      where: { cloudPodId: pod.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    sendSuccess(res, { jobs, count: jobs.length });

  } catch (error: any) {
    console.error('[API] Get jobs error:', error);
    sendError(res, 500, 'Failed to get jobs', error.message);
  }
});

/**
 * GET /internal/cloudpods/:vmid/events
 * Get event history for a CloudPod
 */
router.get('/:vmid/events', async (req: Request, res: Response) => {
  try {
    const vmid = parseInt(req.params.vmid, 10);
    const { limit = '50', type } = req.query;

    if (isNaN(vmid)) {
      return sendError(res, 400, 'Invalid VMID');
    }

    const pod = await prisma.cloudPod.findUnique({ where: { vmid } });

    if (!pod) {
      return sendError(res, 404, `CloudPod with VMID ${vmid} not found`);
    }

    const where: any = { cloudPodId: pod.id };
    if (type) {
      where.type = type;
    }

    const events = await prisma.cloudPodEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    sendSuccess(res, { events, count: events.length });

  } catch (error: any) {
    console.error('[API] Get events error:', error);
    sendError(res, 500, 'Failed to get events', error.message);
  }
});

// ============================================
// Admin / Queue Stats
// ============================================

/**
 * GET /internal/cloudpods/admin/stats
 * Get queue statistics
 */
router.get('/admin/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getQueueStats();
    
    const podCounts = await prisma.cloudPod.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    sendSuccess(res, {
      queues: stats,
      cloudPods: podCounts.reduce((acc, row) => {
        acc[row.status] = row._count.id;
        return acc;
      }, {} as Record<string, number>),
    });

  } catch (error: any) {
    console.error('[API] Get stats error:', error);
    sendError(res, 500, 'Failed to get stats', error.message);
  }
});

export default router;
