/**
 * ENTERPRISE PREMIUM TOOLS SUITE Router
 * Routes: /api/enterprise/premium-tools
 */

import { Router } from 'express';
import * as premiumToolsController from './premium-tools.controller.js';

const router = Router();

router.get('/tools', premiumToolsController.handleListTools);
router.get('/tools/:id', premiumToolsController.handleGetTool);
router.post('/execute', premiumToolsController.handleExecuteTool);
router.get('/usage', premiumToolsController.handleListUsageRecords);

export default router;
