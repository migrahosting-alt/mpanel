/**
 * Provisioning Controller
 * Handles HTTP requests for service provisioning
 */

import provisioningService from '../services/provisioningService.js';
import queueService from '../services/queueService.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';

class ProvisioningController {
  /**
   * Trigger provisioning for a service
   * POST /api/provisioning/provision
   */
  async provisionService(req, res) {
    try {
      const { serviceId, customerId, productId, domain } = req.body;

      // Validate required fields
      if (!serviceId || !customerId || !productId || !domain) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['serviceId', 'customerId', 'productId', 'domain']
        });
      }

      // Validate service exists and belongs to customer
      const serviceCheck = await pool.query(
        'SELECT id, customer_id, status FROM services WHERE id = $1',
        [serviceId]
      );

      if (serviceCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Service not found' });
      }

      if (serviceCheck.rows[0].customer_id !== customerId) {
        return res.status(403).json({ error: 'Service does not belong to customer' });
      }

      if (serviceCheck.rows[0].status === 'active') {
        return res.status(400).json({ error: 'Service already provisioned' });
      }

      // Add job to queue for async processing
      const jobId = await queueService.addProvisioningJob({
        serviceId,
        customerId,
        productId,
        domain
      });

      logger.info(`Provisioning job queued: ${jobId} for service ${serviceId}`);

      res.status(202).json({
        message: 'Provisioning job queued',
        jobId,
        serviceId,
        status: 'queued'
      });

    } catch (error) {
      logger.error('Error queuing provisioning job:', error);
      res.status(500).json({
        error: 'Failed to queue provisioning job',
        message: error.message
      });
    }
  }

  /**
   * Get provisioning task status
   * GET /api/provisioning/tasks/:id
   */
  async getTaskStatus(req, res) {
    try {
      const { id } = req.params;

      // Check if it's a job ID (queue) or task ID (database)
      if (id.startsWith('job_')) {
        // Queue job
        const jobStatus = await queueService.getJobStatus(id);
        return res.json(jobStatus);
      }

      // Database task
      const result = await pool.query(
        `SELECT 
          pt.*,
          s.domain,
          c.name as customer_name,
          c.email as customer_email
         FROM provisioning_tasks pt
         LEFT JOIN services s ON pt.service_id = s.id
         LEFT JOIN customers c ON pt.customer_id = c.id
         WHERE pt.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json(result.rows[0]);

    } catch (error) {
      logger.error('Error fetching task status:', error);
      res.status(500).json({
        error: 'Failed to fetch task status',
        message: error.message
      });
    }
  }

  /**
   * Get all provisioning tasks
   * GET /api/provisioning/tasks
   */
  async getAllTasks(req, res) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;

      let query = `
        SELECT 
          pt.*,
          s.domain,
          c.name as customer_name,
          c.email as customer_email,
          p.name as product_name
        FROM provisioning_tasks pt
        LEFT JOIN services s ON pt.service_id = s.id
        LEFT JOIN customers c ON pt.customer_id = c.id
        LEFT JOIN products p ON s.product_id = p.id
      `;

      const params = [];
      
      if (status) {
        query += ' WHERE pt.status = $1';
        params.push(status);
      }

      query += ' ORDER BY pt.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);

      const result = await pool.query(query, params);

      // Get total count
      const countQuery = status 
        ? 'SELECT COUNT(*) FROM provisioning_tasks WHERE status = $1'
        : 'SELECT COUNT(*) FROM provisioning_tasks';
      const countParams = status ? [status] : [];
      const countResult = await pool.query(countQuery, countParams);

      res.json({
        tasks: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

    } catch (error) {
      logger.error('Error fetching tasks:', error);
      res.status(500).json({
        error: 'Failed to fetch tasks',
        message: error.message
      });
    }
  }

  /**
   * Retry a failed provisioning task
   * POST /api/provisioning/retry/:id
   */
  async retryTask(req, res) {
    try {
      const { id } = req.params;

      // Check if it's a job ID (queue) or task ID (database)
      if (id.startsWith('job_')) {
        // Retry queue job
        const result = await queueService.retryJob(id);
        return res.json({
          message: 'Job queued for retry',
          ...result
        });
      }

      // Retry database task - re-queue provisioning
      const taskResult = await pool.query(
        `SELECT pt.*, s.product_id, s.domain
         FROM provisioning_tasks pt
         JOIN services s ON pt.service_id = s.id
         WHERE pt.id = $1`,
        [id]
      );

      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const task = taskResult.rows[0];

      if (task.status !== 'failed') {
        return res.status(400).json({
          error: 'Can only retry failed tasks',
          currentStatus: task.status
        });
      }

      // Re-queue
      const jobId = await queueService.addProvisioningJob({
        serviceId: task.service_id,
        customerId: task.customer_id,
        productId: task.product_id,
        domain: task.domain
      });

      // Update task status
      await pool.query(
        'UPDATE provisioning_tasks SET status = $1, attempts = 0, updated_at = NOW() WHERE id = $2',
        ['pending', id]
      );

      logger.info(`Task ${id} re-queued as job ${jobId}`);

      res.json({
        message: 'Task queued for retry',
        taskId: id,
        jobId,
        status: 'queued'
      });

    } catch (error) {
      logger.error('Error retrying task:', error);
      res.status(500).json({
        error: 'Failed to retry task',
        message: error.message
      });
    }
  }

  /**
   * Get queue statistics
   * GET /api/provisioning/stats
   */
  async getStats(req, res) {
    try {
      const queueStats = await queueService.getQueueStats();

      // Get database task stats
      const taskStats = await pool.query(`
        SELECT 
          status,
          COUNT(*) as count
        FROM provisioning_tasks
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY status
      `);

      const stats = {
        queue: queueStats,
        tasks: {
          last_7_days: {}
        }
      };

      taskStats.rows.forEach(row => {
        stats.tasks.last_7_days[row.status] = parseInt(row.count);
      });

      res.json(stats);

    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({
        error: 'Failed to fetch stats',
        message: error.message
      });
    }
  }

  /**
   * Get failed jobs
   * GET /api/provisioning/failed
   */
  async getFailedJobs(req, res) {
    try {
      const { limit = 50 } = req.query;
      const failedJobs = await queueService.getFailedJobs(parseInt(limit));

      res.json({
        failed_jobs: failedJobs,
        count: failedJobs.length
      });

    } catch (error) {
      logger.error('Error fetching failed jobs:', error);
      res.status(500).json({
        error: 'Failed to fetch failed jobs',
        message: error.message
      });
    }
  }

  /**
   * Clear failed jobs
   * DELETE /api/provisioning/failed
   */
  async clearFailedJobs(req, res) {
    try {
      const count = await queueService.clearFailedJobs();

      res.json({
        message: 'Failed jobs cleared',
        count
      });

    } catch (error) {
      logger.error('Error clearing failed jobs:', error);
      res.status(500).json({
        error: 'Failed to clear failed jobs',
        message: error.message
      });
    }
  }

  /**
   * Manual provisioning (for testing/debugging)
   * POST /api/provisioning/manual
   */
  async manualProvision(req, res) {
    try {
      const { serviceId, customerId, productId, domain } = req.body;

      // Validate required fields
      if (!serviceId || !customerId || !productId || !domain) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['serviceId', 'customerId', 'productId', 'domain']
        });
      }

      logger.info(`Manual provisioning triggered for service ${serviceId}`);

      // Call provisioning service directly (synchronous)
      const result = await provisioningService.provisionService(
        serviceId,
        customerId,
        productId,
        domain
      );

      res.json({
        message: 'Manual provisioning completed',
        result
      });

    } catch (error) {
      logger.error('Manual provisioning failed:', error);
      res.status(500).json({
        error: 'Manual provisioning failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}

export default new ProvisioningController();
