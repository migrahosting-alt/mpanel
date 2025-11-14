/**
 * Queue Service - Redis-based async task queue
 * 
 * Handles background processing for:
 * - Service provisioning
 * - Invoice generation
 * - Email sending
 * - Backup creation
 * - Any long-running tasks
 */

import Redis from 'ioredis';
import logger from '../config/logger.js';
import provisioningService from './provisioningService.js';

class QueueService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6380,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });

    this.queues = {
      provisioning: 'queue:provisioning',
      emails: 'queue:emails',
      invoices: 'queue:invoices',
      backups: 'queue:backups'
    };

    this.processing = new Map(); // Track currently processing jobs
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds

    this.setupErrorHandlers();
  }

  setupErrorHandlers() {
    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Connected to Redis queue service');
    });

    this.redis.on('ready', () => {
      logger.info('Redis queue service ready');
      this.startWorkers();
    });
  }

  /**
   * Add a job to the provisioning queue
   */
  async addProvisioningJob(jobData) {
    const job = {
      id: this.generateJobId(),
      type: 'provisioning',
      data: jobData,
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      status: 'pending'
    };

    await this.redis.lpush(this.queues.provisioning, JSON.stringify(job));
    logger.info(`Provisioning job added to queue: ${job.id}`, jobData);
    
    return job.id;
  }

  /**
   * Add an email job to the queue
   */
  async addEmailJob(emailData) {
    const job = {
      id: this.generateJobId(),
      type: 'email',
      data: emailData,
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      status: 'pending'
    };

    await this.redis.lpush(this.queues.emails, JSON.stringify(job));
    logger.info(`Email job added to queue: ${job.id}`);
    
    return job.id;
  }

  /**
   * Add an invoice generation job
   */
  async addInvoiceJob(invoiceData) {
    const job = {
      id: this.generateJobId(),
      type: 'invoice',
      data: invoiceData,
      attempts: 0,
      maxRetries: this.maxRetries,
      createdAt: Date.now(),
      status: 'pending'
    };

    await this.redis.lpush(this.queues.invoices, JSON.stringify(job));
    logger.info(`Invoice job added to queue: ${job.id}`);
    
    return job.id;
  }

  /**
   * Start background workers for each queue
   */
  startWorkers() {
    logger.info('Starting queue workers...');

    // Provisioning worker
    this.processQueue(this.queues.provisioning, async (job) => {
      return await this.handleProvisioningJob(job);
    });

    // Email worker
    this.processQueue(this.queues.emails, async (job) => {
      return await this.handleEmailJob(job);
    });

    // Invoice worker
    this.processQueue(this.queues.invoices, async (job) => {
      return await this.handleInvoiceJob(job);
    });

    logger.info('All queue workers started');
  }

  /**
   * Generic queue processor
   */
  async processQueue(queueName, handler) {
    const processNext = async () => {
      try {
        // Block for up to 10 seconds waiting for a job
        const result = await this.redis.brpop(queueName, 10);
        
        if (!result) {
          // No job available, continue loop
          setImmediate(processNext);
          return;
        }

        const [, jobJson] = result;
        const job = JSON.parse(jobJson);

        logger.info(`Processing job ${job.id} from ${queueName}`);
        this.processing.set(job.id, job);

        try {
          // Execute handler
          const result = await handler(job);
          
          // Job succeeded
          job.status = 'completed';
          job.completedAt = Date.now();
          job.result = result;
          
          await this.storeJobResult(job);
          this.processing.delete(job.id);
          
          logger.info(`Job ${job.id} completed successfully`);

        } catch (error) {
          // Job failed
          job.attempts++;
          job.lastError = error.message;
          job.lastErrorAt = Date.now();

          if (job.attempts < job.maxRetries) {
            // Retry
            logger.warn(`Job ${job.id} failed (attempt ${job.attempts}/${job.maxRetries}), retrying...`, error);
            
            // Put back in queue with delay
            setTimeout(async () => {
              await this.redis.lpush(queueName, JSON.stringify(job));
            }, this.retryDelay * job.attempts);

          } else {
            // Max retries exceeded
            job.status = 'failed';
            job.failedAt = Date.now();
            
            await this.storeJobResult(job);
            await this.handleFailedJob(job, error);
            
            logger.error(`Job ${job.id} failed permanently after ${job.attempts} attempts`, error);
          }

          this.processing.delete(job.id);
        }

      } catch (error) {
        logger.error('Queue processing error:', error);
      }

      // Continue processing
      setImmediate(processNext);
    };

    // Start the processor
    processNext();
  }

  /**
   * Handle provisioning job
   */
  async handleProvisioningJob(job) {
    const { serviceId, customerId, productId, domain } = job.data;

    const result = await provisioningService.provisionService(
      serviceId,
      customerId,
      productId,
      domain
    );

    return result;
  }

  /**
   * Handle email job
   */
  async handleEmailJob(job) {
    const emailService = (await import('./email.js')).default;
    
    await emailService.sendTransactional({
      to: job.data.to,
      subject: job.data.subject,
      template: job.data.template,
      data: job.data.data
    });

    return { sent: true, to: job.data.to };
  }

  /**
   * Handle invoice job
   */
  async handleInvoiceJob(job) {
    const invoiceService = (await import('./invoice.js')).default;
    
    const invoice = await invoiceService.generateInvoice(job.data);
    
    return { invoiceId: invoice.id, amount: invoice.total };
  }

  /**
   * Store job result in Redis for retrieval
   */
  async storeJobResult(job) {
    const key = `job:result:${job.id}`;
    await this.redis.setex(key, 86400, JSON.stringify(job)); // Keep for 24 hours
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    // Check if currently processing
    if (this.processing.has(jobId)) {
      return {
        id: jobId,
        status: 'processing',
        job: this.processing.get(jobId)
      };
    }

    // Check stored results
    const key = `job:result:${jobId}`;
    const result = await this.redis.get(key);
    
    if (result) {
      return JSON.parse(result);
    }

    return { id: jobId, status: 'not_found' };
  }

  /**
   * Handle permanently failed jobs
   */
  async handleFailedJob(job, error) {
    logger.error(`Permanent job failure: ${job.id}`, {
      job: job,
      error: error.message,
      stack: error.stack
    });

    // Store in failed jobs list
    await this.redis.lpush('queue:failed', JSON.stringify({
      job: job,
      error: error.message,
      failedAt: Date.now()
    }));

    // Send alert to admins
    try {
      const emailService = (await import('./email.js')).default;
      await emailService.sendTransactional({
        to: process.env.ADMIN_EMAIL || 'admin@example.com',
        subject: `Queue Job Failed: ${job.type} - ${job.id}`,
        template: 'job_failed',
        data: {
          job_id: job.id,
          job_type: job.type,
          error_message: error.message,
          attempts: job.attempts,
          job_data: JSON.stringify(job.data, null, 2)
        }
      });
    } catch (emailError) {
      logger.error('Failed to send job failure notification:', emailError);
    }
  }

  /**
   * Retry a failed job manually
   */
  async retryJob(jobId) {
    const key = `job:result:${jobId}`;
    const result = await this.redis.get(key);
    
    if (!result) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const job = JSON.parse(result);
    
    if (job.status !== 'failed') {
      throw new Error(`Job ${jobId} is not in failed state (current: ${job.status})`);
    }

    // Reset job and re-queue
    job.attempts = 0;
    job.status = 'pending';
    delete job.lastError;
    delete job.failedAt;

    const queueName = this.queues[job.type] || this.queues.provisioning;
    await this.redis.lpush(queueName, JSON.stringify(job));

    logger.info(`Job ${jobId} manually retried`);
    
    return { success: true, jobId: job.id };
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const stats = {};

    for (const [name, queueName] of Object.entries(this.queues)) {
      const length = await this.redis.llen(queueName);
      stats[name] = {
        pending: length,
        processing: Array.from(this.processing.values())
          .filter(j => j.type === name).length
      };
    }

    const failedCount = await this.redis.llen('queue:failed');
    stats.failed = failedCount;
    stats.processing_total = this.processing.size;

    return stats;
  }

  /**
   * Get failed jobs list
   */
  async getFailedJobs(limit = 50) {
    const failed = await this.redis.lrange('queue:failed', 0, limit - 1);
    return failed.map(j => JSON.parse(j));
  }

  /**
   * Clear failed jobs
   */
  async clearFailedJobs() {
    const count = await this.redis.llen('queue:failed');
    await this.redis.del('queue:failed');
    logger.info(`Cleared ${count} failed jobs`);
    return count;
  }

  generateJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down queue service...');
    
    // Wait for processing jobs to complete (max 30 seconds)
    const timeout = 30000;
    const start = Date.now();
    
    while (this.processing.size > 0 && (Date.now() - start) < timeout) {
      logger.info(`Waiting for ${this.processing.size} jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.processing.size > 0) {
      logger.warn(`Forcing shutdown with ${this.processing.size} jobs still processing`);
    }

    await this.redis.quit();
    logger.info('Queue service shut down');
  }
}

export default new QueueService();
