import db from '../db/index.js';
import logger from '../config/logger.js';
import { cache, CacheTTL, CacheNamespace } from './cache.js';

/**
 * Analytics Service
 * Provides data aggregation, trend analysis, and reporting capabilities
 */
class AnalyticsService {
  /**
   * Get revenue analytics
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @param {string} options.period - Time period (day, week, month, year)
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @returns {Promise<Object>} Revenue data
   */
  async getRevenueAnalytics(tenantId, options = {}) {
    const { period = 'month', startDate, endDate } = options;
    const cacheKey = `revenue:${tenantId}:${period}:${startDate}:${endDate}`;
    
    // Try cache first
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this._buildDateFilter(startDate, endDate);
      const groupBy = this._getGroupByClause(period);

      const query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as transaction_count,
          SUM(amount) as total_revenue,
          AVG(amount) as average_order_value,
          COUNT(DISTINCT user_id) as unique_customers
        FROM invoices
        WHERE tenant_id = $1 
          AND status = 'paid'
          ${dateFilter}
        GROUP BY ${groupBy}
        ORDER BY period DESC
      `;

      const result = await db.query(query, [tenantId]);
      
      const analytics = {
        period,
        data: result.rows.map(row => ({
          period: row.period,
          transactionCount: parseInt(row.transaction_count),
          totalRevenue: parseFloat(row.total_revenue),
          averageOrderValue: parseFloat(row.average_order_value),
          uniqueCustomers: parseInt(row.unique_customers)
        })),
        summary: this._calculateRevenueSummary(result.rows)
      };

      // Cache for 1 hour
      await cache.set(CacheNamespace.STATS, cacheKey, analytics, CacheTTL.LONG);
      
      return analytics;
    } catch (error) {
      logger.error('Error getting revenue analytics:', error);
      throw new Error('Failed to retrieve revenue analytics');
    }
  }

  /**
   * Get customer growth analytics
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Customer growth data
   */
  async getCustomerGrowth(tenantId, options = {}) {
    const { period = 'month', startDate, endDate } = options;
    const cacheKey = `customer_growth:${tenantId}:${period}:${startDate}:${endDate}`;
    
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this._buildDateFilter(startDate, endDate, 'created_at');
      const groupBy = this._getGroupByClause(period, 'created_at');

      const query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as new_customers,
          SUM(COUNT(*)) OVER (ORDER BY ${groupBy}) as total_customers
        FROM users
        WHERE tenant_id = $1 
          AND role = 'customer'
          ${dateFilter}
        GROUP BY ${groupBy}
        ORDER BY period DESC
      `;

      const result = await db.query(query, [tenantId]);
      
      const growth = {
        period,
        data: result.rows.map(row => ({
          period: row.period,
          newCustomers: parseInt(row.new_customers),
          totalCustomers: parseInt(row.total_customers)
        })),
        summary: {
          totalNewCustomers: result.rows.reduce((sum, r) => sum + parseInt(r.new_customers), 0),
          currentTotal: result.rows[0] ? parseInt(result.rows[0].total_customers) : 0
        }
      };

      await cache.set(CacheNamespace.STATS, cacheKey, growth, CacheTTL.LONG);
      
      return growth;
    } catch (error) {
      logger.error('Error getting customer growth:', error);
      throw new Error('Failed to retrieve customer growth analytics');
    }
  }

  /**
   * Get product performance analytics
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Product performance data
   */
  async getProductPerformance(tenantId, options = {}) {
    const { startDate, endDate, limit = 10 } = options;
    const cacheKey = `product_performance:${tenantId}:${startDate}:${endDate}:${limit}`;
    
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this._buildDateFilter(startDate, endDate, 'o.created_at');

      const query = `
        SELECT 
          p.id,
          p.name,
          p.sku,
          p.category,
          COUNT(DISTINCT o.id) as order_count,
          SUM(oi.quantity) as units_sold,
          SUM(oi.quantity * oi.price) as total_revenue,
          AVG(oi.price) as average_price
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id
        WHERE p.tenant_id = $1
          ${dateFilter}
        GROUP BY p.id, p.name, p.sku, p.category
        ORDER BY total_revenue DESC
        LIMIT $2
      `;

      const result = await db.query(query, [tenantId, limit]);
      
      const performance = {
        topProducts: result.rows.map(row => ({
          productId: row.id,
          name: row.name,
          sku: row.sku,
          category: row.category,
          orderCount: parseInt(row.order_count) || 0,
          unitsSold: parseInt(row.units_sold) || 0,
          totalRevenue: parseFloat(row.total_revenue) || 0,
          averagePrice: parseFloat(row.average_price) || 0
        }))
      };

      await cache.set(CacheNamespace.STATS, cacheKey, performance, CacheTTL.LONG);
      
      return performance;
    } catch (error) {
      logger.error('Error getting product performance:', error);
      throw new Error('Failed to retrieve product performance analytics');
    }
  }

  /**
   * Get subscription analytics
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Subscription metrics
   */
  async getSubscriptionMetrics(tenantId) {
    const cacheKey = `subscription_metrics:${tenantId}`;
    
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(amount) as total_mrr
        FROM subscriptions
        WHERE tenant_id = $1
        GROUP BY status
      `;

      const churnQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'canceled' AND canceled_at >= NOW() - INTERVAL '30 days') as monthly_churn,
          COUNT(*) FILTER (WHERE status = 'active') as active_count
        FROM subscriptions
        WHERE tenant_id = $1
      `;

      const [result, churnResult] = await Promise.all([
        db.query(query, [tenantId]),
        db.query(churnQuery, [tenantId])
      ]);
      
      const statusBreakdown = {};
      let totalMRR = 0;

      result.rows.forEach(row => {
        statusBreakdown[row.status] = {
          count: parseInt(row.count),
          mrr: parseFloat(row.total_mrr) || 0
        };
        if (row.status === 'active') {
          totalMRR = parseFloat(row.total_mrr) || 0;
        }
      });

      const activeCount = parseInt(churnResult.rows[0]?.active_count) || 0;
      const monthlyChurn = parseInt(churnResult.rows[0]?.monthly_churn) || 0;
      const churnRate = activeCount > 0 ? (monthlyChurn / activeCount) * 100 : 0;

      const metrics = {
        statusBreakdown,
        totalMRR,
        churnRate: parseFloat(churnRate.toFixed(2)),
        monthlyChurn
      };

      await cache.set(CacheNamespace.STATS, cacheKey, metrics, CacheTTL.MEDIUM);
      
      return metrics;
    } catch (error) {
      logger.error('Error getting subscription metrics:', error);
      throw new Error('Failed to retrieve subscription metrics');
    }
  }

  /**
   * Get resource usage analytics
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Resource usage data
   */
  async getResourceUsage(tenantId, options = {}) {
    const { period = 'day', startDate, endDate } = options;
    const cacheKey = `resource_usage:${tenantId}:${period}:${startDate}:${endDate}`;
    
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const dateFilter = this._buildDateFilter(startDate, endDate, 'recorded_at');
      const groupBy = this._getGroupByClause(period, 'recorded_at');

      const query = `
        SELECT 
          ${groupBy} as period,
          resource_type,
          AVG((metrics->>'cpu_usage')::float) as avg_cpu,
          AVG((metrics->>'memory_usage')::float) as avg_memory,
          AVG((metrics->>'disk_usage')::float) as avg_disk,
          MAX((metrics->>'cpu_usage')::float) as peak_cpu,
          MAX((metrics->>'memory_usage')::float) as peak_memory
        FROM resource_metrics
        WHERE tenant_id = $1 
          ${dateFilter}
        GROUP BY ${groupBy}, resource_type
        ORDER BY period DESC, resource_type
      `;

      const result = await db.query(query, [tenantId]);
      
      const usage = {
        period,
        data: result.rows.map(row => ({
          period: row.period,
          resourceType: row.resource_type,
          avgCpu: parseFloat(row.avg_cpu) || 0,
          avgMemory: parseFloat(row.avg_memory) || 0,
          avgDisk: parseFloat(row.avg_disk) || 0,
          peakCpu: parseFloat(row.peak_cpu) || 0,
          peakMemory: parseFloat(row.peak_memory) || 0
        }))
      };

      await cache.set(CacheNamespace.STATS, cacheKey, usage, CacheTTL.MEDIUM);
      
      return usage;
    } catch (error) {
      logger.error('Error getting resource usage:', error);
      throw new Error('Failed to retrieve resource usage analytics');
    }
  }

  /**
   * Generate chart data for visualization
   * @param {string} type - Chart type (line, bar, pie)
   * @param {Array} data - Raw data
   * @param {Object} options - Chart options
   * @returns {Object} Chart-ready data
   */
  generateChartData(type, data, options = {}) {
    const { xKey = 'period', yKey = 'value', label = 'Data' } = options;

    switch (type) {
      case 'line':
      case 'bar':
        return {
          labels: data.map(item => item[xKey]),
          datasets: [{
            label,
            data: data.map(item => item[yKey]),
            ...options.style
          }]
        };

      case 'pie':
      case 'doughnut':
        return {
          labels: data.map(item => item[xKey]),
          datasets: [{
            data: data.map(item => item[yKey]),
            ...options.style
          }]
        };

      default:
        throw new Error(`Unsupported chart type: ${type}`);
    }
  }

  /**
   * Export analytics data to CSV
   * @param {Array} data - Data to export
   * @param {Array} columns - Column definitions
   * @returns {string} CSV string
   */
  exportToCSV(data, columns) {
    try {
      // Header row
      const headers = columns.map(col => col.label || col.key).join(',');
      
      // Data rows
      const rows = data.map(row => {
        return columns.map(col => {
          const value = row[col.key];
          // Escape commas and quotes
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        }).join(',');
      });

      return [headers, ...rows].join('\n');
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw new Error('Failed to export data to CSV');
    }
  }

  /**
   * Get dashboard summary
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Dashboard summary data
   */
  async getDashboardSummary(tenantId) {
    const cacheKey = `dashboard_summary:${tenantId}`;
    
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const [revenue, customers, subscriptions, products] = await Promise.all([
        this.getRevenueAnalytics(tenantId, { period: 'month' }),
        this.getCustomerGrowth(tenantId, { period: 'month' }),
        this.getSubscriptionMetrics(tenantId),
        this.getProductPerformance(tenantId, { limit: 5 })
      ]);

      const summary = {
        revenue: revenue.summary,
        customers: customers.summary,
        subscriptions: {
          totalMRR: subscriptions.totalMRR,
          churnRate: subscriptions.churnRate,
          activeCount: subscriptions.statusBreakdown.active?.count || 0
        },
        topProducts: products.topProducts.slice(0, 5)
      };

      await cache.set(CacheNamespace.STATS, cacheKey, summary, CacheTTL.MEDIUM);
      
      return summary;
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      throw new Error('Failed to retrieve dashboard summary');
    }
  }

  /**
   * Build SQL date filter clause
   * @private
   */
  _buildDateFilter(startDate, endDate, dateColumn = 'created_at') {
    const filters = [];
    
    if (startDate) {
      filters.push(`AND ${dateColumn} >= '${startDate}'`);
    }
    
    if (endDate) {
      filters.push(`AND ${dateColumn} <= '${endDate}'`);
    }
    
    return filters.join(' ');
  }

  /**
   * Get SQL GROUP BY clause for time periods
   * @private
   */
  _getGroupByClause(period, dateColumn = 'created_at') {
    switch (period) {
      case 'hour':
        return `DATE_TRUNC('hour', ${dateColumn})`;
      case 'day':
        return `DATE_TRUNC('day', ${dateColumn})`;
      case 'week':
        return `DATE_TRUNC('week', ${dateColumn})`;
      case 'month':
        return `DATE_TRUNC('month', ${dateColumn})`;
      case 'year':
        return `DATE_TRUNC('year', ${dateColumn})`;
      default:
        return `DATE_TRUNC('day', ${dateColumn})`;
    }
  }

  /**
   * Calculate revenue summary statistics
   * @private
   */
  _calculateRevenueSummary(rows) {
    if (!rows || rows.length === 0) {
      return {
        total: 0,
        average: 0,
        growth: 0
      };
    }

    const total = rows.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0);
    const average = total / rows.length;
    
    // Calculate growth percentage (latest vs previous period)
    let growth = 0;
    if (rows.length >= 2) {
      const latest = parseFloat(rows[0].total_revenue);
      const previous = parseFloat(rows[1].total_revenue);
      if (previous > 0) {
        growth = ((latest - previous) / previous) * 100;
      }
    }

    return {
      total: parseFloat(total.toFixed(2)),
      average: parseFloat(average.toFixed(2)),
      growth: parseFloat(growth.toFixed(2))
    };
  }
}

export default new AnalyticsService();
