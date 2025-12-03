/**
 * Provisioning Router - CloudPods and jobs management
 */

import express from 'express';
import * as provisioningController from './provisioning.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantRole, requirePlatformPermission } from '../../middleware/rbac.middleware.js';

const router = express.Router();

router.use(authMiddleware);

/**
 * Tenant routes
 */

// GET /api/provisioning/cloudpods
router.get(
  '/cloudpods',
  requireTenantRole(['OWNER', 'ADMIN', 'BILLING', 'MEMBER']),
  provisioningController.listCloudPods
);

// GET /api/provisioning/cloudpods/:id
router.get(
  '/cloudpods/:id',
  requireTenantRole(['OWNER', 'ADMIN', 'BILLING', 'MEMBER']),
  provisioningController.getCloudPod
);

// GET /api/provisioning/jobs
router.get(
  '/jobs',
  requireTenantRole(['OWNER', 'ADMIN', 'BILLING']),
  provisioningController.listJobs
);

/**
 * Platform routes
 */

// GET /api/provisioning/platform/cloudpods
router.get(
  '/platform/cloudpods',
  requirePlatformPermission('platform:provisioning:read'),
  provisioningController.listCloudPodsPlatform
);

// GET /api/provisioning/platform/jobs
router.get(
  '/platform/jobs',
  requirePlatformPermission('platform:provisioning:read'),
  provisioningController.listJobsPlatform
);

// POST /api/provisioning/platform/jobs/:id/retry
router.post(
  '/platform/jobs/:id/retry',
  requirePlatformPermission('platform:provisioning:manage'),
  provisioningController.retryJob
);

// POST /api/provisioning/platform/jobs/:id/cancel
router.post(
  '/platform/jobs/:id/cancel',
  requirePlatformPermission('platform:provisioning:manage'),
  provisioningController.cancelJob
);

export default router;
