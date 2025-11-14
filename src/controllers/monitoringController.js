// src/controllers/monitoringController.js
/**
 * Resource Monitoring & Alerts Controller
 * Handles system resource monitoring, metrics, and alert management
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Get current resource metrics
 */
export const getMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_type, resource_id } = req.query;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type and resource_id are required' });
    }

    // Verify ownership
    const hasAccess = await verifyResourceAccess(userId, resource_type, resource_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Collect metrics based on resource type
    let metrics;
    switch (resource_type) {
      case 'server':
        metrics = await getServerMetrics();
        break;
      case 'website':
        metrics = await getWebsiteMetrics(resource_id);
        break;
      case 'database':
        metrics = await getDatabaseMetrics(resource_id);
        break;
      default:
        return res.status(400).json({ error: 'Invalid resource type' });
    }

    res.json({ metrics });
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

/**
 * Get historical metrics
 */
/**
 * Get metrics history
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_type, resource_id, period = '24h' } = req.query;

    if (!resource_type || !resource_id) {
      return res.status(400).json({ error: 'resource_type and resource_id are required' });
    }

    // Verify ownership
    const hasAccess = await verifyResourceAccess(userId, resource_type, resource_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate time range
    const intervals = {
      '1h': 60,
      '6h': 360,
      '24h': 1440,
      '7d': 10080,
      '30d': 43200,
    };

    const minutes = intervals[period] || 1440;
    const since = new Date(Date.now() - minutes * 60 * 1000);

    const result = await pool.query(
      `SELECT * FROM resource_metrics 
       WHERE resource_type = $1 AND resource_id = $2 AND timestamp >= $3
       ORDER BY timestamp ASC`,
      [resource_type, resource_id, since]
    );

    res.json({ metrics: result.rows });
  } catch (error) {
    logger.error('Error fetching metric history:', error);
    res.status(500).json({ error: 'Failed to fetch metric history' });
  }
};

/**
 * Get server metrics
 */
async function getServerMetrics() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;

  // Get disk usage
  let diskUsage = 0;
  try {
    const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5}' | sed 's/%//'");
    diskUsage = parseFloat(stdout.trim());
  } catch (error) {
    logger.error('Error getting disk usage:', error);
  }

  // Get network stats
  let networkRx = 0;
  let networkTx = 0;
  try {
    const { stdout } = await execAsync("cat /proc/net/dev | grep eth0 | awk '{print $2, $10}'");
    const [rx, tx] = stdout.trim().split(' ').map(Number);
    networkRx = rx;
    networkTx = tx;
  } catch (error) {
    // Ignore network stats errors (may not be on Linux)
  }

  return {
    cpu: cpuUsage.toFixed(2),
    memory: memoryUsage.toFixed(2),
    disk: diskUsage.toFixed(2),
    network: {
      rx: networkRx,
      tx: networkTx,
    },
    uptime: os.uptime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get website metrics
 */
async function getWebsiteMetrics(websiteId) {
  const website = await pool.query(`SELECT * FROM websites WHERE id = $1`, [websiteId]);
  if (website.rows.length === 0) throw new Error('Website not found');

  const sitePath = website.rows[0].path || `/var/www/${website.rows[0].domain}`;

  // Get disk usage for website
  let diskUsage = 0;
  try {
    const { stdout } = await execAsync(`du -sb ${sitePath} | awk '{print $1}'`);
    diskUsage = parseInt(stdout.trim());
  } catch (error) {
    logger.error('Error getting website disk usage:', error);
  }

  // Get file count
  let fileCount = 0;
  try {
    const { stdout } = await execAsync(`find ${sitePath} -type f | wc -l`);
    fileCount = parseInt(stdout.trim());
  } catch (error) {
    logger.error('Error getting file count:', error);
  }

  // Get request stats from access logs (if nginx/apache)
  let requests = 0;
  try {
    const domain = website.rows[0].domain;
    const { stdout } = await execAsync(
      `grep -c "${domain}" /var/log/nginx/access.log 2>/dev/null || echo 0`
    );
    requests = parseInt(stdout.trim());
  } catch (error) {
    // Ignore if logs not available
  }

  return {
    disk_usage: diskUsage,
    file_count: fileCount,
    requests_24h: requests,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get database metrics
 */
async function getDatabaseMetrics(databaseId) {
  const db = await pool.query(`SELECT * FROM databases WHERE id = $1`, [databaseId]);
  if (db.rows.length === 0) throw new Error('Database not found');

  const dbName = db.rows[0].name;

  // Get database size
  const sizeResult = await pool.query(
    `SELECT pg_database_size($1) as size`,
    [dbName]
  );
  const size = sizeResult.rows[0].size;

  // Get connection count
  const connResult = await pool.query(
    `SELECT count(*) as connections FROM pg_stat_activity WHERE datname = $1`,
    [dbName]
  );
  const connections = connResult.rows[0].connections;

  // Get table count
  const tableResult = await pool.query(
    `SELECT count(*) as tables 
     FROM information_schema.tables 
     WHERE table_catalog = $1 AND table_schema = 'public'`,
    [dbName]
  );
  const tables = tableResult.rows[0].tables;

  return {
    size: parseInt(size),
    connections: parseInt(connections),
    tables: parseInt(tables),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Record metrics
 */
export const recordMetrics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_type, resource_id, metrics } = req.body;

    if (!resource_type || !resource_id || !metrics) {
      return res.status(400).json({ error: 'resource_type, resource_id, and metrics are required' });
    }

    // Verify ownership
    const hasAccess = await verifyResourceAccess(userId, resource_type, resource_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(
      `INSERT INTO resource_metrics (user_id, resource_type, resource_id, metrics)
       VALUES ($1, $2, $3, $4)`,
      [userId, resource_type, resource_id, metrics]
    );

    res.status(201).json({ message: 'Metrics recorded successfully' });
  } catch (error) {
    logger.error('Error recording metrics:', error);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
};

/**
 * Get all alerts
 */
/**
 * Get alerts for user
 */
export const getAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let query = `SELECT * FROM monitoring_alerts WHERE user_id = $1`;
    const params = [userId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json({ alerts: result.rows });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

/**
 * Get alert rules
 */
export const getRules = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM alert_rules WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ rules: result.rows });
  } catch (error) {
    logger.error('Error fetching alert rules:', error);
    res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
};

/**
 * Create alert rule
 */
export const createRule = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      resource_type,
      resource_id,
      metric,
      operator,
      threshold,
      duration,
      notification_channels,
    } = req.body;

    if (!name || !resource_type || !resource_id || !metric || !operator || !threshold) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify ownership
    const hasAccess = await verifyResourceAccess(userId, resource_type, resource_id);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(
      `INSERT INTO alert_rules 
       (user_id, name, resource_type, resource_id, metric, operator, threshold, duration, notification_channels)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        name,
        resource_type,
        resource_id,
        metric,
        operator,
        threshold,
        duration || 300,
        JSON.stringify(notification_channels || ['email']),
      ]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'alert_rule_created', `Created alert rule: ${name}`]
    );

    logger.info(`Alert rule created: ${name}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating alert rule:', error);
    res.status(500).json({ error: 'Failed to create alert rule' });
  }
};

