/**
 * CloudPod BullMQ Workers
 * 
 * Processes CloudPod jobs from BullMQ queues.
 * Each worker handles a specific operation type (create, destroy, backup, health, scale).
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 4
 */

import { Worker, Job } from 'bullmq';
import { prisma } from '../config/database.js';
import {
  redisConnection,
  CloudPodCreateJobPayload,
  CloudPodDestroyJobPayload,
  CloudPodBackupJobPayload,
  CloudPodHealthJobPayload,
  CloudPodScaleJobPayload,
} from '../services/cloudPodQueues.js';
import {
  createCloudPod,
  destroyCloudPod,
  backupCloudPod,
  getCloudPodHealth,
  getAllCloudPodsHealth,
  scaleCloudPod,
} from '../services/proxmoxSsh.js';
import {
  checkCreateCapacity,
  checkScaleCapacity,
  incrementUsage,
  decrementUsage,
  updateUsageAfterScale,
} from '../services/cloudPodQuotas.js';

// ============================================
// Create Worker
// ============================================

export const cloudPodCreateWorker = new Worker<CloudPodCreateJobPayload>(
  'cloudpods-create',
  async (job: Job<CloudPodCreateJobPayload>) => {
    const payload = job.data;
    console.log(`[CREATE] Processing job ${job.id} for VMID ${payload.vmid}`);

    // 1) Record job start in DB
    const dbJob = await prisma.cloudPodJob.create({
      data: {
        tenantId: payload.tenantId,
        type: 'CREATE',
        status: 'running',
        payload: payload as any,
        bullJobId: job.id,
        startedAt: new Date(),
      },
    });

    try {
      // 2) Check quota
      const quotaCheck = await checkCreateCapacity(
        payload.tenantId,
        payload.cores,
        payload.memoryMb,
        payload.diskGb
      );

      if (!quotaCheck.allowed) {
        throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
      }

      // 3) Create DB row in "provisioning" state
      const pod = await prisma.cloudPod.create({
        data: {
          tenantId: payload.tenantId,
          vmid: payload.vmid,
          hostname: payload.hostname,
          ip: payload.ip ?? '',
          region: payload.region,
          status: 'provisioning',
          cores: payload.cores,
          memoryMb: payload.memoryMb,
          swapMb: payload.swapMb,
          diskGb: payload.diskGb,
          storage: 'clients-main',
          bridge: 'vmbr0',
          blueprintId: payload.blueprintId,
        },
      });

      // Update job with cloudPodId
      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: { cloudPodId: pod.id },
      });

      // 4) Execute Proxmox create
      const result = await createCloudPod({
        vmid: payload.vmid,
        hostname: payload.hostname,
        tenantId: payload.tenantId,
        autoIp: payload.autoIp,
        ip: payload.ip,
        cores: payload.cores,
        memoryMb: payload.memoryMb,
        swapMb: payload.swapMb,
      });

      // 5) Update DB with result
      await prisma.cloudPod.update({
        where: { id: pod.id },
        data: {
          ip: result.ip,
          status: 'active',
        },
      });

      // 6) Update quota usage
      await incrementUsage(payload.tenantId, payload.cores, payload.memoryMb, payload.diskGb);

      // 7) Record success event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: pod.id,
          type: 'STATE_CHANGE',
          message: 'CloudPod created successfully',
          data: JSON.parse(JSON.stringify({ result, vmid: payload.vmid, ip: result.ip })),
        },
      });

      // 8) Update job as success
      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'success',
          result: result as any,
          finishedAt: new Date(),
        },
      });

      console.log(`[CREATE] Success: VMID ${payload.vmid} -> IP ${result.ip}`);
      return { success: true, vmid: payload.vmid, ip: result.ip, cloudPodId: pod.id };

    } catch (error: any) {
      console.error(`[CREATE] Failed: ${error.message}`);

      // Update CloudPod status to failed if it exists
      const existingPod = await prisma.cloudPod.findUnique({
        where: { vmid: payload.vmid },
      });
      if (existingPod) {
        await prisma.cloudPod.update({
          where: { vmid: payload.vmid },
          data: { status: 'failed' },
        });
      }

      // Record failure event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: existingPod?.id,
          type: 'ERROR',
          message: `CloudPod creation failed: ${error.message}`,
          data: { error: error.message, vmid: payload.vmid },
        },
      });

      // Update job as failed
      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error.message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

// ============================================
// Destroy Worker
// ============================================

