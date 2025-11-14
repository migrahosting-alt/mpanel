// src/db/index.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: process.env.DATABASE_POOL_MIN ? parseInt(process.env.DATABASE_POOL_MIN) : 2,
  max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX) : 10,
});

export default pool;
