/**
 * MODULE_WEBSITES Service
 * Vhost management with queue-based provisioning
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  Website,
  CreateWebsiteRequest,
  UpdateWebsiteRequest,
  DeployWebsiteRequest,
  ListWebsitesQuery,
} from './websites.types.js';

/**
 * List websites with filters
 */
export async function listWebsites(
  query: ListWebsitesQuery,
  actorTenantId: string | null
): Promise<{ websites: Website[]; total: number }> {
  const { status, type, serverId, cloudpodId, search, page = 1, pageSize = 20 } = query;

  const where: any = { tenantId: actorTenantId };

  if (status) where.status = status;
  if (type) where.type = type;
  if (serverId) where.serverId = serverId;
  if (cloudpodId) where.cloudpodId = cloudpodId;
  if (search) {
    where.OR = [
      { documentRoot: { contains: search, mode: 'insensitive' } },
      // Can search by domain name once we join Domain table
    ];
  }

  try {
    // @ts-ignore - Website table may not exist yet
    const [websites, total] = await Promise.all([
      prisma.website.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.website.count({ where }),
    ]);

    return { websites, total };
  } catch (error) {
    logger.debug('Website table not available');
    return { websites: [], total: 0 };
  }
}

/**
 * Get website by ID
 */
export async function getWebsiteById(
  id: string,
  actorTenantId: string | null
): Promise<Website | null> {
  try {
    // @ts-ignore
    const website = await prisma.website.findFirst({
      where: { id, tenantId: actorTenantId },
    });

    return website;
  } catch (error) {
    logger.debug('Website table not available');
    return null;
  }
}

/**
 * Create website (enqueues provisioning job)
 */
export async function createWebsite(
  data: CreateWebsiteRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ website: Website; jobId: string }> {
  const {
    cloudpodId,
    primaryDomainId,
    primaryDomainName,
    type,
    runtime,
    deployStrategy,
    gitRepoUrl,
    autoDatabase,
    autoSsl,
  } = data;

  // Verify CloudPod exists and belongs to tenant
  const cloudpod = await prisma.server.findFirst({
    where: { id: cloudpodId, tenantId: actorTenantId },
  });

  if (!cloudpod) {
    throw new Error('CloudPod not found or access denied');
  }

  // If domain name provided but no ID, create domain first
  let finalDomainId = primaryDomainId;
  if (!finalDomainId && primaryDomainName) {
    // TODO: Create domain via domains module
    logger.warn('Domain creation not yet implemented', { primaryDomainName });
    // For now, use placeholder
    finalDomainId = 'placeholder-domain-id';
  }

  if (!finalDomainId) {
    throw new Error('Either primaryDomainId or primaryDomainName is required');
  }

  // Generate document root
  const documentRoot = `/var/www/${primaryDomainName || 'website'}`;

  // Create website in PENDING state
  // @ts-ignore
  const website = await prisma.website.create({
    data: {
      tenantId: actorTenantId,
      cloudpodId,
      serverId: cloudpod.id,
      primaryDomainId: finalDomainId,
      type,
      documentRoot,
      runtime,
      status: 'PENDING',
      sslStatus: autoSsl ? 'PENDING' : 'NONE',
      deployStrategy,
      gitRepoUrl: gitRepoUrl || null,
      backupPolicyId: null,
      region: cloudpod.region,
    },
  });

  // Enqueue provisioning job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'provision.website',
      status: 'pending',
      payload: {
        websiteId: website.id,
        autoDatabase,
        autoSsl,
      },
      createdBy: actorId,
    },
  });

  logger.info('Website created, provisioning job enqueued', {
    websiteId: website.id,
    jobId: job.id,
  });

  return { website, jobId: job.id };
}

/**
 * Update website
 */
export async function updateWebsite(
  id: string,
  data: UpdateWebsiteRequest,
  actorTenantId: string
): Promise<Website> {
  try {
    // @ts-ignore
    const website = await prisma.website.update({
      where: { id, tenantId: actorTenantId },
      data,
    });

    return website;
  } catch (error) {
    throw new Error('Website not found or update failed');
  }
}

/**
 * Deploy website
 */
export async function deployWebsite(
  id: string,
  data: DeployWebsiteRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  // Verify website exists
  try {
    // @ts-ignore
    const website = await prisma.website.findFirst({
      where: { id, tenantId: actorTenantId },
    });

    if (!website) {
      throw new Error('Website not found');
    }

    // Enqueue deployment job
    const job = await prisma.job.create({
      data: {
        tenantId: actorTenantId,
        type: 'website.deploy',
        status: 'pending',
        payload: {
          websiteId: id,
          ...data,
        },
        createdBy: actorId,
      },
    });

    logger.info('Website deployment enqueued', { websiteId: id, jobId: job.id });

    return { jobId: job.id };
  } catch (error) {
    throw new Error('Deployment failed');
  }
}

/**
 * Issue/renew SSL certificate
 */
export async function issueSsl(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  try {
    // @ts-ignore
    const website = await prisma.website.findFirst({
      where: { id, tenantId: actorTenantId },
    });

    if (!website) {
      throw new Error('Website not found');
    }

    // Update SSL status to PENDING
    // @ts-ignore
    await prisma.website.update({
      where: { id },
      data: { sslStatus: 'PENDING' },
    });

    // Enqueue SSL issuance job
    const job = await prisma.job.create({
      data: {
        tenantId: actorTenantId,
        type: 'website.ssl.issue',
        status: 'pending',
        payload: { websiteId: id },
        createdBy: actorId,
      },
    });

    logger.info('SSL issuance enqueued', { websiteId: id, jobId: job.id });

    return { jobId: job.id };
  } catch (error) {
    throw new Error('SSL issuance failed');
  }
}

/**
 * Delete website
 */
export async function deleteWebsite(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  try {
    // Mark as DELETING
    // @ts-ignore
    const website = await prisma.website.update({
      where: { id, tenantId: actorTenantId },
      data: { status: 'DELETING' },
    });

    // Enqueue deletion job (auto-backup first)
    const job = await prisma.job.create({
      data: {
        tenantId: actorTenantId,
        type: 'website.delete',
        status: 'pending',
        payload: {
          websiteId: id,
          autoBackupFirst: true,
        },
        createdBy: actorId,
      },
    });

    logger.info('Website deletion initiated', { websiteId: id, jobId: job.id });

    return { jobId: job.id };
  } catch (error) {
    throw new Error('Website deletion failed');
  }
}
