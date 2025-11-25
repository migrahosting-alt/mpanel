import express from 'express';
import * as deploymentController from '../controllers/deploymentController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission, requireAdmin } from '../middleware/authorization.js';

const router = express.Router();

// All deployment routes require authentication
router.use(authenticateToken);

/**
 * Deploy database
 * Requires: deployments.database permission
 */
router.post(
  '/database',
  requirePermission('deployments.database'),
  deploymentController.deployDatabase
);

/**
 * Deploy database user
 * Requires: deployments.user permission
 */
router.post(
  '/user',
  requirePermission('deployments.user'),
  deploymentController.deployUser
);

/**
 * Deploy table
 * Requires: deployments.table permission
 */
router.post(
  '/table',
  requirePermission('deployments.table'),
  deploymentController.deployTable
);

/**
 * Deploy API endpoint
 * Requires: deployments.api permission
 */
router.post(
  '/api',
  requirePermission('deployments.api'),
  deploymentController.deployAPI
);

/**
 * Deploy website
 * Requires: deployments.website permission
 */
router.post(
  '/website',
  requirePermission('deployments.website'),
  deploymentController.deployWebsite
);

/**
 * Deploy form
 * Requires: deployments.form permission
 */
router.post(
  '/form',
  requirePermission('deployments.form'),
  deploymentController.deployForm
);

/**
 * Get all deployments
 * Requires: deployments.read permission
 */
router.get(
  '/',
  requirePermission('deployments.read'),
  deploymentController.getAllDeployments
);

/**
 * Get deployment by ID
 * Requires: deployments.read permission
 */
router.get(
  '/:id',
  requirePermission('deployments.read'),
  deploymentController.getDeploymentById
);

/**
 * Delete deployment
 * Requires: deployments.delete permission
 */
router.delete(
  '/:id',
  requirePermission('deployments.delete'),
  deploymentController.deleteDeployment
);

export default router;

