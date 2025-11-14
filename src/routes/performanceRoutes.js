const express = require('express');
const router = express.Router();
const performanceService = require('../services/performanceService');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * Performance Optimization Suite Routes
 * 
 * Endpoints for caching, query optimization, Web Vitals, CDN management
 */

// Middleware - all routes require authentication
router.use(authenticate);

/**
 * @route   DELETE /api/performance/cache
 * @desc    Invalidate cache
 * @access  Private
 */
router.delete('/cache', async (req, res) => {
  try {
    const { keys } = req.body;

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({ error: 'Keys array required' });
    }

    await performanceService.cacheInvalidate(keys);
    res.json({ success: true, invalidated: keys.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/performance/cache/warm
 * @desc    Warm cache with specific keys
 * @access  Admin only
 */
router.post('/cache/warm', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { keys } = req.body;

    if (!keys || !Array.isArray(keys)) {
      return res.status(400).json({ error: 'Keys array required' });
    }

    const result = await performanceService.warmCache(tenantId, keys);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/queries/analyze
 * @desc    Analyze slow queries
 * @access  Admin only
 */
router.get('/queries/analyze', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { threshold = 1000 } = req.query;

    const analysis = await performanceService.analyzeSlowQueries(tenantId, parseInt(threshold));
    res.json(analysis);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/connection-pool
 * @desc    Analyze database connection pool
 * @access  Admin only
 */
router.get('/connection-pool', requireRole('admin'), async (req, res) => {
  try {
    const stats = await performanceService.analyzeConnectionPool();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/performance/web-vitals
 * @desc    Record Web Vital metric
 * @access  Public (tracking endpoint)
 */
router.post('/web-vitals', async (req, res) => {
  try {
    const { tenantId, websiteId, metricName, value, url } = req.body;

    if (!metricName || !value) {
      return res.status(400).json({ error: 'metricName and value required' });
    }

    const metricData = {
      tenantId,
      websiteId,
      metricName,
      value,
      url,
      userAgent: req.headers['user-agent'],
      connectionType: req.headers['connection-type'] || 'unknown'
    };

    const metric = await performanceService.recordWebVital(metricData);
    res.status(201).json(metric);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/web-vitals/summary
 * @desc    Get Web Vitals summary
 * @access  Private
 */
router.get('/web-vitals/summary', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { websiteId, startDate, endDate } = req.query;

    if (!websiteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'websiteId, startDate, and endDate required' });
    }

    const summary = await performanceService.getWebVitalsSummary(
      tenantId,
      parseInt(websiteId),
      new Date(startDate),
      new Date(endDate)
    );

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/performance/cdn/purge
 * @desc    Purge CDN cache
 * @access  Private
 */
router.post('/cdn/purge', async (req, res) => {
  try {
    const { websiteId, urls, provider } = req.body;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId required' });
    }

    const result = await performanceService.purgeCDNCache(
      websiteId,
      urls || [],
      provider || 'cloudflare'
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/cdn/purge-logs
 * @desc    Get CDN purge logs
 * @access  Private
 */
router.get('/cdn/purge-logs', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { websiteId, limit = 50 } = req.query;

    const pool = require('../config/database');
    
    let query = `
      SELECT cpl.*, w.domain
      FROM cdn_purge_logs cpl
      JOIN websites w ON cpl.website_id = w.id
      WHERE w.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 1;

    if (websiteId) {
      query += ` AND cpl.website_id = $${++paramCount}`;
      params.push(websiteId);
    }

    query += ` ORDER BY cpl.created_at DESC LIMIT $${++paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/assets/analyze
 * @desc    Analyze assets for optimization opportunities
 * @access  Private
 */
router.get('/assets/analyze', async (req, res) => {
  try {
    const { websiteId } = req.query;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId required' });
    }

    const recommendations = await performanceService.analyzeAssets(parseInt(websiteId));
    res.json(recommendations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/score
 * @desc    Calculate performance score
 * @access  Private
 */
router.get('/score', async (req, res) => {
  try {
    const { websiteId } = req.query;

    if (!websiteId) {
      return res.status(400).json({ error: 'websiteId required' });
    }

    const score = await performanceService.calculatePerformanceScore(parseInt(websiteId));
    res.json(score);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/budget-violations
 * @desc    Get performance budget violations
 * @access  Private
 */
router.get('/budget-violations', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { websiteId, startDate, endDate, limit = 100 } = req.query;

    const pool = require('../config/database');
    
    let query = `
      SELECT pbv.*, w.domain
      FROM performance_budget_violations pbv
      JOIN websites w ON pbv.website_id = w.id
      WHERE w.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 1;

    if (websiteId) {
      query += ` AND pbv.website_id = $${++paramCount}`;
      params.push(websiteId);
    }

    if (startDate && endDate) {
      query += ` AND pbv.created_at BETWEEN $${++paramCount} AND $${++paramCount}`;
      params.push(new Date(startDate), new Date(endDate));
      paramCount++;
    }

    query += ` ORDER BY pbv.created_at DESC LIMIT $${++paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/performance/reports
 * @desc    Get comprehensive performance report
 * @access  Private
 */
router.get('/reports', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { websiteId, startDate, endDate } = req.query;

    if (!websiteId || !startDate || !endDate) {
      return res.status(400).json({ error: 'websiteId, startDate, and endDate required' });
    }

    // Compile comprehensive report
    const [webVitals, score, queryAnalysis, connectionPool] = await Promise.all([
      performanceService.getWebVitalsSummary(
        tenantId,
        parseInt(websiteId),
        new Date(startDate),
        new Date(endDate)
      ),
      performanceService.calculatePerformanceScore(parseInt(websiteId)),
      performanceService.analyzeSlowQueries(tenantId, 1000),
      performanceService.analyzeConnectionPool()
    ]);

    const report = {
      period: { start: startDate, end: endDate },
      webVitals,
      performanceScore: score,
      slowQueries: queryAnalysis.slice(0, 10), // Top 10
      connectionPool,
      generatedAt: new Date()
    };

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
