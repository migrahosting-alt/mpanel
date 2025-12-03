/**
 * MODULE_SERVER_METRICS Router
 * Routes: /api/hosting/server-metrics
 */

import { Router } from 'express';
import * as metricsController from './serverMetrics.controller.js';

const router = Router();

// Get server metric summary
router.get('/summary', metricsController.handleGetMetricSummary);

// Get timeseries data
router.get('/timeseries', metricsController.handleGetTimeseries);

// Get metric alerts
router.get('/alerts', metricsController.handleGetAlerts);

export default router;
