import { Queue } from 'bullmq';
import { env } from '../config/env.js';

const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

export const sslQueue = new Queue('ssl-issuance', { connection });

export async function enqueueSslIssue(domainId) {
  await sslQueue.add(
    'issue',
    { domainId },
    {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}
