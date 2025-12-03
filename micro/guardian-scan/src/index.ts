import 'dotenv/config';
import { logger } from './logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Guardian Scanner Service
 * Phase 3: Poll guardian_scans for pending scans, collect data from server logs/APIs,
 * run analyzers, insert findings, create remediation tasks.
 */

const SCAN_INTERVAL_SECONDS = parseInt(process.env.SCAN_INTERVAL_SECONDS || '60', 10);

async function pollScans() {
  try {
    const scans = await prisma.guardianScan.findMany({
      where: { status: 'queued' },
      take: 10,
      orderBy: { createdAt: 'asc' },
    });

    if (scans.length === 0) {
      logger.debug('No pending scans');
      return;
    }

    for (const scan of scans) {
      logger.info({ scanId: scan.id, type: scan.type }, 'Processing scan');

      // Mark running
      await prisma.guardianScan.update({
        where: { id: scan.id },
        data: { status: 'running', startedAt: new Date() },
      });

      // TODO: collectors (mail logs, web logs, DNS, system)
      // TODO: analyzers (authFailures, TLS, DNS misconfig, etc.)
      // TODO: insert findings to guardianFinding
      // TODO: create guardianRemediationTask if needed

      // Stub completion
      await prisma.guardianScan.update({
        where: { id: scan.id },
        data: { status: 'completed', completedAt: new Date(), findingsCount: 0 },
      });

      logger.info({ scanId: scan.id }, 'Scan completed (stub)');
    }
  } catch (error) {
    logger.error({ error }, 'Error polling scans');
  }
}

async function main() {
  logger.info('Starting Guardian Deep Scanner microservice…');
  logger.info(`Polling interval: ${SCAN_INTERVAL_SECONDS}s`);

  setInterval(pollScans, SCAN_INTERVAL_SECONDS * 1000);

  // Initial poll
  await pollScans();
}

main();
