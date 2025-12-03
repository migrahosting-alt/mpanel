/**
 * ENTERPRISE ANALYTICS (BI) Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as analyticsService from './analytics.service.js';
import type { CreateDataSourceRequest, CreateDashboardRequest } from './analytics.types.js';

export async function handleListDataSources(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const sources = await analyticsService.listDataSources(actorTenantId);
    return res.json(sources);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateDataSource(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateDataSourceRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const source = await analyticsService.createDataSource(data, actorTenantId, actorId);
    return res.status(201).json(source);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteDataSource(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await analyticsService.deleteDataSource(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListDashboards(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const dashboards = await analyticsService.listDashboards(actorTenantId);
    return res.json(dashboards);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const dashboard = await analyticsService.getDashboardById(id, actorTenantId);
    if (!dashboard) return res.status(404).json({ error: 'Dashboard not found' });
    return res.json(dashboard);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateDashboardRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const dashboard = await analyticsService.createDashboard(data, actorTenantId, actorId);
    return res.status(201).json(dashboard);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await analyticsService.deleteDashboard(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}
