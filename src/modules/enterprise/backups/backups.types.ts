/**
 * ENTERPRISE BACKUPS & DR Types
 * Tenant-configurable backup policies with MinIO storage
 */

export enum BackupType {
  FULL = 'FULL',
  INCREMENTAL = 'INCREMENTAL',
}

export enum BackupStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum RestoreStatus {
  PENDING = 'PENDING',
  RESTORING = 'RESTORING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface BackupPolicy {
  id: string;
  tenantId: string;
  name: string;
  resourceType: string; // 'website', 'database', 'server'
  resourceIds: string[];
  schedule: string; // Cron expression
  backupType: BackupType;
  retentionDays: number;
  storageConfig: {
    bucket: string;
    encryption: boolean;
  };
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupRun {
  id: string;
  tenantId: string;
  policyId: string;
  resourceType: string;
  resourceId: string;
  backupType: BackupType;
  status: BackupStatus;
  storageKey: string | null;
  sizeMb: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface RestoreJob {
  id: string;
  tenantId: string;
  backupRunId: string;
  targetResourceId: string | null;
  status: RestoreStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  createdBy: string;
  createdAt: Date;
}

export interface CreateBackupPolicyRequest {
  name: string;
  resourceType: string;
  resourceIds: string[];
  schedule: string;
  backupType: BackupType;
  retentionDays: number;
}

export interface TriggerBackupRequest {
  policyId: string;
  resourceIds?: string[];
}

export interface RestoreBackupRequest {
  backupRunId: string;
  targetResourceId?: string;
}
