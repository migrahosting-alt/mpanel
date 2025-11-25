// src/services/queryOptimizer.js
/**
 * Database query optimization utilities
 * Provides connection pooling, query caching, and performance monitoring
 */

import pool from '../db/index.js';
import { cache, CacheNamespace, CacheTTL } from './cache.js';
import logger from '../config/logger.js';

/**
 * Execute query with caching
 */
export async function cachedQuery(sql, params = [], options = {}) {
  const {
    cacheKey,
    namespace = CacheNamespace.STATS,
    ttl = CacheTTL.MEDIUM,
    skipCache = false,
  } = options;

  if (skipCache || !cacheKey) {
    const start = Date.now();
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query (${duration}ms):`, sql.substring(0, 100));
    }
    
    return result;
  }

  // Try cache first
  const cached = await cache.get(namespace, cacheKey);
  if (cached) {
    return { rows: cached, fromCache: true };
  }

  // Execute query
  const start = Date.now();
  const result = await pool.query(sql, params);
  const duration = Date.now() - start;

  if (duration > 1000) {
    logger.warn(`Slow query (${duration}ms):`, sql.substring(0, 100));
  }

  // Cache result
  await cache.set(namespace, cacheKey, result.rows, ttl);

  return result;
}

/**
 * Batch query executor (reduces roundtrips)
 */
export async function batchQuery(queries) {
  const client = await pool.connect();
  
  try {
    const results = [];
    
    for (const { sql, params } of queries) {
      const result = await client.query(sql, params);
      results.push(result);
    }
    
    return results;
  } finally {
    client.release();
  }
}

/**
 * Transaction helper with automatic rollback on error
 */
export async function transaction(callback) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Paginated query helper
 */
export async function paginatedQuery(sql, params = [], options = {}) {
  const {
    page = 1,
    limit = 20,
    orderBy = 'created_at DESC',
  } = options;

  const offset = (page - 1) * limit;

  // Add pagination to query
  const paginatedSql = `
    ${sql}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const paginatedParams = [...params, limit, offset];

  // Execute query and count in parallel
  const [dataResult, countResult] = await Promise.all([
    pool.query(paginatedSql, paginatedParams),
    pool.query(`SELECT COUNT(*) FROM (${sql}) as count_query`, params),
  ]);

  const total = parseInt(countResult.rows[0].count);
  const totalPages = Math.ceil(total / limit);

  return {
    data: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Bulk insert helper (optimized for large datasets)
 */
export async function bulkInsert(table, columns, rows) {
  if (rows.length === 0) return { rowCount: 0 };

  const placeholders = rows
    .map((_, rowIndex) =>
      `(${columns.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      ).join(', ')})`
    )
    .join(', ');

  const values = rows.flat();

  const sql = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES ${placeholders}
    RETURNING id
  `;

  return pool.query(sql, values);
}

/**
 * Bulk update helper
 */
export async function bulkUpdate(table, updates, idColumn = 'id') {
  if (updates.length === 0) return { rowCount: 0 };

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let totalUpdated = 0;
    
    for (const update of updates) {
      const { id, ...fields } = update;
      const setClause = Object.keys(fields)
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');
      
      const values = [...Object.values(fields), id];
      
      const result = await client.query(
        `UPDATE ${table} SET ${setClause} WHERE ${idColumn} = $${values.length}`,
        values
      );
      
      totalUpdated += result.rowCount;
    }
    
    await client.query('COMMIT');
    return { rowCount: totalUpdated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Query performance monitoring
 */
export async function analyzeQuery(sql, params = []) {
  const explainResult = await pool.query(`EXPLAIN ANALYZE ${sql}`, params);
  
  logger.info('Query Analysis:', {
    sql: sql.substring(0, 100),
    plan: explainResult.rows,
  });
  
  return explainResult.rows;
}

/**
 * Database statistics
 */
export async function getDbStats() {
  const stats = await cachedQuery(
    `
    SELECT 
      schemaname,
      tablename,
      n_tup_ins as inserts,
      n_tup_upd as updates,
      n_tup_del as deletes,
      n_live_tup as live_rows,
      n_dead_tup as dead_rows,
      last_vacuum,
      last_autovacuum,
      last_analyze,
      last_autoanalyze
    FROM pg_stat_user_tables
    ORDER BY n_live_tup DESC
    `,
    [],
    {
      cacheKey: 'db_stats',
      namespace: CacheNamespace.STATS,
      ttl: CacheTTL.SHORT,
    }
  );

  return stats.rows;
}

/**
 * Index usage statistics
 */
export async function getIndexStats() {
  const stats = await cachedQuery(
    `
    SELECT
      schemaname,
      tablename,
      indexname,
      idx_scan as scans,
      idx_tup_read as tuples_read,
      idx_tup_fetch as tuples_fetched
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    `,
    [],
    {
      cacheKey: 'index_stats',
      namespace: CacheNamespace.STATS,
      ttl: CacheTTL.SHORT,
    }
  );

  return stats.rows;
}

/**
 * Connection pool statistics
 */
export function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export default {
  cachedQuery,
  batchQuery,
  transaction,
  paginatedQuery,
  bulkInsert,
  bulkUpdate,
  analyzeQuery,
  getDbStats,
  getIndexStats,
  getPoolStats,
};
