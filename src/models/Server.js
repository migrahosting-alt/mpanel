import pool from '../config/database.js';

class Server {
  static async create(serverData) {
    const {
      hostname,
      ipAddress,
      controlPanel = 'cpanel',
      controlPanelUrl,
      apiToken,
      apiUsername,
      apiPasswordEncrypted,
      dbHost = 'localhost',
      maxAccounts = 500,
      location,
      nameserver1,
      nameserver2
    } = serverData;

    const result = await pool.query(
      `INSERT INTO servers (
        hostname, ip_address, control_panel, control_panel_url,
        api_token, api_username, api_password_encrypted,
        db_host, max_accounts, location, nameserver1, nameserver2, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
      RETURNING *`,
      [hostname, ipAddress, controlPanel, controlPanelUrl, apiToken, apiUsername, apiPasswordEncrypted, dbHost, maxAccounts, location, nameserver1, nameserver2]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM servers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByTenant(tenantId) {
    const result = await pool.query(
      `SELECT * FROM servers 
       WHERE tenant_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return result.rows;
  }

  static async findAll() {
    const result = await pool.query(
      `SELECT * FROM servers 
       WHERE status != 'deleted'
       ORDER BY created_at DESC`
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
      `UPDATE servers SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async updateAgentStatus(id, agentVersion) {
    const result = await pool.query(
      `UPDATE servers 
       SET agent_version = $1, agent_last_seen = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [agentVersion, id]
    );
    return result.rows[0];
  }

  static async recordMetrics(serverId, metrics) {
    const {
      cpuUsage,
      memoryUsageMb,
      memoryTotalMb,
      diskUsageGb,
      diskTotalGb,
      networkInMbps,
      networkOutMbps,
      loadAverage1m,
      loadAverage5m,
      loadAverage15m,
      activeConnections,
      metadata = {}
    } = metrics;

    await pool.query(
      `INSERT INTO server_metrics (
        server_id, cpu_usage, memory_usage_mb, memory_total_mb,
        disk_usage_gb, disk_total_gb, network_in_mbps, network_out_mbps,
        load_average_1m, load_average_5m, load_average_15m,
        active_connections, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [serverId, cpuUsage, memoryUsageMb, memoryTotalMb, diskUsageGb, diskTotalGb, networkInMbps, networkOutMbps, loadAverage1m, loadAverage5m, loadAverage15m, activeConnections, metadata]
    );
  }

  static async getLatestMetrics(serverId) {
    const result = await pool.query(
      `SELECT * FROM server_metrics 
       WHERE server_id = $1 
       ORDER BY metric_time DESC 
       LIMIT 1`,
      [serverId]
    );
    return result.rows[0];
  }

  static async delete(id) {
    // Soft delete - set status to 'deleted' instead of removing from database
    const result = await pool.query(
      `UPDATE servers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rowCount > 0;
  }
}

export default Server;
