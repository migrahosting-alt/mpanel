/**
 * OPS OVERVIEW Router
 * Routes: /api/ops/platform-overview
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as opsOverviewController from './ops-overview.controller.js';

const router = Router();

// Platform health overview (Admin/Owner only)
router.get('/', authMiddleware, requireRole('ADMIN'), opsOverviewController.handleGetOpsOverview);

export default router;
