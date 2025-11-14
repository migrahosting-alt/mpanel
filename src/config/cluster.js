// src/config/cluster.js
/**
 * Node.js Cluster configuration for load balancing across CPU cores
 * Enables horizontal scaling on a single machine
 */

import cluster from 'cluster';
import os from 'os';
import logger from './logger.js';

const NUM_WORKERS = parseInt(process.env.WORKERS) || os.cpus().length;
const WORKER_RESTART_DELAY = 1000; // 1 second

/**
 * Initialize cluster master
 */
export function initializeCluster(startServer) {
  if (cluster.isPrimary) {
    logger.info(`Master process ${process.pid} is running`);
    logger.info(`Starting ${NUM_WORKERS} worker processes`);

    // Fork workers
    for (let i = 0; i < NUM_WORKERS; i++) {
      cluster.fork();
    }

    // Handle worker exits
    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      
      // Restart worker after delay
      setTimeout(() => {
        cluster.fork();
      }, WORKER_RESTART_DELAY);
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      
      for (const id in cluster.workers) {
        cluster.workers[id].send('shutdown');
      }

      setTimeout(() => {
        logger.info('Forcing shutdown');
        process.exit(0);
      }, 30000); // 30 second timeout
    });

    // Worker health monitoring
    setInterval(() => {
      const workers = Object.values(cluster.workers);
      const healthy = workers.filter(w => w.isConnected()).length;
      
      if (healthy < NUM_WORKERS * 0.5) {
        logger.error(`Only ${healthy}/${NUM_WORKERS} workers healthy!`);
      }
    }, 60000); // Check every minute

  } else {
    // Worker process
    logger.info(`Worker ${process.pid} started`);
    
    // Start the server in worker
    startServer();

    // Handle shutdown signal from master
    process.on('message', (msg) => {
      if (msg === 'shutdown') {
        logger.info(`Worker ${process.pid} shutting down`);
        
        // Gracefully close server and connections
        process.exit(0);
      }
    });
  }
}

/**
 * Check if running in cluster mode
 */
export function isClusterMode() {
  return process.env.CLUSTER_MODE === 'true';
}

/**
 * Get worker ID (0 if not in cluster)
 */
export function getWorkerId() {
  return cluster.worker?.id || 0;
}

/**
 * Broadcast message to all workers
 */
export function broadcastToWorkers(message) {
  if (cluster.isPrimary) {
    for (const id in cluster.workers) {
      cluster.workers[id].send(message);
    }
  }
}

export default {
  initializeCluster,
  isClusterMode,
  getWorkerId,
  broadcastToWorkers,
};
