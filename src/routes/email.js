// src/routes/email.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * SCHEMA ASSUMPTION (matches your error):
 *
 * email_accounts (
 *   id uuid PK,
 *   tenant_id uuid NOT NULL,
 *   customer_id uuid NOT NULL,
 *   domain_id uuid NOT NULL,
 *   local_part varchar,
 *   password_hash text,
 *   quota_mb integer,
 *   spam_filter_enabled boolean,
 *   status varchar,
 *   created_at timestamp,
 *   updated_at timestamp
 * )
 *
 * email_forwarders (
 *   id uuid PK,
 *   tenant_id uuid NOT NULL,
 *   customer_id uuid NOT NULL,
 *   domain_id uuid NOT NULL,
 *   source varchar,
 *   destination varchar,
 *   created_at timestamp,
 *   updated_at timestamp
 * )
 */

// ---- EMAIL ACCOUNTS ----

// List accounts (optionally by domain)
router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id, role } = req.user;
    const { domain_id } = req.query;

    const params = [tenant_id];
    let where = 'ea.tenant_id = $1';

    // non-admins only see accounts under their customers
    if (role !== 'admin') {
      params.push(user_id);
      where += ' AND c.user_id = $2';
    }

    if (domain_id) {
      params.push(domain_id);
      where += ` AND ea.domain_id = $${params.length}`;
    }

    const query = `
      SELECT ea.*, d.domain_name, c.company_name
      FROM email_accounts ea
      JOIN domains d ON ea.domain_id = d.id
      JOIN customers c ON ea.customer_id = c.id
      WHERE ${where}
      ORDER BY d.domain_name, ea.local_part
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, accounts: result.rows });
  } catch (err) {
    console.error('Email accounts list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create email account
router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id } = req.user;
    const { domain_id, customerId, local_part, password, quota_mb = 1024, spam_filter_enabled = true } = req.body;

    if (!domain_id || !customerId || !local_part || !password) {
      return res.status(400).json({
        success: false,
        error: 'domain_id, customerId, local_part, and password are required',
      });
    }

    // Validate customer belongs to tenant and (optionally) this user
    const customerCheck = await pool.query(
      `SELECT id FROM customers WHERE id = $1 AND tenant_id = $2`,
      [customerId, tenant_id]
    );
    if (customerCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Validate domain belongs to same tenant & customer
    const domainCheck = await pool.query(
      `SELECT id FROM domains WHERE id = $1 AND tenant_id = $2 AND customer_id = $3`,
      [domain_id, tenant_id, customerId]
    );
    if (domainCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found for customer' });
    }

    const result = await pool.query(
      `INSERT INTO email_accounts
         (tenant_id, customer_id, domain_id, local_part, password_hash,
          quota_mb, spam_filter_enabled, status)
       VALUES ($1,$2,$3,$4, crypt($5, gen_salt('bf')),$6,$7,'active')
       RETURNING *`,
      [tenant_id, customerId, domain_id, local_part, password, quota_mb, spam_filter_enabled]
    );

    // Provision mailbox on actual mail server via server agent
    try {
      const serverResult = await pool.query('SELECT * FROM servers WHERE tenant_id = $1 LIMIT 1', [tenant_id]);
      const server = serverResult.rows[0];
      
      if (server) {
        const axios = (await import('axios')).default;
        const https = (await import('https')).default;
        const domainResult = await pool.query('SELECT name FROM domains WHERE id = $1', [domain_id]);
        const domainName = domainResult.rows[0]?.name;
        
        await axios.post(`https://${server.hostname}:3100/api/email/accounts`, {
          email: `${local_part}@${domainName}`,
          password,
          quota_mb,
          spam_filter_enabled
        }, {
          headers: {
            'Authorization': `Bearer ${server.api_key}`,
            'Content-Type': 'application/json'
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        
        console.log(`Mailbox ${local_part}@${domainName} created on server ${server.hostname}`);
      }
    } catch (agentError) {
      console.error('Failed to create mailbox on physical server:', agentError.message);
      // Continue anyway - email account record created in mPanel
    }

    res.status(201).json({ success: true, account: result.rows[0] });
  } catch (err) {
    console.error('Email account create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---- FORWARDERS ----

// List forwarders
router.get('/forwarders', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id, role } = req.user;
    const { domain_id } = req.query;

    const params = [tenant_id];
    let where = 'f.tenant_id = $1';

    if (role !== 'admin') {
      params.push(user_id);
      where += ' AND c.user_id = $2';
    }

    if (domain_id) {
      params.push(domain_id);
      where += ` AND f.domain_id = $${params.length}`;
    }

    const query = `
      SELECT f.*, d.domain_name, c.company_name
      FROM email_forwarders f
      JOIN domains d ON f.domain_id = d.id
      JOIN customers c ON f.customer_id = c.id
      WHERE ${where}
      ORDER BY d.domain_name, f.source
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, forwarders: result.rows });
  } catch (err) {
    console.error('Forwarders list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create forwarder
router.post('/forwarders', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { domain_id, customerId, source, destination } = req.body;

    if (!domain_id || !customerId || !source || !destination) {
      return res.status(400).json({
        success: false,
        error: 'domain_id, customerId, source, destination are required',
      });
    }

    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenant_id]
    );
    if (customerCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    const domainCheck = await pool.query(
      'SELECT id FROM domains WHERE id = $1 AND tenant_id = $2 AND customer_id = $3',
      [domain_id, tenant_id, customerId]
    );
    if (domainCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found for customer' });
    }

    const result = await pool.query(
      `INSERT INTO email_forwarders
         (tenant_id, customer_id, domain_id, source, destination)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [tenant_id, customerId, domain_id, source, destination]
    );

    // TODO: sync to mail server

    res.status(201).json({ success: true, forwarder: result.rows[0] });
  } catch (err) {
    console.error('Forwarder create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
