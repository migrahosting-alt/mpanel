/**
 * Worker Thread Pool - Offloads CPU-intensive tasks to worker threads
 * 
 * Features:
 * - Worker thread pool for CPU-intensive operations
 * - PDF generation, encryption, compression, image processing
 * - Automatic load balancing
 * - Graceful worker lifecycle management
 * - Performance metrics
 */

import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { EventEmitter } from 'events';
import logger from '../config/logger.js';
import { Counter, Histogram, Gauge } from 'prom-client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WorkerPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.poolSize = options.poolSize || Math.max(2, cpus().length - 1);
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.workerTimeout = options.workerTimeout || 30000; // 30 seconds
    
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasks = new Map();
    
    this.metrics = {
      tasksProcessed: new Counter({
        name: 'worker_pool_tasks_processed_total',
        help: 'Total tasks processed by worker pool',
        labelNames: ['task_type', 'status']
      }),
      taskDuration: new Histogram({
        name: 'worker_pool_task_duration_seconds',
        help: 'Task processing duration',
        labelNames: ['task_type'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
      }),
      queueSize: new Gauge({
        name: 'worker_pool_queue_size',
        help: 'Current size of task queue'
      }),
      activeWorkers: new Gauge({
        name: 'worker_pool_active_workers',
        help: 'Number of active workers'
      }),
      availableWorkers: new Gauge({
        name: 'worker_pool_available_workers',
        help: 'Number of available workers'
      })
    };

    this.taskHandlers = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the worker pool
   */
  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing worker pool', {
      poolSize: this.poolSize,
      maxQueueSize: this.maxQueueSize
    });

    // Create workers
    for (let i = 0; i < this.poolSize; i++) {
      await this.createWorker(i);
    }

    this.initialized = true;
    this.updateMetrics();

    logger.info('Worker pool initialized', {
      workersCreated: this.workers.length
    });
  }

  /**
   * Create a new worker
   */
  async createWorker(id) {
    const workerPath = path.join(__dirname, 'worker.js');
    const worker = new Worker(workerPath);
    
    worker.workerId = id;
    worker.busy = false;
    worker.currentTask = null;

    worker.on('message', (message) => {
      this.handleWorkerMessage(worker, message);
    });

    worker.on('error', (error) => {
      this.handleWorkerError(worker, error);
    });

    worker.on('exit', (code) => {
      this.handleWorkerExit(worker, code);
    });

    this.workers.push(worker);
    this.availableWorkers.push(worker);

    return worker;
  }

  /**
   * Handle message from worker
   */
  handleWorkerMessage(worker, message) {
    const { type, taskId, result, error } = message;

    if (type === 'ready') {
      logger.debug('Worker ready', { workerId: worker.workerId });
      return;
    }

    if (type === 'complete') {
      const task = this.activeTasks.get(taskId);
      if (!task) return;

      const duration = (Date.now() - task.startTime) / 1000;

      if (error) {
        this.metrics.tasksProcessed.inc({
          task_type: task.type,
          status: 'error'
        });
        task.reject(new Error(error));
      } else {
        this.metrics.tasksProcessed.inc({
          task_type: task.type,
          status: 'success'
        });
        this.metrics.taskDuration.observe({ task_type: task.type }, duration);
        task.resolve(result);
      }

      // Clear timeout
      if (task.timeout) {
        clearTimeout(task.timeout);
      }

      this.activeTasks.delete(taskId);
      this.releaseWorker(worker);
    }
  }

  /**
   * Handle worker error
   */
  handleWorkerError(worker, error) {
    logger.error('Worker error', {
      workerId: worker.workerId,
      error: error.message
    });

    if (worker.currentTask) {
      const task = this.activeTasks.get(worker.currentTask);
      if (task) {
        task.reject(error);
        this.activeTasks.delete(worker.currentTask);
      }
    }

    this.restartWorker(worker);
  }

  /**
   * Handle worker exit
   */
  handleWorkerExit(worker, code) {
    logger.warn('Worker exited', {
      workerId: worker.workerId,
      code
    });

    // Remove from arrays
    this.workers = this.workers.filter(w => w !== worker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== worker);

    // Restart if needed
    if (this.initialized) {
      this.createWorker(worker.workerId);
    }
  }

  /**
   * Restart a worker
   */
  async restartWorker(worker) {
    const workerId = worker.workerId;
    
    try {
      await worker.terminate();
    } catch (error) {
      logger.error('Error terminating worker', { error: error.message });
    }

    this.workers = this.workers.filter(w => w !== worker);
    this.availableWorkers = this.availableWorkers.filter(w => w !== worker);

    await this.createWorker(workerId);
  }

  /**
   * Release worker back to pool
   */
  releaseWorker(worker) {
    worker.busy = false;
    worker.currentTask = null;
    this.availableWorkers.push(worker);
    this.updateMetrics();

    // Process next queued task
    this.processQueue();
  }

  /**
   * Execute a task
   */
  async execute(taskType, data, options = {}) {
    return new Promise((resolve, reject) => {
      const taskId = `${taskType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const task = {
        id: taskId,
        type: taskType,
        data,
        resolve,
        reject,
        startTime: Date.now(),
        timeout: null,
        options
      };

      // Check queue size
      if (this.taskQueue.length >= this.maxQueueSize) {
        reject(new Error('Worker pool queue full'));
        return;
      }

      // Add to queue
      this.taskQueue.push(task);
      this.updateMetrics();

      // Try to process immediately
      this.processQueue();
    });
  }

  /**
   * Process queued tasks
   */
  processQueue() {
    while (this.taskQueue.length > 0 && this.availableWorkers.length > 0) {
      const task = this.taskQueue.shift();
      const worker = this.availableWorkers.shift();

      worker.busy = true;
      worker.currentTask = task.id;
      this.activeTasks.set(task.id, task);

      // Set timeout
      task.timeout = setTimeout(() => {
        logger.error('Worker task timeout', {
          taskId: task.id,
          taskType: task.type
        });
        
        this.metrics.tasksProcessed.inc({
          task_type: task.type,
          status: 'timeout'
        });
        
        task.reject(new Error('Task timeout'));
        this.activeTasks.delete(task.id);
        this.restartWorker(worker);
      }, this.workerTimeout);

      // Send task to worker
      worker.postMessage({
        type: 'task',
        taskId: task.id,
        taskType: task.type,
        data: task.data
      });

      this.updateMetrics();
    }
  }

  /**
   * Update metrics
   */
  updateMetrics() {
    this.metrics.queueSize.set(this.taskQueue.length);
    this.metrics.activeWorkers.set(this.workers.length - this.availableWorkers.length);
    this.metrics.availableWorkers.set(this.availableWorkers.length);
  }

  /**
   * Convenience methods for specific tasks
   */
  
  async generatePDF(data) {
    return this.execute('pdf-generation', data);
  }

  async encryptData(data) {
    return this.execute('encryption', data);
  }

  async compressBackup(data) {
    return this.execute('compression', data);
  }

  async processImage(data) {
    return this.execute('image-processing', data);
  }

  async parseCSV(data) {
    return this.execute('csv-parsing', data);
  }

  async hashPassword(data) {
    return this.execute('password-hashing', data);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      poolSize: this.poolSize,
      activeWorkers: this.workers.length - this.availableWorkers.length,
      availableWorkers: this.availableWorkers.length,
      queueSize: this.taskQueue.length,
      activeTasks: this.activeTasks.size,
      totalWorkers: this.workers.length,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Shutdown the pool
   */
  async shutdown() {
    logger.info('Shutting down worker pool');

    this.initialized = false;

    // Wait for active tasks to complete (with timeout)
    const maxWait = 10000; // 10 seconds
    const startTime = Date.now();
    
    while (this.activeTasks.size > 0 && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );

    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.activeTasks.clear();

    logger.info('Worker pool shut down');
  }
}

// Singleton instance
const workerPool = new WorkerPool({
  poolSize: parseInt(process.env.WORKER_POOL_SIZE || '0') || Math.max(2, cpus().length - 1),
  maxQueueSize: parseInt(process.env.WORKER_MAX_QUEUE_SIZE || '1000'),
  workerTimeout: parseInt(process.env.WORKER_TIMEOUT || '30000')
});

export default workerPool;
