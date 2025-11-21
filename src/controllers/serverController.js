import Server from '../models/Server.js';
import logger from '../config/logger.js';

export const createServer = async (req, res) => {
  try {
    // Normalize snake_case to camelCase for compatibility
    const serverData = {
      tenantId: req.user.tenantId,
      hostname: req.body.hostname,
      ipAddress: req.body.ipAddress || req.body.ip_address,
      controlPanel: req.body.controlPanel || req.body.control_panel || 'cpanel',
      controlPanelUrl: req.body.controlPanelUrl || req.body.control_panel_url,
      apiToken: req.body.apiToken || req.body.api_token,
      apiUsername: req.body.apiUsername || req.body.api_username,
      apiPasswordEncrypted: req.body.apiPasswordEncrypted || req.body.api_password_encrypted,
      dbHost: req.body.dbHost || req.body.db_host || 'localhost',
      maxAccounts: req.body.maxAccounts || req.body.max_accounts || 500,
      location: req.body.location,
      nameserver1: req.body.nameserver1 || 'ns1.migrahosting.com',
      nameserver2: req.body.nameserver2 || 'ns2.migrahosting.com'
    };

    const server = await Server.create(serverData);
    logger.info(`Server created: ${server.id}`, { userId: req.user.id });
    res.status(201).json(server);
  } catch (error) {
    logger.error('Error creating server:', error);
    
    // Provide specific error messages
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A server with this hostname already exists' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ error: 'Missing required field: ' + error.column });
    }
    
    res.status(500).json({ error: error.message || 'Failed to create server' });
  }
};

export const getServers = async (req, res) => {
  try {
    // For null tenant (super admin), get all servers. Otherwise filter by tenant.
    const servers = req.user.tenantId 
      ? await Server.findByTenant(req.user.tenantId)
      : await Server.findAll();
    res.json({ servers, data: servers });
  } catch (error) {
    logger.error('Error fetching servers:', error);
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
};

export const getServer = async (req, res) => {
  try {
    const server = await Server.findById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    res.json(server);
  } catch (error) {
    logger.error('Error fetching server:', error);
    res.status(500).json({ error: 'Failed to fetch server' });
  }
};

export const updateServer = async (req, res) => {
  try {
    const server = await Server.update(req.params.id, req.body);
    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }
    logger.info(`Server updated: ${server.id}`, { userId: req.user.id });
    res.json(server);
  } catch (error) {
    logger.error('Error updating server:', error);
    res.status(500).json({ error: 'Failed to update server' });
  }
};

export const reportServerMetrics = async (req, res) => {
  try {
    const { id } = req.params;
    await Server.recordMetrics(id, req.body);
    await Server.updateAgentStatus(id, req.body.agentVersion);
    res.json({ message: 'Metrics recorded successfully' });
  } catch (error) {
    logger.error('Error recording metrics:', error);
    res.status(500).json({ error: 'Failed to record metrics' });
  }
};

export const getServerMetrics = async (req, res) => {
  try {
    const metrics = await Server.getLatestMetrics(req.params.id);
    if (!metrics) {
      return res.status(404).json({ error: 'No metrics found' });
    }
    res.json(metrics);
  } catch (error) {
    logger.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
};

export const deleteServer = async (req, res) => {
  try {
    const deleted = await Server.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Server not found' });
    }
    logger.info(`Server deleted: ${req.params.id}`, { userId: req.user.id });
    res.json({ success: true, message: 'Server deleted successfully' });
  } catch (error) {
    logger.error('Error deleting server:', error);
    res.status(500).json({ error: 'Failed to delete server' });
  }
};
