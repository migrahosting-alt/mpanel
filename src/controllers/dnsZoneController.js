// src/controllers/dnsZoneController.js
/**
 * Advanced DNS Zone Management Controller
 * Handles DNS zones, records, and bulk operations
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';

/**
 * Get all DNS zones for user
 */
export const getZones = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT 
        z.*,
        u.email as owner_email,
        COUNT(r.id) as record_count
      FROM dns_zones z
      LEFT JOIN users u ON z.user_id = u.id
      LEFT JOIN dns_records r ON z.id = r.zone_id
    `;

    const params = [];
    if (!isAdmin) {
      query += ` WHERE z.user_id = $1`;
      params.push(userId);
    }

    query += ` GROUP BY z.id, u.email ORDER BY z.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ zones: result.rows });
  } catch (error) {
    logger.error('Error fetching DNS zones:', error);
    res.status(500).json({ error: 'Failed to fetch DNS zones' });
  }
};

/**
 * Get single DNS zone with records
 */
export const getZone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get zone
    const zoneQuery = isAdmin
      ? `SELECT * FROM dns_zones WHERE id = $1`
      : `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`;
    
    const zoneParams = isAdmin ? [id] : [id, userId];
    const zoneResult = await pool.query(zoneQuery, zoneParams);

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const zone = zoneResult.rows[0];

    // Get all records for this zone
    const recordsResult = await pool.query(
      `SELECT * FROM dns_records WHERE zone_id = $1 ORDER BY type, name`,
      [id]
    );

    res.json({ zone, records: recordsResult.rows });
  } catch (error) {
    logger.error('Error fetching DNS zone:', error);
    res.status(500).json({ error: 'Failed to fetch DNS zone' });
  }
};

/**
 * Create new DNS zone
 */
export const createZone = async (req, res) => {
  try {
    const userId = req.user.id;
    const { domain, default_ttl } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Check if zone already exists
    const existing = await pool.query(
      `SELECT id FROM dns_zones WHERE domain = $1`,
      [domain]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'DNS zone already exists for this domain' });
    }

    const result = await pool.query(
      `INSERT INTO dns_zones (user_id, domain, default_ttl, serial)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, domain, default_ttl || 3600, Date.now()]
    );

    const zone = result.rows[0];

    // Create default DNS records
    const defaultRecords = [
      { type: 'SOA', name: '@', content: `ns1.${domain}. admin.${domain}. ${zone.serial} 3600 1800 1209600 300`, ttl: 3600 },
      { type: 'NS', name: '@', content: `ns1.${domain}.`, ttl: 3600 },
      { type: 'NS', name: '@', content: `ns2.${domain}.`, ttl: 3600 },
      { type: 'A', name: '@', content: '0.0.0.0', ttl: 3600 },
      { type: 'A', name: 'www', content: '0.0.0.0', ttl: 3600 },
    ];

    for (const record of defaultRecords) {
      await pool.query(
        `INSERT INTO dns_records (zone_id, type, name, content, ttl)
         VALUES ($1, $2, $3, $4, $5)`,
        [zone.id, record.type, record.name, record.content, record.ttl]
      );
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'dns_zone_created', `Created DNS zone for ${domain}`]
    );

    logger.info(`DNS zone created for ${domain}`);
    res.status(201).json(zone);
  } catch (error) {
    logger.error('Error creating DNS zone:', error);
    res.status(500).json({ error: 'Failed to create DNS zone' });
  }
};

/**
 * Update DNS zone
 */
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { default_ttl } = req.body;

    const result = await pool.query(
      `UPDATE dns_zones 
       SET default_ttl = $1, serial = $2, updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [default_ttl, Date.now(), id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating DNS zone:', error);
    res.status(500).json({ error: 'Failed to update DNS zone' });
  }
};

/**
 * Delete DNS zone
 */
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get zone info first
    const zoneQuery = isAdmin
      ? `SELECT * FROM dns_zones WHERE id = $1`
      : `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`;
    
    const zoneParams = isAdmin ? [id] : [id, userId];
    const zoneResult = await pool.query(zoneQuery, zoneParams);

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const zone = zoneResult.rows[0];

    // Delete all records first (cascade should handle this, but explicit is better)
    await pool.query(`DELETE FROM dns_records WHERE zone_id = $1`, [id]);

    // Delete zone
    await pool.query(`DELETE FROM dns_zones WHERE id = $1`, [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'dns_zone_deleted', `Deleted DNS zone for ${zone.domain}`]
    );

    logger.info(`DNS zone deleted: ${zone.domain}`);
    res.json({ message: 'DNS zone deleted successfully' });
  } catch (error) {
    logger.error('Error deleting DNS zone:', error);
    res.status(500).json({ error: 'Failed to delete DNS zone' });
  }
};

