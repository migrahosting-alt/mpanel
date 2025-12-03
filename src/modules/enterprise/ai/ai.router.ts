/**
 * ENTERPRISE AI FEATURES Router
 * Routes: /api/enterprise/ai
 */

import { Router } from 'express';
import * as aiController from './ai.controller.js';

const router = Router();

router.get('/config', aiController.handleGetActiveConfig);
router.post('/config', aiController.handleCreateConfig);
router.delete('/config/:id', aiController.handleDeleteConfig);

router.post('/completions', aiController.handleGenerateCompletion);
router.get('/usage/stats', aiController.handleGetUsageStats);
router.get('/usage/records', aiController.handleListUsageRecords);

export default router;
