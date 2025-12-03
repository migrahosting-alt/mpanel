/**
 * ENTERPRISE CDN MANAGEMENT Service
 * Distribution management with purge operations
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  CdnDistribution,
  CdnPurgeJob,
  CreateDistributionRequest,
  PurgeCacheRequest,
} from './cdn.types.js';

export async function listDistributions(actorTenantId: string): Promise<CdnDistribution[]> {
  try {
    // @ts-ignore
    const distributions = await prisma.cdnDistribution.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return distributions;
  } catch {
    return [];
  }
}

export async function createDistribution(
  data: CreateDistributionRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ distribution: CdnDistribution; jobId: string }> {
  const { provider, domain, originUrl, regions = ['us-east', 'eu-west'], cacheTtl = 3600 } = data;

  // @ts-ignore
  const distribution = await prisma.cdnDistribution.create({
    data: {
      tenantId: actorTenantId,
      provider,
      domain,
      originUrl,
      status: 'DEPLOYING',
      regions,
      cacheConfig: {
        ttl: cacheTtl,
        queryStringCaching: true,
      },
      sslEnabled: true,
      createdBy: actorId,
    },
  });

  // Enqueue deployment job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'cdn.distribution.deploy',
      status: 'pending',
      payload: { distributionId: distribution.id },
      createdBy: actorId,
    },
  });

  logger.info('CDN distribution created', { distributionId: distribution.id, jobId: job.id });

  return { distribution, jobId: job.id };
}

export async function deleteDistribution(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  // @ts-ignore
  const distribution = await prisma.cdnDistribution.findFirst({
    where: { id, tenantId: actorTenantId },
  });

  if (!distribution) {
    throw new Error('Distribution not found');
  }

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'cdn.distribution.delete',
      status: 'pending',
      payload: { distributionId: id },
      createdBy: actorId,
    },
  });

  logger.info('CDN distribution deletion initiated', { distributionId: id, jobId: job.id });

  return { jobId: job.id };
}

export async function purgeCache(
  distributionId: string,
  data: PurgeCacheRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ purgeJob: CdnPurgeJob; jobId: string }> {
  const { paths } = data;

  // Verify distribution
  // @ts-ignore
  const distribution = await prisma.cdnDistribution.findFirst({
    where: { id: distributionId, tenantId: actorTenantId },
  });

  if (!distribution) {
    throw new Error('Distribution not found');
  }

  // @ts-ignore
  const purgeJob = await prisma.cdnPurgeJob.create({
    data: {
      distributionId,
      paths,
      status: 'PENDING',
      completedAt: null,
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'cdn.cache.purge',
      status: 'pending',
      payload: {
        purgeJobId: purgeJob.id,
        distributionId,
        paths,
      },
      createdBy: actorId,
    },
  });

  logger.info('CDN cache purge initiated', { purgeJobId: purgeJob.id, jobId: job.id });

  return { purgeJob, jobId: job.id };
}
