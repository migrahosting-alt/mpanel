// src/controllers/dashboardController.js
import pool from '../db/index.js';
import logger from '../config/logger.js';

/**
 * Get dashboard overview stats
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const tenantId = req.user.tenantId || req.user.tenant_id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

    // Get basic counts
    const stats = {
      domains: 0,
      websites: 0,
      databases: 0,
      mailboxes: 0,
      customers: 0,
      servers: 0
    };

    try {
      const domainsResult = await pool.query(
        'SELECT COUNT(*) as count FROM domains WHERE tenant_id = $1',
        [tenantId]
      );
      stats.domains = parseInt(domainsResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting domains:', err);
    }

    try {
      const websitesResult = await pool.query(
        'SELECT COUNT(*) as count FROM websites WHERE tenant_id = $1',
        [tenantId]
      );
      stats.websites = parseInt(websitesResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting websites:', err);
    }

    try {
      const databasesResult = await pool.query(
        'SELECT COUNT(*) as count FROM databases WHERE tenant_id = $1',
        [tenantId]
      );
      stats.databases = parseInt(databasesResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting databases:', err);
    }

    try {
      const mailboxesResult = await pool.query(
        'SELECT COUNT(*) as count FROM mailboxes WHERE tenant_id = $1',
        [tenantId]
      );
      stats.mailboxes = parseInt(mailboxesResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting mailboxes:', err);
    }

    try {
      const customersResult = await pool.query(
        'SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1',
        [tenantId]
      );
      stats.customers = parseInt(customersResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting customers:', err);
    }

    try {
      const serversResult = await pool.query(
        'SELECT COUNT(*) as count FROM servers WHERE tenant_id = $1',
        [tenantId]
      );
      stats.servers = parseInt(serversResult.rows[0]?.count) || 0;
    } catch (err) {
      logger.error('Error counting servers:', err);
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to fetch dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

/**
 * Get service health/status overview
 * GET /api/dashboard/service-health
 */
export const getServiceHealth = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT 
          type,
          status,
          COUNT(*) as count
         FROM services
         GROUP BY type, status
         ORDER BY type, status`
      : `SELECT 
          type,
          status,
          COUNT(*) as count
         FROM services
         WHERE user_id = $1
         GROUP BY type, status
         ORDER BY type, status`;

    const params = isAdmin ? [] : [userId];
    const result = await pool.query(query, params);

    // Organize by service type
    const health = {
      domains: { active: 0, inactive: 0, suspended: 0 },
      hosting: { active: 0, inactive: 0, suspended: 0 },
      databases: { active: 0, inactive: 0, suspended: 0 },
      email: { active: 0, inactive: 0, suspended: 0 }
    };

    result.rows.forEach(row => {
      const type = row.type === 'email' ? 'email' : row.type;
      if (health[type]) {
        const status = row.status || 'active';
        health[type][status] = parseInt(row.count) || 0;
      }
    });

    res.json(health);
  } catch (error) {
    logger.error('Failed to fetch service health:', error);
    res.status(500).json({ error: 'Failed to fetch service health' });
  }
};

/**
 * Get upcoming renewals
 * GET /api/dashboard/renewals
 */
export const getUpcomingRenewals = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT 
          s.id,
          s.type,
          s.name,
          s.renewal_date,
          s.price,
          u.email as customer_email
         FROM services s
         LEFT JOIN users u ON s.user_id = u.id
         WHERE s.renewal_date IS NOT NULL 
           AND s.renewal_date >= NOW()
           AND s.renewal_date <= NOW() + INTERVAL '30 days'
           AND s.status = 'active'
         ORDER BY s.renewal_date ASC
         LIMIT 10`
      : `SELECT 
          id,
          type,
          name,
          renewal_date,
          price
         FROM services
         WHERE user_id = $1
           AND renewal_date IS NOT NULL
           AND renewal_date >= NOW()
           AND renewal_date <= NOW() + INTERVAL '30 days'
           AND status = 'active'
         ORDER BY renewal_date ASC
         LIMIT 10`;

    const params = isAdmin ? [] : [userId];
    const result = await pool.query(query, params);

    res.json({ renewals: result.rows });
  } catch (error) {
    logger.error('Failed to fetch upcoming renewals:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming renewals' });
  }
};

/**
 * Get quick actions available to user
 * GET /api/dashboard/quick-actions
 */
export const getQuickActions = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';

    const actions = isAdmin
      ? [
          { id: 'create-user', label: 'Create User', icon: 'UserPlusIcon', path: '/users' },
          { id: 'view-invoices', label: 'View Invoices', icon: 'DocumentTextIcon', path: '/invoices' },
          { id: 'manage-services', label: 'Manage Services', icon: 'ServerIcon', path: '/services' },
          { id: 'system-metrics', label: 'System Metrics', icon: 'ChartBarIcon', path: '/metrics' }
        ]
      : [
          { id: 'add-domain', label: 'Add Domain', icon: 'GlobeAltIcon', path: '/domains' },
          { id: 'create-database', label: 'Create Database', icon: 'CircleStackIcon', path: '/databases' },
          { id: 'view-invoices', label: 'View Invoices', icon: 'DocumentTextIcon', path: '/invoices' },
          { id: 'manage-subscription', label: 'Manage Subscription', icon: 'CreditCardIcon', path: '/subscriptions' }
        ];

    res.json({ actions });
  } catch (error) {
    logger.error('Failed to fetch quick actions:', error);
    res.status(500).json({ error: 'Failed to fetch quick actions' });
  }
};
