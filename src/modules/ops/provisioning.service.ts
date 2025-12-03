import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// Known BullMQ queues in the system
const KNOWN_QUEUES = [
  'cloudpods-provisioning',
  'guardian-security',
  'email-notifications',
  'billing-tasks',
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

  if (queue) {
    where.queueName = queue;
  }

  if (status) {
    where.status = status;
  }

  // Fetch from ProvisioningTask table (CloudPods jobs)
  const [data, total] = await Promise.all([
    prisma.provisioningTask.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        cloudPod: {
          select: {
            id: true,
            name: true,
            tenant: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.provisioningTask.count({ where }),
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
  const job = await prisma.provisioningTask.findUnique({
    where: { id },
    include: {
      cloudPod: {
        select: {
          id: true,
          name: true,
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return job;
}

export async function getQueueStats() {
  // Get stats for all known queues
  const stats = await Promise.all(
    KNOWN_QUEUES.map(async (queueName) => {
      const [waiting, active, completed, failed] = await Promise.all([
        prisma.provisioningTask.count({
          where: { queueName, status: 'PENDING' },
        }),
        prisma.provisioningTask.count({
          where: { queueName, status: 'IN_PROGRESS' },
        }),
        prisma.provisioningTask.count({
          where: { queueName, status: 'COMPLETED' },
        }),
        prisma.provisioningTask.count({
          where: { queueName, status: 'FAILED' },
        }),
      ]);

      return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        total: waiting + active + completed + failed,
      };
    })
  );

  return stats;
}

export async function getQueueDetails(queueName: string) {
  const [waiting, active, completed, failed, recentJobs] = await Promise.all([
    prisma.provisioningTask.count({
      where: { queueName, status: 'PENDING' },
    }),
    prisma.provisioningTask.count({
      where: { queueName, status: 'IN_PROGRESS' },
    }),
    prisma.provisioningTask.count({
      where: { queueName, status: 'COMPLETED' },
    }),
    prisma.provisioningTask.count({
      where: { queueName, status: 'FAILED' },
    }),
    prisma.provisioningTask.findMany({
      where: { queueName },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        cloudPod: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
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

  if (job.status !== 'FAILED') {
    throw new Error('Only failed jobs can be retried');
  }

  const updated = await prisma.provisioningTask.update({
    where: { id },
    data: {
      status: 'PENDING',
      error: null,
      attemptedAt: null,
    },
  });

  logger.info('Job retry requested', { jobId: id });

  return updated;
}

export async function cancelJob(id: string) {
  const job = await prisma.provisioningTask.findUnique({ where: { id } });

  if (!job) {
    throw new Error('Job not found');
  }

  if (job.status === 'COMPLETED') {
    throw new Error('Cannot cancel completed job');
  }

  const updated = await prisma.provisioningTask.update({
    where: { id },
    data: {
      status: 'FAILED',
      error: 'Cancelled by administrator',
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
