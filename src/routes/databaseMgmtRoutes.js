import express from 'express';
import pool from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get all databases for tenant
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    let query = `
      SELECT 
        d.id,
        d.name,
        d.db_user,
        d.size_mb,
        d.max_size_mb,
        d.created_at,
        d.status,
        dom.domain_name as associated_domain
      FROM databases d
      LEFT JOIN domains dom ON d.domain_id = dom.id
      WHERE d.tenant_id = $1
      ORDER BY d.created_at DESC
    `;
    
    const result = await pool.query(query, [req.user.tenant_id]);
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create database
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, db_user, db_password, max_size_mb = 512, domain_id } = req.body;
    
    if (!name || !db_user || !db_password) {
      return res.status(400).json({ 
        error: 'Database name, username, and password are required' 
      });
    }
    
    // Validate database name (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      return res.status(400).json({ 
        error: 'Database name can only contain letters, numbers, and underscores' 
      });
    }
    
    // Validate username
    if (!/^[a-zA-Z0-9_]+$/.test(db_user)) {
      return res.status(400).json({ 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Hash password for storage
    const password_hash = await bcrypt.hash(db_password, 10);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create database record
      const dbResult = await client.query(
        `INSERT INTO databases 
        (tenant_id, name, db_user, password_hash, max_size_mb, domain_id, status) 
        VALUES ($1, $2, $3, $4, $5, $6, 'active') 
        RETURNING *`,
        [req.user.tenant_id, name, db_user, password_hash, max_size_mb, domain_id]
      );
      
      // Create actual PostgreSQL database
      await client.query(`CREATE DATABASE "${name}"`);
      
      // Create database user
      await client.query(`CREATE USER "${db_user}" WITH PASSWORD '${db_password}'`);
      
      // Grant privileges
      await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${name}" TO "${db_user}"`);
      
      await client.query('COMMIT');
      
      // Log activity
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, 'database_created', JSON.stringify({ database: name, user: db_user })]
      );
      
      res.json({ 
        message: 'Database created successfully',
        database: {
          ...dbResult.rows[0],
          password_hash: undefined // Don't return hash
        }
      });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete database
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get database details
      const dbResult = await client.query(
        'SELECT * FROM databases WHERE id = $1 AND tenant_id = $2',
        [id, req.user.tenant_id]
      );
      
      if (dbResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Database not found' });
      }
      
      const database = dbResult.rows[0];
      
      // Terminate active connections
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
      `, [database.name]);
      
      // Drop database
      await client.query(`DROP DATABASE IF EXISTS "${database.name}"`);
      
      // Drop user
      await client.query(`DROP USER IF EXISTS "${database.db_user}"`);
      
      // Delete record
      await client.query(
        'DELETE FROM databases WHERE id = $1',
        [id]
      );
      
      await client.query('COMMIT');
      
      // Log activity
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, 'database_deleted', JSON.stringify({ database: database.name })]
      );
      
      res.json({ message: 'Database deleted successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get database users
router.get('/:id/users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    // Get PostgreSQL users for this database
    const result = await pool.query(`
      SELECT 
        usename as username,
        usecreatedb as can_create_db,
        usesuper as is_superuser,
        valuntil as password_expires
      FROM pg_user
      WHERE usename LIKE $1
    `, [`%${dbCheck.rows[0].name}%`]);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('Error fetching database users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create database user
router.post('/:id/users', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // Validate username
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const dbName = dbCheck.rows[0].name;
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      await client.query(`CREATE USER "${username}" WITH PASSWORD '${password}'`);
      
      // Grant privileges
      const privString = privileges.join(', ');
      await client.query(`GRANT ${privString} ON DATABASE "${dbName}" TO "${username}"`);
      
      await client.query('COMMIT');
      
      // Log activity
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
        [req.user.id, 'database_user_created', JSON.stringify({ database: dbName, user: username })]
      );
      
      res.json({ message: 'Database user created successfully' });
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error creating database user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete database user
router.delete('/:id/users/:username', authenticateToken, async (req, res) => {
  try {
    const { id, username } = req.params;
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    await pool.query(`DROP USER IF EXISTS "${username}"`);
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'database_user_deleted', JSON.stringify({ database: dbCheck.rows[0].name, user: username })]
    );
    
    res.json({ message: 'Database user deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting database user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update database user password
router.post('/:id/users/:username/password', authenticateToken, async (req, res) => {
  try {
    const { id, username } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    await pool.query(`ALTER USER "${username}" WITH PASSWORD '${password}'`);
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'database_user_password_updated', JSON.stringify({ database: dbCheck.rows[0].name, user: username })]
    );
    
    res.json({ message: 'Password updated successfully' });
    
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get database size and statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name, max_size_mb FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    const dbName = dbCheck.rows[0].name;
    
    // Get database size
    const sizeResult = await pool.query(`
      SELECT pg_database_size($1) as size_bytes
    `, [dbName]);
    
    // Get table count
    const tableResult = await pool.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_catalog = $1
      AND table_schema = 'public'
    `, [dbName]);
    
    const size_bytes = parseInt(sizeResult.rows[0].size_bytes);
    const size_mb = Math.round(size_bytes / (1024 * 1024) * 100) / 100;
    
    // Update size in database
    await pool.query(
      'UPDATE databases SET size_mb = $1 WHERE id = $2',
      [size_mb, id]
    );
    
    res.json({
      size_bytes,
      size_mb,
      max_size_mb: dbCheck.rows[0].max_size_mb,
      usage_percent: Math.round((size_mb / dbCheck.rows[0].max_size_mb) * 100),
      table_count: parseInt(tableResult.rows[0].table_count)
    });
    
  } catch (error) {
    console.error('Error fetching database stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export database (SQL dump)
router.get('/:id/export', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    // In production, this would use pg_dump
    // For now, return a simple representation
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${dbCheck.rows[0].name}.sql"`);
    
    res.send(`-- Database export for ${dbCheck.rows[0].name}\n-- Generated on ${new Date().toISOString()}\n\n`);
    
  } catch (error) {
    console.error('Error exporting database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Import SQL file
router.post('/:id/import', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { sql } = req.body;
    
    if (!sql) {
      return res.status(400).json({ error: 'SQL content is required' });
    }
    
    // Verify database belongs to tenant
    const dbCheck = await pool.query(
      'SELECT name FROM databases WHERE id = $1 AND tenant_id = $2',
      [id, req.user.tenant_id]
    );
    
    if (dbCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    // Execute SQL (be careful with this in production!)
    await pool.query(sql);
    
    // Log activity
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'database_imported', JSON.stringify({ database: dbCheck.rows[0].name })]
    );
    
    res.json({ message: 'SQL imported successfully' });
    
  } catch (error) {
    console.error('Error importing SQL:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
