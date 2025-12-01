import { dequeueJob, type QueueJob } from '../config/redis.js';
import logger from '../config/logger.js';

export type { QueueJob } from '../config/redis.js';

export interface QueueConfig {
  name: string;
  concurrency: number;
  pollInterval: number; // milliseconds
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<void>;

export class Queue {
  private name: string;
  private concurrency: number;
  private pollInterval: number;
  private handlers: Map<string, JobHandler>;
  private running: boolean = false;
  private activeJobs: number = 0;

  constructor(config: QueueConfig) {
    this.name = config.name;
    this.concurrency = config.concurrency;
    this.pollInterval = config.pollInterval;
    this.handlers = new Map();
  }

  /**
   * Register a handler for a specific job type
   */
  process(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    logger.info('Job handler registered', {
      queue: this.name,
      jobType,
    });
  }

  /**
   * Start processing jobs
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Queue already running', { queue: this.name });
      return;
    }

    this.running = true;
    logger.info('Queue started', {
      queue: this.name,
      concurrency: this.concurrency,
      pollInterval: this.pollInterval,
    });

    // Start multiple workers based on concurrency
    const workers = [];
    for (let i = 0; i < this.concurrency; i++) {
      workers.push(this.worker(i));
    }

    await Promise.all(workers);
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    this.running = false;
    logger.info('Queue stopping', {
      queue: this.name,
      activeJobs: this.activeJobs,
    });

    // Wait for active jobs to complete
    while (this.activeJobs > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.info('Queue stopped', { queue: this.name });
  }

  /**
   * Worker loop
   */
  private async worker(workerId: number): Promise<void> {
    logger.debug('Worker started', {
      queue: this.name,
      workerId,
    });

    while (this.running) {
      try {
        // Check if we can process more jobs
        if (this.activeJobs >= this.concurrency) {
          await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
          continue;
        }

        // Dequeue job
        const job = await dequeueJob(this.name);

        if (!job) {
          // No jobs available, wait and retry
          await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
          continue;
        }

        this.activeJobs++;

        // Process job asynchronously
        this.processJob(job)
          .catch((error) => {
            logger.error('Job processing failed', {
              queue: this.name,
              jobId: job.id,
              jobType: job.type,
              error: error instanceof Error ? error.message : 'Unknown',
            });
          })
          .finally(() => {
            this.activeJobs--;
          });
      } catch (error) {
        logger.error('Worker error', {
          queue: this.name,
          workerId,
          error: error instanceof Error ? error.message : 'Unknown',
        });

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, this.pollInterval * 2));
      }
    }

    logger.debug('Worker stopped', {
      queue: this.name,
      workerId,
    });
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueueJob): Promise<void> {
    const handler = this.handlers.get(job.type);

    if (!handler) {
      logger.error('No handler found for job type', {
        queue: this.name,
        jobId: job.id,
        jobType: job.type,
      });
      return;
    }

    logger.info('Processing job', {
      queue: this.name,
      jobId: job.id,
      jobType: job.type,
      attempt: job.attempts + 1,
    });

    const startTime = Date.now();

    try {
      await handler(job);

      const duration = Date.now() - startTime;

      logger.info('Job completed', {
        queue: this.name,
        jobId: job.id,
        jobType: job.type,
        duration,
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Job failed', {
        queue: this.name,
        jobId: job.id,
        jobType: job.type,
        attempt: job.attempts + 1,
        duration,
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // TODO: Implement retry logic here
      // - Check job.attempts vs job.maxAttempts
      // - Re-enqueue with exponential backoff
      // - Update job status in database

      throw error;
    }
  }

  /**
   * Get queue stats
   */
  getStats() {
    return {
      name: this.name,
      running: this.running,
      activeJobs: this.activeJobs,
      concurrency: this.concurrency,
      handlers: Array.from(this.handlers.keys()),
    };
  }
}

/**
 * Create a new queue
 */
export function createQueue(config: QueueConfig): Queue {
  return new Queue(config);
}

export default Queue;
