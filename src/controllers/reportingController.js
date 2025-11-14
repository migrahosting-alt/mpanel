import analyticsService from '../services/analyticsService.js';
import logger from '../config/logger.js';

/**
 * Get revenue analytics
 */
export const getRevenueAnalytics = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { period, startDate, endDate } = req.query;

    const analytics = await analyticsService.getRevenueAnalytics(tenantId, {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(analytics);
  } catch (error) {
    logger.error('Error in getRevenueAnalytics:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get customer growth analytics
 */
export const getCustomerGrowth = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { period, startDate, endDate } = req.query;

    const growth = await analyticsService.getCustomerGrowth(tenantId, {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(growth);
  } catch (error) {
    logger.error('Error in getCustomerGrowth:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get product performance analytics
 */
export const getProductPerformance = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate, limit } = req.query;

    const performance = await analyticsService.getProductPerformance(tenantId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined
    });

    res.json(performance);
  } catch (error) {
    logger.error('Error in getProductPerformance:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get subscription metrics
 */
export const getSubscriptionMetrics = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const metrics = await analyticsService.getSubscriptionMetrics(tenantId);
    res.json(metrics);
  } catch (error) {
    logger.error('Error in getSubscriptionMetrics:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get resource usage analytics
 */
export const getResourceUsage = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { period, startDate, endDate } = req.query;

    const usage = await analyticsService.getResourceUsage(tenantId, {
      period,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });

    res.json(usage);
  } catch (error) {
    logger.error('Error in getResourceUsage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get dashboard summary
 */
export const getDashboardSummary = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const summary = await analyticsService.getDashboardSummary(tenantId);
    res.json(summary);
  } catch (error) {
    logger.error('Error in getDashboardSummary:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Generate chart data
 */
export const generateChartData = async (req, res) => {
  try {
    const { type, dataType, options } = req.body;
    const { tenantId } = req.user;

    let rawData;
    
    // Fetch data based on type
    switch (dataType) {
      case 'revenue':
        rawData = await analyticsService.getRevenueAnalytics(tenantId, options);
        break;
      case 'customers':
        rawData = await analyticsService.getCustomerGrowth(tenantId, options);
        break;
      case 'products':
        rawData = await analyticsService.getProductPerformance(tenantId, options);
        break;
      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }

    const chartData = analyticsService.generateChartData(
      type,
      rawData.data || rawData.topProducts,
      options
    );

    res.json(chartData);
  } catch (error) {
    logger.error('Error in generateChartData:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Export analytics to CSV
 */
export const exportAnalytics = async (req, res) => {
  try {
    const { dataType, options, columns } = req.body;
    const { tenantId } = req.user;

    let data;
    
    // Fetch data based on type
    switch (dataType) {
      case 'revenue':
        data = await analyticsService.getRevenueAnalytics(tenantId, options);
        break;
      case 'customers':
        data = await analyticsService.getCustomerGrowth(tenantId, options);
        break;
      case 'products':
        data = await analyticsService.getProductPerformance(tenantId, options);
        break;
      default:
        return res.status(400).json({ error: 'Invalid data type' });
    }

    const csv = analyticsService.exportToCSV(
      data.data || data.topProducts,
      columns
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${dataType}-export.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error in exportAnalytics:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create custom report
 */
export const createCustomReport = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { name, metrics, filters, schedule } = req.body;

    // Validate required fields
    if (!name || !metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid report configuration' });
    }

    // Store report configuration in database
    const query = `
      INSERT INTO custom_reports (tenant_id, name, metrics, filters, schedule, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;

    const result = await db.query(query, [
      tenantId,
      name,
      JSON.stringify(metrics),
      JSON.stringify(filters || {}),
      JSON.stringify(schedule || {})
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error in createCustomReport:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get custom reports
 */
export const getCustomReports = async (req, res) => {
  try {
    const { tenantId } = req.user;

    const query = `
      SELECT * FROM custom_reports
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(query, [tenantId]);
    res.json(result.rows);
  } catch (error) {
    logger.error('Error in getCustomReports:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete custom report
 */
export const deleteCustomReport = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { reportId } = req.params;

    const query = `
      DELETE FROM custom_reports
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `;

    const result = await db.query(query, [reportId, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteCustomReport:', error);
    res.status(500).json({ error: error.message });
  }
};
