/**
 * MODULE_SERVERS Types
 * Manage logical servers (CloudPods, VPS, dedicated servers, physical nodes)
 */

export enum ServerRole {
  WEB = 'WEB',
  DB = 'DB',
  MAIL = 'MAIL',
  DNS = 'DNS',
  STORAGE = 'STORAGE',
  ALL_IN_ONE = 'ALL_IN_ONE',
}

export enum ServerType {
  CLOUDPOD = 'CLOUDPOD',
  DEDICATED = 'DEDICATED',
  VPS = 'VPS',
  PHYSICAL_NODE = 'PHYSICAL_NODE',
}

export enum ServerStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  SUSPENDED = 'SUSPENDED',
  DELETING = 'DELETING',
  ERROR = 'ERROR',
}

export enum ServerProvider {
  MIGRAHOSTING_INTERNAL = 'MIGRAHOSTING_INTERNAL',
  PROXMOX_CLUSTER = 'PROXMOX_CLUSTER',
  OTHER = 'OTHER',
}

export enum GuardianStatus {
  NOT_SCANNED = 'NOT_SCANNED',
  CLEAN = 'CLEAN',
  WARN = 'WARN',
  CRITICAL = 'CRITICAL',
}

export type ServerAction =
  | 'reboot'
  | 'shutdown'
  | 'power_on'
  | 'rebuild'
  | 'run_guardian_scan'
  | 'enable_maintenance'
  | 'disable_maintenance';

export interface Server {
  id: string;
  tenantId: string | null; // null for platform-only physical nodes
  name: string;
  slug: string;
  role: ServerRole;
  type: ServerType;
  provider: ServerProvider;
  publicIp: string | null;
  privateIp: string | null;
  region: string | null;
  status: ServerStatus;
  guardianStatus: GuardianStatus;
  maintenanceMode: boolean;
  metadata: Record<string, any> | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateServerRequest {
  name: string;
  role: ServerRole;
  type: ServerType;
  provider: ServerProvider;
  targetClusterId?: string;
  templateId?: string;
  region?: string;
  plan?: {
    cpu: number;
    ramMb: number;
    diskGb: number;
  };
  tenantId?: string; // platform-only
}

export interface ServerActionRequest {
  action: ServerAction;
}

export interface ListServersQuery {
  role?: ServerRole;
  status?: ServerStatus;
  search?: string;
  tenantId?: string; // platform-only
  page?: number;
  pageSize?: number;
}

export interface ServerWithCounts extends Server {
  websiteCount?: number;
  databaseCount?: number;
  backupCount?: number;
}
