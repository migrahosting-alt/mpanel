import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Get all customers for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { id: user_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      // Admins see all customers
      query = `
        SELECT c.*, u.email, u.first_name, u.last_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.created_at DESC
      `;
      params = [];
    } else {
      // Regular users see only their customers
      query = `
        SELECT c.*, u.email, u.first_name, u.last_name
        FROM customers c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.user_id = $1
        ORDER BY c.created_at DESC
      `;
      params = [user_id];
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single customer by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { id: user_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      query = 'SELECT c.*, u.email, u.first_name, u.last_name FROM customers c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = $1';
      params = [id];
    } else {
      query = 'SELECT c.*, u.email, u.first_name, u.last_name FROM customers c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = $1 AND c.user_id = $2';
      params = [id, user_id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new customer
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { company_name, email, phone, country, city } = req.body;
    const { tenant_id, id: user_id } = req.user;
    
    if (!company_name || !email) {
      return res.status(400).json({ success: false, error: 'Company name and email are required' });
    }
    
    const query = `
      INSERT INTO customers (tenant_id, user_id, company_name, email, phone, country, city, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      tenant_id,
      user_id,
      company_name,
      email,
      phone || null,
      country || null,
      city || null
    ]);
    
    res.status(201).json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update customer
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, email, phone, country, city } = req.body;
    const { id: user_id, role, tenant_id } = req.user;
    
    // Check ownership
    let checkQuery;
    let checkParams;
    if (role === 'admin') {
      checkQuery = 'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2';
      checkParams = [id, tenant_id];
    } else {
      checkQuery = 'SELECT id FROM customers WHERE id = $1 AND user_id = $2 AND tenant_id = $3';
      checkParams = [id, user_id, tenant_id];
    }
    
    const checkResult = await pool.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found or access denied' });
    }
    
    const query = `
      UPDATE customers 
      SET company_name = $1, email = $2, phone = $3, country = $4, city = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      company_name,
      email,
      phone || null,
      country || null,
      city || null,
      id
    ]);
    
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { id: user_id, role, tenant_id } = req.user;
    
    // Check ownership
    let checkQuery;
    let checkParams;
    if (role === 'admin') {
      checkQuery = 'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2';
      checkParams = [id, tenant_id];
    } else {
      checkQuery = 'SELECT id FROM customers WHERE id = $1 AND user_id = $2 AND tenant_id = $3';
      checkParams = [id, user_id, tenant_id];
    }
    
    const checkResult = await pool.query(checkQuery, checkParams);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found or access denied' });
    }
    
    await pool.query('DELETE FROM customers WHERE id = $1', [id]);
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create domain for specific customer
router.post('/:customerId/domains', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { domain_name, type = 'primary', document_root, php_version = '8.2', auto_ssl = true } = req.body;
    const { tenant_id, id: user_id } = req.user;
    
    if (!domain_name) {
      return res.status(400).json({ success: false, error: 'Domain name is required' });
    }
    
    // Validate customer exists and belongs to this user
    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND user_id = $2',
      [customerId, user_id]
    );
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found or access denied' });
    }
    
    // Extract TLD from domain name
    const tld = domain_name.split('.').pop();
    
    // Check if domain already exists
    const existingDomain = await pool.query(
      'SELECT id FROM domains WHERE domain_name = $1',
      [domain_name]
    );
    
    if (existingDomain.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Domain already exists' });
    }
    
    const query = `
      INSERT INTO domains (
        tenant_id, user_id, customer_id, domain_name, tld, type, document_root, 
        php_version, auto_ssl, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      tenant_id,
      user_id,
      customerId,
      domain_name,
      tld,
      type,
      document_root || `/home/${customerId}/public_html/${domain_name}`,
      php_version,
      auto_ssl
    ]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'create_domain', 'domain', $3, $4)`,
      [tenant_id, user_id, result.rows[0].id, JSON.stringify({ domain_name, customerId })]
    );
    
    res.status(201).json({ success: true, domain: result.rows[0] });
  } catch (error) {
    console.error('Error creating domain for customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
