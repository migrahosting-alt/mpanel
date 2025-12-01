import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/index.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// =============================================================================
// ENTERPRISE CUSTOMER ROUTES - MigraHosting mPanel
// Features: Full CRUD, RBAC, soft delete, audit logging, tenant isolation
// =============================================================================

// Role hierarchy for authorization
const ROLE_HIERARCHY = {
  super_admin: 0,
  admin: 1,
  manager: 2,
  editor: 3,
  sales: 4,
  support: 5,
  billing: 7,
  customer: 10,
};

// Check if user has required permission level
const hasPermission = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole] ?? 99;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel <= requiredLevel;
};

// Audit logging helper
const logAudit = async (tenantId, userId, action, targetType, targetId, details = {}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, target_type, target_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [tenantId, userId, action, targetType, targetId, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};

// Role-based access control middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// =============================================================================
// GET /customers - List all customers (with RBAC)
// =============================================================================
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { id: userId, role, tenant_id } = req.user;
    const { status, search, limit = 100, offset = 0 } = req.query;
    
    // Build query based on role
    let whereConditions = ['c.deleted_at IS NULL'];
    let params = [];
    let paramIndex = 1;
    
    // Tenant isolation for non-super_admin
    if (role !== 'super_admin' && tenant_id) {
      whereConditions.push(`c.tenant_id = $${paramIndex}`);
      params.push(tenant_id);
      paramIndex++;
    }
    
    // Regular customers can only see their own customer profile
    if (role === 'customer') {
      whereConditions.push(`c.user_id = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }
    
    // Status filter
    if (status && status !== 'all') {
      whereConditions.push(`c.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    // Search filter
    if (search) {
      whereConditions.push(`(
        c.company_name ILIKE $${paramIndex} OR 
        c.email ILIKE $${paramIndex} OR 
        c.first_name ILIKE $${paramIndex} OR 
        c.last_name ILIKE $${paramIndex} OR
        c.phone ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    const query = `
      SELECT 
        c.id,
        c.tenant_id,
        c.user_id,
        c.company_name,
        c.email,
        c.first_name,
        c.last_name,
        c.phone,
        c.country,
        c.city,
        c.state,
        c.address_line1,
        c.address_line2,
        c.postal_code,
        c.tax_id,
        c.currency,
        c.credit_balance,
        c.status,
        c.notes,
        c.created_at,
        c.updated_at,
        u.email as linked_user_email,
        u.first_name as linked_user_first_name,
        u.last_name as linked_user_last_name,
        (SELECT COUNT(*) FROM domains d WHERE d.customer_id = c.id) as domain_count,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subscriptions
      FROM customers c
      LEFT JOIN users u ON c.user_id = u.id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) FROM customers c ${whereClause}`;
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({ 
      success: true, 
      customers: result.rows,
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Export Customers (MUST be before /:id routes!)
// =============================================================================
router.get('/export', authenticateToken, requireRole(['super_admin', 'admin', 'manager', 'sales', 'billing']), async (req, res) => {
  try {
    const { tenant_id, role } = req.user;
    const { format = 'csv', include_deleted = 'false', status } = req.query;
    
    let query = `
      SELECT 
        c.id,
        c.company_name,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.address_line1,
        c.address_line2,
        c.city,
        c.state,
        c.postal_code,
        c.country,
        c.currency,
        c.tax_id,
        c.status,
        c.notes,
        c.credit_balance,
        u.email as linked_user_email,
        u.role as linked_user_role,
        c.created_at,
        c.updated_at
      FROM customers c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (role !== 'super_admin') {
      params.push(tenant_id);
      query += ` AND c.tenant_id = $${params.length}`;
    }
    
    if (include_deleted !== 'true') {
      query += ` AND c.deleted_at IS NULL`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    const result = await pool.query(query, params);
    
    if (format === 'csv') {
      const headers = ['ID', 'Company', 'First Name', 'Last Name', 'Email', 'Phone', 'Address', 'Address2', 'City', 'State', 'Postal Code', 'Country', 'Currency', 'Tax ID', 'Status', 'Notes', 'Credit Balance', 'Linked User Email', 'Linked User Role', 'Created At', 'Updated At'];
      let csv = headers.join(',') + '\n';
      
      result.rows.forEach(row => {
        const values = [
          row.id,
          `"${(row.company_name || '').replace(/"/g, '""')}"`,
          `"${(row.first_name || '').replace(/"/g, '""')}"`,
          `"${(row.last_name || '').replace(/"/g, '""')}"`,
          row.email || '',
          row.phone || '',
          `"${(row.address_line1 || '').replace(/"/g, '""')}"`,
          `"${(row.address_line2 || '').replace(/"/g, '""')}"`,
          `"${(row.city || '').replace(/"/g, '""')}"`,
          row.state || '',
          row.postal_code || '',
          row.country || '',
          row.currency || 'USD',
          row.tax_id || '',
          row.status || 'active',
          `"${(row.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          row.credit_balance || '0.00',
          row.linked_user_email || '',
          row.linked_user_role || '',
          row.created_at,
          row.updated_at
        ];
        csv += values.join(',') + '\n';
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers_export.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Customer Statistics (MUST be before /:id routes!)
// =============================================================================
router.get('/stats/overview', authenticateToken, requireRole(['super_admin', 'admin', 'manager', 'sales']), async (req, res) => {
  try {
    const { tenant_id, role } = req.user;
    const tenantFilter = role === 'super_admin' ? '' : 'AND tenant_id = $1';
    const params = role === 'super_admin' ? [] : [tenant_id];
    
    // Total customers
    const totalQuery = await pool.query(
      `SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL ${tenantFilter}`,
      params
    );
    
    // By status
    const statusQuery = await pool.query(
      `SELECT status, COUNT(*) FROM customers WHERE deleted_at IS NULL ${tenantFilter} GROUP BY status`,
      params
    );
    
    // New this month
    const newThisMonth = await pool.query(
      `SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND created_at >= DATE_TRUNC('month', NOW()) ${tenantFilter}`,
      params
    );
    
    // New last month
    const newLastMonth = await pool.query(
      `SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL AND created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', NOW()) ${tenantFilter}`,
      params
    );
    
    // By country
    const byCountry = await pool.query(
      `SELECT country, COUNT(*) FROM customers WHERE deleted_at IS NULL AND country IS NOT NULL ${tenantFilter} GROUP BY country ORDER BY count DESC LIMIT 10`,
      params
    );
    
    // Total credit balance
    const creditBalance = await pool.query(
      `SELECT COALESCE(SUM(credit_balance), 0) as total FROM customers WHERE deleted_at IS NULL ${tenantFilter}`,
      params
    );
    
    // Growth rate
    const currentMonth = parseInt(newThisMonth.rows[0].count);
    const lastMonth = parseInt(newLastMonth.rows[0].count);
    const growthRate = lastMonth > 0 ? ((currentMonth - lastMonth) / lastMonth * 100).toFixed(1) : 0;
    
    const statusMap = {};
    statusQuery.rows.forEach(row => {
      statusMap[row.status] = parseInt(row.count);
    });
    
    res.json({
      success: true,
      stats: {
        total: parseInt(totalQuery.rows[0].count),
        by_status: statusMap,
        new_this_month: currentMonth,
        new_last_month: lastMonth,
        growth_rate: parseFloat(growthRate),
        by_country: byCountry.rows.map(r => ({ country: r.country, count: parseInt(r.count) })),
        total_credit_balance: parseFloat(creditBalance.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Bulk Actions (MUST be before /:id routes!)
// =============================================================================
router.post('/bulk-action', authenticateToken, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const { action, customer_ids } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    if (!action || !customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Action and customer_ids array required' });
    }
    
    let result;
    
    // Use PostgreSQL ANY() operator with arrays for proper parameter binding
    switch (action) {
      case 'delete':
        // Soft delete
        if (role === 'super_admin') {
          result = await pool.query(
            'UPDATE customers SET deleted_at = NOW(), deleted_by = $1 WHERE id = ANY($2::uuid[]) RETURNING id',
            [user_id, customer_ids]
          );
        } else {
          result = await pool.query(
            'UPDATE customers SET deleted_at = NOW(), deleted_by = $1 WHERE tenant_id = $2 AND id = ANY($3::uuid[]) RETURNING id',
            [user_id, tenant_id, customer_ids]
          );
        }
        break;
        
      case 'activate':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE customers SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]) RETURNING id`,
            [customer_ids]
          );
        } else {
          result = await pool.query(
            `UPDATE customers SET status = 'active', updated_at = NOW() WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id`,
            [tenant_id, customer_ids]
          );
        }
        break;
        
      case 'suspend':
        if (role === 'super_admin') {
          result = await pool.query(
            `UPDATE customers SET status = 'suspended', updated_at = NOW() WHERE id = ANY($1::uuid[]) RETURNING id`,
            [customer_ids]
          );
        } else {
          result = await pool.query(
            `UPDATE customers SET status = 'suspended', updated_at = NOW() WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id`,
            [tenant_id, customer_ids]
          );
        }
        break;
        
      case 'restore':
        // Restore soft-deleted
        if (role === 'super_admin') {
          result = await pool.query(
            'UPDATE customers SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE id = ANY($1::uuid[]) RETURNING id',
            [customer_ids]
          );
        } else {
          result = await pool.query(
            'UPDATE customers SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW() WHERE tenant_id = $1 AND id = ANY($2::uuid[]) RETURNING id',
            [tenant_id, customer_ids]
          );
        }
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    await logAudit(tenant_id, user_id, `customers_bulk_${action}`, 'customers', null, { customer_ids, affected: result.rowCount });
    
    res.json({ success: true, affected: result.rowCount, message: `${result.rowCount} customers ${action}d` });
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/:id - Get single customer
// =============================================================================
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role, tenant_id } = req.user;
    
    let whereConditions = ['c.id = $1', 'c.deleted_at IS NULL'];
    let params = [id];
    let paramIndex = 2;
    
    // Tenant isolation
    if (role !== 'super_admin' && tenant_id) {
      whereConditions.push(`c.tenant_id = $${paramIndex}`);
      params.push(tenant_id);
      paramIndex++;
    }
    
    // Regular customers can only see their own profile
    if (role === 'customer') {
      whereConditions.push(`c.user_id = $${paramIndex}`);
      params.push(userId);
    }
    
    const query = `
      SELECT 
        c.*,
        u.email as linked_user_email,
        u.first_name as linked_user_first_name,
        u.last_name as linked_user_last_name
      FROM customers c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE ${whereConditions.join(' AND ')}
    `;
    
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

// =============================================================================
// POST /customers - Create new customer
// =============================================================================
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { role, tenant_id, id: creatorId } = req.user;
    
    // Only staff can create customers
    if (!hasPermission(role, 'support')) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const {
      company_name,
      email,
      first_name,
      last_name,
      phone,
      country,
      city,
      state,
      address_line1,
      address_line2,
      postal_code,
      tax_id,
      currency,
      user_id,
      notes,
      status = 'active',
      create_user_account,
      password
    } = req.body;
    
    // Validation
    if (!company_name?.trim() && !email?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Either company name or email is required' 
      });
    }
    
    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }
    
    // Check for duplicate email within tenant (customers)
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM customers WHERE email = $1 AND tenant_id = $2 AND deleted_at IS NULL',
        [email.toLowerCase(), tenant_id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'A customer with this email already exists' 
        });
      }
    }
    
    let linkedUserId = user_id || null;
    
    // Create user account if requested
    if (create_user_account && email && password) {
      // Check if user with this email already exists
      const userEmailCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (userEmailCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'A user account with this email already exists. Use "Link to User Account" instead.' 
        });
      }
      
      // Password validation
      if (password.length < 8) {
        return res.status(400).json({ 
          success: false, 
          error: 'Password must be at least 8 characters' 
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user account
      const userResult = await pool.query(
        `INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'customer', 'active', CURRENT_TIMESTAMP)
         RETURNING id`,
        [tenant_id, email.toLowerCase().trim(), hashedPassword, first_name?.trim() || null, last_name?.trim() || null]
      );
      
      linkedUserId = userResult.rows[0].id;
      
      // Audit log for user creation
      await logAudit(tenant_id, creatorId, 'user_created', 'user', linkedUserId, {
        email: email.toLowerCase(),
        role: 'customer',
        created_with_customer: true,
        created_by: creatorId
      });
    }
    
    const query = `
      INSERT INTO customers (
        tenant_id, user_id, company_name, email, first_name, last_name,
        phone, country, city, state, address_line1, address_line2,
        postal_code, tax_id, currency, notes, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      tenant_id,
      linkedUserId,
      company_name?.trim() || null,
      email?.toLowerCase()?.trim() || null,
      first_name?.trim() || null,
      last_name?.trim() || null,
      phone?.trim() || null,
      country?.trim() || null,
      city?.trim() || null,
      state?.trim() || null,
      address_line1?.trim() || null,
      address_line2?.trim() || null,
      postal_code?.trim() || null,
      tax_id?.trim() || null,
      currency || 'USD',
      notes?.trim() || null,
      status
    ]);
    
    // Audit log
    await logAudit(tenant_id, creatorId, 'customer_created', 'customer', result.rows[0].id, {
      company_name,
      email,
      user_account_created: !!create_user_account,
      created_by: creatorId
    });
    
    res.status(201).json({ 
      success: true, 
      customer: result.rows[0],
      user_created: !!create_user_account && !!linkedUserId
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// PUT /customers/:id - Update customer
// =============================================================================
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id, id: updaterId } = req.user;
    
    // Only staff can update customers
    if (!hasPermission(role, 'support')) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // Check customer exists and belongs to tenant
    const checkQuery = role === 'super_admin'
      ? 'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL'
      : 'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL';
    const checkParams = role === 'super_admin' ? [id] : [id, tenant_id];
    
    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const {
      company_name,
      email,
      first_name,
      last_name,
      phone,
      country,
      city,
      state,
      address_line1,
      address_line2,
      postal_code,
      tax_id,
      currency,
      user_id,
      notes,
      status
    } = req.body;
    
    // Email validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }
    
    // Check for duplicate email (excluding current customer)
    if (email) {
      const emailCheck = await pool.query(
        'SELECT id FROM customers WHERE email = $1 AND tenant_id = $2 AND id != $3 AND deleted_at IS NULL',
        [email.toLowerCase(), tenant_id, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ 
          success: false, 
          error: 'A customer with this email already exists' 
        });
      }
    }
    
    const query = `
      UPDATE customers SET
        company_name = COALESCE($1, company_name),
        email = COALESCE($2, email),
        first_name = COALESCE($3, first_name),
        last_name = COALESCE($4, last_name),
        phone = COALESCE($5, phone),
        country = COALESCE($6, country),
        city = COALESCE($7, city),
        state = COALESCE($8, state),
        address_line1 = COALESCE($9, address_line1),
        address_line2 = COALESCE($10, address_line2),
        postal_code = COALESCE($11, postal_code),
        tax_id = COALESCE($12, tax_id),
        currency = COALESCE($13, currency),
        user_id = $14,
        notes = COALESCE($15, notes),
        status = COALESCE($16, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $17
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      company_name?.trim(),
      email?.toLowerCase()?.trim(),
      first_name?.trim(),
      last_name?.trim(),
      phone?.trim(),
      country?.trim(),
      city?.trim(),
      state?.trim(),
      address_line1?.trim(),
      address_line2?.trim(),
      postal_code?.trim(),
      tax_id?.trim(),
      currency,
      user_id || null,
      notes?.trim(),
      status,
      id
    ]);
    
    // Audit log
    await logAudit(tenant_id, updaterId, 'customer_updated', 'customer', id, {
      changes: req.body,
      updated_by: updaterId
    });
    
    res.json({ success: true, customer: result.rows[0] });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// DELETE /customers/:id - Soft delete customer
// =============================================================================
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id, id: deleterId } = req.user;
    
    // Only managers+ can delete customers
    if (!hasPermission(role, 'manager')) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // Check customer exists
    const checkQuery = role === 'super_admin'
      ? 'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL'
      : 'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL';
    const checkParams = role === 'super_admin' ? [id] : [id, tenant_id];
    
    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Check for active subscriptions
    const subsCheck = await pool.query(
      "SELECT COUNT(*) FROM subscriptions WHERE customer_id = $1 AND status = 'active'",
      [id]
    );
    if (parseInt(subsCheck.rows[0].count) > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Cannot delete customer with active subscriptions. Cancel subscriptions first.' 
      });
    }
    
    // Soft delete
    await pool.query(
      `UPDATE customers SET 
        deleted_at = CURRENT_TIMESTAMP, 
        deleted_by = $1, 
        status = 'deleted',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [deleterId, id]
    );
    
    // Audit log
    await logAudit(tenant_id, deleterId, 'customer_deleted', 'customer', id, {
      company_name: existing.rows[0].company_name,
      email: existing.rows[0].email,
      deleted_by: deleterId
    });
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /customers/:id/restore - Restore soft-deleted customer
// =============================================================================
router.post('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id, id: restorerId } = req.user;
    
    // Only managers+ can restore
    if (!hasPermission(role, 'manager')) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const checkQuery = role === 'super_admin'
      ? 'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NOT NULL'
      : 'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NOT NULL';
    const checkParams = role === 'super_admin' ? [id] : [id, tenant_id];
    
    const existing = await pool.query(checkQuery, checkParams);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Deleted customer not found' });
    }
    
    await pool.query(
      `UPDATE customers SET 
        deleted_at = NULL, 
        deleted_by = NULL, 
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
    
    await logAudit(tenant_id, restorerId, 'customer_restored', 'customer', id, {
      restored_by: restorerId
    });
    
    res.json({ success: true, message: 'Customer restored successfully' });
  } catch (error) {
    console.error('Error restoring customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/:id/summary - Get customer summary with stats
// =============================================================================
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id } = req.user;
    
    // Get customer
    const customerQuery = role === 'super_admin'
      ? 'SELECT * FROM customers WHERE id = $1 AND deleted_at IS NULL'
      : 'SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL';
    const customerParams = role === 'super_admin' ? [id] : [id, tenant_id];
    
    const customer = await pool.query(customerQuery, customerParams);
    if (customer.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Get stats
    const [domains, subscriptions, invoices] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM domains WHERE customer_id = $1', [id]),
      pool.query("SELECT COUNT(*) FROM subscriptions WHERE customer_id = $1 AND status = 'active'", [id]),
      pool.query("SELECT COUNT(*), COALESCE(SUM(total), 0) as total FROM invoices WHERE customer_id = $1 AND status = 'paid'", [id])
    ]);
    
    res.json({
      success: true,
      customer: customer.rows[0],
      stats: {
        domain_count: parseInt(domains.rows[0].count),
        active_subscriptions: parseInt(subscriptions.rows[0].count),
        paid_invoices: parseInt(invoices.rows[0].count),
        total_revenue: parseFloat(invoices.rows[0].total) || 0
      }
    });
  } catch (error) {
    console.error('Error fetching customer summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// Domain routes for specific customer
// =============================================================================
router.post('/:customerId/domains', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { domain_name, type = 'primary', document_root, php_version = '8.2', auto_ssl = true } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    if (!domain_name) {
      return res.status(400).json({ success: false, error: 'Domain name is required' });
    }
    
    // Validate customer exists
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [customerId])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [customerId, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Extract TLD
    const tld = domain_name.split('.').pop();
    
    // Check if domain exists
    const existingDomain = await pool.query('SELECT id FROM domains WHERE domain_name = $1', [domain_name]);
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
    
    await logAudit(tenant_id, user_id, 'domain_created', 'domain', result.rows[0].id, { domain_name, customerId });
    
    res.status(201).json({ success: true, domain: result.rows[0] });
  } catch (error) {
    console.error('Error creating domain for customer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Customer Activity Timeline
// =============================================================================
router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role } = req.user;
    const { limit = 50 } = req.query;
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1', [id])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Get all audit logs related to this customer
    const activity = await pool.query(`
      SELECT 
        al.id,
        al.action,
        al.entity_type,
        al.entity_id,
        al.changes,
        al.ip_address,
        al.created_at,
        u.email as performed_by
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE (al.entity_type = 'customer' AND al.entity_id = $1)
         OR (al.changes::text LIKE $2)
      ORDER BY al.created_at DESC
      LIMIT $3
    `, [id, `%"customerId":"${id}"%`, parseInt(limit)]);
    
    res.json({ success: true, activity: activity.rows });
  } catch (error) {
    console.error('Error fetching customer activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Credit Management
// =============================================================================
router.get('/:id/credits', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role } = req.user;
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id, credit_balance FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id, credit_balance FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    // Get credit transactions
    const transactions = await pool.query(`
      SELECT 
        ct.id,
        ct.amount,
        ct.type,
        ct.description,
        ct.balance_after,
        ct.reference_type,
        ct.reference_id,
        ct.created_at,
        u.email as created_by_email
      FROM credit_transactions ct
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.customer_id = $1
      ORDER BY ct.created_at DESC
      LIMIT 100
    `, [id]);
    
    res.json({
      success: true,
      balance: parseFloat(customerCheck.rows[0].credit_balance) || 0,
      transactions: transactions.rows
    });
  } catch (error) {
    console.error('Error fetching customer credits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/credits', authenticateToken, requireRole(['super_admin', 'admin', 'manager', 'billing']), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, description } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    if (!amount || !type) {
      return res.status(400).json({ success: false, error: 'Amount and type are required' });
    }
    
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type must be credit or debit' });
    }
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id, credit_balance FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id, credit_balance FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const currentBalance = parseFloat(customerCheck.rows[0].credit_balance) || 0;
    const adjustedAmount = type === 'credit' ? Math.abs(amount) : -Math.abs(amount);
    const newBalance = currentBalance + adjustedAmount;
    
    if (newBalance < 0) {
      return res.status(400).json({ success: false, error: 'Insufficient credit balance' });
    }
    
    // Update customer balance
    await pool.query('UPDATE customers SET credit_balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, id]);
    
    // Record transaction
    const transaction = await pool.query(`
      INSERT INTO credit_transactions (customer_id, amount, type, description, balance_after, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, adjustedAmount, type, description || `Manual ${type}`, newBalance, user_id]);
    
    await logAudit(tenant_id, user_id, 'credit_adjusted', 'customer', id, { amount: adjustedAmount, type, newBalance });
    
    res.json({
      success: true,
      transaction: transaction.rows[0],
      new_balance: newBalance
    });
  } catch (error) {
    console.error('Error adjusting customer credit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// ENTERPRISE FEATURES - Document Management
// =============================================================================
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, role } = req.user;
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const documents = await pool.query(`
      SELECT 
        cd.id,
        cd.document_type,
        cd.file_name,
        cd.file_size,
        cd.mime_type,
        cd.description,
        cd.is_verified,
        cd.verified_at,
        cd.expires_at,
        cd.created_at,
        u.email as uploaded_by_email,
        v.email as verified_by_email
      FROM customer_documents cd
      LEFT JOIN users u ON cd.uploaded_by = u.id
      LEFT JOIN users v ON cd.verified_by = v.id
      WHERE cd.customer_id = $1
      ORDER BY cd.created_at DESC
    `, [id]);
    
    res.json({ success: true, documents: documents.rows });
  } catch (error) {
    console.error('Error fetching customer documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/documents', authenticateToken, requireRole(['super_admin', 'admin', 'manager', 'support']), async (req, res) => {
  try {
    const { id } = req.params;
    const { document_type, file_name, file_path, file_size, mime_type, description, expires_at } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    if (!document_type || !file_name) {
      return res.status(400).json({ success: false, error: 'Document type and file name are required' });
    }
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const result = await pool.query(`
      INSERT INTO customer_documents (customer_id, document_type, file_name, file_path, file_size, mime_type, description, expires_at, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [id, document_type, file_name, file_path, file_size, mime_type, description, expires_at, user_id]);
    
    await logAudit(tenant_id, user_id, 'document_uploaded', 'customer_document', result.rows[0].id, { customer_id: id, document_type, file_name });
    
    res.status(201).json({ success: true, document: result.rows[0] });
  } catch (error) {
    console.error('Error uploading customer document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/documents/:documentId/verify', authenticateToken, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const { is_verified } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const result = await pool.query(`
      UPDATE customer_documents 
      SET is_verified = $1, verified_by = $2, verified_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END
      WHERE id = $3 AND customer_id = $4
      RETURNING *
    `, [is_verified, user_id, documentId, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    
    await logAudit(tenant_id, user_id, is_verified ? 'document_verified' : 'document_unverified', 'customer_document', documentId, { customer_id: id });
    
    res.json({ success: true, document: result.rows[0] });
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id/documents/:documentId', authenticateToken, requireRole(['super_admin', 'admin', 'manager']), async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const { tenant_id, id: user_id, role } = req.user;
    
    // Verify customer access
    const customerCheck = role === 'super_admin'
      ? await pool.query('SELECT id FROM customers WHERE id = $1 AND deleted_at IS NULL', [id])
      : await pool.query('SELECT id FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL', [id, tenant_id]);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const result = await pool.query(
      'DELETE FROM customer_documents WHERE id = $1 AND customer_id = $2 RETURNING *',
      [documentId, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }
    
    await logAudit(tenant_id, user_id, 'document_deleted', 'customer_document', documentId, { customer_id: id, file_name: result.rows[0].file_name });
    
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
