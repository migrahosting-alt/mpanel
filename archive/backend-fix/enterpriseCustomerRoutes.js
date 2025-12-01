import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/index.js';
import crypto from 'crypto';

const router = express.Router();

// =============================================================================
// ENTERPRISE CUSTOMER ROUTES - Additional endpoints
// =============================================================================

const ROLE_HIERARCHY = {
  super_admin: 0, admin: 1, manager: 2, editor: 3, 
  sales: 4, support: 5, billing: 7, customer: 10
};

const hasRoleLevel = (userRole, requiredLevel) => {
  return (ROLE_HIERARCHY[userRole] ?? 99) <= requiredLevel;
};

// =============================================================================
// GET /customers/:id/stats - Get customer statistics
// =============================================================================
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    // Get various stats
    const [domains, subscriptions, invoices, payments, creditBalance] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM domains WHERE customer_id = $1', [id]),
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
          COUNT(*) as total
        FROM subscriptions WHERE customer_id = $1
      `, [id]),
      pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'paid') as paid,
          COUNT(*) FILTER (WHERE status = 'unpaid') as unpaid,
          COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN total ELSE 0 END), 0) as total_outstanding
        FROM invoices WHERE customer_id = $1
      `, [id]),
      pool.query(`
        SELECT COALESCE(SUM(amount), 0) as total_payments
        FROM payments WHERE customer_id = $1 AND status = 'completed'
      `, [id]),
      pool.query('SELECT credit_balance FROM customers WHERE id = $1', [id])
    ]);
    
    res.json({
      success: true,
      stats: {
        domains: parseInt(domains.rows[0].count),
        subscriptions: {
          active: parseInt(subscriptions.rows[0].active),
          cancelled: parseInt(subscriptions.rows[0].cancelled),
          total: parseInt(subscriptions.rows[0].total)
        },
        invoices: {
          total: parseInt(invoices.rows[0].total),
          paid: parseInt(invoices.rows[0].paid),
          unpaid: parseInt(invoices.rows[0].unpaid),
          overdue: parseInt(invoices.rows[0].overdue),
          total_paid: parseFloat(invoices.rows[0].total_paid),
          total_outstanding: parseFloat(invoices.rows[0].total_outstanding)
        },
        total_payments: parseFloat(payments.rows[0].total_payments),
        credit_balance: parseFloat(creditBalance.rows[0]?.credit_balance || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/:id/activity - Get customer activity timeline
// =============================================================================
router.get('/:id/activity', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT 
        'invoice' as type,
        i.id,
        CONCAT('Invoice #', i.invoice_number, ' ', i.status) as description,
        i.total as amount,
        i.created_at
      FROM invoices i WHERE i.customer_id = $1
      
      UNION ALL
      
      SELECT 
        'payment' as type,
        p.id,
        CONCAT('Payment received: $', p.amount) as description,
        p.amount,
        p.created_at
      FROM payments p WHERE p.customer_id = $1 AND p.status = 'completed'
      
      UNION ALL
      
      SELECT 
        'domain' as type,
        d.id,
        CONCAT('Domain ', d.domain_name, ' added') as description,
        NULL as amount,
        d.created_at
      FROM domains d WHERE d.customer_id = $1
      
      UNION ALL
      
      SELECT 
        'subscription' as type,
        s.id,
        CONCAT('Subscription ', s.status) as description,
        s.amount as amount,
        s.created_at
      FROM subscriptions s WHERE s.customer_id = $1
      
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);
    
    res.json({ success: true, activity: result.rows });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /customers/:id/credit - Add/remove credit
// =============================================================================
router.post('/:id/credit', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, type, description } = req.body;
    const { role, id: userId, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.billing)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' });
    }
    
    if (!['credit', 'debit'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }
    
    // Get current balance
    const customer = await pool.query(
      'SELECT credit_balance FROM customers WHERE id = $1',
      [id]
    );
    
    if (customer.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }
    
    const currentBalance = parseFloat(customer.rows[0].credit_balance) || 0;
    const adjustment = type === 'credit' ? amount : -amount;
    const newBalance = currentBalance + adjustment;
    
    if (newBalance < 0) {
      return res.status(400).json({ success: false, error: 'Insufficient credit balance' });
    }
    
    // Update balance
    await pool.query(
      'UPDATE customers SET credit_balance = $1, updated_at = NOW() WHERE id = $2',
      [newBalance, id]
    );
    
    // Record transaction
    await pool.query(`
      INSERT INTO credit_transactions (customer_id, amount, type, description, balance_after, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, amount, type, description || `${type} adjustment`, newBalance, userId]);
    
    res.json({
      success: true,
      previous_balance: currentBalance,
      new_balance: newBalance,
      adjustment: adjustment
    });
  } catch (error) {
    console.error('Error adjusting credit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/:id/credit-history - Get credit transaction history
// =============================================================================
router.get('/:id/credit-history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.billing)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT ct.*, u.email as created_by_email
      FROM credit_transactions ct
      LEFT JOIN users u ON ct.created_by = u.id
      WHERE ct.customer_id = $1
      ORDER BY ct.created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), parseInt(offset)]);
    
    res.json({ success: true, transactions: result.rows });
  } catch (error) {
    console.error('Error fetching credit history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /customers/:id/portal-link - Generate portal access link
// =============================================================================
router.post('/:id/portal-link', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await pool.query(
      `UPDATE customers SET portal_access_token = $1, portal_token_expires_at = $2 WHERE id = $3`,
      [token, expiresAt, id]
    );
    
    const portalUrl = `${process.env.FRONTEND_URL || 'https://mpanel.migrahosting.com'}/portal-access?token=${token}`;
    
    res.json({
      success: true,
      portal_link: portalUrl,
      expires_at: expiresAt
    });
  } catch (error) {
    console.error('Error generating portal link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/:id/documents - Get customer documents
// =============================================================================
router.get('/:id/documents', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.support)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    const result = await pool.query(`
      SELECT cd.*, u.email as uploaded_by_email
      FROM customer_documents cd
      LEFT JOIN users u ON cd.uploaded_by = u.id
      WHERE cd.customer_id = $1
      ORDER BY cd.created_at DESC
    `, [id]);
    
    res.json({ success: true, documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// POST /customers/bulk-action - Bulk actions on customers
// =============================================================================
router.post('/bulk-action', authenticateToken, async (req, res) => {
  try {
    const { action, customerIds } = req.body;
    const { role, id: userId, tenant_id } = req.user;
    
    if (!hasRoleLevel(role, ROLE_HIERARCHY.manager)) {
      return res.status(403).json({ success: false, error: 'Permission denied' });
    }
    
    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No customers selected' });
    }
    
    let result;
    switch (action) {
      case 'activate':
        result = await pool.query(
          `UPDATE customers SET status = 'active', updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [customerIds, tenant_id]
        );
        break;
      case 'suspend':
        result = await pool.query(
          `UPDATE customers SET status = 'suspended', updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [customerIds, tenant_id]
        );
        break;
      case 'delete':
        result = await pool.query(
          `UPDATE customers SET status = 'deleted', deleted_at = NOW(), deleted_by = $3, updated_at = NOW() 
           WHERE id = ANY($1) AND tenant_id = $2
           RETURNING id`,
          [customerIds, tenant_id, userId]
        );
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    res.json({ 
      success: true, 
      affected: result.rowCount,
      message: `${result.rowCount} customers ${action}d`
    });
  } catch (error) {
    console.error('Error bulk action:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =============================================================================
// GET /customers/export - Export customers to CSV
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
        c.company_name, c.email, c.first_name, c.last_name, c.phone,
        c.address_line1, c.city, c.state, c.postal_code, c.country,
        c.status, c.credit_balance, c.currency, c.created_at,
        (SELECT COUNT(*) FROM domains d WHERE d.customer_id = c.id) as domain_count,
        (SELECT COUNT(*) FROM subscriptions s WHERE s.customer_id = c.id AND s.status = 'active') as active_subs
      FROM customers c
      WHERE c.tenant_id = $1 AND c.deleted_at IS NULL
      ORDER BY c.created_at DESC
    `, [tenant_id]);
    
    if (format === 'csv') {
      const headers = ['Company', 'Email', 'First Name', 'Last Name', 'Phone', 'Address', 'City', 'State', 'Postal', 'Country', 'Status', 'Credit Balance', 'Currency', 'Domains', 'Active Subs', 'Created'];
      const rows = result.rows.map(r => [
        r.company_name || '',
        r.email || '',
        r.first_name || '',
        r.last_name || '',
        r.phone || '',
        r.address_line1 || '',
        r.city || '',
        r.state || '',
        r.postal_code || '',
        r.country || '',
        r.status || '',
        r.credit_balance || '0',
        r.currency || 'USD',
        r.domain_count || '0',
        r.active_subs || '0',
        r.created_at || ''
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers-export.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, customers: result.rows });
  } catch (error) {
    console.error('Error exporting customers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
