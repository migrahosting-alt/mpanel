/**
 * Advanced Analytics Service
 * ML-based revenue forecasting, churn prediction, customer analytics
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import aiService from './aiService.js';

class AdvancedAnalyticsService {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(tenantId, period = '30d') {
    try {
      const days = this.parsePeriod(period);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [revenue, customers, subscriptions, churn] = await Promise.all([
        this.getRevenueMetrics(tenantId, since),
        this.getCustomerMetrics(tenantId, since),
        this.getSubscriptionMetrics(tenantId, since),
        this.getChurnMetrics(tenantId, since)
      ]);

      return {
        period,
        revenue,
        customers,
        subscriptions,
        churn,
        generated_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Revenue metrics
   */
  async getRevenueMetrics(tenantId, since) {
    const result = await pool.query(
      `SELECT 
       SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as total_revenue,
       SUM(CASE WHEN status = 'paid' AND created_at >= $2 THEN total ELSE 0 END) as period_revenue,
       COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_invoices,
       COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_invoices,
       AVG(CASE WHEN status = 'paid' THEN total END) as avg_invoice_value,
       SUM(CASE WHEN status = 'paid' AND payment_method = 'card' THEN total ELSE 0 END) as card_revenue,
       SUM(CASE WHEN status = 'paid' AND payment_method = 'bank_transfer' THEN total ELSE 0 END) as bank_revenue
       FROM invoices
       WHERE tenant_id = $1`,
      [tenantId, since]
    );

    // Calculate MRR (Monthly Recurring Revenue)
    const mrrResult = await pool.query(
      `SELECT 
       SUM(CASE 
         WHEN billing_cycle = 'monthly' THEN price
         WHEN billing_cycle = 'quarterly' THEN price / 3
         WHEN billing_cycle = 'yearly' THEN price / 12
         ELSE 0
       END) as mrr,
       SUM(price) as arr
       FROM subscriptions
       WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId]
    );

    return {
      total_revenue: parseFloat(result.rows[0].total_revenue || 0),
      period_revenue: parseFloat(result.rows[0].period_revenue || 0),
      paid_invoices: parseInt(result.rows[0].paid_invoices || 0),
      overdue_invoices: parseInt(result.rows[0].overdue_invoices || 0),
      avg_invoice_value: parseFloat(result.rows[0].avg_invoice_value || 0),
      mrr: parseFloat(mrrResult.rows[0]?.mrr || 0),
      arr: parseFloat(mrrResult.rows[0]?.arr || 0),
      payment_methods: {
        card: parseFloat(result.rows[0].card_revenue || 0),
        bank: parseFloat(result.rows[0].bank_revenue || 0)
      }
    };
  }

  /**
   * Customer metrics
   */
  async getCustomerMetrics(tenantId, since) {
    const result = await pool.query(
      `SELECT 
       COUNT(*) as total_customers,
       COUNT(CASE WHEN created_at >= $2 THEN 1 END) as new_customers,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active_customers,
       AVG(EXTRACT(DAY FROM (NOW() - created_at))) as avg_customer_age_days
       FROM users
       WHERE tenant_id = $1 AND role != 'admin'`,
      [tenantId, since]
    );

    // Customer Lifetime Value (LTV)
    const ltvResult = await pool.query(
      `SELECT 
       u.id,
       SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) as total_spent,
       COUNT(DISTINCT s.id) as active_subs,
       EXTRACT(DAY FROM (NOW() - u.created_at)) as customer_age_days
       FROM users u
       LEFT JOIN invoices i ON i.user_id = u.id
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.tenant_id = $1 AND u.role != 'admin'
       GROUP BY u.id
       HAVING SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) > 0`,
      [tenantId]
    );

    const totalLTV = ltvResult.rows.reduce((sum, r) => sum + parseFloat(r.total_spent), 0);
    const avgLTV = ltvResult.rows.length > 0 ? totalLTV / ltvResult.rows.length : 0;

    return {
      total: parseInt(result.rows[0].total_customers || 0),
      new: parseInt(result.rows[0].new_customers || 0),
      active: parseInt(result.rows[0].active_customers || 0),
      avg_age_days: parseFloat(result.rows[0].avg_customer_age_days || 0),
      avg_ltv: parseFloat(avgLTV.toFixed(2)),
      total_ltv: parseFloat(totalLTV.toFixed(2))
    };
  }

  /**
   * Subscription metrics
   */
  async getSubscriptionMetrics(tenantId, since) {
    const result = await pool.query(
      `SELECT 
       COUNT(*) as total,
       COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
       COUNT(CASE WHEN status = 'cancelled' AND updated_at >= $2 THEN 1 END) as cancelled_period,
       COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial,
       AVG(price) as avg_price
       FROM subscriptions
       WHERE tenant_id = $1`,
      [tenantId, since]
    );

    // Growth rate
    const previousPeriod = new Date(since.getTime() - (Date.now() - since.getTime()));
    const growthResult = await pool.query(
      `SELECT 
       COUNT(CASE WHEN created_at >= $2 AND created_at < $3 THEN 1 END) as previous_new,
       COUNT(CASE WHEN created_at >= $3 THEN 1 END) as current_new
       FROM subscriptions
       WHERE tenant_id = $1 AND status = 'active'`,
      [tenantId, previousPeriod, since]
    );

    const prevNew = parseInt(growthResult.rows[0].previous_new || 0);
    const currNew = parseInt(growthResult.rows[0].current_new || 0);
    const growthRate = prevNew > 0 ? ((currNew - prevNew) / prevNew * 100) : 0;

    return {
      total: parseInt(result.rows[0].total || 0),
      active: parseInt(result.rows[0].active || 0),
      cancelled_period: parseInt(result.rows[0].cancelled_period || 0),
      trial: parseInt(result.rows[0].trial || 0),
      avg_price: parseFloat(result.rows[0].avg_price || 0),
      growth_rate: parseFloat(growthRate.toFixed(2))
    };
  }

  /**
   * Churn metrics
   */
  async getChurnMetrics(tenantId, since) {
    const result = await pool.query(
      `WITH period_start AS (
         SELECT COUNT(*) as start_count
         FROM subscriptions
         WHERE tenant_id = $1 AND status = 'active' AND created_at < $2
       ),
       period_end AS (
         SELECT COUNT(*) as end_count
         FROM subscriptions
         WHERE tenant_id = $1 AND status = 'active'
       ),
       period_churned AS (
         SELECT COUNT(*) as churned_count
         FROM subscriptions
         WHERE tenant_id = $1 AND status = 'cancelled' 
         AND updated_at >= $2
       )
       SELECT 
         ps.start_count,
         pe.end_count,
         pc.churned_count
       FROM period_start ps, period_end pe, period_churned pc`,
      [tenantId, since]
    );

    const startCount = parseInt(result.rows[0]?.start_count || 0);
    const churnedCount = parseInt(result.rows[0]?.churned_count || 0);
    const churnRate = startCount > 0 ? (churnedCount / startCount * 100) : 0;

    return {
      churned_count: churnedCount,
      churn_rate: parseFloat(churnRate.toFixed(2)),
      retention_rate: parseFloat((100 - churnRate).toFixed(2))
    };
  }

  /**
   * Revenue forecast (ML-powered)
   */
  async forecastRevenue(tenantId, months = 6) {
    try {
      // Use AI service for intelligent forecasting
      const forecast = await aiService.forecastRevenue(tenantId, months);
      
      // Store forecast in database
      for (const monthData of forecast.forecast) {
        const forecastMonth = new Date();
        forecastMonth.setMonth(forecastMonth.getMonth() + monthData.month);
        
        await pool.query(
          `INSERT INTO revenue_forecasts 
           (tenant_id, forecast_month, revenue_low, revenue_mid, revenue_high, confidence, analysis_data)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (tenant_id, forecast_month) 
           DO UPDATE SET 
             revenue_low = $3, 
             revenue_mid = $4, 
             revenue_high = $5,
             confidence = $6,
             analysis_data = $7`,
          [
            tenantId,
            forecastMonth.toISOString().split('T')[0],
            monthData.revenue_low,
            monthData.revenue_mid,
            monthData.revenue_high,
            0.7, // confidence
            JSON.stringify(forecast.analysis)
          ]
        );
      }

      return forecast;
    } catch (error) {
      logger.error('Revenue forecast error:', error);
      throw error;
    }
  }

  /**
   * Customer segmentation
   */
  async segmentCustomers(tenantId) {
    try {
      const result = await pool.query(
        `SELECT 
         u.id,
         u.email,
         COUNT(DISTINCT s.id) as subscription_count,
         SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) as total_spent,
         MAX(i.created_at) as last_purchase,
         EXTRACT(DAY FROM (NOW() - MAX(i.created_at))) as days_since_purchase,
         EXTRACT(DAY FROM (NOW() - u.created_at)) as customer_age_days
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         LEFT JOIN invoices i ON i.user_id = u.id
         WHERE u.tenant_id = $1 AND u.role != 'admin'
         GROUP BY u.id, u.email`,
        [tenantId]
      );

      // RFM Analysis (Recency, Frequency, Monetary)
      const segments = {
        champions: [], // Recent, frequent, high spend
        loyal: [], // Frequent, moderate spend
        at_risk: [], // Was frequent, now declining
        lost: [], // No recent activity
        new: [] // Recent join, low activity
      };

      for (const customer of result.rows) {
        const daysSince = parseInt(customer.days_since_purchase || 999);
        const totalSpent = parseFloat(customer.total_spent || 0);
        const frequency = parseInt(customer.subscription_count || 0);
        const age = parseInt(customer.customer_age_days || 0);

        if (daysSince <= 30 && totalSpent >= 500 && frequency >= 2) {
          segments.champions.push(customer);
        } else if (frequency >= 3 && totalSpent >= 300) {
          segments.loyal.push(customer);
        } else if (daysSince >= 60 && frequency >= 2) {
          segments.at_risk.push(customer);
        } else if (daysSince >= 90) {
          segments.lost.push(customer);
        } else if (age <= 30) {
          segments.new.push(customer);
        }
      }

      return {
        total_customers: result.rows.length,
        segments: {
          champions: { count: segments.champions.length, customers: segments.champions.slice(0, 10) },
          loyal: { count: segments.loyal.length, customers: segments.loyal.slice(0, 10) },
          at_risk: { count: segments.at_risk.length, customers: segments.at_risk.slice(0, 10) },
          lost: { count: segments.lost.length, customers: segments.lost.slice(0, 10) },
          new: { count: segments.new.length, customers: segments.new.slice(0, 10) }
        }
      };
    } catch (error) {
      logger.error('Customer segmentation error:', error);
      throw error;
    }
  }

  /**
   * Product performance analysis
   */
  async analyzeProductPerformance(tenantId, period = '30d') {
    try {
      const days = this.parsePeriod(period);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const result = await pool.query(
        `SELECT 
         p.id,
         p.name,
         p.price,
         COUNT(DISTINCT s.id) as active_subscriptions,
         COUNT(DISTINCT CASE WHEN s.created_at >= $2 THEN s.id END) as new_subscriptions,
         SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) as total_revenue,
         AVG(CASE WHEN i.status = 'paid' THEN i.total END) as avg_revenue,
         COUNT(DISTINCT CASE WHEN s.status = 'cancelled' AND s.updated_at >= $2 THEN s.id END) as cancellations
         FROM products p
         LEFT JOIN subscriptions s ON s.product_id = p.id
         LEFT JOIN invoices i ON i.user_id = s.user_id AND i.created_at >= $2
         WHERE p.tenant_id = $1
         GROUP BY p.id, p.name, p.price
         ORDER BY total_revenue DESC`,
        [tenantId, since]
      );

      return result.rows.map(product => ({
        ...product,
        active_subscriptions: parseInt(product.active_subscriptions || 0),
        new_subscriptions: parseInt(product.new_subscriptions || 0),
        total_revenue: parseFloat(product.total_revenue || 0),
        avg_revenue: parseFloat(product.avg_revenue || 0),
        cancellations: parseInt(product.cancellations || 0),
        retention_rate: product.active_subscriptions > 0 
          ? ((product.active_subscriptions - product.cancellations) / product.active_subscriptions * 100).toFixed(2)
          : 100
      }));
    } catch (error) {
      logger.error('Product performance analysis error:', error);
      throw error;
    }
  }

  /**
   * Cohort analysis
   */
  async analyzeCohorts(tenantId) {
    try {
      const result = await pool.query(
        `SELECT 
         DATE_TRUNC('month', u.created_at) as cohort_month,
         COUNT(DISTINCT u.id) as cohort_size,
         COUNT(DISTINCT CASE WHEN s.status = 'active' THEN u.id END) as still_active,
         SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) as total_revenue
         FROM users u
         LEFT JOIN subscriptions s ON s.user_id = u.id
         LEFT JOIN invoices i ON i.user_id = u.id
         WHERE u.tenant_id = $1 AND u.role != 'admin'
         GROUP BY cohort_month
         ORDER BY cohort_month DESC
         LIMIT 12`,
        [tenantId]
      );

      return result.rows.map(cohort => ({
        month: cohort.cohort_month,
        cohort_size: parseInt(cohort.cohort_size),
        still_active: parseInt(cohort.still_active || 0),
        retention_rate: cohort.cohort_size > 0 
          ? ((cohort.still_active / cohort.cohort_size) * 100).toFixed(2)
          : 0,
        total_revenue: parseFloat(cohort.total_revenue || 0),
        avg_revenue_per_customer: cohort.cohort_size > 0
          ? (cohort.total_revenue / cohort.cohort_size).toFixed(2)
          : 0
      }));
    } catch (error) {
      logger.error('Cohort analysis error:', error);
      throw error;
    }
  }

  /**
   * Helper: Parse period string
   */
  parsePeriod(period) {
    const match = period.match(/^(\d+)([dhwmy])$/);
    if (!match) return 30;

    const [, value, unit] = match;
    const num = parseInt(value);

    switch (unit) {
      case 'd': return num;
      case 'h': return num / 24;
      case 'w': return num * 7;
      case 'm': return num * 30;
      case 'y': return num * 365;
      default: return 30;
    }
  }
}

export default new AdvancedAnalyticsService();
