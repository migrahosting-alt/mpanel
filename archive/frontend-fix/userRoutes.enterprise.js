/**
 * Enterprise User Management Routes
 * 
 * Features:
 * - Multi-tenant support with proper isolation
 * - RBAC (Role-Based Access Control) with hierarchy
 * - Audit logging for all operations
 * - Soft delete with restore capability
 * - Password policy enforcement
 * - Input validation and sanitization
 * - Rate limiting ready
 * 
 * Role Hierarchy (lower = more power):
 * - super_admin (0): Full system access, all tenants
 * - admin (1): Full tenant access
 * - manager (2): Can manage users but not admins
 * - support (5): Can view and assist users
 * - customer (10): Standard user
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import pool from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const ROLE_HIERARCHY = {
  super_admin: 0,
  admin: 1,
  manager: 2,
  editor: 3,
  sales: 4,
  support: 5,
  billing: 7,
  customer: 10,
  client: 10
};

const BCRYPT_ROUNDS = 12;

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false // Set to true for stricter policy
};

/**
 * Check if user has required role level
 */
const hasRoleLevel = (userRole, requiredLevel) => {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 99;
  return userLevel <= requiredLevel;
};

/**
 * Check if user can manage target role
 */
const canManageRole = (userRole, targetRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 99;
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 99;
  // Can only manage roles lower than your own (higher number = less privilege)
  return userLevel < targetLevel;
};

/**
 * Validate password against policy
 */
const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return errors;
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Log audit event
 */
