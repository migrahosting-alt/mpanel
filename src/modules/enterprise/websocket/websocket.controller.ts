/**
 * ENTERPRISE WEBSOCKET Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as websocketService from './websocket.service.js';
import type { BroadcastMessageRequest } from './websocket.types.js';

export async function handleBroadcast(req: Request, res: Response, next: NextFunction) {
  try {
    const data: BroadcastMessageRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    websocketService.broadcastToRoom(data, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}
