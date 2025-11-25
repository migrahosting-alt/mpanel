import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { createDNSZone, deleteDNSZone } from '../services/provisioning/dns.js';
import pool from '../db/index.js';
const router = express.Router();

// Get all domains for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      // Admins see all domains for their tenant
      query = `
        SELECT d.*, 
               c.company_name as customer_company,
               u.email as customer_email, 
               u.first_name, 
               u.last_name
        FROM domains d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE d.tenant_id = $1
        ORDER BY d.created_at DESC
      `;
      params = [tenant_id];
    } else {
      // Regular users see only their domains (via customer_id)
      query = `
        SELECT d.*, 
               c.company_name as customer_company,
               u.email as customer_email, 
               u.first_name, 
               u.last_name
        FROM domains d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE d.tenant_id = $1
        ORDER BY d.created_at DESC
      `;
      params = [tenant_id];
    }
    
    const result = await pool.query(query, params);
    res.json({ success: true, domains: result.rows });
  } catch (error) {
    console.error('Error fetching domains:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single domain
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: user_id, role } = req.user;
    
    let query;
    let params;
    
    if (role === 'admin') {
      query = `
        SELECT d.*, 
               c.company_name as customer_company,
               u.email as customer_email
        FROM domains d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE d.id = $1 AND d.tenant_id = $2
      `;
      params = [id, tenant_id];
    } else {
      query = `
        SELECT d.*, 
               c.company_name as customer_company,
               u.email as customer_email
        FROM domains d
        LEFT JOIN customers c ON d.customer_id = c.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE d.id = $1 AND d.tenant_id = $2
      `;
      params = [id, tenant_id];
    }
    
    const result = await pool.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    res.json({ success: true, domain: result.rows[0] });
  } catch (error) {
    console.error('Error fetching domain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new domain
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { domain_name, customerId, type = 'primary', document_root, php_version = '8.2', auto_ssl = true, create_dns = true } = req.body;
    const { tenant_id, id: user_id, role } = req.user;
    
    if (!domain_name || !customerId) {
      return res.status(400).json({ success: false, error: 'Domain name and customerId are required' });
    }
    
    // Validate customer exists and belongs to this user (or any customer for admins)
    let customerQuery;
    let customerParams;
    
    if (role === 'admin') {
      // Admin: allow any customer in the tenant
      customerQuery = 'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2';
      customerParams = [customerId, tenant_id];
    } else {
      // Regular user: only their own customers
      customerQuery = 'SELECT id FROM customers WHERE id = $1 AND user_id = $2';
      customerParams = [customerId, user_id];
    }
    
    const customerCheck = await pool.query(customerQuery, customerParams);
    
    if (customerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found or access denied' });
    }
    
    // Extract TLD from domain name (e.g., 'example.com' -> 'com')
    const tld = domain_name.split('.').pop();
    
    // Check if domain already exists
    const existingDomain = await pool.query(
      'SELECT id FROM domains WHERE domain_name = $1',
      [domain_name]
    );
    
    if (existingDomain.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Domain already exists' });
    }

    let dnsZoneId = null;

    // Provision DNS zone if requested
    if (create_dns) {
      try {
        logger.info(`Creating DNS zone for domain: ${domain_name}`, { userId: user_id });
        const dnsResult = await createDNSZone({
          domain: domain_name,
          tenantId: tenant_id,
          type: 'MASTER',
        });
        dnsZoneId = dnsResult.zone.id;
        logger.info(`DNS zone created for domain: ${domain_name}`, { zoneId: dnsZoneId });
      } catch (dnsError) {
        logger.error('Error creating DNS zone:', dnsError);
        // Continue with domain creation even if DNS fails
      }
    }
    
    const query = `
      INSERT INTO domains (
        tenant_id, user_id, customer_id, domain_name, tld, type, document_root, 
        php_version, auto_ssl, status, dns_zone_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
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
      auto_ssl,
      dnsZoneId
    ]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'create_domain', 'domain', $3, $4)`,
      [tenant_id, user_id, result.rows[0].id, JSON.stringify({ domain_name, dns_zone_id: dnsZoneId })]
    );
    
    // If auto_ssl is enabled, create SSL certificate request
    if (auto_ssl) {
      await pool.query(
        `INSERT INTO ssl_certificates (domain_id, type, status)
         VALUES ($1, 'letsencrypt', 'pending')`,
        [result.rows[0].id]
      );
    }
    
    res.status(201).json({ success: true, domain: result.rows[0] });
  } catch (error) {
    console.error('Error creating domain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update domain
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: customer_id, role } = req.user;
    const {
      php_version,
      auto_ssl,
      redirect_url,
      redirect_type,
      status
    } = req.body;
    
    // Check domain ownership
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM domains WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2 AND user_id = $3';
      checkParams = [id, tenant_id, customer_id];
    }
    
    const domainCheck = await pool.query(checkQuery, checkParams);
    
    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (php_version !== undefined) {
      updates.push(`php_version = $${paramCount++}`);
      values.push(php_version);
    }
    
    if (auto_ssl !== undefined) {
      updates.push(`auto_ssl = $${paramCount++}`);
      values.push(auto_ssl);
    }
    
    if (redirect_url !== undefined) {
      updates.push(`redirect_url = $${paramCount++}`);
      values.push(redirect_url);
    }
    
    if (redirect_type !== undefined) {
      updates.push(`redirect_type = $${paramCount++}`);
      values.push(redirect_type);
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
      UPDATE domains 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'update_domain', 'domain', $3, $4)`,
      [tenant_id, customer_id, id, JSON.stringify(req.body)]
    );
    
    res.json({ success: true, domain: result.rows[0] });
  } catch (error) {
    console.error('Error updating domain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete domain
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: customer_id, role } = req.user;
    
    // Check domain ownership
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM domains WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2 AND user_id = $3';
      checkParams = [id, tenant_id, customer_id];
    }
    
    const domainCheck = await pool.query(checkQuery, checkParams);
    
    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    const domain = domainCheck.rows[0];

    // Delete DNS zone if exists
    if (domain.dns_zone_id) {
      try {
        logger.info(`Deleting DNS zone for domain: ${domain.domain_name}`, { zoneId: domain.dns_zone_id });
        await deleteDNSZone(domain.dns_zone_id, tenant_id);
        logger.info(`DNS zone deleted for domain: ${domain.domain_name}`);
      } catch (dnsError) {
        logger.error('Error deleting DNS zone:', dnsError);
        // Continue with domain deletion even if DNS fails
      }
    }
    
    // Delete domain (cascades to SSL, DNS records, etc.)
    await pool.query('DELETE FROM domains WHERE id = $1', [id]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'delete_domain', 'domain', $3, $4)`,
      [tenant_id, customer_id, id, JSON.stringify({ domain_name: domain.domain_name })]
    );
    
    res.json({ success: true, message: 'Domain deleted successfully' });
  } catch (error) {
    console.error('Error deleting domain:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get SSL certificate for domain
router.get('/:id/ssl', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: customer_id, role } = req.user;
    
    // Check domain ownership
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM domains WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2 AND user_id = $3';
      checkParams = [id, tenant_id, customer_id];
    }
    
    const domainCheck = await pool.query(checkQuery, checkParams);
    
    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    const result = await pool.query(
      'SELECT * FROM ssl_certificates WHERE domain_id = $1 ORDER BY created_at DESC LIMIT 1',
      [id]
    );
    
    res.json({ success: true, ssl: result.rows[0] || null });
  } catch (error) {
    console.error('Error fetching SSL certificate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Request SSL certificate
router.post('/:id/ssl', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: customer_id, role } = req.user;
    const { type = 'letsencrypt' } = req.body;
    
    // Check domain ownership
    let checkQuery;
    let checkParams;
    
    if (role === 'admin') {
      checkQuery = 'SELECT * FROM domains WHERE id = $1';
      checkParams = [id];
    } else {
      checkQuery = 'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2 AND user_id = $3';
      checkParams = [id, tenant_id, customer_id];
    }
    
    const domainCheck = await pool.query(checkQuery, checkParams);
    
    if (domainCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    // Create SSL certificate request
    const result = await pool.query(
      `INSERT INTO ssl_certificates (domain_id, type, status, auto_renew)
       VALUES ($1, $2, 'pending', true)
       RETURNING *`,
      [id, type]
    );
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (tenant_id, user_id, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'request_ssl', 'ssl_certificate', $3, $4)`,
      [tenant_id, customer_id, result.rows[0].id, JSON.stringify({ domain_id: id, type })]
    );
    
    res.status(201).json({ 
      success: true, 
      ssl: result.rows[0],
      message: 'SSL certificate request created. It will be processed shortly.'
    });
  } catch (error) {
    console.error('Error requesting SSL certificate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;


