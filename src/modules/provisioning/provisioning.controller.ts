/**
 * Provisioning Controller - CloudPods and jobs management
 */

import { Request, Response } from 'express';
import * as provisioningService from './provisioning.service.js';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

/**
 * GET /api/provisioning/cloudpods - List tenant CloudPods
 */
export async function listCloudPods(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const cloudPods = await provisioningService.listCloudPodsForTenant(tenantId);

    return res.json({
      success: true,
      data: cloudPods,
    });
  } catch (error) {
    logger.error('Error listing CloudPods', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list CloudPods',
    });
  }
}

/**
 * GET /api/provisioning/cloudpods/:id - Get CloudPod details
 */
export async function getCloudPod(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const cloudPod = await provisioningService.getCloudPodById(tenantId, id);

    if (!cloudPod) {
      return res.status(404).json({
        success: false,
        error: 'CloudPod not found',
      });
    }

    return res.json({
      success: true,
      data: cloudPod,
    });
  } catch (error) {
    logger.error('Error getting CloudPod', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get CloudPod',
    });
  }
}

/**
 * GET /api/provisioning/jobs - List tenant jobs
 */
export async function listJobs(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const { status, type, page, pageSize } = req.query;

    const result = await provisioningService.listJobsForTenant(tenantId, {
      status: status as string,
      type: type as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
    });

    return res.json({
      success: true,
      data: result.jobs,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (pageSize ? parseInt(pageSize as string) : 50)),
      },
    });
  } catch (error) {
    logger.error('Error listing jobs', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list jobs',
    });
  }
}

/**
 * Platform routes
 */

export async function listCloudPodsPlatform(req: AuthRequest, res: Response) {
  try {
    const { tenantId, status, page, pageSize } = req.query;

    const result = await provisioningService.listCloudPodsForPlatform({
      tenantId: tenantId as string,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
    });

    return res.json({
      success: true,
      data: result.cloudPods,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (pageSize ? parseInt(pageSize as string) : 50)),
      },
    });
  } catch (error) {
    logger.error('Error listing CloudPods (platform)', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list CloudPods',
    });
  }
}

export async function listJobsPlatform(req: AuthRequest, res: Response) {
  try {
    const { tenantId, status, type, page, pageSize } = req.query;

    const result = await provisioningService.listJobsForPlatform({
      tenantId: tenantId as string,
      status: status as string,
      type: type as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
    });

    return res.json({
      success: true,
      data: result.jobs,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (pageSize ? parseInt(pageSize as string) : 50)),
      },
    });
  } catch (error) {
    logger.error('Error listing jobs (platform)', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list jobs',
    });
  }
}

export async function retryJob(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const actorUserId = req.user!.id;

    const job = await provisioningService.retryJob(id, actorUserId);

    await writeAuditEvent({
      actorUserId,
      tenantId: null,
      type: 'CLOUDPOD_JOB_RETRIED',
      metadata: { jobId: id },
    });

    return res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    logger.error('Error retrying job', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry job',
    });
  }
}

export async function cancelJob(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const actorUserId = req.user!.id;

    const job = await provisioningService.cancelJob(id, actorUserId);

    await writeAuditEvent({
      actorUserId,
      tenantId: null,
      type: 'CLOUDPOD_JOB_CANCELLED',
      metadata: { jobId: id },
    });

    return res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    logger.error('Error cancelling job', { error });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel job',
    });
  }
}

export default {
  listCloudPods,
  getCloudPod,
  listJobs,
  listCloudPodsPlatform,
  listJobsPlatform,
  retryJob,
  cancelJob,
};
