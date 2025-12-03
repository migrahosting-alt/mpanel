/**
 * ENTERPRISE CDN MANAGEMENT Types
 * Multi-region distribution with cache purging
 */

export enum CdnProvider {
  CLOUDFLARE = 'CLOUDFLARE',
  CUSTOM = 'CUSTOM',
}

export enum DistributionStatus {
  DEPLOYING = 'DEPLOYING',
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export interface CdnDistribution {
  id: string;
  tenantId: string;
  provider: CdnProvider;
  domain: string;
  originUrl: string;
  status: DistributionStatus;
  regions: string[];
  cacheConfig: {
    ttl: number;
    queryStringCaching: boolean;
  };
  sslEnabled: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CdnPurgeJob {
  id: string;
  distributionId: string;
  paths: string[];
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt: Date | null;
}

export interface CreateDistributionRequest {
  provider: CdnProvider;
  domain: string;
  originUrl: string;
  regions?: string[];
  cacheTtl?: number;
}

export interface PurgeCacheRequest {
  paths: string[];
}
