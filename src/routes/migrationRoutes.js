import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  importFromWHMCS,
  importFromCyberPanel,
  getImportHistory,
  testWHMCSConnection,
  testCyberPanelConnection
} from '../controllers/migrationController.js';

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authenticateToken);

/**
 * @route   POST /api/migrations/whmcs/test
 * @desc    Test WHMCS database connection
 * @access  Admin
 */
router.post('/whmcs/test', testWHMCSConnection);

/**
 * @route   POST /api/migrations/whmcs/import
 * @desc    Import data from WHMCS
 * @access  Admin
 */
router.post('/whmcs/import', importFromWHMCS);

/**
 * @route   POST /api/migrations/cyberpanel/test
 * @desc    Test CyberPanel connection
 * @access  Admin
 */
router.post('/cyberpanel/test', testCyberPanelConnection);

/**
 * @route   POST /api/migrations/cyberpanel/import
 * @desc    Import data from CyberPanel
 * @access  Admin
 */
router.post('/cyberpanel/import', importFromCyberPanel);

/**
 * @route   GET /api/migrations/history
 * @desc    Get import history
 * @access  Admin
 */
router.get('/history', getImportHistory);

export default router;
