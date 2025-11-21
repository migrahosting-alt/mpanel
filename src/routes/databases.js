import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();

/**
 * Assumed schema:
 * databases (
 *   id uuid PK,
 *   tenant_id uuid NOT NULL,
 *   customer_id uuid NOT NULL,
 *   name varchar NOT NULL,
 *   db_type varchar NOT NULL,
 *   username varchar,
 *   status varchar,
 *   created_at timestamp,
 *   updated_at timestamp
 * )
 */

// GET /api/db-management
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id, id: user_id, role } = req.user;

    const params = [tenant_id];
    let where = 'd.tenant_id = $1';

    if (role !== 'admin') {
      params.push(user_id);
      where += ' AND c.user_id = $2';
    }

    const query = `
      SELECT d.*, c.company_name
      FROM databases d
      JOIN customers c ON d.customer_id = c.id
      WHERE ${where}
      ORDER BY d.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json({ success: true, databases: result.rows });
  } catch (err) {
    console.error('DB list error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new database (panel + physical)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.user;
    const { name, db_type = 'postgres', customerId } = req.body;

    if (!name || !customerId) {
      return res
        .status(400)
        .json({ success: false, error: 'name and customerId are required' });
    }

    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND tenant_id = $2',
      [customerId, tenant_id]
    );
    if (customerCheck.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Generate DB username and password
    const dbUser = `u_${name.slice(0, 10)}_${Date.now().toString(36)}`.replace(
      /[^a-zA-Z0-9_]/g,
      ''
    );
    const dbPass =
      Math.random().toString(36).slice(2) +
      Math.random().toString(36).slice(2);

    // Create database on physical DB server via server agent
    try {
      const serverResult = await pool.query('SELECT * FROM servers WHERE tenant_id = $1 LIMIT 1', [tenant_id]);
      const server = serverResult.rows[0];
      
      if (server) {
        const axios = (await import('axios')).default;
        const https = (await import('https')).default;
        
        await axios.post(`https://${server.hostname}:3100/api/databases`, {
          name,
          user: dbUser,
          password: dbPass,
          type: db_type
        }, {
          headers: {
            'Authorization': `Bearer ${server.api_key}`,
            'Content-Type': 'application/json'
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false })
        });
        
        console.log(`Database ${name} created on server ${server.hostname}`);
      }
    } catch (agentError) {
      console.error('Failed to create database on physical server:', agentError.message);
      // Continue anyway - database record will be created in mPanel
    }

    const result = await pool.query(
      `INSERT INTO databases
       (tenant_id, customer_id, name, db_type, username, status)
       VALUES ($1,$2,$3,$4,$5,'active')
       RETURNING *`,
      [tenant_id, customerId, name, db_type, dbUser]
    );

    res.status(201).json({
      success: true,
      database: { ...result.rows[0], generated_password: dbPass },
    });
  } catch (err) {
    console.error('DB create error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete database (panel + physical)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Get database details before deletion
    const dbResult = await pool.query('SELECT * FROM databases WHERE id = $1', [id]);
    const database = dbResult.rows[0];
    
    if (database) {
      // Drop database on physical server
      try {
        const serverResult = await pool.query('SELECT * FROM servers WHERE tenant_id = $1 LIMIT 1', [database.tenant_id]);
        const server = serverResult.rows[0];
        
        if (server) {
          const axios = (await import('axios')).default;
          const https = (await import('https')).default;
          
          await axios.delete(`https://${server.hostname}:3100/api/databases/${database.name}`, {
            headers: {
              'Authorization': `Bearer ${server.api_key}`
            },
            httpsAgent: new https.Agent({ rejectUnauthorized: false })
          });
          
          console.log(`Database ${database.name} dropped on server ${server.hostname}`);
        }
      } catch (agentError) {
        console.error('Failed to drop database on physical server:', agentError.message);
        // Continue with deletion from mPanel anyway
      }
    }

    await pool.query('DELETE FROM databases WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DB delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

