/**
 * Email Provisioning Service
 * Handles email account and forwarder provisioning
 * Works with Postfix/Dovecot virtual mail setup
 */

import pool from '../../db/index.js';
import bcrypt from 'bcryptjs';

/**
 * Create email account in virtual mailbox table
 * @param {Object} config - Email account configuration
 * @param {string} config.email - Full email address (user@domain.com)
 * @param {string} config.password - Plain text password
 * @param {number} config.quota - Mailbox quota in MB (default: 1000)
 * @param {number} config.tenantId - Tenant ID
 * @returns {Promise<Object>} - Created email account
 */
export async function createEmailAccount(config) {
  const { email, password, quota = 1000, tenantId } = config;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Creating email account: ${email}`);
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error(`Invalid email format: ${email}`);
    }
    
    // Extract domain from email
    const [username, domain] = email.split('@');
    
    // Check if email already exists
    const checkQuery = `
      SELECT id FROM email_accounts 
      WHERE email = $1 AND tenant_id = $2
    `;
    const checkResult = await client.query(checkQuery, [email, tenantId]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`Email account ${email} already exists`);
    }
    
    // Hash password for Dovecot (SHA512-CRYPT)
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create email account
    const insertQuery = `
      INSERT INTO email_accounts (
        tenant_id,
        domain,
        email,
        username,
        password_hash,
        quota_mb,
        enabled,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;
    
    const values = [tenantId, domain, email, username, hashedPassword, quota, true];
    const result = await client.query(insertQuery, values);
    
    const account = result.rows[0];
    
    // Create mailbox directory (this would be handled by Dovecot in production)
    console.log(`[Email] ✓ Email account created: ${email}`);
    console.log(`[Email]   Mailbox path: /var/mail/vhosts/${domain}/${username}`);
    console.log(`[Email]   Quota: ${quota} MB`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      account: {
        id: account.id,
        email: account.email,
        domain: account.domain,
        quota: account.quota_mb,
        enabled: account.enabled,
        created_at: account.created_at,
      },
      message: `Email account ${email} created successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error creating email account ${email}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create email forwarder (alias)
 * @param {Object} config - Forwarder configuration
 * @param {string} config.source - Source email (user@domain.com)
 * @param {string} config.destination - Destination email(s) (comma-separated)
 * @param {number} config.tenantId - Tenant ID
 * @returns {Promise<Object>} - Created forwarder
 */
export async function createEmailForwarder(config) {
  const { source, destination, tenantId } = config;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Creating forwarder: ${source} -> ${destination}`);
    
    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(source)) {
      throw new Error(`Invalid source email format: ${source}`);
    }
    
    const destinations = destination.split(',').map(d => d.trim());
    for (const dest of destinations) {
      if (!emailRegex.test(dest)) {
        throw new Error(`Invalid destination email format: ${dest}`);
      }
    }
    
    // Extract domain from source
    const [, domain] = source.split('@');
    
    // Check if forwarder already exists
    const checkQuery = `
      SELECT id FROM email_forwarders 
      WHERE source = $1 AND tenant_id = $2
    `;
    const checkResult = await client.query(checkQuery, [source, tenantId]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`Email forwarder ${source} already exists`);
    }
    
    // Create forwarder
    const insertQuery = `
      INSERT INTO email_forwarders (
        tenant_id,
        domain,
        source,
        destination,
        enabled,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `;
    
    const values = [tenantId, domain, source, destination, true];
    const result = await client.query(insertQuery, values);
    
    const forwarder = result.rows[0];
    
    console.log(`[Email] ✓ Forwarder created: ${source} -> ${destination}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      forwarder: {
        id: forwarder.id,
        source: forwarder.source,
        destination: forwarder.destination,
        domain: forwarder.domain,
        enabled: forwarder.enabled,
        created_at: forwarder.created_at,
      },
      message: `Email forwarder ${source} created successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error creating forwarder ${source}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete email account
 * @param {string} email - Email address to delete
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function deleteEmailAccount(email, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Deleting email account: ${email}`);
    
    const deleteQuery = `
      DELETE FROM email_accounts 
      WHERE email = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(deleteQuery, [email, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Email account ${email} not found`);
    }
    
    console.log(`[Email] ✓ Email account deleted: ${email}`);
    console.log(`[Email]   Note: Mailbox files should be manually cleaned up`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Email account ${email} deleted successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error deleting email account ${email}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete email forwarder
 * @param {string} source - Source email to delete
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function deleteEmailForwarder(source, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Deleting forwarder: ${source}`);
    
    const deleteQuery = `
      DELETE FROM email_forwarders 
      WHERE source = $1 AND tenant_id = $2
      RETURNING *
    `;
    
    const result = await client.query(deleteQuery, [source, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Email forwarder ${source} not found`);
    }
    
    console.log(`[Email] ✓ Forwarder deleted: ${source}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Email forwarder ${source} deleted successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error deleting forwarder ${source}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Change email account password
 * @param {string} email - Email address
 * @param {string} newPassword - New password
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function changeEmailPassword(email, newPassword, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Changing password for: ${email}`);
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const updateQuery = `
      UPDATE email_accounts 
      SET password_hash = $1, updated_at = NOW()
      WHERE email = $2 AND tenant_id = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [hashedPassword, email, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Email account ${email} not found`);
    }
    
    console.log(`[Email] ✓ Password changed for: ${email}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Password changed for ${email} successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error changing password for ${email}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update email account quota
 * @param {string} email - Email address
 * @param {number} quotaMB - New quota in MB
 * @param {number} tenantId - Tenant ID
 * @returns {Promise<Object>} - Result
 */
export async function updateEmailQuota(email, quotaMB, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log(`[Email] Updating quota for ${email}: ${quotaMB} MB`);
    
    const updateQuery = `
      UPDATE email_accounts 
      SET quota_mb = $1, updated_at = NOW()
      WHERE email = $2 AND tenant_id = $3
      RETURNING *
    `;
    
    const result = await client.query(updateQuery, [quotaMB, email, tenantId]);
    
    if (result.rows.length === 0) {
      throw new Error(`Email account ${email} not found`);
    }
    
    console.log(`[Email] ✓ Quota updated for: ${email}`);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      account: result.rows[0],
      message: `Quota updated for ${email} successfully`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Email] Error updating quota for ${email}:`, error);
    throw error;
  } finally {
    client.release();
  }
}

export default {
  createEmailAccount,
  createEmailForwarder,
  deleteEmailAccount,
  deleteEmailForwarder,
  changeEmailPassword,
  updateEmailQuota,
};
