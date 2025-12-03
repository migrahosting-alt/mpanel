import type { Request, Response } from 'express';
import logger from '../../config/logger.js';
import * as provisioningService from './provisioning.service.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    tenantId?: string;
    role: string;
  };
}

function handleError(res: Response, error: unknown, message = 'Unexpected error') {
  logger.error(message, { error: error instanceof Error ? error.message : error });
  return res.status(500).json({ success: false, error: message });
}

export async function listJobs(req: AuthenticatedRequest, res: Response) {
  try {
    const { queue, status, page, pageSize } = req.query;
    
    const jobs = await provisioningService.listJobs({
      queue: typeof queue === 'string' ? queue : undefined,
      status: typeof status === 'string' ? status : undefined,
      page: typeof page === 'string' ? parseInt(page, 10) : undefined,
      pageSize: typeof pageSize === 'string' ? parseInt(pageSize, 10) : undefined,
    });

    return res.json({ success: true, ...jobs });
  } catch (error) {
    return handleError(res, error, 'Failed to list jobs');
  }
}

export async function getJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const job = await provisioningService.getJob(id);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    return res.json({ success: true, data: job });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch job');
  }
}

export async function getQueueStats(req: AuthenticatedRequest, res: Response) {
  try {
    const stats = await provisioningService.getQueueStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch queue stats');
  }
}

export async function getQueueDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const { name } = req.params;
    const details = await provisioningService.getQueueDetails(name);

    return res.json({ success: true, data: details });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch queue details');
  }
}

export async function retryJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await provisioningService.retryJob(id);

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'Failed to retry job');
  }
}

export async function cancelJob(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const result = await provisioningService.cancelJob(id);

    return res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'Failed to cancel job');
  }
}

export async function getWorkerHealth(req: AuthenticatedRequest, res: Response) {
  try {
    const health = await provisioningService.getWorkerHealth();
    return res.json({ success: true, data: health });
  } catch (error) {
    return handleError(res, error, 'Failed to fetch worker health');
  }
}

export default {
  listJobs,
  getJob,
  getQueueStats,
  getQueueDetails,
  retryJob,
  cancelJob,
  getWorkerHealth,
};
