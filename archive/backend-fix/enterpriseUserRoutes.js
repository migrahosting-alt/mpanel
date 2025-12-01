import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/index.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const router = express.Router();

// =============================================================================
// ENTERPRISE USER ROUTES - Additional endpoints
// =============================================================================

const ROLE_HIERARCHY = {
  super_admin: 0, admin: 1, manager: 2, editor: 3, 
  sales: 4, support: 5, billing: 7, customer: 10
};

const hasRoleLevel = (userRole, requiredLevel) => {
  return (ROLE_HIERARCHY[userRole] ?? 99) <= requiredLevel;
};

// =============================================================================
// GET /users/:id/login-history - Get user login history
// =============================================================================
router.get('/:id/login-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id } = req.user;
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

// =============================================================================
// GET /users/:id/sessions - Get active user sessions
// =============================================================================
router.get('/:id/sessions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    // Users can view their own sessions, admins can view any
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT id, ip_address, user_agent, device_name, last_active_at, created_at,
             CASE WHEN id = $2 THEN true ELSE false END as is_current
      FROM user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
      ORDER BY last_active_at DESC
    `, [id, req.sessionId || '']);
    
    res.json({ success: true, sessions: result.rows });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DELETE /users/:id/sessions/:sessionId - Revoke specific session
// =============================================================================
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

// =============================================================================
// DELETE /users/:id/sessions - Revoke all sessions (except current)
// =============================================================================
router.delete('/:id/sessions', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    await pool.query(
      `UPDATE user_sessions SET revoked_at = NOW() 
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [id]
    );
    
    res.json({ success: true, message: 'All sessions revoked' });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /users/:id/2fa/enable - Enable 2FA
// =============================================================================
router.post('/:id/2fa/enable', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user;
    
    if (id !== currentUserId && !hasRoleLevel(role, ROLE_HIERARCHY.admin)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // Generate secret
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

// =============================================================================
// POST /users/:id/2fa/verify - Verify and activate 2FA
// =============================================================================
router.post('/:id/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const { id: currentUserId } = req.user;
    
    if (id !== currentUserId) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // In production, verify TOTP code here
    // For now, just enable it
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

// =============================================================================
// DELETE /users/:id/2fa - Disable 2FA
// =============================================================================
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

// =============================================================================
// POST /users/:id/verify-email - Send verification email
// =============================================================================
router.post('/:id/verify-email', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // Mark as verified (in production, send email first)
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

// =============================================================================
// POST /users/:id/force-password-change - Force password change on next login
// =============================================================================
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

// =============================================================================
// POST /users/bulk-action - Bulk actions on users
// =============================================================================
router.post('/bulk-action', authenticateToken, async (req, res) => {
  try {
    const { action, userIds } = req.body;
    const { role, id: currentUserId, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No users selected' });
    }
    
    // Prevent self-action
    const filteredIds = userIds.filter(id => id !== currentUserId);
    
    let result;
    switch (action) {
      case 'activate':
        result = await pool.query(
          `UPDATE users SET status = 'active', updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [filteredIds, tenant_id]
        );
        break;
      case 'suspend':
        result = await pool.query(
          `UPDATE users SET status = 'suspended', updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [filteredIds, tenant_id]
        );
        break;
      case 'delete':
        result = await pool.query(
          `UPDATE users SET status = 'deleted', deleted_at = NOW(), deleted_by = $3, updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [filteredIds, tenant_id, currentUserId]
        );
        break;
      case 'force-password-change':
        result = await pool.query(
          `UPDATE users SET must_change_password = true, updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [filteredIds, tenant_id]
        );
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({ 
      success: true, 
      affected: result.rowCount,
      message: `${result.rowCount} users ${action}d`
    });
  } catch (error) {
    console.error('Error bulk action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /users/export - Export users to CSV
// =============================================================================
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

export default router;
