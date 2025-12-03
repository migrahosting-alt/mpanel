/**
 * ENTERPRISE WHITE-LABEL Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as whiteLabelService from './white-label.service.js';
import type { UpdateWhiteLabelRequest, UploadAssetRequest } from './white-label.types.js';

export async function handleGetConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const config = await whiteLabelService.getConfig(actorTenantId);
    if (!config) return res.status(404).json({ error: 'Config not found' });
    return res.json(config);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data: UpdateWhiteLabelRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const config = await whiteLabelService.updateConfig(data, actorTenantId);
    return res.json(config);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUploadAsset(req: Request, res: Response, next: NextFunction) {
  try {
    const data: UploadAssetRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const result = await whiteLabelService.uploadAsset(data, actorTenantId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
