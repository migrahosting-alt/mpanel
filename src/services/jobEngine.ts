/**
 * Job Engine - Worker Orchestration System (Jobs v2)
 * 
 * Simple multi-queue, multi-worker job engine for mPanel.
 * 
 * Queues:
 * - "cloudpods"  (pod lifecycle, security groups, volumes)
 * - "metrics"    (usage sampling)
 * - "health"     (health checks & auto-heal)
 * - "backups"    (backups & retention)
 * - "webhooks"   (webhook deliveries)
 * - "dns"        (DNS record management)
 * - "hooks"      (lifecycle hooks execution)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'dead';

export interface JobHandlerContext {
  jobId: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

export type JobHandler = (ctx: JobHandlerContext) => Promise<void>;

export interface JobEngineOptions {
  queue: string;
  workerName: string;
  pollIntervalMs?: number;
  maxConcurrent?: number;
  heartbeatIntervalMs?: number;
}

export interface EnqueueJobParams {
  type: string;
  payload: Record<string, unknown>;
  scheduledAt?: Date;
  maxAttempts?: number;
  priority?: number;
}

export class JobEngine {
  private readonly queue: string;
  private readonly workerName: string;
  private readonly pollIntervalMs: number;
  private readonly maxConcurrent: number;
  private readonly heartbeatIntervalMs: number;
  private readonly handlers = new Map<string, JobHandler>();
  private running = false;
  private activeCount = 0;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(opts: JobEngineOptions) {
    this.queue = opts.queue;
    this.workerName = opts.workerName;
    this.pollIntervalMs = opts.pollIntervalMs ?? 1_000;
    this.maxConcurrent = opts.maxConcurrent ?? 5;
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 30_000;
  }

  /**
   * Register a handler for a job type
   */
  registerHandler(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  /**
   * Enqueue a new job
   */
  async enqueueJob(params: EnqueueJobParams): Promise<string> {
    const { type, payload, scheduledAt, maxAttempts = 5, priority = 0 } = params;

    const job = await prisma.platformJob.create({
      data: {
        queue: this.queue,
        type,
        payload: JSON.parse(JSON.stringify(payload)),
        status: 'pending',
        attempts: 0,
        maxAttempts,
        priority,
        scheduledAt: scheduledAt ?? new Date(),
      },
    });

    return job.id;
  }

  /**
   * Enqueue a job with a specific queue (static helper)
   */
  static async enqueue(
    queue: string,
    type: string,
    payload: Record<string, unknown>,
    opts?: { scheduledAt?: Date; maxAttempts?: number; priority?: number }
  ): Promise<string> {
    const job = await prisma.platformJob.create({
      data: {
        queue,
        type,
        payload: JSON.parse(JSON.stringify(payload)),
        status: 'pending',
        attempts: 0,
        maxAttempts: opts?.maxAttempts ?? 5,
        priority: opts?.priority ?? 0,
        scheduledAt: opts?.scheduledAt ?? new Date(),
      },
    });

    return job.id;
  }

  /**
   * Start the worker loop
   */
  start() {
    if (this.running) return;
    this.running = true;
    this.registerWorker();
    this.startHeartbeat();
    this.loop();
    console.log(`[JobEngine:${this.queue}] Worker "${this.workerName}" started`);
  }

  /**
   * Stop the worker
   */
  async stop() {
    this.running = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    await this.unregisterWorker();
    console.log(`[JobEngine:${this.queue}] Worker "${this.workerName}" stopped`);
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [pending, running, completed, failed, dead] = await Promise.all([
      prisma.platformJob.count({ where: { queue: this.queue, status: 'pending' } }),
      prisma.platformJob.count({ where: { queue: this.queue, status: 'running' } }),
      prisma.platformJob.count({ where: { queue: this.queue, status: 'completed' } }),
      prisma.platformJob.count({ where: { queue: this.queue, status: 'failed' } }),
      prisma.platformJob.count({ where: { queue: this.queue, status: 'dead' } }),
    ]);

    return { queue: this.queue, pending, running, completed, failed, dead };
  }

  /**
   * Retry dead jobs
   */
  async retryDeadJobs(maxCount: number = 10): Promise<number> {
    const deadJobs = await prisma.platformJob.findMany({
      where: { queue: this.queue, status: 'dead' },
      take: maxCount,
      orderBy: { createdAt: 'asc' },
    });

    let retried = 0;
    for (const job of deadJobs) {
      await prisma.platformJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          attempts: 0,
          lastError: null,
          scheduledAt: new Date(),
          updatedAt: new Date(),
        },
      });
      retried++;
    }

    return retried;
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld: number = 7): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);

    const result = await prisma.platformJob.deleteMany({
      where: {
        queue: this.queue,
        status: { in: ['completed', 'dead'] },
        completedAt: { lt: cutoff },
      },
    });

    return result.count;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async registerWorker() {
    await prisma.jobWorker.upsert({
      where: { name: this.workerName },
      create: {
        name: this.workerName,
        queue: this.queue,
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
      update: {
        queue: this.queue,
        status: 'online',
        lastHeartbeatAt: new Date(),
      },
    });
  }

  private async unregisterWorker() {
    await prisma.jobWorker.update({
      where: { name: this.workerName },
      data: { status: 'offline', lastHeartbeatAt: new Date() },
    }).catch(() => {});
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await prisma.jobWorker.update({
          where: { name: this.workerName },
          data: { lastHeartbeatAt: new Date() },
        });
      } catch (err) {
        console.error(`[JobEngine:${this.queue}] Heartbeat error:`, err);
      }
    }, this.heartbeatIntervalMs);
  }

  private async loop() {
    while (this.running) {
      try {
        if (this.activeCount < this.maxConcurrent) {
          const job = await this.claimNextJob();
          if (job) {
            this.activeCount++;
            this.runJob(job)
              .catch((err) => {
                console.error(`[JobEngine:${this.queue}] Job ${job.id} error:`, err);
              })
              .finally(() => {
                this.activeCount--;
              });
          }
        }
      } catch (err) {
        console.error(`[JobEngine:${this.queue}] Loop error:`, err);
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
  }

  private async claimNextJob() {
    const now = new Date();

    // Find next pending job
    // For production, use "FOR UPDATE SKIP LOCKED" with raw SQL
    const job = await prisma.platformJob.findFirst({
      where: {
        queue: this.queue,
        status: 'pending',
        scheduledAt: { lte: now },
      },
      orderBy: [
        { priority: 'desc' },
        { scheduledAt: 'asc' },
      ],
    });

    if (!job) return null;

    // Claim the job
    const updated = await prisma.platformJob.update({
      where: { id: job.id },
      data: {
        status: 'running',
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  private async runJob(job: {
    id: string;
    type: string;
    payload: unknown;
    attempts: number;
    maxAttempts: number;
  }) {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      await prisma.platformJob.update({
        where: { id: job.id },
        data: {
          status: 'dead',
          lastError: `No handler registered for job type "${job.type}"`,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.error(`[JobEngine:${this.queue}] No handler for job type: ${job.type}`);
      return;
    }

    try {
      await handler({
        jobId: job.id,
        type: job.type,
        payload: job.payload as Record<string, unknown>,
        attempts: job.attempts + 1,
        maxAttempts: job.maxAttempts,
      });

      await prisma.platformJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(`[JobEngine:${this.queue}] Job ${job.id} (${job.type}) completed`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const attempts = job.attempts + 1;
      const maxAttempts = job.maxAttempts;
      const shouldDie = attempts >= maxAttempts;

      const nextStatus: JobStatus = shouldDie ? 'dead' : 'pending';

      // Exponential backoff: 2, 4, 8, 16, 32, 60 minutes max
      const backoffMinutes = Math.min(60, Math.pow(2, attempts));
      const nextScheduledAt = shouldDie
        ? undefined
        : new Date(Date.now() + backoffMinutes * 60_000);

      await prisma.platformJob.update({
        where: { id: job.id },
        data: {
          status: nextStatus,
          attempts,
          lastError: errorMessage,
          scheduledAt: nextScheduledAt,
          completedAt: shouldDie ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });

      if (shouldDie) {
        console.error(`[JobEngine:${this.queue}] Job ${job.id} (${job.type}) is DEAD after ${attempts} attempts: ${errorMessage}`);
      } else {
        console.warn(`[JobEngine:${this.queue}] Job ${job.id} (${job.type}) failed (attempt ${attempts}/${maxAttempts}), retry in ${backoffMinutes}m: ${errorMessage}`);
      }
    }
  }
}

// ============================================
// Queue Constants
// ============================================

export const QUEUES = {
  CLOUDPODS: 'cloudpods',
  METRICS: 'metrics',
  HEALTH: 'health',
  BACKUPS: 'backups',
  WEBHOOKS: 'webhooks',
  DNS: 'dns',
  HOOKS: 'hooks',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

// ============================================
// Job Types
// ============================================

export const JOB_TYPES = {
  // CloudPods lifecycle
  POD_PROVISION: 'pod.provision',
  POD_DESTROY: 'pod.destroy',
  POD_START: 'pod.start',
  POD_STOP: 'pod.stop',
  POD_REBOOT: 'pod.reboot',
  POD_REBUILD: 'pod.rebuild',
  POD_RESIZE: 'pod.resize',

  // Volumes
  VOLUME_CREATE: 'volume.create',
  VOLUME_ATTACH: 'volume.attach',
  VOLUME_DETACH: 'volume.detach',
  VOLUME_RESIZE: 'volume.resize',
  VOLUME_DELETE: 'volume.delete',

  // Health
  POD_HEALTH_CHECK: 'pod.health.check',
  POD_AUTO_HEAL: 'pod.auto_heal',

  // Metrics
  POD_METRICS_SAMPLE: 'pod.metrics.sample',
  METRICS_AGGREGATE_DAILY: 'metrics.aggregate_daily',
  METRICS_CLEANUP: 'metrics.cleanup',

  // Backups
  BACKUP_CREATE: 'backup.create',
  BACKUP_RESTORE: 'backup.restore',
  BACKUP_DELETE: 'backup.delete',
  BACKUP_RETENTION_ENFORCE: 'backup.retention_enforce',

  // DNS
  DNS_CREATE_RECORD: 'dns.create_record',
  DNS_DELETE_RECORD: 'dns.delete_record',
  DNS_UPDATE_RECORD: 'dns.update_record',

  // Webhooks
  WEBHOOK_DELIVER: 'webhook.deliver',

  // Hooks
  HOOK_EXECUTE: 'hook.execute',

  // Security
  SECURITY_GROUP_APPLY: 'security_group.apply',
} as const;

export type JobType = typeof JOB_TYPES[keyof typeof JOB_TYPES];

export default JobEngine;
