/**
 * ENTERPRISE MONITORING & ALERTS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as monitoringService from './monitoring.service.js';
import type { CreateMonitorRequest, CreateAlertPolicyRequest } from './monitoring.types.js';

export async function handleListMonitors(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const monitors = await monitoringService.listMonitors(actorTenantId);
    return res.json(monitors);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateMonitor(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateMonitorRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const monitor = await monitoringService.createMonitor(data, actorTenantId, actorId);
    return res.status(201).json(monitor);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteMonitor(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await monitoringService.deleteMonitor(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListMonitorChecks(req: Request, res: Response, next: NextFunction) {
  try {
    const { monitorId } = req.params;
    const actorTenantId = (req as any).tenantId;
    const checks = await monitoringService.listMonitorChecks(monitorId, actorTenantId);
    return res.json(checks);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListAlertPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const policies = await monitoringService.listAlertPolicies(actorTenantId);
    return res.json(policies);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateAlertPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateAlertPolicyRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const policy = await monitoringService.createAlertPolicy(data, actorTenantId, actorId);
    return res.status(201).json(policy);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteAlertPolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await monitoringService.deleteAlertPolicy(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}
