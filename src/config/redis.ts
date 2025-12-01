import { createClient, RedisClientType } from 'redis';
import { env } from './env.js';
import logger from './logger.js';

// ============================================
// REDIS CLIENT
// ============================================

let redisClient: RedisClientType | null = null;

export async function createRedisClient(): Promise<RedisClientType> {
  if (redisClient) {
    return redisClient;
  }
  
  const client = createClient({
    url: env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis connection failed');
        }
        // Exponential backoff: 50ms, 100ms, 200ms, etc.
        return Math.min(retries * 50, 3000);
      },
    },
  });
  
  client.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
  });
  
  client.on('connect', () => {
    logger.info('Redis client connected');
  });
  
  client.on('reconnecting', () => {
    logger.warn('Redis client reconnecting...');
  });
  
  client.on('ready', () => {
    logger.info('Redis client ready');
  });
  
  await client.connect();
  
  redisClient = client as RedisClientType;
  return redisClient;
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
}

// ============================================
// CACHE HELPERS
// ============================================

export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedisClient();
  return client.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  expirationSeconds?: number
): Promise<void> {
  const client = await getRedisClient();
  
  if (expirationSeconds) {
    await client.setEx(key, expirationSeconds, value);
  } else {
    await client.set(key, value);
  }
}

export async function cacheDel(key: string): Promise<void> {
  const client = await getRedisClient();
  await client.del(key);
}

export async function cacheExists(key: string): Promise<boolean> {
  const client = await getRedisClient();
  const result = await client.exists(key);
  return result === 1;
}

// ============================================
// QUEUE HELPERS (for BullMQ)
// ============================================

export interface QueueJob<T = any> {
  id: string;
  type: string;
  payload: T;
  attempts: number;
  maxAttempts?: number;
}

export async function enqueueJob<T>(
  queueName: string,
  job: Omit<QueueJob<T>, 'id' | 'attempts'>
): Promise<void> {
  const client = await getRedisClient();
  
  const jobData = {
    ...job,
    id: `${queueName}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
    attempts: 0,
    enqueuedAt: new Date().toISOString(),
  };
  
  await client.lPush(`queue:${queueName}`, JSON.stringify(jobData));
  logger.debug('Job enqueued', { queueName, jobType: job.type, jobId: jobData.id });
}

export async function dequeueJob<T>(queueName: string): Promise<QueueJob<T> | null> {
  const client = await getRedisClient();
  const jobStr = await client.rPop(`queue:${queueName}`);
  
  if (!jobStr) {
    return null;
  }
  
  try {
    return JSON.parse(jobStr) as QueueJob<T>;
  } catch (error) {
    logger.error('Failed to parse job from queue', { queueName, error });
    return null;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    const client = await getRedisClient();
    await client.ping();
    const latencyMs = Date.now() - start;
    
    return {
      healthy: true,
      latencyMs,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    logger.info('Disconnecting from Redis...');
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

process.on('beforeExit', async () => {
  await disconnectRedis();
});

export default {
  createClient: createRedisClient,
  getClient: getRedisClient,
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
  exists: cacheExists,
  enqueue: enqueueJob,
  dequeue: dequeueJob,
  checkHealth: checkRedisHealth,
  disconnect: disconnectRedis,
};
