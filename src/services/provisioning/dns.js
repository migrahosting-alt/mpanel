/**
 * DNS Provisioning Service
 * Handles DNS zone and record provisioning via PowerDNS API
 */

import pool from '../../db/index.js';

/**
 * Create DNS zone in database
 * @param {Object} config - Zone configuration
 * @param {string} config.domain - Domain name (e.g., 'example.com')
 * @param {number} config.tenantId - Tenant ID
 * @param {string} config.type - Zone type ('MASTER', 'SLAVE', 'NATIVE')
 * @returns {Promise<Object>} - Created zone
 */
export async function createDNSZone(config) {
  const { domain, tenantId, type = 'MASTER' } = config;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[DNS] Creating zone: ${domain}`);
    
    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(domain)) {
      throw new Error(`Invalid domain format: ${domain}`);
    }
    
    // Check if zone already exists
    const checkQuery = `
      SELECT id FROM dns_zones 
      WHERE domain = $1 AND tenant_id = $2
    `;
    const checkResult = await client.query(checkQuery, [domain, tenantId]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`DNS zone ${domain} already exists`);
    }
    
    // Generate SOA serial (YYYYMMDD01 format)
    const now = new Date();
    const serial = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}01`;
    
    // Create DNS zone
    const insertQuery = `
      INSERT INTO dns_zones (
        tenant_id,
        domain,
        type,
        master,
        serial,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const values = [tenantId, domain, type, null, parseInt(serial)];
    const result = await client.query(insertQuery, values);
    
    const zone = result.rows[0];
    
    // Create default SOA record
    await createDefaultRecords(zone.id, domain, serial, tenantId, client);
    
    console.log(`[DNS] ✓ Zone created: ${domain}`);
    console.log(`[DNS]   Serial: ${serial}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      zone: {
        id: zone.id,
        domain: zone.domain,
        type: zone.type,
        serial: zone.serial,
        created_at: zone.created_at,
      },
      message: `DNS zone ${domain} created successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DNS] Error creating zone ${domain}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create default DNS records for a new zone
 * @param {number} zoneId - Zone ID
 * @param {string} domain - Domain name
 * @param {string} serial - SOA serial
 * @param {number} tenantId - Tenant ID
 * @param {Object} client - Database client
 */
async function createDefaultRecords(zoneId, domain, serial, tenantId, client) {
  console.log(`[DNS] Creating default records for ${domain}`);
  
  const records = [
    // SOA record
    {
      name: domain,
      type: 'SOA',
      content: `ns1.${domain}. admin.${domain}. ${serial} 10800 3600 604800 3600`,
      ttl: 3600,
      prio: 0,
    },
    // NS records
    {
      name: domain,
      type: 'NS',
      content: `ns1.${domain}.`,
      ttl: 3600,
      prio: 0,
    },
    {
      name: domain,
      type: 'NS',
      content: `ns2.${domain}.`,
      ttl: 3600,
      prio: 0,
    },
    // A record (pointing to server IP - should be configured)
    {
      name: domain,
      type: 'A',
      content: process.env.DNS_DEFAULT_IP || '127.0.0.1',
      ttl: 3600,
      prio: 0,
    },
    // WWW CNAME
    {
      name: `www.${domain}`,
      type: 'CNAME',
      content: `${domain}.`,
      ttl: 3600,
      prio: 0,
    },
    // MX record
    {
      name: domain,
      type: 'MX',
      content: `mail.${domain}.`,
      ttl: 3600,
      prio: 10,
    },
  ];
  
  for (const record of records) {
    const insertQuery = `
      INSERT INTO dns_records (
        zone_id,
        tenant_id,
        name,
        type,
        content,
        ttl,
        prio,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `;
    
    await client.query(insertQuery, [
      zoneId,
      tenantId,
      record.name,
      record.type,
      record.content,
      record.ttl,
      record.prio,
    ]);
    
    console.log(`[DNS]   ✓ ${record.type} ${record.name} ${record.content}`);
  }
}

/**
 * Create DNS record
 * @param {Object} config - Record configuration
 * @param {number} config.zoneId - Zone ID
 * @param {string} config.name - Record name (e.g., 'www.example.com')
 * @param {string} config.type - Record type ('A', 'AAAA', 'CNAME', 'MX', 'TXT', etc.)
 * @param {string} config.content - Record content (IP, domain, text, etc.)
 * @param {number} config.ttl - TTL in seconds (default: 3600)
 * @param {number} config.prio - Priority for MX records (default: 0)
 * @param {number} config.tenantId - Tenant ID
 * @returns {Promise<Object>} - Created record
 */
export async function createDNSRecord(config) {
  const { zoneId, name, type, content, ttl = 3600, prio = 0, tenantId } = config;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[DNS] Creating record: ${type} ${name} ${content}`);
    
    // Validate record type
    const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'SRV', 'PTR'];
    if (!validTypes.includes(type.toUpperCase())) {
      throw new Error(`Invalid DNS record type: ${type}`);
    }
    
    // Create record
    const insertQuery = `
      INSERT INTO dns_records (
        zone_id,
        tenant_id,
        name,
        type,
        content,
        ttl,
        prio,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    
    const values = [zoneId, tenantId, name, type.toUpperCase(), content, ttl, prio];
    const result = await client.query(insertQuery, values);
    
    const record = result.rows[0];
    
    // Update zone serial
    await incrementZoneSerial(zoneId, client);
    
    console.log(`[DNS] ✓ Record created: ${type} ${name}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      record: {
        id: record.id,
        name: record.name,
        type: record.type,
        content: record.content,
        ttl: record.ttl,
        prio: record.prio,
        created_at: record.created_at,
      },
      message: `DNS record ${type} ${name} created successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DNS] Error creating record:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Increment zone serial number (for SOA updates)
 * @param {number} zoneId - Zone ID
 * @param {Object} client - Database client
 */
async function incrementZoneSerial(zoneId, client) {
  const updateQuery = `
    UPDATE dns_zones
    SET serial = serial + 1, updated_at = NOW()
    WHERE id = $1
    RETURNING serial
  `;
  
  const result = await client.query(updateQuery, [zoneId]);
  console.log(`[DNS]   Serial incremented to: ${result.rows[0].serial}`);
}

/**
 * Delete DNS zone and all its records
 * @param {number} zoneId - Zone ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function deleteDNSZone(zoneId, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[DNS] Deleting zone: ${zoneId}`);
    
    // Delete all records first
    const deleteRecordsQuery = `
      DELETE FROM dns_records 
      WHERE zone_id = $1 AND tenant_id = $2
    `;
    await client.query(deleteRecordsQuery, [zoneId, tenantId]);
    
    // Delete zone
    const deleteZoneQuery = `
      DELETE FROM dns_zones 
      WHERE id = $1 AND tenant_id = $2
      RETURNING domain
    `;
    
    const result = await client.query(deleteZoneQuery, [zoneId, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`DNS zone ${zoneId} not found`);
    }
    
    const domain = result.rows[0].domain;
    
    console.log(`[DNS] ✓ Zone deleted: ${domain}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `DNS zone ${domain} deleted successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DNS] Error deleting zone ${zoneId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete DNS record
 * @param {number} recordId - Record ID
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function deleteDNSRecord(recordId, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[DNS] Deleting record: ${recordId}`);
    
    const deleteQuery = `
      DELETE FROM dns_records 
      WHERE id = $1 AND tenant_id = $2
      RETURNING zone_id, name, type
    `;
    
    const result = await client.query(deleteQuery, [recordId, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`DNS record ${recordId} not found`);
    }
    
    const { zone_id, name, type } = result.rows[0];
    
    // Update zone serial
    await incrementZoneSerial(zone_id, client);
    
    console.log(`[DNS] ✓ Record deleted: ${type} ${name}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `DNS record ${type} ${name} deleted successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[DNS] Error deleting record ${recordId}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export default {
  createDNSZone,
  createDNSRecord,
  deleteDNSZone,
  deleteDNSRecord,
};
