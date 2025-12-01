/**
 * Worker Routes
 * API endpoints for provisioning workers to claim and complete tasks
 * See MPANEL_SYSTEM_BLUEPRINT.md Section 3.1
 */

import express from 'express';
import pool from '../db/index.js';

const router = express.Router();

// Helper function to execute queries
const query = (text, params) => pool.query(text, params);

/**
 * @route   POST /api/worker/tasks/claim
 * @desc    Claim next pending provisioning task
 * @access  Worker (no auth for now, add worker API key later)
 * @returns { task: { id, type, payload, ... } } or { task: null }
 */
router.post('/tasks/claim', async (req, res) => {
  try {
    // Start transaction
    await query('BEGIN');

    // Find oldest pending task and lock it
    const result = await query(`
      SELECT 
        id,
        step,
        status,
        server_id,
        subscription_id,
        payload_json,
        created_at,
        updated_at
      FROM provisioning_tasks
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    if (result.rows.length === 0) {
      await query('COMMIT');
      return res.json({ task: null });
    }

    const task = result.rows[0];

    // Mark as in_progress
    await query(
      `UPDATE provisioning_tasks 
       SET status = 'in_progress', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [task.id]
    );

    await query('COMMIT');

    // Parse payload if it's JSON string
    if (typeof task.payload_json === 'string') {
      try {
        task.payload = JSON.parse(task.payload_json);
        delete task.payload_json;
      } catch (e) {
        // Leave as payload_json if not valid JSON
        task.payload = task.payload_json;
      }
    } else {
      task.payload = task.payload_json;
      delete task.payload_json;
    }

    console.log(`[WORKER] Task ${task.id} claimed by worker`);

    res.json({ task });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[WORKER] Error claiming task:', error);
    res.status(500).json({ error: 'Failed to claim task' });
  }
});

/**
 * @route   POST /api/worker/tasks/:id/complete
 * @desc    Mark a task as completed or failed
 * @access  Worker
 * @body    { status: 'success' | 'failed', error?: string, result?: object }
 */
router.post('/tasks/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, error, result } = req.body;

    if (!status || !['success', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "success" or "failed"' });
    }

    // Update task status
    const updateResult = await query(
      `UPDATE provisioning_tasks 
       SET status = $1,
           error_message = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, step, status`,
      [status, error || null, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = updateResult.rows[0];

    // If successful, activate the subscription
    if (status === 'success') {
      await query(
        `UPDATE subscriptions 
         SET status = 'active'
         WHERE id = (
           SELECT subscription_id 
           FROM provisioning_tasks 
           WHERE id = $1
         )`,
        [id]
      );

      console.log(`[WORKER] Task ${id} completed successfully`);
    } else {
      console.error(`[WORKER] Task ${id} failed: ${error}`);
    }

    res.json({ 
      success: true,
      task: {
        id: task.id,
        step: task.step,
        status: task.status
      }
    });
  } catch (error) {
    console.error('[WORKER] Error completing task:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

/**
 * @route   GET /api/worker/tasks/:id
 * @desc    Get task details (for worker to check status)
 * @access  Worker
 */
router.get('/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT 
        id,
        step,
        status,
        server_id,
        subscription_id,
        payload_json,
        error_message,
        created_at,
        updated_at
       FROM provisioning_tasks
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = result.rows[0];

    // Parse payload if it's JSON string
    if (typeof task.payload_json === 'string') {
      try {
        task.payload = JSON.parse(task.payload_json);
        delete task.payload_json;
      } catch (e) {
        task.payload = task.payload_json;
      }
    } else {
      task.payload = task.payload_json;
      delete task.payload_json;
    }

    res.json({ task });
  } catch (error) {
    console.error('[WORKER] Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

export default router;
