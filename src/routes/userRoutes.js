import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import bcrypt from 'bcrypt';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, role } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    const query = `
      SELECT id, email, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE tenant_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [tenant_id]);
    res.json({ success: true, users: result.rows });
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
    
    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    const query = `
      SELECT id, email, first_name, last_name, role, status, created_at, updated_at
      FROM users
      WHERE id = $1 AND tenant_id = $2
    `;
    
    const result = await pool.query(query, [id, tenant_id]);
    
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
    const { email, password, first_name, last_name, role = 'customer' } = req.body;
    const { tenant_id, role: userRole } = req.user;
    
    if (userRole !== 'admin') {
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
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING id, email, first_name, last_name, role, status, created_at
    `;
    
    const result = await pool.query(query, [
      tenant_id,
      email,
      password_hash,
      first_name || null,
      last_name || null,
      role
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
    const { email, first_name, last_name, role } = req.body;
    const { tenant_id, role: userRole } = req.user;
    
    if (userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // Check if user exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const query = `
      UPDATE users 
      SET email = $1, first_name = $2, last_name = $3, role = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND tenant_id = $6
      RETURNING id, email, first_name, last_name, role, status, created_at, updated_at
    `;
    
    const result = await pool.query(query, [
      email,
      first_name || null,
      last_name || null,
      role,
      id,
      tenant_id
    ]);
    
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role, id: currentUserId } = req.user;
    
    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
    }
    
    // Prevent deleting yourself
    if (id === currentUserId) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }
    
    // Check if user exists
    const checkResult = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    await pool.query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [id, tenant_id]);
    
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
