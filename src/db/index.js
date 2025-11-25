// src/db/index.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { addQueryMonitoring } from '../utils/queryMonitor.js';
import connectionPoolMonitor from '../utils/connectionPoolMonitor.js';
import indexAdvisor from '../utils/indexAdvisor.js';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: process.env.DATABASE_POOL_MIN ? parseInt(process.env.DATABASE_POOL_MIN) : 2,
  max: process.env.DATABASE_POOL_MAX ? parseInt(process.env.DATABASE_POOL_MAX) : 10,
  // Query timeout (prevent long-running queries from blocking)
  query_timeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '30000', 10), // 30 seconds default
  // Connection timeout
  connectionTimeoutMillis: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000', 10), // 10 seconds
  // Idle timeout (close idle connections after this time)
  idleTimeoutMillis: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000', 10), // 30 seconds
});

// Add query performance monitoring
let monitoredPool = addQueryMonitoring(pool);

// Add connection pool monitoring
connectionPoolMonitor.monitorPool(pool);

// Wrap query to include index advisor analysis
const originalQuery = monitoredPool.query.bind(monitoredPool);
monitoredPool.query = async function(sql, params) {
  const startTime = Date.now();
  const result = await originalQuery(sql, params);
  const duration = Date.now() - startTime;
  
  // Analyze for index recommendations
  indexAdvisor.analyzeQuery(sql, duration, params);
  
  return result;
};

export default monitoredPool;
