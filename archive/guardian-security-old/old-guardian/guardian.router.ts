/**
 * Guardian Router - AI assistant management
 */

import express from 'express';
import * as guardianController from './guardian.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/guardian/instances
 */
router.get('/instances', guardianController.listInstances);

/**
 * POST /api/guardian/instances
 */
router.post(
  '/instances',
  requireTenantRole(['OWNER', 'ADMIN']),
  guardianController.createInstance
);

/**
 * GET /api/guardian/instances/:id
 */
router.get('/instances/:id', guardianController.getInstance);

/**
 * PATCH /api/guardian/instances/:id
 */
router.patch(
  '/instances/:id',
  requireTenantRole(['OWNER', 'ADMIN']),
  guardianController.updateInstance
);

/**
 * POST /api/guardian/instances/:id/disable
 */
router.post(
  '/instances/:id/disable',
  requireTenantRole(['OWNER', 'ADMIN']),
  guardianController.disableInstance
);

/**
 * GET /api/guardian/instances/:id/embed
 */
router.get('/instances/:id/embed', guardianController.getEmbedConfig);

export default router;
