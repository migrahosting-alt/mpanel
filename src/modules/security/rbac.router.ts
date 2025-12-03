import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';
import * as controller from './rbac.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requirePlatformPermission());

// List roles
router.get('/roles', controller.listRoles);

// Get role
router.get('/roles/:id', controller.getRole);

// Create role
router.post('/roles', controller.createRole);

// Update role
router.patch('/roles/:id', controller.updateRole);

// Delete role
router.delete('/roles/:id', controller.deleteRole);

// List permissions
router.get('/permissions', controller.listPermissions);

// Role assignments
router.get('/roles/:id/users', controller.getRoleUsers);

export default router;
