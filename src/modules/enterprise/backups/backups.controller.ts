/**
 * ENTERPRISE BACKUPS & DR Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as backupsService from './backups.service.js';
import type {
  CreateBackupPolicyRequest,
  TriggerBackupRequest,
  RestoreBackupRequest,
} from './backups.types.js';

export async function handleListPolicies(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const policies = await backupsService.listPolicies(actorTenantId);
    return res.json(policies);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreatePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateBackupPolicyRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const policy = await backupsService.createPolicy(data, actorTenantId, actorId);
    return res.status(201).json(policy);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeletePolicy(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await backupsService.deletePolicy(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListBackupRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const runs = await backupsService.listBackupRuns(actorTenantId);
    return res.json(runs);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleTriggerBackup(req: Request, res: Response, next: NextFunction) {
  try {
    const data: TriggerBackupRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await backupsService.triggerBackup(data, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRestoreBackup(req: Request, res: Response, next: NextFunction) {
  try {
    const data: RestoreBackupRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await backupsService.restoreBackup(data, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListRestoreJobs(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const jobs = await backupsService.listRestoreJobs(actorTenantId);
    return res.json(jobs);
  } catch (error) {
    return next(error);
    next(error);
  }
}
