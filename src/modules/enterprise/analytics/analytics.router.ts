/**
 * ENTERPRISE ANALYTICS (BI) Router
 * Routes: /api/enterprise/analytics
 */

import { Router } from 'express';
import * as analyticsController from './analytics.controller.js';

const router = Router();

router.get('/data-sources', analyticsController.handleListDataSources);
router.post('/data-sources', analyticsController.handleCreateDataSource);
router.delete('/data-sources/:id', analyticsController.handleDeleteDataSource);

router.get('/dashboards', analyticsController.handleListDashboards);
router.get('/dashboards/:id', analyticsController.handleGetDashboard);
router.post('/dashboards', analyticsController.handleCreateDashboard);
router.delete('/dashboards/:id', analyticsController.handleDeleteDashboard);

export default router;