export const cloudPodDestroyWorker = new Worker<CloudPodDestroyJobPayload>(
  'cloudpods-destroy',
  async (job: Job<CloudPodDestroyJobPayload>) => {
    const payload = job.data;
    console.log(`[DESTROY] Processing job ${job.id} for VMID ${payload.vmid}`);

    // 1) Get existing pod
    const pod = await prisma.cloudPod.findUnique({
      where: { id: payload.cloudPodId },
    });

    if (!pod) {
      throw new Error(`CloudPod not found: ${payload.cloudPodId}`);
    }

    // 2) Record job
    const dbJob = await prisma.cloudPodJob.create({
      data: {
        tenantId: payload.tenantId,
        cloudPodId: payload.cloudPodId,
        type: 'DESTROY',
        status: 'running',
        payload: payload as any,
        bullJobId: job.id,
        startedAt: new Date(),
      },
    });

    try {
      // 3) Update status to deleting
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: { status: 'deleting' },
      });

      // 4) Execute Proxmox destroy
      const result = await destroyCloudPod(payload.vmid);

      // 5) Mark as deleted (soft delete)
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: {
          status: 'deleted',
          deletedAt: new Date(),
        },
      });

      // 6) Update quota usage
      await decrementUsage(payload.tenantId, pod.cores, pod.memoryMb, pod.diskGb);

      // 7) Record success event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'STATE_CHANGE',
          message: 'CloudPod destroyed successfully',
          data: JSON.parse(JSON.stringify({ result, reason: payload.reason })),
        },
      });

      // 8) Update job as success
      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'success',
          result: result as any,
          finishedAt: new Date(),
        },
      });

      console.log(`[DESTROY] Success: VMID ${payload.vmid}`);
      return { success: true, vmid: payload.vmid };

    } catch (error: any) {
      console.error(`[DESTROY] Failed: ${error.message}`);

      // Record failure
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'ERROR',
          message: `CloudPod destruction failed: ${error.message}`,
          data: { error: error.message },
        },
      });

      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error.message,
          finishedAt: new Date(),
        },
      });

      // Revert status
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: { status: 'active' },
      });

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

// ============================================
// Backup Worker
// ============================================

export const cloudPodBackupWorker = new Worker<CloudPodBackupJobPayload>(
  'cloudpods-backup',
  async (job: Job<CloudPodBackupJobPayload>) => {
    const payload = job.data;
    console.log(`[BACKUP] Processing job ${job.id} for VMID ${payload.vmid}`);

    const dbJob = await prisma.cloudPodJob.create({
      data: {
        tenantId: payload.tenantId,
        cloudPodId: payload.cloudPodId,
        type: 'BACKUP',
        status: 'running',
        payload: payload as any,
        bullJobId: job.id,
        startedAt: new Date(),
      },
    });

    try {
      // Execute backup
      const result = await backupCloudPod(payload.vmid, payload.snapshotName);

      // Update CloudPod last backup timestamp
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: { lastBackupAt: new Date() },
      });

      // Record success event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'BACKUP',
          message: `Backup created: ${result.snapshot}`,
          data: JSON.parse(JSON.stringify({ result, triggeredBy: payload.triggeredBy, reason: payload.reason })),
        },
      });

      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'success',
          result: result as any,
          finishedAt: new Date(),
        },
      });

      console.log(`[BACKUP] Success: VMID ${payload.vmid} -> ${result.snapshot}`);
      return { success: true, snapshot: result.snapshot };

    } catch (error: any) {
      console.error(`[BACKUP] Failed: ${error.message}`);

      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'ERROR',
          message: `Backup failed: ${error.message}`,
          data: { error: error.message },
        },
      });

      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error.message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 3 }
);

// ============================================
// Health Worker
// ============================================

