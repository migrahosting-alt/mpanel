/**
 * ENTERPRISE PREMIUM TOOLS SUITE Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as premiumToolsService from './premium-tools.service.js';
import type { ExecuteToolRequest } from './premium-tools.types.js';

export async function handleListTools(req: Request, res: Response, next: NextFunction) {
  try {
    const tools = await premiumToolsService.listTools();
    return res.json(tools);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetTool(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const tool = await premiumToolsService.getToolById(id);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    return res.json(tool);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleExecuteTool(req: Request, res: Response, next: NextFunction) {
  try {
    const data: ExecuteToolRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await premiumToolsService.executeTool(data, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListUsageRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const records = await premiumToolsService.listUsageRecords(actorTenantId);
    return res.json(records);
  } catch (error) {
    return next(error);
    next(error);
  }
}
