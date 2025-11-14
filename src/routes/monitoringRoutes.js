const express = require('express');
const router = express.Router();
const monitoringService = require('../services/monitoringService');
const auth = require('../middleware/auth');

/**
 * Advanced Monitoring & Observability Routes
 */

// Track API request (usually called by middleware)
router.post('/requests', auth, async (req, res) => {
  try {
    const request = await monitoringService.trackRequest({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(request);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get APM dashboard
router.get('/apm/dashboard', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dashboard = await monitoringService.getAPMDashboard(
      req.user.tenantId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      }
    );

    res.json(dashboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Track infrastructure metrics
router.post('/infrastructure/metrics', auth, async (req, res) => {
  try {
    const metrics = await monitoringService.trackInfrastructureMetrics({
      ...req.body,
      tenantId: req.user.tenantId
    });

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get infrastructure metrics
router.get('/infrastructure/metrics', auth, async (req, res) => {
  try {
    const { serverId, startDate, endDate } = req.query;
    
    let query = `
      SELECT * FROM infrastructure_metrics
      WHERE tenant_id = $1
    `;
    const params = [req.user.tenantId];

    if (serverId) {
      params.push(serverId);
      query += ` AND server_id = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND recorded_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND recorded_at <= $${params.length}`;
    }

    query += ' ORDER BY recorded_at DESC LIMIT 1000';

    const result = await require('../config/database').query(query, params);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active alerts
router.get('/alerts', auth, async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    
    const result = await require('../config/database').query(
      `SELECT * FROM monitoring_alerts
       WHERE tenant_id = $1 AND status = ANY($2)
       ORDER BY created_at DESC
       LIMIT 100`,
      [req.user.tenantId, Array.isArray(status) ? status : [status]]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.post('/alerts/:id/acknowledge', auth, async (req, res) => {
  try {
    const result = await monitoringService.acknowledgeAlert(
      parseInt(req.params.id),
      req.user.id
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve alert
router.post('/alerts/:id/resolve', auth, async (req, res) => {
  try {
    const { resolution } = req.body;
    const result = await monitoringService.resolveAlert(
      parseInt(req.params.id),
      req.user.id,
      resolution
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get anomalies
router.get('/anomalies', auth, async (req, res) => {
  try {
    const { status = 'open' } = req.query;
    
    const result = await require('../config/database').query(
      `SELECT * FROM monitoring_anomalies
       WHERE tenant_id = $1 AND status = $2
       ORDER BY detected_at DESC
       LIMIT 100`,
      [req.user.tenantId, status]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get distributed trace
router.get('/traces/:traceId', auth, async (req, res) => {
  try {
    const trace = await monitoringService.getTrace(req.params.traceId);
    
    if (!trace) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aggregate log entry
router.post('/logs', auth, async (req, res) => {
  try {
    await monitoringService.aggregateLog(req.user.tenantId, req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search logs
router.get('/logs', auth, async (req, res) => {
  try {
    const { level, source, startDate, endDate, limit = 100 } = req.query;
    
    let query = `
      SELECT * FROM log_aggregation
      WHERE tenant_id = $1
    `;
    const params = [req.user.tenantId];

    if (level) {
      params.push(level);
      query += ` AND level = $${params.length}`;
    }

    if (source) {
      params.push(source);
      query += ` AND source = $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND created_at >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND created_at <= $${params.length}`;
    }

    params.push(parseInt(limit));
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    const result = await require('../config/database').query(query, params);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get metrics summary
router.get('/metrics/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const result = await require('../config/database').query(
      `SELECT 
        COUNT(DISTINCT path) as unique_endpoints,
        SUM(request_count) as total_requests,
        SUM(error_count) as total_errors,
        AVG(avg_response_time) as avg_response_time,
        MAX(max_response_time) as max_response_time
       FROM apm_metrics
       WHERE tenant_id = $1
         AND time_bucket >= $2
         AND time_bucket <= $3`,
      [
        req.user.tenantId,
        startDate || new Date(Date.now() - 24 * 60 * 60 * 1000),
        endDate || new Date()
      ]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
