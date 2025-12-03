/**
 * ENTERPRISE MONITORING & ALERTS Router
 * Routes: /api/enterprise/monitoring
 */

import { Router } from 'express';
import * as monitoringController from './monitoring.controller.js';

const router = Router();

router.get('/monitors', monitoringController.handleListMonitors);
router.post('/monitors', monitoringController.handleCreateMonitor);
router.delete('/monitors/:id', monitoringController.handleDeleteMonitor);
router.get('/monitors/:monitorId/checks', monitoringController.handleListMonitorChecks);

router.get('/alert-policies', monitoringController.handleListAlertPolicies);
router.post('/alert-policies', monitoringController.handleCreateAlertPolicy);
router.delete('/alert-policies/:id', monitoringController.handleDeleteAlertPolicy);

export default router;
