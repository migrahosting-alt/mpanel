import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// Known BullMQ queues in the system
const KNOWN_QUEUES = [
  'cloudpods-provisioning',
  'guardian-security',
  'email-notifications',
  'billing-tasks',
  'provisioning', // Main provisioning queue
];

interface ListJobsParams {
  queue?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export async function listJobs(params: ListJobsParams) {
  const { queue, status, page = 1, pageSize = 50 } = params;

  const where: any = {};

  if (status) {
    where.status = status.toLowerCase();
  }

  if (queue && queue !== 'all') {
    // Filter by job type as a proxy for queue
    where.type = { contains: queue };
  }

  // Fetch from Job table
  const [data, total] = await Promise.all([
    prisma.job.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        order: {
          select: {
            id: true,
          },
        },
      },
    }),
    prisma.job.count({ where }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

export async function getJob(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
        },
      },
      order: {
        select: {
          id: true,
        },
      },
    },
  });

  return job;
}

export async function getQueueStats() {
  // Get stats by job status
  const [pending, running, success, failed, total] = await Promise.all([
    prisma.job.count({ where: { status: 'pending' } }),
    prisma.job.count({ where: { status: 'running' } }),
    prisma.job.count({ where: { status: 'success' } }),
    prisma.job.count({ where: { status: 'failed' } }),
    prisma.job.count(),
  ]);

  return KNOWN_QUEUES.map((name) => ({
    name,
    waiting: name === 'provisioning' ? pending : 0,
    active: name === 'provisioning' ? running : 0,
    completed: name === 'provisioning' ? success : 0,
    failed: name === 'provisioning' ? failed : 0,
    total: name === 'provisioning' ? total : 0,
  }));
}

export async function getQueueDetails(queueName: string) {
  const where = queueName === 'all' ? {} : { type: { contains: queueName } };

  const [pending, running, success, failed, recentJobs] = await Promise.all([
    prisma.job.count({ where: { ...where, status: 'pending' } }),
    prisma.job.count({ where: { ...where, status: 'running' } }),
    prisma.job.count({ where: { ...where, status: 'success' } }),
    prisma.job.count({ where: { ...where, status: 'failed' } }),
    prisma.job.findMany({
      where,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);
  ]);

  return {
    name: queueName,
    stats: {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed,
    },
    recentJobs,
  };
}

export async function retryJob(id: string) {
  const job = await prisma.provisioningTask.findUnique({ where: { id } });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status !== 'failed') {
    throw new Error('Only failed jobs can be retried');
  }

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: 'pending',
      lastError: null,
      attempts: 0,
      startedAt: null,
      completedAt: null,
    },
  });

  logger.info('Job retry requested', { jobId: id });

  return updated;
}

export async function cancelJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id } });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'success' || job.status === 'failed') {
    throw new Error('Cannot cancel completed jobs');
  }

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status: 'failed',
      lastError: 'Cancelled by administrator',
      completedAt: new Date(),
    },
  });

  logger.warn('Job cancelled', { jobId: id });

  return updated;
}

export async function getWorkerHealth() {
  // Mock worker health - in production, fetch from Redis or worker heartbeats
  return {
    workers: [
      {
        name: 'cloudpods-provisioning',
        status: 'RUNNING',
        processedJobs: Math.floor(Math.random() * 1000),
        failedJobs: Math.floor(Math.random() * 10),
        lastHeartbeat: new Date(),
      },
      {
        name: 'guardian-security',
        status: 'RUNNING',
        processedJobs: Math.floor(Math.random() * 500),
        failedJobs: Math.floor(Math.random() * 5),
        lastHeartbeat: new Date(),
      },
    ],
  };
}

export default {
  listJobs,
  getJob,
  getQueueStats,
  getQueueDetails,
  retryJob,
  cancelJob,
  getWorkerHealth,
};
