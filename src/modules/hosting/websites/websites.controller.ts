/**
 * MODULE_WEBSITES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as websitesService from './websites.service.js';
import type {
  CreateWebsiteRequest,
  UpdateWebsiteRequest,
  DeployWebsiteRequest,
  ListWebsitesQuery,
} from './websites.types.js';

export async function handleListWebsites(req: Request, res: Response, next: NextFunction) {
  try {
    const query: ListWebsitesQuery = {
      status: req.query.status as any,
      type: req.query.type as any,
      serverId: req.query.serverId as string,
      cloudpodId: req.query.cloudpodId as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
    };

    const actorTenantId = (req as any).tenantId;
    const result = await websitesService.listWebsites(query, actorTenantId);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;

    const website = await websitesService.getWebsiteById(id, actorTenantId);

    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }

    return res.json(website);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateWebsiteRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await websitesService.createWebsite(data, actorTenantId, actorId);

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: UpdateWebsiteRequest = req.body;
    const actorTenantId = (req as any).tenantId;

    const website = await websitesService.updateWebsite(id, data, actorTenantId);

    return res.json(website);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeployWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: DeployWebsiteRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await websitesService.deployWebsite(id, data, actorTenantId, actorId);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleIssueSsl(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await websitesService.issueSsl(id, actorTenantId, actorId);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteWebsite(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;

    const result = await websitesService.deleteWebsite(id, actorTenantId, actorId);

    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
