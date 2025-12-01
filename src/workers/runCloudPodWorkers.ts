#!/usr/bin/env node
/**
 * CloudPods Worker Runner
 * 
 * Entry point for running CloudPod BullMQ workers.
 * Run with: node src/workers/runCloudPodWorkers.js
 * Or: pm2 start src/workers/runCloudPodWorkers.js --name cloudpod-workers
 * 
 * @see docs/migra-cloudpods-platform-spec.md
 */

import {
  startWorkers,
  closeWorkers,
} from './cloudPodWorkers.js';
import { scheduleHealthChecks } from '../services/cloudPodQueues.js';

console.log('============================================');
console.log(' MigraCloud CloudPod Workers');
console.log(' Control Plane v1.0');
console.log('============================================');
console.log('');

// Configuration (defaults from env.ts schema)
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const PROXMOX_HOST = process.env.PROXMOX_HOST || 'proxmox-host';
const HEALTH_CHECK_INTERVAL = parseInt(process.env.HEALTH_CHECK_INTERVAL || '5', 10);

console.log('Configuration:');
console.log(`  Redis: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`  Proxmox: ${PROXMOX_HOST}`);
console.log(`  Health check interval: ${HEALTH_CHECK_INTERVAL} minutes`);
console.log('');

// Start workers
startWorkers();

// Schedule health checks (every 5 minutes by default)
if (HEALTH_CHECK_INTERVAL > 0) {
  console.log(`[Scheduler] Setting up health check sweep every ${HEALTH_CHECK_INTERVAL} minutes`);
  scheduleHealthChecks(HEALTH_CHECK_INTERVAL).catch((err) => {
    console.error('[Scheduler] Failed to setup health checks:', err);
  });
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n[Shutdown] Received ${signal}, closing workers...`);
  try {
    await closeWorkers();
    console.log('[Shutdown] All workers closed');
    process.exit(0);
  } catch (err) {
    console.error('[Shutdown] Error closing workers:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Keep process alive
console.log('');
console.log('[CloudPod Workers] Ready and listening for jobs...');
console.log('Press Ctrl+C to stop');
