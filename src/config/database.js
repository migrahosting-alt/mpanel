import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// ============================================
// DATABASE CONNECTION
// ============================================
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
const connectionString = process.env.DATABASE_URL;

// ============================================
// LEGACY PG POOL (for backward compatibility)
// ============================================
export const pool = new Pool({
  connectionString,
  min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
  max: parseInt(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('!!!!! DATABASE POOL ERROR !!!!!');
  console.error('Error:', err.message);
  console.error('Code:', err.code);
});

// ============================================
// PRISMA CLIENT (Prisma 7 with pg adapter)
// ============================================
// Create a dedicated pool for Prisma
const prismaPool = new Pool({
  connectionString,
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const adapter = new PrismaPg(prismaPool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
});

// Default export for backward compatibility
export default pool;
