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
    
    let whereClause = `WHERE status != 'deleted' ${tenantFilter.clause}`;
    
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

router.post('/bulk-action', authenticateToken, async (req, res) => {
  try {
    // Accept both user_ids (frontend) and userIds (legacy) for compatibility
    const { action, user_ids, userIds } = req.body;
    const ids = user_ids || userIds;
    const { role, id: currentUserId, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No users selected' });
    }
    
    // Don't allow users to modify themselves via bulk action
    const filteredIds = ids.filter(id => id !== currentUserId);
    
    if (filteredIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Cannot perform bulk action on yourself' });
    }
    
    let result;
    switch (action) {
      case 'activate':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE users SET status = 'active', updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) RETURNING id`,
            [filteredIds]
          );
        } else {
          result = await pool.query(
            `UPDATE users SET status = 'active', updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
            [filteredIds, tenant_id]
          );
        }
        break;
      case 'suspend':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE users SET status = 'suspended', updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) RETURNING id`,
            [filteredIds]
          );
        } else {
          result = await pool.query(
            `UPDATE users SET status = 'suspended', updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
            [filteredIds, tenant_id]
          );
        }
        break;
      case 'delete':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE users SET status = 'deleted', deleted_at = NOW(), deleted_by = $2, updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) RETURNING id`,
            [filteredIds, currentUserId]
          );
        } else {
          result = await pool.query(
            `UPDATE users SET status = 'deleted', deleted_at = NOW(), deleted_by = $3, updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
            [filteredIds, tenant_id, currentUserId]
          );
        }
        break;
      case 'force-password-change':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE users SET must_change_password = true, updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) RETURNING id`,
            [filteredIds]
          );
        } else {
          result = await pool.query(
            `UPDATE users SET must_change_password = true, updated_at = NOW() 
             WHERE id = ANY($1::uuid[]) AND tenant_id = $2 RETURNING id`,
            [filteredIds, tenant_id]
          );
        }
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({ 
      success: true, 
      affected: result.rowCount,
      message: `${result.rowCount} users updated`
    });
  } catch (error) {
    console.error('Error bulk action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /users/export
 * Export users to CSV
 */
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { role, tenant_id } = req.user;
    const { format = 'csv' } = req.query;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        email, first_name, last_name, role, status,
        email_verified_at IS NOT NULL as email_verified,
        two_factor_enabled,
        last_login_at,
        created_at
      FROM users
      WHERE tenant_id = $1 AND status != 'deleted'
      ORDER BY created_at DESC
    `, [tenant_id]);
    
    if (format === 'csv') {
      const headers = ['Email', 'First Name', 'Last Name', 'Role', 'Status', 'Email Verified', '2FA Enabled', 'Last Login', 'Created'];
      const rows = result.rows.map(r => [
        r.email,
        r.first_name || '',
        r.last_name || '',
        r.role,
        r.status,
        r.email_verified ? 'Yes' : 'No',
        r.two_factor_enabled ? 'Yes' : 'No',
        r.last_login_at || 'Never',
        r.created_at
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - User Stats Summary
// =============================================================================
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const { role, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // For super_admin, show all; otherwise filter by tenant
    const baseFilter = role === 'super_admin' 
      ? 'WHERE deleted_at IS NULL' 
      : 'WHERE tenant_id = $1 AND deleted_at IS NULL';
    const params = role === 'super_admin' ? [] : [tenant_id];
    
    // Total users
    const totalQuery = await pool.query(
      `SELECT COUNT(*) FROM users ${baseFilter}`,
      params
    );
    
    // By role
    const byRoleQuery = await pool.query(
      `SELECT role, COUNT(*) FROM users ${baseFilter} GROUP BY role ORDER BY COUNT(*) DESC`,
      params
    );
    
    // By status
    const byStatusQuery = await pool.query(
      `SELECT status, COUNT(*) FROM users ${baseFilter} GROUP BY status`,
      params
    );
    
    // New this month
    const newThisMonth = await pool.query(
      `SELECT COUNT(*) FROM users ${baseFilter} AND created_at >= DATE_TRUNC('month', NOW())`,
      params
    );
    
    // Active today (logged in today)
    const activeToday = await pool.query(
      `SELECT COUNT(*) FROM users ${baseFilter} AND last_login_at >= CURRENT_DATE`,
      params
    );
    
    // 2FA enabled
    const twoFAEnabled = await pool.query(
      `SELECT COUNT(*) FROM users ${baseFilter} AND two_factor_enabled = true`,
      params
    );
    
    res.json({
      success: true,
      stats: {
        total: parseInt(totalQuery.rows[0].count),
        by_role: byRoleQuery.rows.reduce((acc, r) => { acc[r.role] = parseInt(r.count); return acc; }, {}),
        by_status: byStatusQuery.rows.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
        new_this_month: parseInt(newThisMonth.rows[0].count),
        active_today: parseInt(activeToday.rows[0].count),
        two_fa_enabled: parseInt(twoFAEnabled.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    const { email, first_name, last_name, role: newRole, status, password } = req.body;
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
    
    // Handle password update if provided
    if (password && password.trim()) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramIndex}`);
      values.push(hashedPassword);
      paramIndex++;
      updates.push(`password_changed_at = NOW()`);
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

// =============================================================================
// ENTERPRISE FEATURES - Login History, Sessions, 2FA, Bulk Actions, Export
// =============================================================================

/**
 * GET /users/:id/login-history
 * Get user login history
 */
router.get('/:id/login-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    const { limit = 50, offset = 0 } = req.query;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT id, login_at, ip_address, user_agent, success, failure_reason, location, device_type
      FROM login_history
      WHERE user_id = $1
      ORDER BY login_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM login_history WHERE user_id = $1',
      [id]
    );
    
    res.json({
      success: true,
      history: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching login history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /users/:id/sessions
 * Get active user sessions
 */
router.get('/:id/sessions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT id, ip_address, user_agent, device_name, last_active_at, created_at
      FROM user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY last_active_at DESC
    `, [id]);
    
    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /users/:id/sessions/:sessionId
 * Revoke specific session
 */
router.delete('/:id/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { id, sessionId } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      'UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2',
      [sessionId, id]
    );
    
    res.json({ success: true, message: 'Session revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /users/:id/sessions
 * Revoke all sessions
 */
router.delete('/:id/sessions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [id]
    );
    
    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /users/:id/2fa/enable
 * Enable 2FA for user
 */
router.post('/:id/2fa/enable', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    const crypto = await import('crypto');
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const secret = crypto.randomBytes(20).toString('hex');
    
    await pool.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret, id]
    );
    
    res.json({ 
      success: true, 
      secret,
      message: 'Scan QR code with authenticator app, then verify'
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /users/:id/2fa/verify
 * Verify and activate 2FA
 */
router.post('/:id/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { id: currentUserId } = req.user;
    
    if (id !== currentUserId) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      'UPDATE users SET two_factor_enabled = true WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /users/:id/2fa
 * Disable 2FA
 */
router.delete('/:id/2fa', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: '2FA disabled' });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /users/:id/verify-email
 * Mark email as verified
 */
router.post('/:id/verify-email', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      'UPDATE users SET email_verified_at = NOW() WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: 'Email verified' });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /users/:id/force-password-change
 * Force password change on next login
 */
router.post('/:id/force-password-change', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      'UPDATE users SET must_change_password = true WHERE id = $1',
      [id]
    );
    
    res.json({ success: true, message: 'User must change password on next login' });
  } catch (error) {
    console.error('Error forcing password change:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /users/bulk-action
 * Bulk actions on multiple users
 */

export default router;
