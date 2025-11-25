import deploymentService from '../services/deploymentService.js';
import logger from '../config/logger.js';

/**
 * Deployment Controller
 * Handles one-click deployments: databases, users, tables, APIs, websites, forms
 */

/**
 * Deploy a database
 * POST /api/deployments/database
 */
export const deployDatabase = async (req, res) => {
  try {
    const { name, server_id, type, charset, collation } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id) {
      return res.status(400).json({ error: 'Name and server_id are required' });
    }

    const deployment = await deploymentService.deployDatabase(userId, tenantId, {
      name,
      server_id,
      type: type || 'mysql',
      charset,
      collation
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy database error:', error);
    res.status(500).json({ error: 'Failed to deploy database' });
  }
};

/**
 * Deploy a database user
 * POST /api/deployments/user
 */
export const deployUser = async (req, res) => {
  try {
    const { name, server_id, database_id, privileges } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id) {
      return res.status(400).json({ error: 'Name and server_id are required' });
    }

    const deployment = await deploymentService.deployUser(userId, tenantId, {
      name,
      server_id,
      database_id,
      privileges
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy user error:', error);
    res.status(500).json({ error: 'Failed to deploy user' });
  }
};

/**
 * Deploy a table
 * POST /api/deployments/table
 */
export const deployTable = async (req, res) => {
  try {
    const { name, server_id, database_id, schema } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id || !database_id || !schema) {
      return res.status(400).json({ error: 'Name, server_id, database_id, and schema are required' });
    }

    const deployment = await deploymentService.deployTable(userId, tenantId, {
      name,
      server_id,
      database_id,
      schema
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy table error:', error);
    res.status(500).json({ error: 'Failed to deploy table' });
  }
};

/**
 * Deploy an API endpoint
 * POST /api/deployments/api
 */
export const deployAPI = async (req, res) => {
  try {
    const { name, server_id, method, path, handler_type, database_id, custom_code, domain } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id || !path) {
      return res.status(400).json({ error: 'Name, server_id, and path are required' });
    }

    const deployment = await deploymentService.deployAPI(userId, tenantId, {
      name,
      server_id,
      method,
      path,
      handler_type,
      database_id,
      custom_code,
      domain
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy API error:', error);
    res.status(500).json({ error: 'Failed to deploy API' });
  }
};

/**
 * Deploy a website
 * POST /api/deployments/website
 */
export const deployWebsite = async (req, res) => {
  try {
    const { name, server_id, domain, template, framework } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id || !domain) {
      return res.status(400).json({ error: 'Name, server_id, and domain are required' });
    }

    const deployment = await deploymentService.deployWebsite(userId, tenantId, {
      name,
      server_id,
      domain,
      template,
      framework
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy website error:', error);
    res.status(500).json({ error: 'Failed to deploy website' });
  }
};

/**
 * Deploy a form
 * POST /api/deployments/form
 */
export const deployForm = async (req, res) => {
  try {
    const { name, server_id, fields, action_type, database_id, domain } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    if (!name || !server_id || !fields) {
      return res.status(400).json({ error: 'Name, server_id, and fields are required' });
    }

    const deployment = await deploymentService.deployForm(userId, tenantId, {
      name,
      server_id,
      fields,
      action_type,
      database_id,
      domain
    });

    res.status(201).json(deployment);
  } catch (error) {
    logger.error('Deploy form error:', error);
    res.status(500).json({ error: 'Failed to deploy form' });
  }
};

/**
 * Get all deployments
 * GET /api/deployments
 */
export const getAllDeployments = async (req, res) => {
  try {
    const { type, status, limit, offset } = req.query;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    const deployments = await deploymentService.getAllDeployments({
      user_id: userId,
      tenant_id: tenantId,
      type,
      status,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });

    res.json(deployments);
  } catch (error) {
    logger.error('Get deployments error:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
};

/**
 * Get deployment by ID
 * GET /api/deployments/:id
 */
export const getDeploymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const deployment = await deploymentService.getDeploymentById(id);

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    res.json(deployment);
  } catch (error) {
    logger.error('Get deployment error:', error);
    res.status(500).json({ error: 'Failed to fetch deployment' });
  }
};

/**
 * Delete deployment
 * DELETE /api/deployments/:id
 */
export const deleteDeployment = async (req, res) => {
  try {
    const { id } = req.params;

    await deploymentService.deleteDeployment(id);

    res.json({ message: 'Deployment deleted successfully' });
  } catch (error) {
    logger.error('Delete deployment error:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
};

export default {
  deployDatabase,
  deployUser,
  deployTable,
  deployAPI,
  deployWebsite,
  deployForm,
  getAllDeployments,
  getDeploymentById,
  deleteDeployment
};
