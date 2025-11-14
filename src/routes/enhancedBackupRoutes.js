const express = require('express');
const router = express.Router();
const enhancedBackupService = require('../services/enhancedBackupService');
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Enhanced Backup & Disaster Recovery Routes
 * All routes require authentication
 */

// Create PITR backup
router.post('/backups/pitr', authenticate, async (req, res) => {
  try {
    const backup = await enhancedBackupService.createPITRBackup(req.body.databaseId, req.body.options);
    res.status(201).json(backup);
  } catch (error) {
    logger.error('Create PITR backup failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Restore from PITR backup
router.post('/backups/pitr/:id/restore', authenticate, async (req, res) => {
  try {
    const result = await enhancedBackupService.restoreFromPITR(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    logger.error('Restore from PITR failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify backup integrity
router.post('/backups/pitr/:id/verify', authenticate, async (req, res) => {
  try {
    const result = await enhancedBackupService.restoreFromPITR(req.params.id, { verifyOnly: true });
    res.json(result);
  } catch (error) {
    logger.error('Backup verification failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Perform automated restore test
router.post('/backups/pitr/:id/test', authenticate, async (req, res) => {
  try {
    const result = await enhancedBackupService.performRestoreTest(req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Restore test failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Apply retention policy
router.post('/backups/retention/:databaseId', authenticate, async (req, res) => {
  try {
    await enhancedBackupService.applyRetentionPolicy(req.params.databaseId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Apply retention policy failed:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
