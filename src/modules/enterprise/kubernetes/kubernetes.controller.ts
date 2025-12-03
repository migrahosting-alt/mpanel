/**
 * ENTERPRISE KUBERNETES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as kubernetesService from './kubernetes.service.js';
import type { RegisterClusterRequest } from './kubernetes.types.js';

export async function handleListClusters(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const clusters = await kubernetesService.listClusters(actorTenantId);
    return res.json(clusters);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRegisterCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const data: RegisterClusterRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const cluster = await kubernetesService.registerCluster(data, actorTenantId, actorId);
    return res.status(201).json(cluster);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetClusterHealth(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const health = await kubernetesService.getClusterHealth(id, actorTenantId);
    return res.json(health);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await kubernetesService.deleteCluster(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}
