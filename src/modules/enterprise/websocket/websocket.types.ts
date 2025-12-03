/**
 * ENTERPRISE WEBSOCKET Types
 * Real-time messaging with tenant-aware channels
 */

export enum WebSocketEventType {
  JOB_STATUS = 'job.status',
  NOTIFICATION = 'notification',
  PRESENCE = 'presence',
  METRIC_UPDATE = 'metric.update',
  CUSTOM = 'custom',
}

export interface WebSocketMessage {
  event: WebSocketEventType;
  data: Record<string, any>;
  timestamp: Date;
}

export interface PresenceUpdate {
  userId: string;
  status: 'online' | 'offline';
  lastSeen: Date;
}

export interface BroadcastMessageRequest {
  room: string;
  event: WebSocketEventType;
  data: Record<string, any>;
}
