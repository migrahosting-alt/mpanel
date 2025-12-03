/**
 * MODULE_WEBSITES Types
 * Manage websites/apps (vhosts) hosted on CloudPods/servers
 */

export enum WebsiteType {
  WORDPRESS = 'WORDPRESS',
  PHP_APP = 'PHP_APP',
  NODE_APP = 'NODE_APP',
  STATIC = 'STATIC',
  CUSTOM = 'CUSTOM',
}

export enum WebsiteStatus {
  PENDING = 'PENDING',
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
  ERROR = 'ERROR',
  DELETING = 'DELETING',
}

export enum WebsiteSslStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
}

export enum DeployStrategy {
  AUTO_GIT = 'AUTO_GIT',
  SFTP = 'SFTP',
  MANUAL = 'MANUAL',
}

export interface Website {
  id: string;
  tenantId: string;
  cloudpodId: string;
  serverId: string;
  primaryDomainId: string;
  type: WebsiteType;
  documentRoot: string;
  runtime: string; // e.g. 'PHP-8.3', 'NODE-20'
  status: WebsiteStatus;
  sslStatus: WebsiteSslStatus;
  deployStrategy: DeployStrategy;
  gitRepoUrl: string | null;
  backupPolicyId: string | null;
  region: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWebsiteRequest {
  cloudpodId: string;
  primaryDomainId?: string;
  primaryDomainName?: string; // if domain doesn't exist, create it
  type: WebsiteType;
  runtime: string;
  deployStrategy: DeployStrategy;
  gitRepoUrl?: string;
  autoDatabase?: boolean;
  autoSsl?: boolean;
}

export interface UpdateWebsiteRequest {
  runtime?: string;
  deployStrategy?: DeployStrategy;
  gitRepoUrl?: string;
  backupPolicyId?: string;
}

export interface DeployWebsiteRequest {
  trigger: 'manual' | 'git_webhook';
  branch?: string;
  commitId?: string;
}

export interface ListWebsitesQuery {
  status?: WebsiteStatus;
  type?: WebsiteType;
  serverId?: string;
  cloudpodId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}
