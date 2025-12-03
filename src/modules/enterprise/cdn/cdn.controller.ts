/**
 * ENTERPRISE CDN MANAGEMENT Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as cdnService from './cdn.service.js';
import type { CreateDistributionRequest, PurgeCacheRequest } from './cdn.types.js';

export async function handleListDistributions(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const distributions = await cdnService.listDistributions(actorTenantId);
    return res.json(distributions);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateDistributionRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await cdnService.createDistribution(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteDistribution(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await cdnService.deleteDistribution(id, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handlePurgeCache(req: Request, res: Response, next: NextFunction) {
  try {
    const { distributionId } = req.params;
    const data: PurgeCacheRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await cdnService.purgeCache(distributionId, data, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
