/**
 * Users Router - Tenant user management endpoints
 */

import express from 'express';
import * as usersController from './users.controller.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantRole } from '../../middleware/rbac.middleware.js';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authMiddleware);

/**
 * GET /api/users
 * List users in current tenant
 * RBAC: OWNER, ADMIN, BILLING (read-only)
 */
router.get(
  '/',
  requireTenantRole(['OWNER', 'ADMIN', 'BILLING']),
  usersController.listUsers
);

/**
 * GET /api/users/:id
 * Get user details (tenant-scoped)
 * RBAC: OWNER, ADMIN, BILLING
 */
router.get(
  '/:id',
  requireTenantRole(['OWNER', 'ADMIN', 'BILLING']),
  usersController.getUser
);

/**
 * POST /api/users/invite
 * Invite user to tenant
 * RBAC: OWNER, ADMIN only
 */
router.post(
  '/invite',
  requireTenantRole(['OWNER', 'ADMIN']),
  usersController.inviteUser
);

/**
 * PATCH /api/users/:id/role
 * Change user role
 * RBAC: OWNER, ADMIN
 */
router.patch(
  '/:id/role',
  requireTenantRole(['OWNER', 'ADMIN']),
  usersController.changeUserRole
);

/**
 * POST /api/users/:id/suspend
 * Suspend user
 * RBAC: OWNER, ADMIN
 */
router.post(
  '/:id/suspend',
  requireTenantRole(['OWNER', 'ADMIN']),
  usersController.suspendUser
);

/**
 * POST /api/users/:id/reactivate
 * Reactivate suspended user
 * RBAC: OWNER, ADMIN
 */
router.post(
  '/:id/reactivate',
  requireTenantRole(['OWNER', 'ADMIN']),
  usersController.reactivateUser
);

export default router;
