/**
 * ENTERPRISE WEBSOCKET Service
 * Socket.io namespacing with tenant rooms
 */

import logger from '../../../config/logger.js';
import type { WebSocketEventType, BroadcastMessageRequest } from './websocket.types.js';

// Global reference to Socket.IO instance (initialized in server-ts.ts)
let io: any = null;

export function setSocketIOInstance(socketIO: any) {
  io = socketIO;
  logger.info('WebSocket service initialized');
}

export function broadcastToTenant(
  tenantId: string,
  event: WebSocketEventType,
  data: Record<string, any>
): void {
  if (!io) {
    logger.warn('Socket.IO not initialized');
    return;
  }

  const room = `tenant:${tenantId}`;
  io.to(room).emit(event, {
    event,
    data,
    timestamp: new Date(),
  });

  logger.debug('WebSocket broadcast', { tenantId, event, room });
}

export function broadcastToRoom(data: BroadcastMessageRequest, tenantId: string): void {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }

  const { room, event, data: payload } = data;
  const fullRoom = `tenant:${tenantId}:${room}`;

  io.to(fullRoom).emit(event, {
    event,
    data: payload,
    timestamp: new Date(),
  });

  logger.debug('WebSocket room broadcast', { tenantId, room: fullRoom, event });
}

export function emitJobStatusUpdate(tenantId: string, jobId: string, status: string): void {
  broadcastToTenant(tenantId, 'job.status' as WebSocketEventType, {
    jobId,
    status,
  });
}

export function emitNotification(
  tenantId: string,
  notification: { title: string; message: string; type: string }
): void {
  broadcastToTenant(tenantId, 'notification' as WebSocketEventType, notification);
}
