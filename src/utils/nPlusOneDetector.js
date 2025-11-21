/**
 * N+1 Query Detector - Detects and prevents N+1 query patterns
 * 
 * Features:
 * - Detects repeated similar queries (N+1 pattern)
 * - Warns developers in development mode
 * - Tracks query patterns per request
 * - Suggests batch loading solutions
 * - DataLoader integration support
 */

import logger from '../config/logger.js';
import crypto from 'crypto';

class NPlusOneDetector {
  constructor() {
    this.enabled = process.env.NODE_ENV === 'development' || process.env.DETECT_N_PLUS_ONE === 'true';
    
    // Track queries per request
    this.requestQueries = new Map(); // requestId -> array of queries
    
    // Threshold for N+1 detection
    this.SIMILARITY_THRESHOLD = 0.8;  // 80% similarity
    this.MIN_REPEATED_QUERIES = 3;    // Minimum 3 repeated queries to trigger warning
    
    // Cleanup old requests every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Track a query for N+1 detection
   */
  trackQuery(requestId, sql, params, duration) {
    if (!this.enabled) return;

    const querySignature = this.normalizeQuery(sql);
    const queryInfo = {
      signature: querySignature,
      sql,
      params,
      duration,
      timestamp: Date.now()
    };

    if (!this.requestQueries.has(requestId)) {
      this.requestQueries.set(requestId, []);
    }

    this.requestQueries.get(requestId).push(queryInfo);
  }

  /**
   * Analyze queries for N+1 patterns at end of request
   */
  analyzeRequest(requestId) {
    if (!this.enabled) return null;

    const queries = this.requestQueries.get(requestId);
    if (!queries || queries.length < this.MIN_REPEATED_QUERIES) {
      return null;
    }

    // Group queries by signature
    const queryGroups = new Map();
    
    for (const query of queries) {
      if (!queryGroups.has(query.signature)) {
        queryGroups.set(query.signature, []);
      }
      queryGroups.get(query.signature).push(query);
    }

    // Check for N+1 patterns
    const nPlusOnePatterns = [];
    
    for (const [signature, groupQueries] of queryGroups) {
      if (groupQueries.length >= this.MIN_REPEATED_QUERIES) {
        // This is a potential N+1 pattern
        const totalDuration = groupQueries.reduce((sum, q) => sum + q.duration, 0);
        
        nPlusOnePatterns.push({
          signature,
          count: groupQueries.length,
          totalDuration,
          averageDuration: totalDuration / groupQueries.length,
          examples: groupQueries.slice(0, 3),
          recommendation: this.getRecommendation(signature, groupQueries)
        });
      }
    }

    // Log warnings for N+1 patterns
    if (nPlusOnePatterns.length > 0) {
      logger.warn('⚠️  N+1 Query Pattern Detected', {
        requestId,
        totalQueries: queries.length,
        patterns: nPlusOnePatterns.map(p => ({
          query: p.signature,
          repetitions: p.count,
          totalTime: `${p.totalDuration}ms`,
          averageTime: `${p.averageDuration.toFixed(2)}ms`,
          recommendation: p.recommendation
        }))
      });

      return {
        detected: true,
        patterns: nPlusOnePatterns,
        totalQueries: queries.length,
        potentialSavings: this.calculatePotentialSavings(nPlusOnePatterns)
      };
    }

    return null;
  }

  /**
   * Normalize SQL query to detect similar patterns
   */
  normalizeQuery(sql) {
    return sql
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .replace(/\$\d+/g, '$?')           // Replace parameter placeholders
      .replace(/IN \([^)]+\)/gi, 'IN (?)')  // Normalize IN clauses
      .replace(/= '[^']*'/g, "= '?'")    // Normalize string literals
      .replace(/= \d+/g, '= ?')          // Normalize numeric literals
      .trim()
      .toUpperCase();
  }

  /**
   * Get recommendation for fixing N+1 pattern
   */
  getRecommendation(signature, queries) {
    // Extract table name from query
    const tableMatch = signature.match(/FROM\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : 'unknown';

    // Detect if it's a WHERE IN pattern that could be batched
    if (signature.includes('WHERE') && signature.includes('=')) {
      return {
        type: 'batch_query',
        message: `Batch load ${table} records using WHERE IN instead of individual queries`,
        solution: `Use DataLoader or batch the IDs: SELECT * FROM ${table} WHERE id = ANY($1)`,
        estimatedImprovement: `Reduce ${queries.length} queries to 1 query`
      };
    }

    // Detect if it's a JOIN that's missing
    if (signature.includes('SELECT') && !signature.includes('JOIN')) {
      return {
        type: 'use_join',
        message: `Use JOIN to fetch related ${table} data in single query`,
        solution: `Add appropriate JOIN clause to parent query`,
        estimatedImprovement: `Reduce ${queries.length} queries to 1 query with JOIN`
      };
    }

    return {
      type: 'optimize',
      message: `Optimize repeated queries to ${table}`,
      solution: 'Consider caching, batching, or eager loading',
      estimatedImprovement: `Potential ${queries.length}x reduction in database calls`
    };
  }

  /**
   * Calculate potential performance savings
   */
  calculatePotentialSavings(patterns) {
    const totalQueries = patterns.reduce((sum, p) => sum + p.count, 0);
    const totalDuration = patterns.reduce((sum, p) => sum + p.totalDuration, 0);
    const optimizedQueries = patterns.length; // Each pattern becomes 1 batch query
    const estimatedSavings = ((totalQueries - optimizedQueries) / totalQueries * 100).toFixed(1);

    return {
      currentQueries: totalQueries,
      optimizedQueries,
      queriesReduced: totalQueries - optimizedQueries,
      percentageReduction: `${estimatedSavings}%`,
      totalDuration: `${totalDuration}ms`,
      estimatedNewDuration: `~${(totalDuration / totalQueries * optimizedQueries).toFixed(2)}ms`
    };
  }

  /**
   * Clear tracking for a request
   */
  clearRequest(requestId) {
    this.requestQueries.delete(requestId);
  }

  /**
   * Cleanup old request data (requests older than 10 minutes)
   */
  cleanup() {
    const cutoff = Date.now() - 600000; // 10 minutes ago
    
    for (const [requestId, queries] of this.requestQueries) {
      if (queries.length > 0 && queries[0].timestamp < cutoff) {
        this.requestQueries.delete(requestId);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      activeRequests: this.requestQueries.size,
      config: {
        similarityThreshold: this.SIMILARITY_THRESHOLD,
        minRepeatedQueries: this.MIN_REPEATED_QUERIES
      }
    };
  }
}

// Singleton instance
const detector = new NPlusOneDetector();

/**
 * Middleware to detect N+1 queries per request
 */
export function nPlusOneDetectionMiddleware(req, res, next) {
  if (!detector.enabled) {
    return next();
  }

  // Analyze queries when response finishes
  res.on('finish', () => {
    const analysis = detector.analyzeRequest(req.id);
    
    if (analysis && analysis.detected) {
      // Add custom header in development
      res.setHeader('X-N-Plus-One-Detected', 'true');
      res.setHeader('X-N-Plus-One-Patterns', analysis.patterns.length.toString());
    }
    
    // Cleanup
    detector.clearRequest(req.id);
  });

  next();
}

/**
 * Track a query for N+1 detection
 */
export function trackQueryForNPlusOne(requestId, sql, params, duration) {
  detector.trackQuery(requestId, sql, params, duration);
}

export default detector;
