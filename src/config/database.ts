import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as pg from 'pg';
import { env } from './env.js';
import logger from './logger.js';

const { Pool } = pg;

// ============================================
// POSTGRES POOL (shared by Prisma adapter and legacy code)
// ============================================

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error & { code?: string }) => {
  logger.error('Database pool error', {
    error: err.message,
    code: err.code,
    stack: err.stack,
  });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

// ============================================
// PRISMA CLIENT (Prisma 7 with pg adapter)
// ============================================

// Create Prisma Client with pg adapter
const prismaClientSingleton = () => {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkDatabaseHealth(): Promise<{
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
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

export async function disconnectDatabase(): Promise<void> {
  logger.info('Disconnecting from database...');
  
  await Promise.all([
    prisma.$disconnect(),
    pool.end(),
  ]);
  
  logger.info('Database connections closed');
}

process.on('beforeExit', async () => {
  await disconnectDatabase();
});

// Default export for backward compatibility
export default pool;
