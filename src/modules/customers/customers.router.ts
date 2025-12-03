/**
 * Customers Router - Platform customer management
 */

import express from 'express';
import * as customersController from './customers.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';

const router = express.Router();

// All routes require authentication + platform permission
router.use(authMiddleware);
router.use(requirePlatformPermission('platform:customers:read'));

/**
 * GET /api/platform/customers
 * List all customers
 */
router.get('/', customersController.listCustomers);

/**
 * GET /api/platform/customers/:tenantId
 * Get customer overview
 */
router.get('/:tenantId', customersController.getCustomerOverview);

export default router;
