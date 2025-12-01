import { createQueue, type QueueJob } from '../queue.js';
import { prisma } from '../../config/database.js';
import { JobType, JobStatus, SubscriptionStatus, DomainStatus } from '../../types/db-enums.js';
import logger from '../../config/logger.js';
import dnsService from '../../modules/dns/dns.service.js';
import hostingService from '../../modules/hosting/hosting.service.js';
import mailService from '../../modules/mail/mail.service.js';

// Create provisioning queue
const provisioningQueue = createQueue({
  name: 'provisioning',
  concurrency: 3, // Process up to 3 jobs simultaneously
  pollInterval: 5000, // Poll every 5 seconds
});

/**
 * Process DNS provisioning job
 */
async function processDnsProvisioning(jobPayload: any): Promise<void> {
  const { jobId, subscriptionId } = jobPayload;

  logger.info('Processing DNS provisioning', { jobId, subscriptionId });

  try {
    // Update job status to RUNNING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Get job details from database
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const payload = job.payload as any;
    const domain = payload.domain;

    if (!domain) {
      throw new Error('Domain is required for DNS provisioning');
    }

    // Provision DNS zone
    await dnsService.provisionDnsZone({
      domain,
      domainId: payload.domainId,
      tenantId: job.tenantId,
    });

    // Update job status to SUCCESS
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
      },
    });

    logger.info('DNS provisioning completed', { jobId, domain });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job status to FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        lastError: errorMessage,
        attempts: { increment: 1 },
      },
    });

    logger.error('DNS provisioning failed', {
      jobId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Process hosting provisioning job
 */
async function processHostingProvisioning(jobPayload: any): Promise<void> {
  const { jobId, subscriptionId } = jobPayload;

  logger.info('Processing hosting provisioning', { jobId, subscriptionId });

  try {
    // Update job status to RUNNING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Get job details from database
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const payload = job.payload as any;
    const domain = payload.domain;

    if (!domain) {
      throw new Error('Domain is required for hosting provisioning');
    }

    // Provision hosting account
    await hostingService.provisionHostingAccount({
      domain,
      domainId: payload.domainId,
      customerId: payload.customerId,
      email: payload.email,
      tenantId: job.tenantId,
    });

    // Update job status to SUCCESS
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
      },
    });

    // Check if all provisioning jobs for this subscription are complete
    await checkAndActivateSubscription(subscriptionId);

    logger.info('Hosting provisioning completed', { jobId, domain });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job status to FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        lastError: errorMessage,
        attempts: { increment: 1 },
      },
    });

    logger.error('Hosting provisioning failed', {
      jobId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Process mail provisioning job
 */
async function processMailProvisioning(jobPayload: any): Promise<void> {
  const { jobId, subscriptionId } = jobPayload;

  logger.info('Processing mail provisioning', { jobId, subscriptionId });

  try {
    // Update job status to RUNNING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Get job details from database
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const payload = job.payload as any;
    const domain = payload.domain;

    if (!domain) {
      throw new Error('Domain is required for mail provisioning');
    }

    // Provision mail account
    await mailService.provisionMailAccount({
      domain,
      domainId: payload.domainId,
      email: payload.email,
      tenantId: job.tenantId,
    });

    // Update job status to SUCCESS
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.SUCCESS,
        completedAt: new Date(),
      },
    });

    logger.info('Mail provisioning completed', { jobId, domain });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update job status to FAILED
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        lastError: errorMessage,
        attempts: { increment: 1 },
      },
    });

    logger.error('Mail provisioning failed', {
      jobId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Check if all provisioning jobs are complete and activate subscription
 */
async function checkAndActivateSubscription(subscriptionId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      order: {
        include: {
          jobs: true,
        },
      },
    },
  });

  if (!subscription || !subscription.order) {
    return;
  }

  const jobs = subscription.order.jobs;
  const allCompleted = jobs.every((job) => job.status === JobStatus.SUCCESS);
  const anyFailed = jobs.some((job) => job.status === JobStatus.FAILED);

  if (allCompleted) {
    // Activate subscription
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Update domain status
    const payload = jobs[0].payload as any;
    if (payload.domainId) {
      await prisma.domain.update({
        where: { id: payload.domainId },
        data: {
          status: DomainStatus.ACTIVE,
        },
      });
    }

    logger.info('Subscription activated', {
      subscriptionId,
      domainId: payload.domainId,
    });
  } else if (anyFailed) {
    logger.warn('Some provisioning jobs failed, subscription remains inactive', {
      subscriptionId,
      failedJobs: jobs.filter((j) => j.status === JobStatus.FAILED).map((j) => j.id),
    });
  }
}

// Register job handlers
provisioningQueue.process(JobType.PROVISION_DNS, async (job: QueueJob) => {
  await processDnsProvisioning(job.payload);
});

provisioningQueue.process(JobType.PROVISION_HOSTING, async (job: QueueJob) => {
  await processHostingProvisioning(job.payload);
});

provisioningQueue.process(JobType.PROVISION_MAIL, async (job: QueueJob) => {
  await processMailProvisioning(job.payload);
});

// Start the queue
export async function startProvisioningWorker(): Promise<void> {
  logger.info('Starting provisioning worker');
  await provisioningQueue.start();
}

// Stop the queue
export async function stopProvisioningWorker(): Promise<void> {
  logger.info('Stopping provisioning worker');
  await provisioningQueue.stop();
}

export default provisioningQueue;
