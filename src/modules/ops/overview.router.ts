/**
 * Ops Overview Router
 * Based on: MODULE_OPS_OVERVIEW.ix.md
 * 
 * Route: GET /api/ops/overview
 * RBAC: Requires ops:overview:read or ops:*
 */

import { Router } from 'express';
import { handleGetOpsOverview } from './overview.controller.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';

const router = Router();

// GET /api/ops/overview - Get operational dashboard summary
router.get(
  '/',
  requirePlatformPermission('ops:overview:read'),
  handleGetOpsOverview
);

export default router;
