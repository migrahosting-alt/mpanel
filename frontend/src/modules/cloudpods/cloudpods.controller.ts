/**
 * CLOUDPODS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as cloudpodsService from './cloudpods.service.js';
import type {
  CreateCloudPodRequest,
  ResizeCloudPodRequest,
  UpdateCloudPodRequest,
} from './cloudpods.types.js';

export async function handleListCloudPods(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      tenantId: req.query.tenantId as string,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    };

    const result = await cloudpodsService.listCloudPods(filters);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const pod = await cloudpodsService.getCloudPodById(id);
    
    if (!pod) {
      return res.status(404).json({ error: 'CloudPod not found' });
    }

    return res.json(pod);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateCloudPodRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const result = await cloudpodsService.createCloudPod(data, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleResizeCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: ResizeCloudPodRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const result = await cloudpodsService.resizeCloudPod(id, data, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleSuspendCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const pod = await cloudpodsService.suspendCloudPod(id, actorId);
    return res.json(pod);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleResumeCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const pod = await cloudpodsService.resumeCloudPod(id, actorId);
    return res.json(pod);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const pod = await cloudpodsService.deleteCloudPod(id, actorId);
    return res.json(pod);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateCloudPod(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: UpdateCloudPodRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const pod = await cloudpodsService.updateCloudPod(id, data, actorId);
    return res.json(pod);
  } catch (error) {
    return next(error);
    next(error);
  }
}
