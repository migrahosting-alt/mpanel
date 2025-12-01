// src/routes/adminServers.js
// Admin API for managing servers

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/admin/servers
 * Returns all servers
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.*,
        COUNT(pt.id) FILTER (WHERE pt.status = 'pending') as pending_tasks,
        COUNT(pt.id) FILTER (WHERE pt.status = 'in_progress') as active_tasks
      FROM servers s
      LEFT JOIN provisioning_tasks pt ON s.id = pt.server_id
      GROUP BY s.id
      ORDER BY s.created_at ASC
    `);

    res.json({ servers: result.rows });
  } catch (err) {
    console.error('Error fetching servers:', err);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

/**
 * POST /api/admin/servers
 * Create a new server
 */
router.post('/', async (req, res) => {
  try {
    const { name, fqdn, ipAddress, location, role, apiBaseUrl, isActive } = req.body;

    if (!name || !fqdn || !role) {
      return res.status(400).json({ error: 'name, fqdn, and role are required' });
    }

    const result = await pool.query(`
      INSERT INTO servers (name, fqdn, ip_address, location, role, api_base_url, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, fqdn, ipAddress || null, location || null, role, apiBaseUrl || null, isActive !== false]);

    res.status(201).json({ server: result.rows[0] });
  } catch (err) {
    console.error('Error creating server:', err);
    
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Server name already exists' });
    }
    
    res.status(500).json({ error: 'Failed to create server' });
  }
});

/**
 * PATCH /api/admin/servers/:id
 * Update server
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { fqdn, ipAddress, location, role, apiBaseUrl, isActive } = req.body;

    const result = await pool.query(`
      UPDATE servers 
      SET 
        fqdn = COALESCE($1, fqdn),
        ip_address = COALESCE($2, ip_address),
        location = COALESCE($3, location),
        role = COALESCE($4, role),
        api_base_url = COALESCE($5, api_base_url),
        is_active = COALESCE($6, is_active),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [fqdn, ipAddress, location, role, apiBaseUrl, isActive, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({ server: result.rows[0] });
  } catch (err) {
    console.error('Error updating server:', err);
    res.status(500).json({ error: 'Failed to update server' });
  }
});

export default router;
