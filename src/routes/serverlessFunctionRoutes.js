/**
 * Serverless Functions API Routes
 */

import express from 'express';
import serverlessFunctions from '../services/serverlessFunctions.js';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * List all functions for authenticated user
 */
router.get('/functions', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM serverless_functions WHERE user_id = $1 OR tenant_id = $2 ORDER BY created_at DESC',
      [req.user.id, req.user.tenant_id]
    );

    res.json({
      success: true,
      functions: result.rows
    });
  } catch (error) {
    logger.error('Failed to list functions', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get function details
 */
router.get('/functions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM serverless_functions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }

    res.json({
      success: true,
      function: result.rows[0]
    });
  } catch (error) {
    logger.error('Failed to get function', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create new function
 */
router.post('/functions', async (req, res) => {
  try {
    const func = await serverlessFunctions.createFunction(
      req.user.id,
      req.user.tenant_id,
      req.body
    );

    res.status(201).json({
      success: true,
      function: func
    });
  } catch (error) {
    logger.error('Failed to create function', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Update function
 */
router.put('/functions/:id', async (req, res) => {
  try {
    const func = await serverlessFunctions.updateFunction(
      req.params.id,
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      function: func
    });
  } catch (error) {
    logger.error('Failed to update function', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Delete function
 */
router.delete('/functions/:id', async (req, res) => {
  try {
    await serverlessFunctions.deleteFunction(req.params.id, req.user.id);

    res.json({
      success: true,
      message: 'Function deleted'
    });
  } catch (error) {
    logger.error('Failed to delete function', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Invoke function
 */
router.post('/functions/:id/invoke', async (req, res) => {
  try {
    const result = await serverlessFunctions.invokeFunction(
      req.params.id,
      req.body.payload || {},
      req.user.id
    );

    res.json({
      success: result.status !== 'failed',
      ...result
    });
  } catch (error) {
    logger.error('Failed to invoke function', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get function metrics
 */
router.get('/functions/:id/metrics', async (req, res) => {
  try {
    const metrics = await serverlessFunctions.getFunctionMetrics(req.params.id);

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Failed to get function metrics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get function invocation history
 */
router.get('/functions/:id/invocations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const invocations = await serverlessFunctions.getInvocations(req.params.id, limit);

    res.json({
      success: true,
      invocations
    });
  } catch (error) {
    logger.error('Failed to get invocations', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Create scheduled trigger
 */
router.post('/functions/:id/schedules', async (req, res) => {
  try {
    const { schedule, payload } = req.body;

    const scheduleRecord = await serverlessFunctions.createSchedule(
      req.params.id,
      req.user.id,
      schedule,
      payload
    );

    res.status(201).json({
      success: true,
      schedule: scheduleRecord
    });
  } catch (error) {
    logger.error('Failed to create schedule', { error: error.message });
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
