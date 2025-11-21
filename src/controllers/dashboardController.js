// src/controllers/dashboardController.js
import pool from '../db/index.js';
import logger from '../config/logger.js';

/**
 * Get dashboard overview stats
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get service counts
    const servicesQuery = isAdmin
      ? `SELECT 
          COUNT(*) FILTER (WHERE type = 'domain') as domains,
          COUNT(*) FILTER (WHERE type = 'hosting') as hosting,
          COUNT(*) FILTER (WHERE type = 'database') as databases,
          COUNT(*) FILTER (WHERE type = 'email') as email_accounts
         FROM services`
      : `SELECT 
          COUNT(*) FILTER (WHERE type = 'domain') as domains,
          COUNT(*) FILTER (WHERE type = 'hosting') as hosting,
          COUNT(*) FILTER (WHERE type = 'database') as databases,
          COUNT(*) FILTER (WHERE type = 'email') as email_accounts
         FROM services WHERE user_id = $1`;

    const servicesParams = isAdmin ? [] : [userId];
    const servicesResult = await pool.query(servicesQuery, servicesParams);
    const services = servicesResult.rows[0] || {
      domains: 0,
      hosting: 0,
      databases: 0,
      email_accounts: 0
    };

    // Get subscription info
    const subscriptionQuery = isAdmin
      ? `SELECT COUNT(*) as total, 
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'canceled') as canceled
         FROM subscriptions`
      : `SELECT COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'canceled') as canceled
         FROM subscriptions WHERE user_id = $1`;

    const subscriptionParams = isAdmin ? [] : [userId];
    const subscriptionResult = await pool.query(subscriptionQuery, subscriptionParams);
    const subscriptions = subscriptionResult.rows[0] || { total: 0, active: 0, canceled: 0 };

    // Get billing summary
    const billingQuery = isAdmin
      ? `SELECT 
          COUNT(*) as total_invoices,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
          COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_invoices,
          COALESCE(SUM(total) FILTER (WHERE status = 'unpaid'), 0) as amount_due,
          COALESCE(SUM(total) FILTER (WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'), 0) as paid_last_30_days
         FROM invoices`
      : `SELECT 
          COUNT(*) as total_invoices,
          COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
          COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid_invoices,
          COALESCE(SUM(total) FILTER (WHERE status = 'unpaid'), 0) as amount_due,
          COALESCE(SUM(total) FILTER (WHERE status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'), 0) as paid_last_30_days
         FROM invoices WHERE user_id = $1`;

    const billingParams = isAdmin ? [] : [userId];
    const billingResult = await pool.query(billingQuery, billingParams);
    const billing = billingResult.rows[0] || {
      total_invoices: 0,
      paid_invoices: 0,
      unpaid_invoices: 0,
      amount_due: 0,
      paid_last_30_days: 0
    };

    // Get recent activity (last 10 items)
    const activityQuery = isAdmin
      ? `SELECT type, description, created_at, user_id 
         FROM activity_logs 
         ORDER BY created_at DESC 
         LIMIT 10`
      : `SELECT type, description, created_at 
         FROM activity_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`;

    const activityParams = isAdmin ? [] : [userId];
    const activityResult = await pool.query(activityQuery, activityParams);
    const recentActivity = activityResult.rows || [];

    res.json({
      services: {
        domains: parseInt(services.domains) || 0,
        hosting: parseInt(services.hosting) || 0,
        databases: parseInt(services.databases) || 0,
        email_accounts: parseInt(services.email_accounts) || 0,
        total: (parseInt(services.domains) || 0) + 
               (parseInt(services.hosting) || 0) + 
               (parseInt(services.databases) || 0) + 
               (parseInt(services.email_accounts) || 0)
      },
      subscriptions: {
        total: parseInt(subscriptions.total) || 0,
        active: parseInt(subscriptions.active) || 0,
        canceled: parseInt(subscriptions.canceled) || 0
      },
      billing: {
        totalInvoices: parseInt(billing.total_invoices) || 0,
        paidInvoices: parseInt(billing.paid_invoices) || 0,
        unpaidInvoices: parseInt(billing.unpaid_invoices) || 0,
        amountDue: parseFloat(billing.amount_due) || 0,
        paidLast30Days: parseFloat(billing.paid_last_30_days) || 0
      },
      recentActivity
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
