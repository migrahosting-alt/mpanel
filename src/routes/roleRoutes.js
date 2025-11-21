import express from 'express';
import * as roleController from '../controllers/roleController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission, requireSuperAdmin } from '../middleware/authorization.js';

const router = express.Router();

// All role routes require authentication
router.use(authenticateToken);

/**
 * Get all roles
 * Requires: roles.read permission
 */
router.get(
  '/',
  requirePermission('roles.read'),
  roleController.getAllRoles
);

/**
 * Get all permissions
 * Requires: roles.read permission
 */
router.get(
  '/permissions/all',
  requirePermission('roles.read'),
  roleController.getAllPermissions
);

/**
 * Get role by ID
 * Requires: roles.read permission
 */
router.get(
  '/:id',
  requirePermission('roles.read'),
  roleController.getRoleById
);

/**
 * Create role
 * Requires: Super Admin only
 */
router.post(
  '/',
  requireSuperAdmin,
  roleController.createRole
);

/**
 * Update role
 * Requires: Super Admin only
 */
router.put(
  '/:id',
  requireSuperAdmin,
  roleController.updateRole
);

/**
 * Delete role
 * Requires: Super Admin only
 */
router.delete(
  '/:id',
  requireSuperAdmin,
  roleController.deleteRole
);

/**
 * Assign permissions to role
 * Requires: roles.assign_permissions permission
 */
router.put(
  '/:id/permissions',
  requirePermission('roles.assign_permissions'),
  roleController.assignPermissions
);

/**
 * Assign role to user
 * Requires: users.manage_roles permission
 */
router.put(
  '/:id/assign',
  requirePermission('users.manage_roles'),
  roleController.assignRoleToUser
);

/**
 * Get users by role
 * Requires: users.read permission
 */
router.get(
  '/:id/users',
  requirePermission('users.read'),
  roleController.getUsersByRole
);

export default router;

