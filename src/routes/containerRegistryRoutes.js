/**
 * Container Registry API Routes
 */

import express from 'express';
import containerRegistry from '../services/containerRegistry.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * List container images
 */
router.get('/images', async (req, res) => {
  try {
    const images = await containerRegistry.listImages(req.user.tenant_id, req.query);

    res.json({
      success: true,
      images
    });
  } catch (error) {
    logger.error('Failed to list images', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Push image to registry
 */
router.post('/images/push', async (req, res) => {
  try {
    const { imageName, tag } = req.body;

    const image = await containerRegistry.pushImage(
      req.user.id,
      req.user.tenant_id,
      imageName,
      tag
    );

    res.status(201).json({
      success: true,
      image
    });
  } catch (error) {
    logger.error('Failed to push image', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Pull image from registry
 */
router.post('/images/:id/pull', async (req, res) => {
  try {
    const result = await containerRegistry.pullImage(req.params.id, req.user.id);

    res.json(result);
  } catch (error) {
    logger.error('Failed to pull image', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Build image from Dockerfile
 */
router.post('/images/build', async (req, res) => {
  try {
    const { imageName, dockerfile, buildContext } = req.body;

    const image = await containerRegistry.buildImage(
      req.user.id,
      req.user.tenant_id,
      imageName,
      dockerfile,
      buildContext
    );

    res.status(201).json({
      success: true,
      image
    });
  } catch (error) {
    logger.error('Failed to build image', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Scan image for vulnerabilities
 */
router.post('/images/:id/scan', async (req, res) => {
  try {
    const vulnerabilities = await containerRegistry.scanImage(req.params.id);

    res.json({
      success: true,
      vulnerabilities
    });
  } catch (error) {
    logger.error('Failed to scan image', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get scan results
 */
router.get('/images/:id/scan-results', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM image_scan_results 
       WHERE image_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [req.params.id]
    );

    res.json({
      success: true,
      scanResult: result.rows[0] || null
    });
  } catch (error) {
    logger.error('Failed to get scan results', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sign image
 */
router.post('/images/:id/sign', async (req, res) => {
  try {
    const result = await containerRegistry.signImage(req.params.id, req.user.id);

    res.json(result);
  } catch (error) {
    logger.error('Failed to sign image', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Delete image
 */
router.delete('/images/:id', async (req, res) => {
  try {
    const result = await containerRegistry.deleteImage(req.params.id, req.user.id);

    res.json(result);
  } catch (error) {
    logger.error('Failed to delete image', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Run garbage collection (Admin only)
 */
router.post('/gc', requireRole('admin'), async (req, res) => {
  try {
    const result = await containerRegistry.runGarbageCollection();

    res.json(result);
  } catch (error) {
    logger.error('Failed to run garbage collection', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
