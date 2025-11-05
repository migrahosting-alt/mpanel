import Server from '../models/Server.js';
import logger from '../config/logger.js';

export const createServer = async (req, res) => {
  try {
    const serverData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const server = await Server.create(serverData);
    logger.info(`Server created: ${server.id}`, { userId: req.user.id });
    res.status(201).json(server);
  } catch (error) {
    logger.error('Error creating server:', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
};

export const getServers = async (req, res) => {
  try {
    const servers = await Server.findByTenant(req.user.tenantId);
    res.json(servers);
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
