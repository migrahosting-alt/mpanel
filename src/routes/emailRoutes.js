import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get all email accounts for authenticated user
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      query = `
        SELECT e.*, d.domain_name
        FROM email_accounts e
        LEFT JOIN domains d ON e.domain_id = d.id
        ORDER BY e.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT e.*, d.domain_name
        FROM email_accounts e
        LEFT JOIN domains d ON e.domain_id = d.id
        WHERE e.tenant_id = $1
        ORDER BY e.created_at DESC
      `;
      params = [tenant_id];
    }
    
    const result = await pool.query(query, params);
    
    // Don't send password hashes to client
    const accounts = result.rows.map(({ password_hash, ...account }) => account);
    
    res.json({ success: true, accounts });
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email account
router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const { email_address, password, domain_id, quota_mb = 1024 } = req.body;
    const { tenant_id, id: user_id } = req.user;
    
    if (!email_address || !password || !domain_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email address, password, and domain are required' 
      });
    }
    
    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM email_accounts WHERE email_address = $1',
      [email_address]
    );
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Email address already exists' });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    const query = `
      INSERT INTO email_accounts (
        tenant_id, domain_id, email_address, password_hash, quota_mb, status
      ) VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id, tenant_id, domain_id, email_address, quota_mb, usage_mb, status, 
                spam_filter_enabled, created_at
    `;
    
    const result = await pool.query(query, [
      tenant_id, domain_id, email_address, password_hash, quota_mb
    ]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'create_email_account', 'email_account', $3, $4)`,
      [tenant_id, user_id, result.rows[0].id, JSON.stringify({ email_address })]
    );
    
    res.status(201).json({ success: true, account: result.rows[0] });
  } catch (error) {
    console.error('Error creating email account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update email account
router.put('/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: user_id, role } = req.user;
    const { 
      password, quota_mb, spam_filter_enabled, spam_threshold,
      auto_responder_enabled, auto_responder_subject, auto_responder_message, status
    } = req.body;
    
    // Check ownership
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM email_accounts WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM email_accounts WHERE id = $1 AND tenant_id = $2';
      checkParams = [id, tenant_id];
    }
    
    const accountCheck = await pool.query(checkQuery, checkParams);
    
    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email account not found' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${paramCount++}`);
      values.push(password_hash);
    }
    
    if (quota_mb !== undefined) {
      updates.push(`quota_mb = $${paramCount++}`);
      values.push(quota_mb);
    }
    
    if (spam_filter_enabled !== undefined) {
      updates.push(`spam_filter_enabled = $${paramCount++}`);
      values.push(spam_filter_enabled);
    }
    
    if (spam_threshold !== undefined) {
      updates.push(`spam_threshold = $${paramCount++}`);
      values.push(spam_threshold);
    }
    
    if (auto_responder_enabled !== undefined) {
      updates.push(`auto_responder_enabled = $${paramCount++}`);
      values.push(auto_responder_enabled);
    }
    
    if (auto_responder_subject !== undefined) {
      updates.push(`auto_responder_subject = $${paramCount++}`);
      values.push(auto_responder_subject);
    }
    
    if (auto_responder_message !== undefined) {
      updates.push(`auto_responder_message = $${paramCount++}`);
      values.push(auto_responder_message);
    }
    
    if (status !== undefined && role === 'admin') {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE email_accounts 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, tenant_id, domain_id, email_address, quota_mb, usage_mb, status,
                spam_filter_enabled, spam_threshold, auto_responder_enabled, created_at
    `;
    
    const result = await pool.query(query, values);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'update_email_account', 'email_account', $3, $4)`,
      [tenant_id, user_id, id, JSON.stringify({ ...req.body, password: password ? '***' : undefined })]
    );
    
    res.json({ success: true, account: result.rows[0] });
  } catch (error) {
    console.error('Error updating email account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email account
router.delete('/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: user_id, role } = req.user;
    
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM email_accounts WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM email_accounts WHERE id = $1 AND tenant_id = $2';
      checkParams = [id, tenant_id];
    }
    
    const accountCheck = await pool.query(checkQuery, checkParams);
    
    if (accountCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email account not found' });
    }
    
    const account = accountCheck.rows[0];
    
    await pool.query('DELETE FROM email_accounts WHERE id = $1', [id]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'delete_email_account', 'email_account', $3, $4)`,
      [tenant_id, user_id, id, JSON.stringify({ email_address: account.email_address })]
    );
    
    res.json({ success: true, message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all email forwarders
router.get('/forwarders', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      query = `
        SELECT f.*, d.domain_name
        FROM email_forwarders f
        LEFT JOIN domains d ON f.domain_id = d.id
        ORDER BY f.created_at DESC
      `;
      params = [];
    } else {
      query = `
        SELECT f.*, d.domain_name
        FROM email_forwarders f
        LEFT JOIN domains d ON f.domain_id = d.id
        WHERE f.tenant_id = $1
        ORDER BY f.created_at DESC
      `;
      params = [tenant_id];
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, forwarders: result.rows });
  } catch (error) {
    console.error('Error fetching email forwarders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create email forwarder
router.post('/forwarders', authenticateToken, async (req, res) => {
  try {
    const { source_address, destination_address, domain_id } = req.body;
    const { tenant_id, id: user_id } = req.user;
    
    if (!source_address || !destination_address || !domain_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Source address, destination address, and domain are required' 
      });
    }
    
    const query = `
      INSERT INTO email_forwarders (
        tenant_id, domain_id, source_address, destination_address, status
      ) VALUES ($1, $2, $3, $4, 'active')
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      tenant_id, domain_id, source_address, destination_address
    ]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'create_email_forwarder', 'email_forwarder', $3, $4)`,
      [tenant_id, user_id, result.rows[0].id, JSON.stringify({ source_address, destination_address })]
    );
    
    res.status(201).json({ success: true, forwarder: result.rows[0] });
  } catch (error) {
    console.error('Error creating email forwarder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete email forwarder
router.delete('/forwarders/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: user_id, role } = req.user;
    
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM email_forwarders WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM email_forwarders WHERE id = $1 AND tenant_id = $2';
      checkParams = [id, tenant_id];
    }
    
    const forwarderCheck = await pool.query(checkQuery, checkParams);
    
    if (forwarderCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Email forwarder not found' });
    }
    
    const forwarder = forwarderCheck.rows[0];
    
    await pool.query('DELETE FROM email_forwarders WHERE id = $1', [id]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'delete_email_forwarder', 'email_forwarder', $3, $4)`,
      [tenant_id, user_id, id, JSON.stringify({ source_address: forwarder.source_address })]
    );
    
    res.json({ success: true, message: 'Email forwarder deleted successfully' });
  } catch (error) {
    console.error('Error deleting email forwarder:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


