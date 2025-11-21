/**
 * Admin Cron Routes
 * Manual cron job triggers for testing and debugging
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import cronService from '../services/cronService.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * GET /api/admin/cron/jobs
 * List all registered cron jobs
 */
router.get('/jobs', 
  authenticateToken, 
  requirePermission('system.manage'),
  async (req, res) => {
    try {
      const jobs = [
        { name: 'processInvoices', description: 'Generate and send invoices', schedule: 'Daily at midnight' },
        { name: 'processSuspensions', description: 'Suspend overdue accounts', schedule: 'Daily at 2 AM' },
        { name: 'processCancellations', description: 'Process pending cancellations', schedule: 'Daily at 3 AM' },
        { name: 'processBackups', description: 'Run scheduled backups', schedule: 'Daily at 1 AM' },
        { name: 'cleanupExpiredSessions', description: 'Remove expired sessions', schedule: 'Every hour' },
        { name: 'processOnboardingSequences', description: 'Send onboarding emails', schedule: 'Daily at 10 AM' },
        { name: 'processSessionCleanup', description: 'Clean old session records', schedule: 'Daily at 2 AM' },
        { name: 'processNPSSurveys', description: 'Send quarterly NPS surveys', schedule: 'First day of quarter' },
        { name: 'processFailedEmails', description: 'Retry failed email jobs', schedule: 'Every hour' },
      ];

      res.json({ jobs });
    } catch (error) {
      logger.error('Error listing cron jobs:', error);
      res.status(500).json({ error: 'Failed to list cron jobs' });
    }
  }
);

/**
 * POST /api/admin/cron/trigger/:jobName
 * Manually trigger a specific cron job
 */
router.post('/trigger/:jobName', 
  authenticateToken, 
  requirePermission('system.manage'),
  async (req, res) => {
    try {
      const { jobName } = req.params;
      
      // Validate job name
      const validJobs = [
        'processInvoices',
        'processSuspensions', 
        'processCancellations',
        'processBackups',
        'cleanupExpiredSessions',
        'processOnboardingSequences',
        'processSessionCleanup',
        'processNPSSurveys',
        'processFailedEmails',
      ];

      if (!validJobs.includes(jobName)) {
        return res.status(400).json({ 
          error: 'Invalid job name',
          validJobs 
        });
      }

      logger.info(`Manual trigger of cron job: ${jobName} by user ${req.user.email}`);

      // Execute the job
      let result;
      switch (jobName) {
        case 'processInvoices':
          result = await cronService.processInvoices();
          break;
        case 'processSuspensions':
          result = await cronService.processSuspensions();
          break;
        case 'processCancellations':
          result = await cronService.processCancellations();
          break;
        case 'processBackups':
          result = await cronService.processBackups();
          break;
        case 'cleanupExpiredSessions':
          result = await cronService.cleanupExpiredSessions();
          break;
        case 'processOnboardingSequences':
          result = await cronService.processOnboardingSequences();
          break;
        case 'processSessionCleanup':
          result = await cronService.processSessionCleanup();
          break;
        case 'processNPSSurveys':
          result = await cronService.processNPSSurveys();
          break;
        case 'processFailedEmails':
          result = await cronService.processFailedEmails();
          break;
        default:
          return res.status(400).json({ error: 'Job not implemented' });
      }

      res.json({ 
        success: true,
        message: `Job ${jobName} executed successfully`,
        result,
        executedBy: req.user.email,
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Error triggering cron job ${req.params.jobName}:`, error);
      res.status(500).json({ 
        error: 'Failed to execute cron job',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * POST /api/admin/cron/trigger-all
 * Trigger all cron jobs sequentially (use with caution!)
 */
router.post('/trigger-all', 
  authenticateToken, 
  requirePermission('system.manage'),
  async (req, res) => {
    try {
      logger.warn(`Manual trigger of ALL cron jobs by user ${req.user.email}`);

      const results = {};
      const jobs = [
        'processInvoices',
        'processSuspensions',
        'processCancellations',
        'processBackups',
        'cleanupExpiredSessions',
        'processOnboardingSequences',
        'processSessionCleanup',
        'processFailedEmails',
      ];

      for (const jobName of jobs) {
        try {
          logger.info(`Running ${jobName}...`);
          let result;
          switch (jobName) {
            case 'processInvoices':
              result = await cronService.processInvoices();
              break;
            case 'processSuspensions':
              result = await cronService.processSuspensions();
              break;
            case 'processCancellations':
              result = await cronService.processCancellations();
              break;
            case 'processBackups':
              result = await cronService.processBackups();
              break;
            case 'cleanupExpiredSessions':
              result = await cronService.cleanupExpiredSessions();
              break;
            case 'processOnboardingSequences':
              result = await cronService.processOnboardingSequences();
              break;
            case 'processSessionCleanup':
              result = await cronService.processSessionCleanup();
              break;
            case 'processFailedEmails':
              result = await cronService.processFailedEmails();
              break;
          }
          results[jobName] = { success: true, result };
        } catch (error) {
          logger.error(`Job ${jobName} failed:`, error);
          results[jobName] = { success: false, error: error.message };
        }
      }

      res.json({ 
        success: true,
        message: 'All cron jobs executed',
        results,
        executedBy: req.user.email,
        executedAt: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Error triggering all cron jobs:', error);
      res.status(500).json({ 
        error: 'Failed to execute cron jobs',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

export default router;
