import 'dotenv/config';
import { logger } from './logger.js';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

/**
 * Telemetry Worker
 * Phase 3: Poll service health endpoints, DB metrics, Redis metrics, queue metrics.
 * Insert into monitoring_service_status + monitoring_slow_queries tables.
 */

const TELEMETRY_INTERVAL_SECONDS = parseInt(process.env.TELEMETRY_INTERVAL_SECONDS || '30', 10);

const NODES = [
  { name: 'mpanel-core', url: process.env.NODE_MPANEL_CORE_URL },
  { name: 'srv1-web', url: process.env.NODE_SRV1_WEB_URL },
  { name: 'mail-core', url: process.env.NODE_MAIL_CORE_URL },
  { name: 'dns-core', url: process.env.NODE_DNS_CORE_URL },
  { name: 'db-core', url: process.env.NODE_DB_CORE_HOST },
].filter((n) => n.url);

async function collectNodeHealth() {
  for (const node of NODES) {
    try {
      const start = Date.now();
      if (node.url && node.url.startsWith('http')) {
        await axios.get(node.url, { timeout: 5000 });
        const latency = Date.now() - start;
        await prisma.monitoringServiceStatus.create({
          data: {
            serviceName: node.name,
            status: 'up',
            latencyMs: latency,
            checkedAt: new Date(),
          },
        });
        logger.debug({ service: node.name, latency }, 'Health check OK');
      } else {
        logger.debug({ service: node.name }, 'Skipping (no http url)');
      }
    } catch (error) {
      logger.warn({ service: node.name, error: (error as Error).message }, 'Health check failed');
      await prisma.monitoringServiceStatus.create({
        data: {
          serviceName: node.name,
          status: 'down',
          latencyMs: null,
          checkedAt: new Date(),
        },
      });
    }
  }
}

async function collectSlowQueries() {
  // TODO: query pg_stat_statements or similar
  // For now, just log that we would collect slow queries
  logger.debug('Slow query collection (stub)');
}

async function collectRedisMetrics() {
  // TODO: query Redis INFO or similar
  logger.debug('Redis metrics collection (stub)');
}

async function collectJobQueueMetrics() {
  // TODO: query BullMQ queue stats
  logger.debug('Job queue metrics collection (stub)');
}

async function poll() {
  try {
    await collectNodeHealth();
    await collectSlowQueries();
    await collectRedisMetrics();
    await collectJobQueueMetrics();
  } catch (error) {
    logger.error({ error }, 'Error in telemetry poll');
  }
}

async function main() {
  logger.info('Starting Telemetry microservice…');
  logger.info(`Polling interval: ${TELEMETRY_INTERVAL_SECONDS}s`);

  setInterval(poll, TELEMETRY_INTERVAL_SECONDS * 1000);

  // Initial poll
  await poll();
}

main();
