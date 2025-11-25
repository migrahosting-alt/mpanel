import Database from '../models/Database.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import { provisionDatabase, deleteDatabase as deleteProvisionedDB } from '../services/provisioning/postgresql.js';

export const createDatabase = async (req, res) => {
  try {
    const { name, dbUser, dbPassword } = req.body;
    const tenantId = req.user.tenantId;

    // Generate a random password if not provided
    const password = dbPassword || crypto.randomBytes(16).toString('base64');
    const username = dbUser || `user_${Date.now()}`;
    const databaseName = name || `db_${Date.now()}`;

    logger.info(`Provisioning database: ${databaseName}`, { userId: req.user.id });

    // Provision the actual PostgreSQL database
    const provisionResult = await provisionDatabase({
      databaseName,
      username,
      password,
    });

    if (!provisionResult.success) {
      throw new Error('Database provisioning failed');
    }

    // Save database metadata to our database
    const databaseData = {
      tenantId,
      name: databaseName,
      dbUser: username,
      dbPassword: password,
      host: provisionResult.host,
      port: provisionResult.port,
      connectionString: provisionResult.connectionString,
      status: 'active',
    };

    const database = await Database.create(databaseData);
    
    // Return password in response (only time it's visible)
    const response = {
      ...database,
      generatedPassword: password,
      connectionString: provisionResult.connectionString,
    };
    
    logger.info(`Database created successfully: ${database.name}`, { 
      userId: req.user.id,
      connectionString: provisionResult.connectionString,
    });
    
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating database:', error);
    res.status(500).json({ 
      error: 'Failed to create database',
      message: error.message,
    });
  }
};

export const getDatabases = async (req, res) => {
  try {
    const { serverId, websiteId } = req.query;
    let databases;
    
    if (serverId) {
      databases = await Database.findByServer(serverId);
    } else if (websiteId) {
      databases = await Database.findByWebsite(websiteId);
    } else {
      databases = await Database.findByTenant(req.user.tenantId);
    }
    
    res.json(databases);
  } catch (error) {
    logger.error('Error fetching databases:', error);
    res.status(500).json({ error: 'Failed to fetch databases' });
  }
};

export const getDatabase = async (req, res) => {
  try {
    const database = await Database.findById(req.params.id);
    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }
    res.json(database);
  } catch (error) {
    logger.error('Error fetching database:', error);
    res.status(500).json({ error: 'Failed to fetch database' });
  }
};

export const rotatePassword = async (req, res) => {
  try {
    // Generate a new random password
    const newPassword = crypto.randomBytes(16).toString('base64');
    
    const database = await Database.rotatePassword(req.params.id, newPassword);
    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    // Return new password in response (only time it's visible)
    const response = {
      ...database,
      newPassword
    };
    
    logger.info(`Database password rotated: ${database.name}`, { userId: req.user.id });
    res.json(response);
  } catch (error) {
    logger.error('Error rotating password:', error);
    res.status(500).json({ error: 'Failed to rotate password' });
  }
};

export const updateSize = async (req, res) => {
  try {
    const { sizeMb } = req.body;
    const database = await Database.updateSize(req.params.id, sizeMb);
    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }
    
    res.json(database);
  } catch (error) {
    logger.error('Error updating size:', error);
    res.status(500).json({ error: 'Failed to update size' });
  }
};

export const deleteDatabase = async (req, res) => {
  try {
    const database = await Database.findById(req.params.id);
    
    if (!database) {
      return res.status(404).json({ error: 'Database not found' });
    }

    if (database.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info(`Deleting database: ${database.name}`, { userId: req.user.id });

    // Delete the actual PostgreSQL database and user
    try {
      await deleteProvisionedDB(database.name);
      logger.info(`Deleted database from PostgreSQL: ${database.name}`);
    } catch (provisionError) {
      logger.error('Error deleting from PostgreSQL:', provisionError);
      // Continue with metadata deletion even if provisioning cleanup fails
    }

    // Delete database metadata from our database
    await Database.delete(req.params.id);
    
    logger.info(`Database deleted successfully: ${database.name}`, { userId: req.user.id });
    
    res.json({ 
      success: true,
      message: `Database ${database.name} deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting database:', error);
    res.status(500).json({ 
      error: 'Failed to delete database',
      message: error.message,
    });
  }
};
