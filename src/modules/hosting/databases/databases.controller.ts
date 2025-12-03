/**
 * MODULE_DATABASES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as databasesService from './databases.service.js';
import type { CreateDatabaseRequest } from './databases.types.js';

export async function handleListDatabases(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const databases = await databasesService.listDatabases(actorTenantId);
    return res.json(databases);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetDatabase(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const database = await databasesService.getDatabaseById(id, actorTenantId);
    if (!database) return res.status(404).json({ error: 'Database not found' });
    return res.json(database);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateDatabase(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateDatabaseRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await databasesService.createDatabase(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteDatabase(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await databasesService.deleteDatabase(id, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
