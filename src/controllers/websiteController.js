import Website from '../models/Website.js';
import logger from '../config/logger.js';

export const createWebsite = async (req, res) => {
  try {
    const websiteData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const website = await Website.create(websiteData);
    logger.info(`Website created: ${website.id}`, { userId: req.user.id });
    res.status(201).json(website);
  } catch (error) {
    logger.error('Error creating website:', error);
    res.status(500).json({ error: 'Failed to create website' });
  }
};

export const getWebsites = async (req, res) => {
  try {
    const { customerId } = req.query;
    let websites;
    
    if (customerId) {
      websites = await Website.findByCustomer(customerId);
    } else {
      websites = await Website.findByTenant(req.user.tenantId);
    }
    
    res.json(websites);
  } catch (error) {
    logger.error('Error fetching websites:', error);
    res.status(500).json({ error: 'Failed to fetch websites' });
  }
};

export const getWebsite = async (req, res) => {
  try {
    const website = await Website.findById(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    res.json(website);
  } catch (error) {
    logger.error('Error fetching website:', error);
    res.status(500).json({ error: 'Failed to fetch website' });
  }
};

export const updateWebsite = async (req, res) => {
  try {
    const website = await Website.update(req.params.id, req.body);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    logger.info(`Website updated: ${website.id}`, { userId: req.user.id });
    res.json(website);
  } catch (error) {
    logger.error('Error updating website:', error);
    res.status(500).json({ error: 'Failed to update website' });
  }
};

export const updateSSL = async (req, res) => {
  try {
    const website = await Website.updateSSL(req.params.id, req.body);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    logger.info(`Website SSL updated: ${website.id}`, { userId: req.user.id });
    res.json(website);
  } catch (error) {
    logger.error('Error updating SSL:', error);
    res.status(500).json({ error: 'Failed to update SSL' });
  }
};

export const deployWebsite = async (req, res) => {
  try {
    const website = await Website.recordDeployment(req.params.id);
    if (!website) {
      return res.status(404).json({ error: 'Website not found' });
    }
    logger.info(`Website deployed: ${website.id}`, { userId: req.user.id });
    res.json({ message: 'Deployment recorded', website });
  } catch (error) {
    logger.error('Error deploying website:', error);
    res.status(500).json({ error: 'Failed to deploy website' });
  }
};
