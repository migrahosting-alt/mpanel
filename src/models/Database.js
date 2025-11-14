import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

class Database {
  static async create(databaseData) {
    const {
      tenantId,
      customerId,
      serverId,
      websiteId,
      name,
      dbType,
      dbUser,
      dbPassword,
      dbHost = 'localhost',
      dbPort,
      charset = 'utf8mb4',
      collation,
      metadata = {}
    } = databaseData;

    const passwordHash = await bcrypt.hash(dbPassword, 10);
    const port = dbPort || (dbType === 'postgresql' ? 5432 : 3306);

    // Generate connection string
    const connectionString = this.generateConnectionString(
      dbType, dbUser, dbPassword, dbHost, port, name
    );

    const result = await pool.query(
      `INSERT INTO databases (
        tenant_id, customer_id, server_id, website_id, name, db_type,
        db_user, db_password_hash, db_host, db_port, charset, collation,
        connection_string, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
      RETURNING *`,
      [tenantId, customerId, serverId, websiteId, name, dbType, dbUser, passwordHash, dbHost, port, charset, collation, connectionString, metadata]
    );
    
    // Don't return password hash
    delete result.rows[0].db_password_hash;
    return result.rows[0];
  }

  static generateConnectionString(dbType, user, password, host, port, database) {
    if (dbType === 'postgresql') {
      return `postgresql://${user}:${password}@${host}:${port}/${database}`;
    } else {
      return `mysql://${user}:${password}@${host}:${port}/${database}`;
    }
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT d.*, s.name as server_name, w.name as website_name
       FROM databases d
       LEFT JOIN servers s ON d.server_id = s.id
       LEFT JOIN websites w ON d.website_id = w.id
       WHERE d.id = $1`,
      [id]
    );
    if (result.rows[0]) {
      delete result.rows[0].db_password_hash;
    }
    return result.rows[0];
  }

  static async findByTenant(tenantId) {
    const result = await pool.query(
      `SELECT d.*, s.name as server_name, w.name as website_name
       FROM databases d
       LEFT JOIN servers s ON d.server_id = s.id
       LEFT JOIN websites w ON d.website_id = w.id
       WHERE d.tenant_id = $1 
       ORDER BY d.created_at DESC`,
      [tenantId]
    );
    result.rows.forEach(row => delete row.db_password_hash);
    return result.rows;
  }

  static async findByServer(serverId) {
    const result = await pool.query(
      `SELECT d.*, w.name as website_name
       FROM databases d
       LEFT JOIN websites w ON d.website_id = w.id
       WHERE d.server_id = $1 
       ORDER BY d.name ASC`,
      [serverId]
    );
    result.rows.forEach(row => delete row.db_password_hash);
    return result.rows;
  }

  static async findByWebsite(websiteId) {
    const result = await pool.query(
      'SELECT * FROM databases WHERE website_id = $1 ORDER BY name ASC',
      [websiteId]
    );
    result.rows.forEach(row => delete row.db_password_hash);
    return result.rows;
  }

  static async rotatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    // Get current database info to regenerate connection string
    const current = await pool.query(
      'SELECT db_type, db_user, db_host, db_port, name FROM databases WHERE id = $1',
      [id]
    );

    if (!current.rows[0]) {
      throw new Error('Database not found');
    }

    const { db_type, db_user, db_host, db_port, name } = current.rows[0];
    const connectionString = this.generateConnectionString(
      db_type, db_user, newPassword, db_host, db_port, name
    );

    const result = await pool.query(
      `UPDATE databases 
       SET db_password_hash = $1, connection_string = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [passwordHash, connectionString, id]
    );
    
    if (result.rows[0]) {
      delete result.rows[0].db_password_hash;
    }
    return result.rows[0];
  }

  static async updateSize(id, sizeMb) {
    const result = await pool.query(
      `UPDATE databases 
       SET size_mb = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [sizeMb, id]
    );
    if (result.rows[0]) {
      delete result.rows[0].db_password_hash;
    }
    return result.rows[0];
  }
}

export default Database;
