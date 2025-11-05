import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

class Mailbox {
  static async create(mailboxData) {
    const {
      tenantId,
      customerId,
      domainId,
      email,
      password,
      quotaMb = 1024,
      forwardTo,
      isCatchAll = false,
      metadata = {}
    } = mailboxData;

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO mailboxes (
        tenant_id, customer_id, domain_id, email, password_hash,
        quota_mb, forward_to, is_catch_all, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *`,
      [tenantId, customerId, domainId, email, passwordHash, quotaMb, forwardTo, isCatchAll, metadata]
    );
    
    // Don't return password hash
    delete result.rows[0].password_hash;
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT m.*, d.domain_name
       FROM mailboxes m
       LEFT JOIN domains d ON m.domain_id = d.id
       WHERE m.id = $1`,
      [id]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM mailboxes WHERE email = $1',
      [email]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }

  static async findByTenant(tenantId) {
    const result = await pool.query(
      `SELECT m.*, d.domain_name
       FROM mailboxes m
       LEFT JOIN domains d ON m.domain_id = d.id
       WHERE m.tenant_id = $1 
       ORDER BY m.email ASC`,
      [tenantId]
    );
    result.rows.forEach(row => delete row.password_hash);
    return result.rows;
  }

  static async findByDomain(domainId) {
    const result = await pool.query(
      'SELECT * FROM mailboxes WHERE domain_id = $1 ORDER BY email ASC',
      [domainId]
    );
    result.rows.forEach(row => delete row.password_hash);
    return result.rows;
  }

  static async updatePassword(id, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      `UPDATE mailboxes 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [passwordHash, id]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }

  static async updateQuota(id, quotaMb, usedMb) {
    const result = await pool.query(
      `UPDATE mailboxes 
       SET quota_mb = $1, used_mb = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [quotaMb, usedMb, id]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }

  static async recordLogin(id) {
    await pool.query(
      `UPDATE mailboxes 
       SET last_login = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async suspend(id) {
    const result = await pool.query(
      `UPDATE mailboxes 
       SET status = 'suspended', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }

  static async activate(id) {
    const result = await pool.query(
      `UPDATE mailboxes 
       SET status = 'active', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    if (result.rows[0]) {
      delete result.rows[0].password_hash;
    }
    return result.rows[0];
  }
}

export default Mailbox;
