/**
 * MODULE_DATABASES Types
 */

export enum DbEngine {
  MYSQL = 'MYSQL',
  MARIADB = 'MARIADB',
  POSTGRES = 'POSTGRES',
}

export enum DbServerStatus {
  ACTIVE = 'ACTIVE',
  DEGRADED = 'DEGRADED',
  OFFLINE = 'OFFLINE',
}

export enum DatabaseStatus {
  ACTIVE = 'ACTIVE',
  DELETING = 'DELETING',
  ERROR = 'ERROR',
}

export enum DatabaseUserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum BackupType {
  AUTO_DAILY = 'AUTO_DAILY',
  MANUAL = 'MANUAL',
  BEFORE_CHANGE = 'BEFORE_CHANGE',
}

export interface DatabaseServer {
  id: string;
  tenantId: string | null;
  serverId: string;
  engine: DbEngine;
  host: string;
  port: number;
  version: string | null;
  defaultForTenant: boolean;
  status: DbServerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Database {
  id: string;
  tenantId: string;
  databaseServerId: string;
  name: string;
  charset: string;
  collation: string;
  associatedWebsiteId: string | null;
  status: DatabaseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDatabaseRequest {
  databaseServerId?: string;
  name: string;
  charset?: string;
  collation?: string;
  associatedWebsiteId?: string;
  createUser?: {
    username: string;
    password: string;
  };
}