/**
 * Get DNS records for a zone
 */
export const getRecords = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Verify zone ownership
    const zoneQuery = isAdmin
      ? `SELECT * FROM dns_zones WHERE id = $1`
      : `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`;
    
    const zoneParams = isAdmin ? [zoneId] : [zoneId, userId];
    const zoneResult = await pool.query(zoneQuery, zoneParams);

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const result = await pool.query(
      `SELECT * FROM dns_records WHERE zone_id = $1 ORDER BY type, name`,
      [zoneId]
    );

    res.json({ records: result.rows });
  } catch (error) {
    logger.error('Error fetching DNS records:', error);
    res.status(500).json({ error: 'Failed to fetch DNS records' });
  }
};

/**
 * Create DNS record
 */
export const createRecord = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;
    const { type, name, content, ttl, priority } = req.body;

    if (!type || !name || !content) {
      return res.status(400).json({ error: 'Type, name, and content are required' });
    }

    // Verify zone ownership
    const zoneResult = await pool.query(
      `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`,
      [zoneId, userId]
    );

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const result = await pool.query(
      `INSERT INTO dns_records (zone_id, type, name, content, ttl, priority)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [zoneId, type, name, content, ttl || 3600, priority || null]
    );

    // Update zone serial
    await pool.query(
      `UPDATE dns_zones SET serial = $1, updated_at = NOW() WHERE id = $2`,
      [Date.now(), zoneId]
    );

    logger.info(`DNS record created: ${type} ${name} in zone ${zoneId}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating DNS record:', error);
    res.status(500).json({ error: 'Failed to create DNS record' });
  }
};

/**
 * Update DNS record
 */
export const updateRecord = async (req, res) => {
  try {
    const { zoneId, recordId } = req.params;
    const userId = req.user.id;
    const { type, name, content, ttl, priority } = req.body;

    // Verify zone ownership
    const zoneResult = await pool.query(
      `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`,
      [zoneId, userId]
    );

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const result = await pool.query(
      `UPDATE dns_records 
       SET type = $1, name = $2, content = $3, ttl = $4, priority = $5, updated_at = NOW()
       WHERE id = $6 AND zone_id = $7
       RETURNING *`,
      [type, name, content, ttl, priority, recordId, zoneId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DNS record not found' });
    }

    // Update zone serial
    await pool.query(
      `UPDATE dns_zones SET serial = $1, updated_at = NOW() WHERE id = $2`,
      [Date.now(), zoneId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating DNS record:', error);
    res.status(500).json({ error: 'Failed to update DNS record' });
  }
};

/**
 * Delete DNS record
 */
export const deleteRecord = async (req, res) => {
  try {
    const { zoneId, recordId } = req.params;
    const userId = req.user.id;

    // Verify zone ownership
    const zoneResult = await pool.query(
      `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`,
      [zoneId, userId]
    );

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const result = await pool.query(
      `DELETE FROM dns_records WHERE id = $1 AND zone_id = $2 RETURNING *`,
      [recordId, zoneId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'DNS record not found' });
    }

    // Update zone serial
    await pool.query(
      `UPDATE dns_zones SET serial = $1, updated_at = NOW() WHERE id = $2`,
      [Date.now(), zoneId]
    );

    res.json({ message: 'DNS record deleted successfully' });
  } catch (error) {
    logger.error('Error deleting DNS record:', error);
    res.status(500).json({ error: 'Failed to delete DNS record' });
  }
};

/**
 * Bulk create DNS records
 */
export const bulkCreateRecords = async (req, res) => {
  try {
    const { zoneId } = req.params;
    const userId = req.user.id;
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    // Verify zone ownership
    const zoneResult = await pool.query(
      `SELECT * FROM dns_zones WHERE id = $1 AND user_id = $2`,
      [zoneId, userId]
    );

    if (zoneResult.rows.length === 0) {
      return res.status(404).json({ error: 'DNS zone not found' });
    }

    const createdRecords = [];
    for (const record of records) {
      const result = await pool.query(
        `INSERT INTO dns_records (zone_id, type, name, content, ttl, priority)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [zoneId, record.type, record.name, record.content, record.ttl || 3600, record.priority || null]
      );
      createdRecords.push(result.rows[0]);
    }

    // Update zone serial
    await pool.query(
      `UPDATE dns_zones SET serial = $1, updated_at = NOW() WHERE id = $2`,
      [Date.now(), zoneId]
    );

    logger.info(`Bulk created ${createdRecords.length} DNS records in zone ${zoneId}`);
    res.status(201).json({ records: createdRecords });
  } catch (error) {
    logger.error('Error bulk creating DNS records:', error);
    res.status(500).json({ error: 'Failed to bulk create DNS records' });
  }
};
