import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcrypt';
import pool from '../db/index.js';

const router = express.Router();

// Helper to check admin access
const isAdminRole = (role) => role === 'admin' || role === 'super_admin';

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, role } = req.user;
    
    console.log('GET /users - User:', { tenant_id, role, userId: req.user.userId });
    
    if (!isAdminRole(role)) {
      console.log('Access denied - role:', role);
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // If tenant_id is null (super admin), show all users. Otherwise filter by tenant.
    const query = tenant_id 
      ? `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at, email_verified
         FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`
      : `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at, email_verified
         FROM users ORDER BY created_at DESC`;
    
    const result = tenant_id ? await pool.query(query, [tenant_id]) : await pool.query(query);
    res.json({ success: true, users: result.rows, data: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single user by ID (admin only)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role } = req.user;
    
    if (!isAdminRole(role)) {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // Super admin can access any user, tenant admin only their tenant's users
    const query = tenant_id 
      ? `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at, email_verified
         FROM users WHERE id = $1 AND tenant_id = $2`
      : `SELECT id, email, first_name, last_name, role, status, created_at, updated_at, last_login_at, email_verified
         FROM users WHERE id = $1`;
    
    const result = tenant_id 
      ? await pool.query(query, [id, tenant_id])
      : await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new user (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { email, password, first_name, last_name, role = 'customer', status = 'active' } = req.body;
    const { tenant_id, role: userRole } = req.user;
    
    console.log('POST /users - User:', { tenant_id, userRole, userId: req.user.userId });
    console.log('POST /users - Body:', { email, first_name, last_name, role, status });
    
    if (!isAdminRole(userRole)) {
      console.log('Access denied - userRole:', userRole);
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }
    
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, first_name, last_name, role, status, created_at
    `;
    
    const result = await pool.query(query, [
      tenant_id,
      email,
      password_hash,
      first_name || null,
      last_name || null,
      role,
      status
    ]);
    
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, first_name, last_name, role, status, password } = req.body;
    const { tenant_id, role: userRole } = req.user;
    
    console.log('PUT /users/:id - Params:', { id });
    console.log('PUT /users/:id - Body:', { email, first_name, last_name, role, status });
    console.log('PUT /users/:id - User:', { tenant_id, userRole });
    
    if (!isAdminRole(userRole)) {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // Check if user exists - super admin can edit any user
    const checkQuery = tenant_id
      ? 'SELECT id, email FROM users WHERE id = $1 AND tenant_id = $2'
      : 'SELECT id, email FROM users WHERE id = $1';
    
    const checkResult = tenant_id
      ? await pool.query(checkQuery, [id, tenant_id])
      : await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (first_name !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(first_name || null);
    }
    if (last_name !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(last_name || null);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, role, status, created_at, updated_at
    `;
    
    console.log('PUT /users/:id - Query:', query);
    console.log('PUT /users/:id - Values:', values);
    
    const result = await pool.query(query, values);
    
    console.log('PUT /users/:id - Result:', result.rows[0]);
    
    res.json({ success: true, user: result.rows[0], message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user status (admin only) - convenience endpoint
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { tenant_id, role: userRole } = req.user;
    
    console.log('PATCH /users/:id/status - Params:', { id, status });
    
    if (!isAdminRole(userRole)) {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    if (!status || !['active', 'suspended', 'inactive', 'pending', 'deleted'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value' });
    }
    
    // Super admin can update any user's status
    const query = tenant_id
      ? `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3 RETURNING id, email, status`
      : `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, status`;
    
    const result = tenant_id
      ? await pool.query(query, [status, id, tenant_id])
      : await pool.query(query, [status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    res.json({ success: true, user: result.rows[0], message: `User status updated to ${status}` });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role, userId: currentUserId } = req.user;
    
    console.log('DELETE /users/:id - Params:', { id });
    console.log('DELETE /users/:id - User:', { tenant_id, role, currentUserId });
    
    if (!isAdminRole(role)) {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // Prevent deleting yourself
    if (id === currentUserId || id === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    // Check if user exists - super admin can delete any user
    const checkQuery = tenant_id
      ? 'SELECT id, email FROM users WHERE id = $1 AND tenant_id = $2'
      : 'SELECT id, email FROM users WHERE id = $1';
    
    const checkResult = tenant_id
      ? await pool.query(checkQuery, [id, tenant_id])
      : await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const deletedEmail = checkResult.rows[0].email;
    
    // Super admin can delete any user
    const deleteQuery = tenant_id
      ? 'DELETE FROM users WHERE id = $1 AND tenant_id = $2'
      : 'DELETE FROM users WHERE id = $1';
    
    await (tenant_id
      ? pool.query(deleteQuery, [id, tenant_id])
      : pool.query(deleteQuery, [id]));
    
    console.log('DELETE /users/:id - Deleted:', deletedEmail);
    
    res.json({ success: true, message: `User ${deletedEmail} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

