/**
 * Guardian Routes
 * API routes for AFM Guardian (AI Support Assistant) management
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import * as guardianController from '../controllers/guardianController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/guardian/instances
 * @desc    Create a new Guardian instance
 * @access  Private - requires 'guardian.create' permission
 */
router.post(
  '/instances',
  requirePermission('guardian.create'),
  guardianController.createInstance
);

/**
 * @route   GET /api/guardian/instances
 * @desc    List all Guardian instances
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/instances',
  requirePermission('guardian.read'),
  guardianController.listInstances
);

/**
 * @route   GET /api/guardian/instances/:id
 * @desc    Get a specific Guardian instance
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/instances/:id',
  requirePermission('guardian.read'),
  guardianController.getInstance
);

/**
 * @route   PUT /api/guardian/instances/:id
 * @desc    Update Guardian instance configuration
 * @access  Private - requires 'guardian.update' permission
 */
router.put(
  '/instances/:id',
  requirePermission('guardian.update'),
  guardianController.updateInstance
);

/**
 * @route   DELETE /api/guardian/instances/:id
 * @desc    Delete Guardian instance
 * @access  Private - requires 'guardian.delete' permission
 */
router.delete(
  '/instances/:id',
  requirePermission('guardian.delete'),
  guardianController.deleteInstance
);

/**
 * @route   POST /api/guardian/instances/:id/regenerate-token
 * @desc    Regenerate widget authentication token
 * @access  Private - requires 'guardian.update' permission
 */
router.post(
  '/instances/:id/regenerate-token',
  requirePermission('guardian.update'),
  guardianController.regenerateToken
);

/**
 * @route   GET /api/guardian/instances/:id/analytics
 * @desc    Get analytics for an instance
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/instances/:id/analytics',
  requirePermission('guardian.read'),
  guardianController.getAnalytics
);

/**
 * @route   GET /api/guardian/instances/:id/sessions
 * @desc    Get session history for an instance
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/instances/:id/sessions',
  requirePermission('guardian.read'),
  guardianController.getSessionHistory
);

/**
 * @route   GET /api/guardian/sessions/:sessionId/conversation
 * @desc    Get conversation for a specific session
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/sessions/:sessionId/conversation',
  requirePermission('guardian.read'),
  guardianController.getSessionConversation
);

/**
 * @route   GET /api/guardian/instances/:id/embed-code
 * @desc    Get widget embed code
 * @access  Private - requires 'guardian.read' permission
 */
router.get(
  '/instances/:id/embed-code',
  requirePermission('guardian.read'),
  guardianController.getEmbedCode
);

export default router;
