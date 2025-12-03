/**
 * Provisioning Service - CloudPods and jobs management
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

/**
 * List CloudPods for tenant
 */
export async function listCloudPodsForTenant(tenantId: string) {
  const cloudPods = await prisma.cloudPod.findMany({
    where: {
      tenantId,
      deletedAt: null,
    },
    include: {
      blueprint: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return cloudPods;
}

/**
 * List CloudPods for platform (all tenants)
 */
export async function listCloudPodsForPlatform(options: {
  tenantId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { tenantId, status, page = 1, pageSize = 50 } = options;
  const skip = (page - 1) * pageSize;

  const where: any = { deletedAt: null };
  if (tenantId) {
    where.tenantId = tenantId;
  }
  if (status) {
    where.status = status;
  }

  const [cloudPods, total] = await Promise.all([
    prisma.cloudPod.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        blueprint: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.cloudPod.count({ where }),
  ]);

  return { cloudPods, total };
}

/**
 * Get CloudPod by ID
 */
export async function getCloudPodById(tenantId: string, id: string) {
  const cloudPod = await prisma.cloudPod.findFirst({
    where: {
      id,
      tenantId,
      deletedAt: null,
    },
    include: {
      blueprint: true,
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  return cloudPod;
}

/**
 * List jobs for tenant
 */
export async function listJobsForTenant(
  tenantId: string,
  options: {
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { status, type, page = 1, pageSize = 50 } = options;
  const skip = (page - 1) * pageSize;

  const where: any = {
    tenantId,
  };

  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  const [jobs, total] = await Promise.all([
    prisma.cloudPodJob.findMany({
      where,
      include: {
        cloudPod: {
          select: {
            id: true,
            hostname: true,
            vmid: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.cloudPodJob.count({ where }),
  ]);

  return { jobs, total };
}

/**
 * List jobs for platform (all tenants)
 */
export async function listJobsForPlatform(options: {
  tenantId?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { tenantId, status, type, page = 1, pageSize = 50 } = options;
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (tenantId) {
    where.tenantId = tenantId;
  }
  if (status) {
    where.status = status;
  }
  if (type) {
    where.type = type;
  }

  const [jobs, total] = await Promise.all([
    prisma.cloudPodJob.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        cloudPod: {
          select: {
            id: true,
            hostname: true,
            vmid: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.cloudPodJob.count({ where }),
  ]);

  return { jobs, total };
}

/**
 * Retry job
 */
export async function retryJob(jobId: string, actorUserId: string) {
  const job = await prisma.cloudPodJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  // Reset job to queued status
  const updatedJob = await prisma.cloudPodJob.update({
    where: { id: jobId },
    data: {
      status: 'queued',
      attempts: 0,
      error: null,
      result: undefined,
      startedAt: null,
      finishedAt: null,
    },
  });

  logger.info('Job retry requested', {
    jobId,
    actorUserId,
    jobType: job.type,
  });

  // TODO: Re-enqueue job in BullMQ

  return updatedJob;
}

/**
 * Cancel job
 */
export async function cancelJob(jobId: string, actorUserId: string) {
  const job = await prisma.cloudPodJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'success' || job.status === 'failed') {
    throw new Error('Cannot cancel completed job');
  }

  const updatedJob = await prisma.cloudPodJob.update({
    where: { id: jobId },
    data: {
      status: 'failed',
      error: 'Cancelled by admin',
      finishedAt: new Date(),
    },
  });

  logger.info('Job cancelled', {
    jobId,
    actorUserId,
    jobType: job.type,
  });

  // TODO: Cancel job in BullMQ

  return updatedJob;
}

export default {
  listCloudPodsForTenant,
  listCloudPodsForPlatform,
  getCloudPodById,
  listJobsForTenant,
  listJobsForPlatform,
  retryJob,
  cancelJob,
};
