import pool from '../config/database.js';

class Website {
  static async create(websiteData) {
    const {
      tenantId,
      customerId,
      serverId,
      subscriptionId,
      name,
      primaryDomain,
      additionalDomains = [],
      documentRoot,
      appType = 'php',
      appVersion,
      phpVersion,
      sslEnabled = false,
      sslProvider = 'none',
      deploySource = 'manual',
      gitRepo,
      gitBranch,
      envVariables = {},
      systemUser,
      metadata = {}
    } = websiteData;

    const result = await pool.query(
      `INSERT INTO websites (
        tenant_id, customer_id, server_id, subscription_id, name, primary_domain,
        additional_domains, document_root, app_type, app_version, php_version,
        ssl_enabled, ssl_provider, deploy_source, git_repo, git_branch,
        env_variables, system_user, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 'active')
      RETURNING *`,
      [tenantId, customerId, serverId, subscriptionId, name, primaryDomain, JSON.stringify(additionalDomains), documentRoot, appType, appVersion, phpVersion, sslEnabled, sslProvider, deploySource, gitRepo, gitBranch, envVariables, systemUser, metadata]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT w.*, s.name as server_name, s.hostname as server_hostname
       FROM websites w
       LEFT JOIN servers s ON w.server_id = s.id
       WHERE w.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByTenant(tenantId) {
    const result = await pool.query(
      `SELECT w.*, s.name as server_name, c.first_name, c.last_name
       FROM websites w
       LEFT JOIN servers s ON w.server_id = s.id
       LEFT JOIN customers c ON w.customer_id = c.id
       WHERE w.tenant_id = $1 
       ORDER BY w.created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async findByCustomer(customerId) {
    const result = await pool.query(
      `SELECT w.*, s.name as server_name
       FROM websites w
       LEFT JOIN servers s ON w.server_id = s.id
       WHERE w.customer_id = $1 
       ORDER BY w.created_at DESC`,
      [customerId]
    );
    return result.rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(id);
    
    const result = await pool.query(
      `UPDATE websites SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async updateSSL(id, sslData) {
    const { sslEnabled, sslProvider, sslExpiresAt } = sslData;
    const result = await pool.query(
      `UPDATE websites 
       SET ssl_enabled = $1, ssl_provider = $2, ssl_expires_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [sslEnabled, sslProvider, sslExpiresAt, id]
    );
    return result.rows[0];
  }

  static async recordDeployment(id) {
    const result = await pool.query(
      `UPDATE websites 
       SET last_deployed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }
}

export default Website;