/**
 * Update alert rule
 */
export const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, metric, operator, threshold, duration, enabled, notification_channels } = req.body;

    const result = await pool.query(
      `UPDATE alert_rules 
       SET name = COALESCE($1, name),
           metric = COALESCE($2, metric),
           operator = COALESCE($3, operator),
           threshold = COALESCE($4, threshold),
           duration = COALESCE($5, duration),
           enabled = COALESCE($6, enabled),
           notification_channels = COALESCE($7, notification_channels),
           updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        name,
        metric,
        operator,
        threshold,
        duration,
        enabled,
        notification_channels ? JSON.stringify(notification_channels) : null,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating alert rule:', error);
    res.status(500).json({ error: 'Failed to update alert rule' });
  }
};

/**
 * Delete alert rule
 */
export const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM alert_rules WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert rule not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'alert_rule_deleted', `Deleted alert rule: ${result.rows[0].name}`]
    );

    res.json({ message: 'Alert rule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting alert rule:', error);
    res.status(500).json({ error: 'Failed to delete alert rule' });
  }
};

/**
 * Acknowledge alert
 */
export const acknowledgeAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE monitoring_alerts 
       SET status = 'acknowledged', acknowledged_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error acknowledging alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
};

/**
 * Resolve alert
 */
export const resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE monitoring_alerts 
       SET status = 'resolved', resolved_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
};

/**
 * Get dashboard stats
 */
/**
 * Get monitoring statistics
 */
export const getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current server metrics
    const serverMetrics = await getServerMetrics();

    // Get alert counts
    const alertCounts = await pool.query(
      `SELECT status, COUNT(*) as count 
       FROM monitoring_alerts 
       WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '24 hours'
       GROUP BY status`,
      [userId]
    );

    // Get active alert rules count
    const rulesCount = await pool.query(
      `SELECT COUNT(*) as count FROM alert_rules WHERE user_id = $1 AND enabled = true`,
      [userId]
    );

    res.json({
      server: serverMetrics,
      alerts: alertCounts.rows.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, { active: 0, acknowledged: 0, resolved: 0 }),
      active_rules: parseInt(rulesCount.rows[0].count),
    });
  } catch (error) {
    logger.error('Error fetching monitoring stats:', error);
    res.status(500).json({ error: 'Failed to fetch monitoring stats' });
  }
};

/**
 * Verify resource access
 */
async function verifyResourceAccess(userId, resourceType, resourceId) {
  if (resourceType === 'server') {
    // Server metrics available to all users
    return true;
  }

  let table;
  switch (resourceType) {
    case 'website':
      table = 'websites';
      break;
    case 'database':
      table = 'databases';
      break;
    case 'email':
      table = 'email_accounts';
      break;
    default:
      return false;
  }

  const result = await pool.query(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [resourceId, userId]
  );

  return result.rows.length > 0;
}
