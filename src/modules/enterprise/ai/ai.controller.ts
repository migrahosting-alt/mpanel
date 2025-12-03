/**
 * ENTERPRISE AI FEATURES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as aiService from './ai.service.js';
import type { CreateAiConfigRequest, AiCompletionRequest } from './ai.types.js';

export async function handleGetActiveConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const config = await aiService.getActiveConfig(actorTenantId);
    if (!config) return res.status(404).json({ error: 'No active AI config' });
    return res.json(config);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateAiConfigRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const config = await aiService.createConfig(data, actorTenantId);
    return res.status(201).json(config);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteConfig(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await aiService.deleteConfig(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGenerateCompletion(req: Request, res: Response, next: NextFunction) {
  try {
    const data: AiCompletionRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const result = await aiService.generateCompletion(data, actorTenantId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetUsageStats(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const stats = await aiService.getUsageStats(actorTenantId);
    return res.json(stats);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListUsageRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const records = await aiService.listUsageRecords(actorTenantId);
    return res.json(records);
  } catch (error) {
    return next(error);
    next(error);
  }
}
