/**
 * Provisioning Routes
 * API endpoints for automated service provisioning
 */

import express from 'express';
import provisioningController from '../controllers/provisioningController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All provisioning routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/provisioning/provision
 * @desc    Queue a service for provisioning
 * @access  Admin
 * @body    { serviceId, customerId, productId, domain }
 */
router.post('/provision', requireAdmin, provisioningController.provisionService);

/**
 * @route   POST /api/provisioning/manual
 * @desc    Manually provision a service (synchronous, for testing)
 * @access  Admin
 * @body    { serviceId, customerId, productId, domain }
 */
router.post('/manual', requireAdmin, provisioningController.manualProvision);

/**
 * @route   GET /api/provisioning/tasks
 * @desc    Get all provisioning tasks
 * @access  Admin
 * @query   ?status=pending&limit=50&offset=0
 */
router.get('/tasks', requireAdmin, provisioningController.getAllTasks);

/**
 * @route   GET /api/provisioning/tasks/:id
 * @desc    Get provisioning task status by ID
 * @access  Admin
 * @param   id - Task ID or Job ID
 */
router.get('/tasks/:id', requireAdmin, provisioningController.getTaskStatus);

/**
 * @route   POST /api/provisioning/retry/:id
 * @desc    Retry a failed provisioning task
 * @access  Admin
 * @param   id - Task ID or Job ID
 */
router.post('/retry/:id', requireAdmin, provisioningController.retryTask);

/**
 * @route   GET /api/provisioning/stats
 * @desc    Get provisioning queue and task statistics
 * @access  Admin
 */
router.get('/stats', requireAdmin, provisioningController.getStats);

/**
 * @route   GET /api/provisioning/failed
 * @desc    Get list of failed provisioning jobs
 * @access  Admin
 * @query   ?limit=50
 */
router.get('/failed', requireAdmin, provisioningController.getFailedJobs);

/**
 * @route   DELETE /api/provisioning/failed
 * @desc    Clear failed jobs queue
 * @access  Admin
 */
router.delete('/failed', requireAdmin, provisioningController.clearFailedJobs);

export default router;