export const cloudPodHealthWorker = new Worker<CloudPodHealthJobPayload>(
  'cloudpods-health',
  async (job: Job<CloudPodHealthJobPayload>) => {
    const payload = job.data;
    console.log(`[HEALTH] Processing job ${job.id} for VMID ${payload.vmid}`);

    try {
      // Special case: health sweep for all pods
      if (payload.vmid === 0 && payload.cloudPodId === 'all') {
        const allHealth = await getAllCloudPodsHealth();
        
        // Update each pod's health in DB
        for (const podHealth of allHealth.pods) {
          const pod = await prisma.cloudPod.findUnique({
            where: { vmid: podHealth.vmid },
          });
          
          if (pod) {
            await prisma.cloudPod.update({
              where: { vmid: podHealth.vmid },
              data: {
                lastHealthStatus: podHealth.healthy ? 'ok' : 'warning',
                lastHealthChecked: new Date(),
              },
            });

            // Record health event if issues found
            if (!podHealth.healthy && podHealth.issues) {
              await prisma.cloudPodEvent.create({
                data: {
                  tenantId: pod.tenantId,
                  cloudPodId: pod.id,
                  type: 'HEALTH',
                  message: `Health issues detected: ${podHealth.issues}`,
                  data: podHealth as any,
                },
              });
            }
          }
        }

        console.log(`[HEALTH] Sweep complete: ${allHealth.healthy}/${allHealth.total} healthy`);
        return { success: true, total: allHealth.total, healthy: allHealth.healthy };
      }

      // Single pod health check
      const result = await getCloudPodHealth(payload.vmid);

      // Update CloudPod health status
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: {
          lastHealthStatus: result.healthy ? 'ok' : (result.issues ? 'warning' : 'critical'),
          lastHealthChecked: new Date(),
        },
      });

      // Record event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'HEALTH',
          message: result.healthy ? 'Health check passed' : `Health issues: ${result.issues}`,
          data: result as any,
        },
      });

      console.log(`[HEALTH] VMID ${payload.vmid}: ${result.healthy ? 'OK' : 'ISSUES'}`);
      return { success: true, health: result };

    } catch (error: any) {
      console.error(`[HEALTH] Failed: ${error.message}`);

      if (payload.cloudPodId !== 'all') {
        await prisma.cloudPod.update({
          where: { id: payload.cloudPodId },
          data: {
            lastHealthStatus: 'critical',
            lastHealthChecked: new Date(),
          },
        });

        await prisma.cloudPodEvent.create({
          data: {
            tenantId: payload.tenantId,
            cloudPodId: payload.cloudPodId,
            type: 'ERROR',
            message: `Health check failed: ${error.message}`,
            data: { error: error.message },
          },
        });
      }

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

// ============================================
// Scale Worker
// ============================================

export const cloudPodScaleWorker = new Worker<CloudPodScaleJobPayload>(
  'cloudpods-scale',
  async (job: Job<CloudPodScaleJobPayload>) => {
    const payload = job.data;
    console.log(`[SCALE] Processing job ${job.id} for VMID ${payload.vmid}`);

    const dbJob = await prisma.cloudPodJob.create({
      data: {
        tenantId: payload.tenantId,
        cloudPodId: payload.cloudPodId,
        type: 'SCALE',
        status: 'running',
        payload: payload as any,
        bullJobId: job.id,
        startedAt: new Date(),
      },
    });

    try {
      // 1) Check quota for scale-up
      const quotaCheck = await checkScaleCapacity(
        payload.tenantId,
        payload.currentCores,
        payload.currentMemoryMb,
        payload.newCores,
        payload.newMemoryMb
      );

      if (!quotaCheck.allowed) {
        throw new Error(`Quota exceeded: ${quotaCheck.reason}`);
      }

      // 2) Optional backup before scale
      if (payload.backupFirst) {
        console.log(`[SCALE] Creating backup before scaling VMID ${payload.vmid}`);
        await backupCloudPod(payload.vmid, `pre-scale-${Date.now()}`);
      }

      // 3) Execute scale
      await scaleCloudPod(payload.vmid, payload.newCores, payload.newMemoryMb);

      // 4) Update CloudPod record
      await prisma.cloudPod.update({
        where: { id: payload.cloudPodId },
        data: {
          cores: payload.newCores,
          memoryMb: payload.newMemoryMb,
        },
      });

      // 5) Update quota usage
      await updateUsageAfterScale(
        payload.tenantId,
        payload.currentCores,
        payload.currentMemoryMb,
        payload.newCores,
        payload.newMemoryMb
      );

      // 6) Record event
      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'STATE_CHANGE',
          message: `Scaled: ${payload.currentCores}→${payload.newCores} cores, ${payload.currentMemoryMb}→${payload.newMemoryMb}MB`,
          data: {
            previousCores: payload.currentCores,
            previousMemoryMb: payload.currentMemoryMb,
            newCores: payload.newCores,
            newMemoryMb: payload.newMemoryMb,
            reason: payload.reason,
          },
        },
      });

      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'success',
          result: { newCores: payload.newCores, newMemoryMb: payload.newMemoryMb },
          finishedAt: new Date(),
        },
      });

      console.log(`[SCALE] Success: VMID ${payload.vmid} -> ${payload.newCores}C/${payload.newMemoryMb}MB`);
      return { success: true, newCores: payload.newCores, newMemoryMb: payload.newMemoryMb };

    } catch (error: any) {
      console.error(`[SCALE] Failed: ${error.message}`);

      await prisma.cloudPodEvent.create({
        data: {
          tenantId: payload.tenantId,
          cloudPodId: payload.cloudPodId,
          type: 'ERROR',
          message: `Scale failed: ${error.message}`,
          data: { error: error.message },
        },
      });

      await prisma.cloudPodJob.update({
        where: { id: dbJob.id },
        data: {
          status: 'failed',
          error: error.message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 } // Scale one at a time
);

// ============================================
// Worker Event Handlers
// ============================================

// Attach error handlers to all workers
const workers = [
  cloudPodCreateWorker,
  cloudPodDestroyWorker,
  cloudPodBackupWorker,
  cloudPodHealthWorker,
  cloudPodScaleWorker,
];

workers.forEach((worker) => {
  worker.on('completed', (job) => {
    console.log(`[${worker.name}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[${worker.name}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[${worker.name}] Worker error:`, err);
  });
});

/**
 * Graceful shutdown - close all workers
 */
export async function closeWorkers() {
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
}

/**
 * Start all workers
 */
export function startWorkers() {
  console.log('[CloudPod Workers] Starting all workers...');
  console.log(`  - Create worker: concurrency 2`);
  console.log(`  - Destroy worker: concurrency 2`);
  console.log(`  - Backup worker: concurrency 3`);
  console.log(`  - Health worker: concurrency 5`);
  console.log(`  - Scale worker: concurrency 1`);
  console.log('[CloudPod Workers] All workers started');
}
