import logger from '../config/logger.js';
import pool from '../db/index.js';
import bcrypt from 'bcrypt';

/**
 * Register a new agent
 */
export const registerAgent = async (req, res) => {
  try {
    const { hostname, os, arch, platform, agentVersion } = req.body;
    const apiKey = req.headers.authorization?.replace('Bearer ', '');

    if (!hostname || !os) {
      return res.status(400).json({
        success: false,
        error: 'Hostname and OS are required',
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key is required',
      });
    }

    logger.info(`[Agent] Registration attempt from ${hostname} (${os})`);

    // For now, we'll use the API key as-is
    // In production, you'd validate against a list of valid keys
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    // Check if agent already exists
    const existingAgent = await pool.query(
      'SELECT id FROM servers_agents WHERE hostname = $1 AND api_key_hash = $2',
      [hostname, apiKeyHash]
    );

    let agentId;

    if (existingAgent.rows.length > 0) {
      // Update existing agent
      agentId = existingAgent.rows[0].id;
      
      await pool.query(`
        UPDATE servers_agents
        SET os = $1, arch = $2, platform = $3, agent_version = $4,
            last_seen = NOW(), updated_at = NOW(), status = 'active'
        WHERE id = $5
      `, [os, arch, platform, agentVersion, agentId]);

      logger.info(`[Agent] Updated existing agent: ${hostname} (ID: ${agentId})`);
    } else {
      // Create new agent
      const result = await pool.query(`
        INSERT INTO servers_agents (
          hostname, os, arch, platform, agent_version, api_key_hash, status, last_seen
        ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
        RETURNING id
      `, [hostname, os, arch, platform, agentVersion, apiKeyHash]);

      agentId = result.rows[0].id;
      logger.info(`[Agent] Registered new agent: ${hostname} (ID: ${agentId})`);
    }

    res.status(201).json({
      success: true,
      agentId,
      message: 'Agent registered successfully',
    });
  } catch (error) {
    logger.error('[Agent] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register agent',
      message: error.message,
    });
  }
};

/**
 * Submit metrics from agent
 */
export const submitMetrics = async (req, res) => {
  try {
    const { agentId, timestamp, metrics } = req.body;

    if (!agentId || !metrics) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID and metrics are required',
      });
    }

    // Verify agent exists
    const agentResult = await pool.query(
      'SELECT id FROM servers_agents WHERE id = $1',
      [agentId]
    );

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    // Insert metrics
    await pool.query(`
      INSERT INTO server_metrics (
        agent_id, timestamp,
        cpu_usage, cpu_load_1min, cpu_load_5min, cpu_load_15min,
        memory_total, memory_used, memory_free, memory_cached,
        disk_total, disk_used, disk_free,
        network_rx_bytes, network_tx_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      agentId,
      timestamp || new Date(),
      metrics.cpu?.usage || null,
      metrics.cpu?.load?.['1min'] || null,
      metrics.cpu?.load?.['5min'] || null,
      metrics.cpu?.load?.['15min'] || null,
      metrics.memory?.total || null,
      metrics.memory?.used || null,
      metrics.memory?.free || null,
      metrics.memory?.cached || null,
      metrics.disk?.disks?.[0]?.total || null,
      metrics.disk?.disks?.[0]?.used || null,
      metrics.disk?.disks?.[0]?.free || null,
      metrics.network?.totals?.rxBytes || null,
      metrics.network?.totals?.txBytes || null,
    ]);

    // Update last_seen timestamp
    await pool.query(
      'UPDATE servers_agents SET last_seen = NOW() WHERE id = $1',
      [agentId]
    );

    logger.info(`[Agent] Metrics received from agent ${agentId}`);

    res.json({
      success: true,
      received: true,
      nextReportIn: 60, // seconds
    });
  } catch (error) {
    logger.error('[Agent] Metrics submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit metrics',
      message: error.message,
    });
  }
};

/**
 * Heartbeat from agent
 */
export const heartbeat = async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Agent ID is required',
      });
    }

    // Update last_seen timestamp
    const result = await pool.query(
      'UPDATE servers_agents SET last_seen = NOW() WHERE id = $1 RETURNING id',
      [agentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Agent not found',
      });
    }

    res.json({
      success: true,
      status: 'ok',
    });
  } catch (error) {
    logger.error('[Agent] Heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process heartbeat',
    });
  }
};

/**
 * Get agent list
 */
export const getAgents = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, hostname, os, arch, platform, agent_version,
        status, last_seen, created_at
      FROM servers_agents
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      agents: result.rows,
    });
  } catch (error) {
    logger.error('[Agent] Get agents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch agents',
    });
  }
};

/**
 * Get agent metrics
 */
export const getAgentMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100 } = req.query;

    const result = await pool.query(`
      SELECT *
      FROM server_metrics
      WHERE agent_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [id, limit]);

    res.json({
      success: true,
      metrics: result.rows,
    });
  } catch (error) {
    logger.error('[Agent] Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics',
    });
  }
};
