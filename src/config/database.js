import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DATABASE_POOL_MIN) || 2,
  max: parseInt(process.env.DATABASE_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('!!!!! DATABASE POOL ERROR !!!!!');
  console.error('Error:', err.message);
  console.error('Code:', err.code);
  console.error('Stack:', err.stack);
  // Don't exit - just log the error
  // process.exit(-1);
});

export default pool;
