import WHMCSImporter from '../services/whmcsImporter.js';
import CyberPanelImporter from '../services/cyberpanelImporter.js';
import logger from '../config/logger.js';

/**
 * Import data from WHMCS
 */
export async function importFromWHMCS(req, res) {
  try {
    const { host, port, user, password, database, ssl, tenantId } = req.body;

    if (!host || !user || !password || !database) {
      return res.status(400).json({
        error: 'Missing required fields: host, user, password, database'
      });
    }

    const importer = new WHMCSImporter({
      host,
      port: port || 3306,
      user,
      password,
      database,
      ssl: ssl || false
    });

    logger.info(`Starting WHMCS import from ${host}/${database}`);
    
    const stats = await importer.importAll(tenantId || req.user.tenantId);

    res.json({
      success: true,
      message: 'WHMCS import completed successfully',
      stats
    });
  } catch (error) {
    logger.error('WHMCS import failed:', error);
    res.status(500).json({
      error: 'Import failed',
      details: error.message
    });
  }
}

/**
 * Import data from CyberPanel
 */
export async function importFromCyberPanel(req, res) {
  try {
    const {
      host,
      adminUser,
      adminPass,
      dbHost,
      dbPort,
      dbUser,
      dbPassword,
      tenantId
    } = req.body;

    if (!host || !adminUser || !adminPass || !dbUser || !dbPassword) {
      return res.status(400).json({
        error: 'Missing required fields: host, adminUser, adminPass, dbUser, dbPassword'
      });
    }

    const importer = new CyberPanelImporter({
      host,
      adminUser,
      adminPass,
      dbHost: dbHost || host,
      dbPort: dbPort || 3306,
      dbUser,
      dbPassword
    });

    logger.info(`Starting CyberPanel import from ${host}`);
    
    const stats = await importer.importAll(tenantId || req.user.tenantId);

    res.json({
      success: true,
      message: 'CyberPanel import completed successfully',
      stats
    });
  } catch (error) {
    logger.error('CyberPanel import failed:', error);
    res.status(500).json({
      error: 'Import failed',
      details: error.message
    });
  }
}

/**
 * Get import status/history
 */
export async function getImportHistory(req, res) {
  try {
    // This would query an imports_log table to show past imports
    // For now, return a placeholder
    res.json({
      imports: [],
      message: 'Import history feature coming soon'
    });
  } catch (error) {
    logger.error('Failed to get import history:', error);
    res.status(500).json({ error: 'Failed to get import history' });
  }
}

/**
 * Test connection to WHMCS
 */
export async function testWHMCSConnection(req, res) {
  try {
    const { host, port, user, password, database } = req.body;

    const importer = new WHMCSImporter({
      host,
      port: port || 3306,
      user,
      password,
      database
    });

    await importer.connect();
    await importer.disconnect();

    res.json({
      success: true,
      message: 'Connection successful'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Connection failed',
      details: error.message
    });
  }
}

/**
 * Test connection to CyberPanel
 */
export async function testCyberPanelConnection(req, res) {
  try {
    const { host, adminUser, adminPass, dbUser, dbPassword } = req.body;

    const importer = new CyberPanelImporter({
      host,
      adminUser,
      adminPass,
      dbUser,
      dbPassword
    });

    await importer.verifyLogin();
    await importer.connectDB();
    await importer.disconnectDB();

    res.json({
      success: true,
      message: 'Connection successful'
    });
  } catch (error) {
    res.status(400).json({
      error: 'Connection failed',
      details: error.message
    });
  }
}
