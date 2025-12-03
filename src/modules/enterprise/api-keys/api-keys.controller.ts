/**
 * ENTERPRISE API KEYS & WEBHOOKS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as apiKeysService from './api-keys.service.js';
import type {
  CreateApiKeyRequest,
  CreateWebhookRequest,
  TriggerWebhookRequest,
} from './api-keys.types.js';

// API Keys
export async function handleListApiKeys(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const keys = await apiKeysService.listApiKeys(actorTenantId);
    return res.json(keys);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateApiKeyRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await apiKeysService.createApiKey(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRevokeApiKey(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await apiKeysService.revokeApiKey(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

// Webhook Endpoints
export async function handleListWebhooks(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const endpoints = await apiKeysService.listWebhookEndpoints(actorTenantId);
    return res.json(endpoints);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateWebhookRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await apiKeysService.createWebhookEndpoint(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await apiKeysService.deleteWebhookEndpoint(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}

// Webhook Deliveries
export async function handleTriggerWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const data: TriggerWebhookRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const result = await apiKeysService.triggerWebhook(data, actorTenantId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListDeliveries(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const deliveries = await apiKeysService.listWebhookDeliveries(actorTenantId);
    return res.json(deliveries);
  } catch (error) {
    return next(error);
    next(error);
  }
}
