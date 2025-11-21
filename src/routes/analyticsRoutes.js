import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import * as reportingController from '../controllers/reportingController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/analytics/revenue
 * @desc Get revenue analytics
 * @query period - Time period (hour, day, week, month, year)
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/revenue', reportingController.getRevenueAnalytics);

/**
 * @route GET /api/analytics/customers
 * @desc Get customer growth analytics
 * @query period - Time period (hour, day, week, month, year)
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/customers', reportingController.getCustomerGrowth);

/**
 * @route GET /api/analytics/products
 * @desc Get product performance analytics
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 * @query limit - Number of top products to return
 */
router.get('/products', reportingController.getProductPerformance);

/**
 * @route GET /api/analytics/subscriptions
 * @desc Get subscription metrics
 */
router.get('/subscriptions', reportingController.getSubscriptionMetrics);

/**
 * @route GET /api/analytics/resources
 * @desc Get resource usage analytics
 * @query period - Time period (hour, day, week, month, year)
 * @query startDate - Start date (ISO string)
 * @query endDate - End date (ISO string)
 */
router.get('/resources', reportingController.getResourceUsage);

/**
 * @route GET /api/analytics/dashboard
 * @desc Get dashboard summary
 */
router.get('/dashboard', reportingController.getDashboardSummary);

/**
 * @route POST /api/analytics/chart
 * @desc Generate chart data
 * @body type - Chart type (line, bar, pie, doughnut)
 * @body dataType - Data type (revenue, customers, products)
 * @body options - Chart options and filters
 */
router.post('/chart', reportingController.generateChartData);

/**
 * @route POST /api/analytics/export
 * @desc Export analytics to CSV
 * @body dataType - Data type to export
 * @body options - Export options and filters
 * @body columns - Column definitions for CSV
 */
router.post('/export', reportingController.exportAnalytics);

/**
 * @route POST /api/analytics/reports
 * @desc Create custom report
 * @body name - Report name
 * @body metrics - Array of metrics to include
 * @body filters - Report filters
 * @body schedule - Report schedule configuration
 */
router.post('/reports', reportingController.createCustomReport);

/**
 * @route GET /api/analytics/reports
 * @desc Get all custom reports
 */
router.get('/reports', reportingController.getCustomReports);

/**
 * @route DELETE /api/analytics/reports/:reportId
 * @desc Delete custom report
 */
router.delete('/reports/:reportId', reportingController.deleteCustomReport);

export default router;

