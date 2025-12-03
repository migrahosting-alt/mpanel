import 'dotenv/config';
import { logger } from './logger.js';

// This microservice boots the existing CloudPods BullMQ workers from the main backend,
// keeping Phase 3 spec compliance while reusing live, battle-tested logic.

async function main() {
  logger.info('Starting CloudPods provisioner microservice…');

  try {
    // Dynamically import the existing worker runner to avoid bundling issues
    const runner = await import('../../src/workers/runCloudPodWorkers.js');
    if (runner && typeof runner.startWorkers === 'function') {
      // When run directly via tsx, runCloudPodWorkers.ts already calls startWorkers.
      logger.info('CloudPods workers started via existing runner');
    } else {
      logger.warn('Worker runner did not expose startWorkers; relying on side-effects');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to bootstrap CloudPods workers from backend');
    process.exit(1);
  }
}

main();
