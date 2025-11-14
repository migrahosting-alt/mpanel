/**
 * Multi-Database Management API Routes
 */

import express from 'express';
import multiDatabase from '../services/multiDatabase.js';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * Create database
 */
router.post('/databases', async (req, res) => {
  try {
    const database = await multiDatabase.createDatabase(
      req.user.id,
      req.user.tenant_id,
      req.body
    );

    res.status(201).json({
      success: true,
      database
    });
  } catch (error) {
    logger.error('Failed to create database', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * List databases
 */
router.get('/databases', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM databases WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      databases: result.rows
    });
  } catch (error) {
    logger.error('Failed to list databases', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get database details
 */
router.get('/databases/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM databases WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }

    res.json({
      success: true,
      database: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get database', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get database metrics
 */
router.get('/databases/:id/metrics', async (req, res) => {
  try {
    const metrics = await multiDatabase.getDatabaseMetrics(req.params.id);

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get database metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Setup replication
 */
router.post('/databases/:id/replication', async (req, res) => {
  try {
    const { replicaServerId } = req.body;

    const replica = await multiDatabase.setupReplication(
      req.params.id,
      replicaServerId
    );

    res.status(201).json({
      success: true,
      replica
    });
  } catch (error) {
    logger.error('Failed to setup replication', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * List replicas
 */
router.get('/databases/:id/replicas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM database_replicas WHERE database_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    res.json({
      success: true,
      replicas: result.rows
    });
  } catch (error) {
    logger.error('Failed to list replicas', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get slow queries
 */
router.get('/databases/:id/slow-queries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const slowQueries = await multiDatabase.analyzeSlowQueries(req.params.id, limit);

    res.json({
      success: true,
      slowQueries
    });
  } catch (error) {
    logger.error('Failed to get slow queries', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete database
 */
router.delete('/databases/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM databases WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [req.params.id, req.user.tenant_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }

    res.json({
      success: true,
      message: 'Database deleted'
    });
  } catch (error) {
    logger.error('Failed to delete database', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
