/**
 * Users Controller - Tenant-scoped user management
 * Enterprise Multi-Tenant Admin Module
 */

import { Request, Response } from 'express';
import * as userService from './userService.js';
import * as tenantService from '../tenants/tenantService.js';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';

// Type for authenticated request
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

/**
 * GET /api/users - List users in current tenant
 * RBAC: OWNER, ADMIN, BILLING (read-only)
 */
export async function listUsers(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;

    const { page, pageSize, search, role } = req.query;

    const result = await userService.listUsersForTenant(tenantId, actorUserId, {
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
      search: search as string,
      role: role as string,
    });

    return res.json({
      success: true,
      data: result.users,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (pageSize ? parseInt(pageSize as string) : 50)),
      },
    });
  } catch (error) {
    logger.error('Error listing users', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list users',
    });
  }
}

/**
 * GET /api/users/:id - Get user details (tenant-scoped)
 * RBAC: OWNER, ADMIN, BILLING
 */
export async function getUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;
    const userId = req.params.id;

    const user = await userService.getUserForTenant(tenantId, userId, actorUserId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found in this tenant',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error getting user', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get user',
    });
  }
}

/**
 * POST /api/users/invite - Invite user to tenant
 * RBAC: OWNER, ADMIN only
 */
export async function inviteUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;
    const actorRole = req.user!.role;

    // Only OWNER and ADMIN can invite
    if (!['OWNER', 'ADMIN'].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only OWNER or ADMIN can invite users',
      });
    }

    const { email, name, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email and role are required',
      });
    }

    // Validate role
    const validRoles = ['OWNER', 'ADMIN', 'BILLING', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Get or create user
    const user = await userService.getOrCreateUserForEmail(email, {
      name,
      source: 'admin_invite',
      status: 'PENDING_VERIFICATION',
    });

    // Check if already member
    const existing = await userService.userBelongsToTenant(user.id, tenantId);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'User is already a member of this tenant',
      });
    }

    // Add to tenant
    const membership = await tenantService.addUserToTenant({
      userId: user.id,
      tenantId,
      role,
    });

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'TENANT_USER_INVITED',
      metadata: {
        invitedUserId: user.id,
        invitedEmail: email,
        role,
      },
    });

    logger.info('User invited to tenant', {
      tenantId,
      userId: user.id,
      email,
      role,
      actorUserId,
    });

    return res.status(201).json({
      success: true,
      data: {
        ...user,
        tenantRole: role,
        joinedAt: membership.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error inviting user', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to invite user',
    });
  }
}

/**
 * PATCH /api/users/:id/role - Change user role
 * RBAC: OWNER, ADMIN (OWNER can demote ADMIN, but at least one OWNER must remain)
 */
export async function changeUserRole(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;
    const actorRole = req.user!.role;
    const userId = req.params.id;
    const { role } = req.body;

    // Only OWNER and ADMIN can change roles
    if (!['OWNER', 'ADMIN'].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only OWNER or ADMIN can change roles',
      });
    }

    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required',
      });
    }

    const validRoles = ['OWNER', 'ADMIN', 'BILLING', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Verify user is in tenant
    const user = await userService.getUserForTenant(tenantId, userId, actorUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found in this tenant',
      });
    }

    // If demoting from OWNER, ensure at least one OWNER remains
    if (user.tenantRole === 'OWNER' && role !== 'OWNER') {
      const owners = await tenantService.getTenantUsersByRole(tenantId, 'OWNER');
      if (owners.length <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot remove the last OWNER. Assign another OWNER first.',
        });
      }
    }

    // Update role
    await tenantService.updateUserRole(tenantId, userId, role);

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'TENANT_USER_ROLE_CHANGED',
      metadata: {
        targetUserId: userId,
        oldRole: user.tenantRole,
        newRole: role,
      },
    });

    logger.info('User role changed', {
      tenantId,
      userId,
      oldRole: user.tenantRole,
      newRole: role,
      actorUserId,
    });

    return res.json({
      success: true,
      data: {
        ...user,
        tenantRole: role,
      },
    });
  } catch (error) {
    logger.error('Error changing user role', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to change user role',
    });
  }
}

/**
 * POST /api/users/:id/suspend - Suspend user
 * RBAC: OWNER, ADMIN
 */
export async function suspendUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;
    const actorRole = req.user!.role;
    const userId = req.params.id;

    // Only OWNER and ADMIN can suspend
    if (!['OWNER', 'ADMIN'].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only OWNER or ADMIN can suspend users',
      });
    }

    // Verify user is in tenant
    const user = await userService.getUserForTenant(tenantId, userId, actorUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found in this tenant',
      });
    }

    // Cannot suspend yourself
    if (userId === actorUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot suspend yourself',
      });
    }

    // Suspend via user service
    await userService.updateUser(userId, { status: 'SUSPENDED' }, actorUserId);

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'TENANT_USER_SUSPENDED',
      metadata: {
        suspendedUserId: userId,
        suspendedEmail: user.email,
      },
    });

    logger.info('User suspended', { tenantId, userId, actorUserId });

    return res.json({
      success: true,
      message: 'User suspended successfully',
    });
  } catch (error) {
    logger.error('Error suspending user', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to suspend user',
    });
  }
}

/**
 * POST /api/users/:id/reactivate - Reactivate suspended user
 * RBAC: OWNER, ADMIN
 */
export async function reactivateUser(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;
    const actorRole = req.user!.role;
    const userId = req.params.id;

    // Only OWNER and ADMIN can reactivate
    if (!['OWNER', 'ADMIN'].includes(actorRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only OWNER or ADMIN can reactivate users',
      });
    }

    // Verify user is in tenant
    const user = await userService.getUserForTenant(tenantId, userId, actorUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found in this tenant',
      });
    }

    // Reactivate
    await userService.updateUser(userId, { status: 'ACTIVE' }, actorUserId);

    // Audit
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'TENANT_USER_REACTIVATED',
      metadata: {
        reactivatedUserId: userId,
        reactivatedEmail: user.email,
      },
    });

    logger.info('User reactivated', { tenantId, userId, actorUserId });

    return res.json({
      success: true,
      message: 'User reactivated successfully',
    });
  } catch (error) {
    logger.error('Error reactivating user', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to reactivate user',
    });
  }
}

export default {
  listUsers,
  getUser,
  inviteUser,
  changeUserRole,
  suspendUser,
  reactivateUser,
};
