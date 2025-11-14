import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// List zones for tenant
router.get('/zones', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, role } = req.user;

    let query = `
      SELECT z.*, d.domain_name
      FROM dns_zones z
      LEFT JOIN domains d ON z.domain_id = d.id
    `;
    const params = [];

    if (role !== 'admin') {
      query += ' WHERE z.tenant_id = $1';
      params.push(tenant_id);
    }

    query += ' ORDER BY z.name ASC';

    const result = await pool.query(query, params);
    res.json({ success: true, zones: result.rows });
  } catch (err) {
    console.error('DNS zones error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// List records for a zone
router.get('/zones/:zoneId/records', authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.params;
    const result = await pool.query(
      `SELECT * FROM dns_records WHERE zone_id = $1 ORDER BY type, name`,
      [zoneId]
    );
    res.json({ success: true, records: result.rows });
  } catch (err) {
    console.error('DNS records error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create record
router.post('/zones/:zoneId/records', authenticateToken, async (req, res) => {
  try {
    const { zoneId } = req.params;
    const { name, type, content, ttl = 300, priority } = req.body;

    if (!name || !type || !content) {
      return res
        .status(400)
        .json({ success: false, error: 'name, type and content are required' });
    }

    const result = await pool.query(
      `INSERT INTO dns_records
       (zone_id, name, type, content, ttl, priority)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [zoneId, name, type.toUpperCase(), content, ttl, priority ?? null]
    );

    res.status(201).json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error('DNS create error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update record
router.put('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, content, ttl, priority } = req.body;

    const result = await pool.query(
      `UPDATE dns_records
       SET name = COALESCE($2, name),
           type = COALESCE($3, type),
           content = COALESCE($4, content),
           ttl = COALESCE($5, ttl),
           priority = COALESCE($6, priority),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, name, type?.toUpperCase() || null, content || null, ttl || null, priority || null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    res.json({ success: true, record: result.rows[0] });
  } catch (err) {
    console.error('DNS update error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete record
router.delete('/records/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM dns_records WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DNS delete error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