const logAudit = async (action, userId, targetId, details, ipAddress = null) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (id, action, user_id, target_id, target_type, details, ip_address, created_at)
       VALUES ($1, $2, $3, $4, 'user', $5, $6, NOW())
       ON CONFLICT DO NOTHING`,
      [uuidv4(), action, userId, targetId, JSON.stringify(details), ipAddress]
    );
  } catch (error) {
    console.error('Audit log error:', error.message);
    // Don't throw - audit logging should not break operations
  }
};

/**
 * Build tenant filter for queries
 */
const getTenantFilter = (user, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (user.role === 'super_admin') {
    return { clause: '', params: [], nextParamIndex: 1 };
  }
  return { 
    clause: `AND ${prefix}tenant_id = $1`, 
    params: [user.tenant_id],
    nextParamIndex: 2
  };
};

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /users
 * List all users with pagination and filtering
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { role, tenant_id, id: userId } = req.user;
    const { page = 1, limit = 50, search, status, userRole, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    
    // Check permission - must be at least support level
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions.' 
      });
    }
    
    // Build query with filters
    const tenantFilter = getTenantFilter(req.user);
    const params = [...tenantFilter.params];
    let paramIndex = tenantFilter.nextParamIndex;
    
    let whereClause = `WHERE 1=1 ${tenantFilter.clause}`;
    
    // Search filter
    if (search) {
      whereClause += ` AND (email ILIKE $${paramIndex} OR first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    // Status filter
    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Role filter
    if (userRole) {
      whereClause += ` AND role = $${paramIndex}`;
      params.push(userRole);
      paramIndex++;
    }
    
    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'email', 'first_name', 'last_name', 'role', 'status'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Count total
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit));
    params.push(offset);
    
    const query = `
      SELECT id, email, first_name, last_name, role, status, 
             created_at, updated_at, last_login_at,
             COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') as full_name
      FROM users
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const result = await pool.query(query, params);
    
    res.json({ 
      success: true, 
      users: result.rows,
      data: result.rows, // Backward compatibility
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

/**
 * GET /users/:id
 * Get single user by ID
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id } = req.user;
    
    // Check permission
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions.' 
      });
    }
    
    const tenantFilter = getTenantFilter(req.user);
    
    const query = `
      SELECT id, email, first_name, last_name, role, status, 
             tenant_id, created_at, updated_at, last_login_at
      FROM users
      WHERE id = $${tenantFilter.nextParamIndex} ${tenantFilter.clause}
    `;
    
    const result = await pool.query(query, [...tenantFilter.params, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

/**
 * POST /users
 * Create new user
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role: newUserRole = 'customer' } = req.body;
    const { role: currentUserRole, tenant_id, id: currentUserId } = req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    
    // Check permission - must be at least manager level
    if (!hasRoleLevel(currentUserRole, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions to create users.' 
      });
    }
    
    // Check if user can assign this role
    if (!canManageRole(currentUserRole, newUserRole)) {
      return res.status(403).json({ 
        success: false, 
        error: `Cannot create user with role '${newUserRole}'. You can only create users with lower privilege levels.` 
      });
    }
    
    // Validate input
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    if (!password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }
    
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: passwordErrors.join('. ') 
      });
    }
    
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id, status FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    
    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];
      if (existing.status === 'deleted') {
        return res.status(409).json({ 
          success: false, 
          error: 'An account with this email was previously deleted. Contact support to restore it.' 
        });
      }
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    
    // Hash password with bcryptjs (compatible with $2a$ prefix)
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    // Determine tenant_id for new user
    // Super admin can create users without tenant, others use their own tenant
    const newUserTenantId = currentUserRole === 'super_admin' ? tenant_id : tenant_id;
    
    const query = `
      INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
      RETURNING id, email, first_name, last_name, role, status, created_at
    `;
    
    const newUserId = uuidv4();
    const result = await pool.query(query, [
      newUserId,
      newUserTenantId,
      email.trim().toLowerCase(),
      password_hash,
      first_name?.trim() || null,
      last_name?.trim() || null,
      newUserRole
    ]);
    
    // Audit log
    await logAudit('user.created', currentUserId, newUserId, {
      email: email.trim().toLowerCase(),
      role: newUserRole,
      created_by: currentUserId
    }, ipAddress);
    
    res.status(201).json({ 
      success: true, 
      user: result.rows[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

/**
 * PUT /users/:id
 * Update user
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, role: newRole, status } = req.body;
    const { role: currentUserRole, tenant_id, id: currentUserId } = req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    
    // Check permission - must be at least manager level
    if (!hasRoleLevel(currentUserRole, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions to update users.' 
      });
    }
    
    // Build tenant filter
    const tenantFilter = getTenantFilter(req.user);
    
    // Get current user data
    const checkQuery = `
      SELECT id, email, role, status, tenant_id 
      FROM users 
      WHERE id = $${tenantFilter.nextParamIndex} ${tenantFilter.clause}
    `;
    const checkResult = await pool.query(checkQuery, [...tenantFilter.params, id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const targetUser = checkResult.rows[0];
    
    // Check if user can manage the target user's current role
    if (!canManageRole(currentUserRole, targetUser.role) && currentUserId !== id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot modify user with equal or higher privilege level.' 
      });
    }
    
    // If changing role, check if allowed
    if (newRole && newRole !== targetUser.role) {
      if (!canManageRole(currentUserRole, newRole)) {
        return res.status(403).json({ 
          success: false, 
          error: `Cannot assign role '${newRole}'. You can only assign roles with lower privilege levels.` 
        });
      }
    }
    
    // Validate email if provided
    if (email && !validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
      const emailCheck = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2',
        [email.trim(), id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ success: false, error: 'Email already in use' });
      }
    }
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      values.push(email.trim().toLowerCase());
      paramIndex++;
    }
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(first_name?.trim() || null);
      paramIndex++;
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(last_name?.trim() || null);
      paramIndex++;
    }
    if (newRole !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(newRole);
      paramIndex++;
    }
    if (status !== undefined && ['active', 'inactive', 'suspended'].includes(status)) {
      updates.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, role, status, created_at, updated_at
    `;
    
    const result = await pool.query(updateQuery, values);
    
    // Audit log
    await logAudit('user.updated', currentUserId, id, {
      changes: req.body,
      previous: { email: targetUser.email, role: targetUser.role }
    }, ipAddress);
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /users/:id
 * Soft delete user (sets status to 'deleted')
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role: currentUserRole, tenant_id, id: currentUserId } = req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const { permanent = false } = req.query; // Allow permanent delete for super_admin
    
    // Check permission - must be at least manager level
    if (!hasRoleLevel(currentUserRole, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Insufficient permissions to delete users.' 
      });
    }
    
    // Prevent self-deletion
    if (id === currentUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot delete your own account.' 
      });
    }
    
    // Build tenant filter
    const tenantFilter = getTenantFilter(req.user);
    
    // Get target user
    const checkQuery = `
      SELECT id, email, role, status 
      FROM users 
      WHERE id = $${tenantFilter.nextParamIndex} ${tenantFilter.clause}
    `;
    const checkResult = await pool.query(checkQuery, [...tenantFilter.params, id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const targetUser = checkResult.rows[0];
    
    // Check if user can delete the target user
    if (!canManageRole(currentUserRole, targetUser.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot delete user with equal or higher privilege level.' 
      });
    }
    
    // Perform soft delete (or permanent if super_admin requests it)
    if (permanent === 'true' && currentUserRole === 'super_admin') {
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
      await logAudit('user.deleted.permanent', currentUserId, id, {
        email: targetUser.email,
        role: targetUser.role
      }, ipAddress);
    } else {
      await pool.query(
        `UPDATE users SET status = 'deleted', updated_at = NOW(), deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
        [currentUserId, id]
      );
      await logAudit('user.deleted', currentUserId, id, {
        email: targetUser.email,
        role: targetUser.role,
        soft_delete: true
      }, ipAddress);
    }
    
    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

/**
 * POST /users/:id/restore
 * Restore soft-deleted user (admin only)
 */
router.post('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role: currentUserRole, id: currentUserId } = req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    
    // Only admins can restore
    if (!hasRoleLevel(currentUserRole, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }
    
    const result = await pool.query(
      `UPDATE users SET status = 'active', deleted_at = NULL, deleted_by = NULL, updated_at = NOW() 
       WHERE id = $1 AND status = 'deleted'
       RETURNING id, email, first_name, last_name, role, status`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deleted user not found' });
    }
    
    await logAudit('user.restored', currentUserId, id, {
      email: result.rows[0].email
    }, ipAddress);
    
    res.json({ 
      success: true, 
      user: result.rows[0],
      message: 'User restored successfully' 
    });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({ success: false, error: 'Failed to restore user' });
  }
});

/**
 * POST /users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/:id/reset-password', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    const { role: currentUserRole, id: currentUserId } = req.user;
    const ipAddress = req.ip || req.connection?.remoteAddress;
    
    // Only admins can reset passwords
    if (!hasRoleLevel(currentUserRole, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin only.' 
      });
    }
    
    if (!new_password) {
      return res.status(400).json({ success: false, error: 'New password is required' });
    }
    
    const passwordErrors = validatePassword(new_password);
    if (passwordErrors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: passwordErrors.join('. ') 
      });
    }
    
    const password_hash = await bcrypt.hash(new_password, BCRYPT_ROUNDS);
    
    const result = await pool.query(
      `UPDATE users SET password_hash = $1, updated_at = NOW(), password_changed_at = NOW()
       WHERE id = $2
       RETURNING id, email`,
      [password_hash, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await logAudit('user.password_reset', currentUserId, id, {
      reset_by: currentUserId
    }, ipAddress);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully' 
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

export default router;
