import Database from '../models/Database.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

export const createDatabase = async (req, res) => {
  try {
    const databaseData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    // Generate a random password if not provided
    if (!databaseData.dbPassword) {
      databaseData.dbPassword = crypto.randomBytes(16).toString('base64');
    }

    const database = await Database.create(databaseData);
    
    // Return password in response (only time it's visible)
    const response = {
      ...database,
      generatedPassword: databaseData.dbPassword
    };
    
    logger.info(`Database created: ${database.name}`, { userId: req.user.id });
    res.status(201).json(response);
  } catch (error) {
    logger.error('Error creating database:', error);
    res.status(500).json({ error: 'Failed to create database' });
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
