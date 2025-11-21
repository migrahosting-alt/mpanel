import express from 'express';
import SmartImporter from '../services/smartImporter.js';
import fs from 'fs';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * POST /api/import/whmcs
 * Trigger WHMCS import from browser
 */
router.post('/whmcs', async (req, res) => {
  try {
    logger.info('🚀 Starting WHMCS import via API...');
    
    // Read config
    const config = JSON.parse(fs.readFileSync('./migration-config.json', 'utf8'));
    
    const importer = new SmartImporter({
      host: config.whmcs.host,
      port: config.whmcs.port,
      user: config.whmcs.user,
      password: config.whmcs.password,
      database: config.whmcs.database
    });
    
    const stats = await importer.importAll(null);
    
    res.json({
      success: true,
      message: 'WHMCS import completed successfully',
      stats
    });
    
  } catch (error) {
    logger.error('Import failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/import/status
 * Check if import data exists
 */
router.get('/status', async (req, res) => {
  try {
    const pool = (await import('../db/index.js')).default;
    
    const [users, customers, products, domains, invoices] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['client']),
      pool.query('SELECT COUNT(*) as count FROM customers'),
      pool.query('SELECT COUNT(*) as count FROM products'),
      pool.query('SELECT COUNT(*) as count FROM domains'),
      pool.query('SELECT COUNT(*) as count FROM invoices')
    ]);
    
    res.json({
      imported: {
        users: parseInt(users.rows[0].count),
        customers: parseInt(customers.rows[0].count),
        products: parseInt(products.rows[0].count),
        domains: parseInt(domains.rows[0].count),
        invoices: parseInt(invoices.rows[0].count)
      },
      hasData: parseInt(customers.rows[0].count) > 0
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
