/**
 * CloudPods BullMQ Queue Definitions
 * 
 * Defines all queues for CloudPod operations using BullMQ + Redis.
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 2
 */

import { Queue, QueueEvents } from 'bullmq';

// Redis connection configuration
const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT ?? '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

export const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// ============================================
// Job Payload Types
// ============================================

export interface CloudPodCreateJobPayload {
  tenantId: string;
  vmid: number;
  hostname: string;
  ip?: string;
  autoIp: boolean;
  cores: number;
  memoryMb: number;
  swapMb: number;
  diskGb: number;
  region: string;
  requestedBy: string;
  blueprintId?: string;
  planId?: string;
}

export interface CloudPodDestroyJobPayload {
  tenantId: string;
  vmid: number;
  cloudPodId: string;
  requestedBy: string;
  reason?: string;
}

export interface CloudPodBackupJobPayload {
  tenantId: string;
  vmid: number;
  cloudPodId: string;
  mode: 'snapshot' | 'suspend' | 'stop';
  snapshotName?: string;
  reason?: string;
  triggeredBy: 'schedule' | 'manual' | 'pre-scale' | 'pre-destroy';
}

export interface CloudPodHealthJobPayload {
  tenantId: string;
  vmid: number;
  cloudPodId: string;
  triggeredBy: 'schedule' | 'manual' | 'focalpilot';
}

export interface CloudPodScaleJobPayload {
  tenantId: string;
  vmid: number;
  cloudPodId: string;
  currentCores: number;
  currentMemoryMb: number;
  newCores: number;
  newMemoryMb: number;
  requestedBy: string;
  reason?: string;
  backupFirst: boolean;
}

// ============================================
// Queue Instances
// ============================================

// Default job options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // Start with 5 second delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000,    // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
};

/**
 * CloudPod Create Queue
 * Handles provisioning new containers on Proxmox
 */
export const cloudPodCreateQueue = new Queue<CloudPodCreateJobPayload>('cloudpods-create', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2, // Only 2 attempts for create (VMID collision issues)
  },
});

/**
 * CloudPod Destroy Queue
 * Handles teardown and cleanup of containers
 */
export const cloudPodDestroyQueue = new Queue<CloudPodDestroyJobPayload>('cloudpods-destroy', {
  connection: redisConnection,
  defaultJobOptions,
});

/**
 * CloudPod Backup Queue
 * Handles snapshots and backups
 */
export const cloudPodBackupQueue = new Queue<CloudPodBackupJobPayload>('cloudpods-backup', {
  connection: redisConnection,
  defaultJobOptions,
});

/**
 * CloudPod Health Queue
 * Handles health checks (can be scheduled or on-demand)
 */
export const cloudPodHealthQueue = new Queue<CloudPodHealthJobPayload>('cloudpods-health', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1, // Health checks don't need retries
  },
});

/**
 * CloudPod Scale Queue
 * Handles vertical scaling (CPU/RAM changes)
 */
export const cloudPodScaleQueue = new Queue<CloudPodScaleJobPayload>('cloudpods-scale', {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2, // 2 attempts for scale
  },
});

// ============================================
// Queue Events (for monitoring)
// ============================================

export const createQueueEvents = new QueueEvents('cloudpods-create', { connection: redisConnection });
export const destroyQueueEvents = new QueueEvents('cloudpods-destroy', { connection: redisConnection });
export const backupQueueEvents = new QueueEvents('cloudpods-backup', { connection: redisConnection });
export const healthQueueEvents = new QueueEvents('cloudpods-health', { connection: redisConnection });
export const scaleQueueEvents = new QueueEvents('cloudpods-scale', { connection: redisConnection });

// ============================================
// Helper Functions
// ============================================

/**
 * Add a CloudPod create job to the queue
 */
export async function enqueueCloudPodCreate(payload: CloudPodCreateJobPayload, jobId?: string) {
  return cloudPodCreateQueue.add('create', payload, {
    jobId: jobId ?? `create-${payload.vmid}-${Date.now()}`,
  });
}

/**
 * Add a CloudPod destroy job to the queue
 */
export async function enqueueCloudPodDestroy(payload: CloudPodDestroyJobPayload, jobId?: string) {
  return cloudPodDestroyQueue.add('destroy', payload, {
    jobId: jobId ?? `destroy-${payload.vmid}-${Date.now()}`,
  });
}

/**
 * Add a CloudPod backup job to the queue
 */
export async function enqueueCloudPodBackup(payload: CloudPodBackupJobPayload, jobId?: string) {
  return cloudPodBackupQueue.add('backup', payload, {
    jobId: jobId ?? `backup-${payload.vmid}-${Date.now()}`,
  });
}

/**
 * Add a CloudPod health check job to the queue
 */
export async function enqueueCloudPodHealth(payload: CloudPodHealthJobPayload, jobId?: string) {
  return cloudPodHealthQueue.add('health', payload, {
    jobId: jobId ?? `health-${payload.vmid}-${Date.now()}`,
  });
}

/**
 * Add a CloudPod scale job to the queue
 */
export async function enqueueCloudPodScale(payload: CloudPodScaleJobPayload, jobId?: string) {
  return cloudPodScaleQueue.add('scale', payload, {
    jobId: jobId ?? `scale-${payload.vmid}-${Date.now()}`,
  });
}

/**
 * Schedule recurring health checks for all active CloudPods
 * Call this on startup or via cron
 */
export async function scheduleHealthChecks(intervalMinutes: number = 5) {
  // Add a repeatable job that triggers health checks
  await cloudPodHealthQueue.add(
    'scheduled-health-sweep',
    {
      tenantId: 'system',
      vmid: 0, // 0 means all pods
      cloudPodId: 'all',
      triggeredBy: 'schedule',
    },
    {
      repeat: {
        every: intervalMinutes * 60 * 1000, // Convert to milliseconds
      },
      jobId: 'health-sweep-schedule',
    }
  );
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const [createCounts, destroyCounts, backupCounts, healthCounts, scaleCounts] = await Promise.all([
    cloudPodCreateQueue.getJobCounts(),
    cloudPodDestroyQueue.getJobCounts(),
    cloudPodBackupQueue.getJobCounts(),
    cloudPodHealthQueue.getJobCounts(),
    cloudPodScaleQueue.getJobCounts(),
  ]);

  return {
    create: createCounts,
    destroy: destroyCounts,
    backup: backupCounts,
    health: healthCounts,
    scale: scaleCounts,
  };
}

/**
 * Graceful shutdown - close all queue connections
 */
export async function closeQueues() {
  await Promise.all([
    cloudPodCreateQueue.close(),
    cloudPodDestroyQueue.close(),
    cloudPodBackupQueue.close(),
    cloudPodHealthQueue.close(),
    cloudPodScaleQueue.close(),
    createQueueEvents.close(),
    destroyQueueEvents.close(),
    backupQueueEvents.close(),
    healthQueueEvents.close(),
    scaleQueueEvents.close(),
  ]);
}
