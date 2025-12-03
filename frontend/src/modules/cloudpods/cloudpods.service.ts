/**
 * CLOUDPODS Service
 * CloudPod provisioning, lifecycle, and management
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import {
  CLOUDPOD_PLANS,
  type CloudPod,
  type CloudPodStatus,
  type CreateCloudPodRequest,
  type ResizeCloudPodRequest,
  type UpdateCloudPodRequest,
} from './cloudpods.types.js';

export async function listCloudPods(filters: {
  tenantId?: string;
  status?: CloudPodStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ items: CloudPod[]; total: number }> {
  const { tenantId, status, page = 1, pageSize = 50 } = filters;

  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  if (status) where.status = status;

  try {
    // @ts-ignore
    const [items, total] = await Promise.all([
      prisma.cloudPod.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.cloudPod.count({ where }),
    ]);

    return { items, total };
  } catch (error) {
    logger.error('Failed to list CloudPods', { error });
    return { items: [], total: 0 };
  }
}

export async function getCloudPodById(id: string): Promise<CloudPod | null> {
  try {
    // @ts-ignore
    const pod = await prisma.cloudPod.findFirst({
      where: { id },
    });
    return pod;
  } catch {
    return null;
  }
}

export async function createCloudPod(
  data: CreateCloudPodRequest,
  actorId: string
): Promise<{ pod: CloudPod; jobId: string }> {
  const { tenantId, subscriptionId, name, plan, region } = data;

  // Get plan specs
  const planSpec = (CLOUDPOD_PLANS as any)[plan];

  // Create CloudPod record
  // @ts-ignore
  const pod = await prisma.cloudPod.create({
    data: {
      tenantId,
      subscriptionId,
      name,
      plan,
      status: 'PROVISIONING',
      region,
      proxmoxVmId: null,
      proxmoxNode: null,
      ipAddress: null,
      hostname: null,
      cpuCores: planSpec.cpuCores,
      ramMb: planSpec.ramMb,
      diskGb: planSpec.diskGb,
      maxWebsites: planSpec.maxWebsites,
      maxEmailAccounts: planSpec.maxEmailAccounts,
      usageStats: {
        cpuUsagePercent: 0,
        ramUsageMb: 0,
        diskUsageGb: 0,
        websiteCount: 0,
        emailAccountCount: 0,
      },
      guardianEnabled: true,
      guardianStatus: null,
      backupPolicyId: null,
      lastBackup: null,
      provisionedAt: null,
      suspendedAt: null,
      deletedAt: null,
    },
  });

  // Update subscription with externalRef
  // @ts-ignore
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { externalRef: pod.id },
  });

  // Enqueue provisioning job
  const job = await prisma.job.create({
    data: {
      tenantId,
      type: 'cloudpod.provision',
      status: 'pending',
      payload: {
        cloudPodId: pod.id,
        plan,
        region,
      },
      createdBy: actorId,
    },
  });

  logger.info('CloudPod created, provisioning enqueued', { podId: pod.id, jobId: job.id });

  return { pod, jobId: job.id };
}

export async function resizeCloudPod(
  id: string,
  data: ResizeCloudPodRequest,
  actorId: string
): Promise<{ pod: CloudPod; jobId: string }> {
  const pod = await getCloudPodById(id);
  if (!pod) {
    throw new Error('CloudPod not found');
  }

  const { newPlan } = data;
  const planSpec = (CLOUDPOD_PLANS as any)[newPlan];

  // Update CloudPod specs
  // @ts-ignore
  const updated = await prisma.cloudPod.update({
    where: { id },
    data: {
      plan: newPlan,
      cpuCores: planSpec.cpuCores,
      ramMb: planSpec.ramMb,
      diskGb: planSpec.diskGb,
      maxWebsites: planSpec.maxWebsites,
      maxEmailAccounts: planSpec.maxEmailAccounts,
    },
  });

  // Enqueue resize job
  const job = await prisma.job.create({
    data: {
      tenantId: pod.tenantId,
      type: 'cloudpod.resize',
      status: 'pending',
      payload: {
        cloudPodId: id,
        oldPlan: pod.plan,
        newPlan,
      },
      createdBy: actorId,
    },
  });

  logger.info('CloudPod resize enqueued', { podId: id, newPlan, jobId: job.id });

  return { pod: updated, jobId: job.id };
}

export async function suspendCloudPod(id: string, actorId: string): Promise<CloudPod> {
  // @ts-ignore
  const pod = await prisma.cloudPod.update({
    where: { id },
    data: {
      status: 'SUSPENDED',
      suspendedAt: new Date(),
    },
  });

  // Enqueue suspend job
  await prisma.job.create({
    data: {
      tenantId: pod.tenantId,
      type: 'cloudpod.suspend',
      status: 'pending',
      payload: { cloudPodId: id },
      createdBy: actorId,
    },
  });

  logger.info('CloudPod suspended', { podId: id });

  return pod;
}

export async function resumeCloudPod(id: string, actorId: string): Promise<CloudPod> {
  // @ts-ignore
  const pod = await prisma.cloudPod.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      suspendedAt: null,
    },
  });

  // Enqueue resume job
  await prisma.job.create({
    data: {
      tenantId: pod.tenantId,
      type: 'cloudpod.resume',
      status: 'pending',
      payload: { cloudPodId: id },
      createdBy: actorId,
    },
  });

  logger.info('CloudPod resumed', { podId: id });

  return pod;
}

export async function deleteCloudPod(id: string, actorId: string): Promise<CloudPod> {
  // @ts-ignore
  const pod = await prisma.cloudPod.update({
    where: { id },
    data: {
      status: 'DELETED',
      deletedAt: new Date(),
    },
  });

  // Enqueue deletion job
  await prisma.job.create({
    data: {
      tenantId: pod.tenantId,
      type: 'cloudpod.delete',
      status: 'pending',
      payload: { cloudPodId: id },
      createdBy: actorId,
    },
  });

  logger.info('CloudPod deletion enqueued', { podId: id });

  return pod;
}

export async function updateCloudPod(
  id: string,
  data: UpdateCloudPodRequest,
  actorId: string
): Promise<CloudPod> {
  // @ts-ignore
  const pod = await prisma.cloudPod.update({
    where: { id },
    data,
  });

  logger.info('CloudPod updated', { podId: id });

  return pod;
}
