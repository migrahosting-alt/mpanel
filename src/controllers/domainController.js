import logger from '../config/logger.js';
import pool from '../db/index.js';
import {
  createDNSZone,
  createDNSRecord,
  deleteDNSZone,
} from '../services/provisioning/dns.js';

export const createDomain = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { 
      domain_name, 
      type = 'primary', 
      document_root, 
      php_version = '8.2', 
      auto_ssl = true,
      create_dns = true,
    } = req.body;
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

    logger.info(`Creating domain: ${domain_name}`, { userId: user_id });

    let dnsZoneId = null;

    // Provision DNS zone if requested
    if (create_dns) {
      try {
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
      document_root || `/var/www/${domain_name}/public`,
      php_version,
      auto_ssl,
      dnsZoneId,
    ]);
    
    const domain = result.rows[0];
    
    logger.info(`Domain created successfully: ${domain_name}`, { 
      userId: user_id,
      domainId: domain.id,
      dnsZoneId,
    });
    
    res.status(201).json({
      success: true,
      domain,
      message: `Domain ${domain_name} created successfully`,
    });
  } catch (error) {
    logger.error('Error creating domain:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create domain',
      message: error.message,
    });
  }
};

export const getDomains = async (req, res) => {
  try {
    const { customerId } = req.query;
    const { tenant_id } = req.user;
    
    let query = 'SELECT * FROM domains WHERE tenant_id = $1';
    const params = [tenant_id];
    
    if (customerId) {
      query += ' AND customer_id = $2';
      params.push(customerId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      domains: result.rows,
    });
  } catch (error) {
    logger.error('Error fetching domains:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch domains',
    });
  }
};

export const getDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;
    
    const result = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    res.json({
      success: true,
      domain: result.rows[0],
    });
  } catch (error) {
    logger.error('Error fetching domain:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch domain',
    });
  }
};

export const deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, id: user_id } = req.user;
    
    // Get domain details
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    if (domainResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    const domain = domainResult.rows[0];
    
    logger.info(`Deleting domain: ${domain.domain_name}`, { userId: user_id });

    // Delete DNS zone if exists
    if (domain.dns_zone_id) {
      try {
        await deleteDNSZone(domain.dns_zone_id, tenant_id);
        logger.info(`DNS zone deleted for domain: ${domain.domain_name}`);
      } catch (dnsError) {
        logger.error('Error deleting DNS zone:', dnsError);
        // Continue with domain deletion even if DNS fails
      }
    }
    
    // Delete domain
    await pool.query(
      'DELETE FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    logger.info(`Domain deleted successfully: ${domain.domain_name}`, { userId: user_id });
    
    res.json({
      success: true,
      message: `Domain ${domain.domain_name} deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting domain:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete domain',
      message: error.message,
    });
  }
};

export const addDNSRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, content, ttl = 3600, prio = 0 } = req.body;
    const { tenant_id } = req.user;
    
    // Get domain details
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );
    
    if (domainResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Domain not found' });
    }
    
    const domain = domainResult.rows[0];
    
    if (!domain.dns_zone_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Domain does not have a DNS zone',
      });
    }

    logger.info(`Adding DNS record for domain: ${domain.domain_name}`, { 
      type, 
      name, 
      content,
    });

    // Create DNS record
    const recordResult = await createDNSRecord({
      zoneId: domain.dns_zone_id,
      name,
      type,
      content,
      ttl,
      prio,
      tenantId: tenant_id,
    });
    
    logger.info(`DNS record created successfully for domain: ${domain.domain_name}`);
    
    res.status(201).json({
      success: true,
      record: recordResult.record,
      message: `DNS record ${type} ${name} created successfully`,
    });
  } catch (error) {
    logger.error('Error adding DNS record:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to add DNS record',
      message: error.message,
    });
  }
};
