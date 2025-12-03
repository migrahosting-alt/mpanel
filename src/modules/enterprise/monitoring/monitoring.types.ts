/**
 * ENTERPRISE MONITORING & ALERTS Types
 * HTTP/TCP/PING checks with alert policies
 */

export enum MonitorType {
  HTTP = 'HTTP',
  TCP = 'TCP',
  PING = 'PING',
}

export enum MonitorStatus {
  UP = 'UP',
  DOWN = 'DOWN',
  DEGRADED = 'DEGRADED',
}

export enum AlertChannel {
  EMAIL = 'EMAIL',
  WEBHOOK = 'WEBHOOK',
  SMS = 'SMS',
}

export interface Monitor {
  id: string;
  tenantId: string;
  name: string;
  type: MonitorType;
  target: string; // URL, IP, hostname
  interval: number; // seconds
  timeout: number; // seconds
  status: MonitorStatus;
  lastCheckAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonitorCheck {
  id: string;
  monitorId: string;
  status: MonitorStatus;
  responseTime: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AlertPolicy {
  id: string;
  tenantId: string;
  name: string;
  monitorIds: string[];
  channels: AlertChannel[];
  recipients: string[];
  cooldownMinutes: number;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMonitorRequest {
  name: string;
  type: MonitorType;
  target: string;
  interval?: number;
  timeout?: number;
}

export interface CreateAlertPolicyRequest {
  name: string;
  monitorIds: string[];
  channels: AlertChannel[];
  recipients: string[];
  cooldownMinutes?: number;
}
