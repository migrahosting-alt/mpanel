import logger from '../config/logger.js';
import { createRedisClient } from '../config/redis.js';
import { startGuardianSecurityWorker, stopGuardianSecurityWorker } from './workers/guardianSecurity.worker.js';

async function main() {
  try {
    logger.info('Guardian Security Worker: initializing Redis client');
    await createRedisClient();

    logger.info('Guardian Security Worker: starting worker');
    await startGuardianSecurityWorker();

    // Keep process alive
    process.on('SIGINT', async () => {
      logger.info('Guardian Security Worker: SIGINT received, shutting down');
      await stopGuardianSecurityWorker();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Guardian Security Worker: SIGTERM received, shutting down');
      await stopGuardianSecurityWorker();
      process.exit(0);
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  } catch (error) {
    logger.error('Guardian Security Worker: failed to start', { error: error instanceof Error ? error.message : error });
    process.exit(1);
  }
}

main();
