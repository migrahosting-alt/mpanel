/**
 * Cron Jobs - Automated recurring tasks
 * 
 * Handles:
 * - Recurring billing (daily at 2 AM)
 * - Service suspension for overdue invoices (daily at 3 AM)
 * - SSL renewal reminders (daily at 4 AM)
 * - Backup cleanup (daily at 5 AM)
 */

import cron from 'node-cron';
import pool from '../db/index.js';
import logger from '../config/logger.js';
import queueService from './queueService.js';
import domainPricingService from './domainPricingService.js';
import { alertCronFailure } from './errorAlertService.js';
import { logQueryReport } from '../utils/queryMonitor.js';
import connectionPoolMonitor from '../utils/connectionPoolMonitor.js';
import indexAdvisor from '../utils/indexAdvisor.js';

class CronService {
  constructor() {
    this.jobs = [];
  }

  /**
   * Initialize all cron jobs
   */
  async initialize() {
    logger.info('Initializing cron jobs...');

    // Only run in production or if explicitly enabled
    if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CRON !== 'true') {
      logger.info('Cron jobs disabled (not in production mode)');
      return;
    }

    // 1. Recurring Billing - Daily at 2:00 AM
    this.jobs.push(
      cron.schedule('0 2 * * *', async () => {
        try {
          await this.processRecurringBilling();
        } catch (error) {
          await alertCronFailure('processRecurringBilling', error);
        }
      })
    );

    // 2. Service Suspension - Daily at 3:00 AM
    this.jobs.push(
      cron.schedule('0 3 * * *', async () => {
        try {
          await this.processServiceSuspensions();
        } catch (error) {
          await alertCronFailure('processServiceSuspensions', error);
        }
      })
    );

    // 3. SSL Renewal Reminders - Daily at 4:00 AM
    this.jobs.push(
      cron.schedule('0 4 * * *', async () => {
        try {
          await this.processSSLRenewals();
        } catch (error) {
          await alertCronFailure('processSSLRenewals', error);
        }
      })
    );

    // 4. Backup Cleanup - Daily at 5:00 AM
    this.jobs.push(
      cron.schedule('0 5 * * *', async () => {
        try {
          await this.processBackupCleanup();
        } catch (error) {
          await alertCronFailure('processBackupCleanup', error);
        }
      })
    );

    // 5. Domain Pricing Update - Daily at 3:00 AM (NameSilo)
    this.jobs.push(
      cron.schedule('0 3 * * *', async () => {
        try {
          await this.processDomainPricingUpdate();
        } catch (error) {
          await alertCronFailure('processDomainPricingUpdate', error);
        }
      })
    );

    // 6. Onboarding Sequences - Daily at 10:00 AM
    this.jobs.push(
      cron.schedule('0 10 * * *', async () => {
        try {
          await this.processOnboardingSequences();
        } catch (error) {
          await alertCronFailure('processOnboardingSequences', error);
        }
      })
    );

    // 7. Session Cleanup - Daily at 2:00 AM
    this.jobs.push(
      cron.schedule('0 2 * * *', async () => {
        try {
          await this.processSessionCleanup();
        } catch (error) {
          await alertCronFailure('processSessionCleanup', error);
        }
      })
    );

    // 8. Database Query Performance Report - Every hour
    this.jobs.push(
      cron.schedule('0 * * * *', async () => {
        try {
          logQueryReport();
        } catch (error) {
          logger.error('Failed to generate query performance report:', error);
        }
      })
    );

    // 9. NPS Surveys - First day of each quarter at 10:00 AM
    this.jobs.push(
      cron.schedule('0 10 1 */3 *', async () => {
        try {
          await this.processNPSSurveys();
        } catch (error) {
          await alertCronFailure('processNPSSurveys', error);
        }
      })
    );

    // 9. Failed Email Retry - Every hour
    this.jobs.push(
      cron.schedule('0 * * * *', async () => {
        try {
          await this.processFailedEmails();
        } catch (error) {
          await alertCronFailure('processFailedEmails', error);
        }
      })
    );

    // 10. Connection Pool Health Report - Every hour
    this.jobs.push(
      cron.schedule('0 * * * *', async () => {
        try {
          const pool = (await import('../db/index.js')).default;
          connectionPoolMonitor.generatePoolReport(pool);
        } catch (error) {
          logger.error('Failed to generate pool health report:', error);
        }
      })
    );

    // 11. Database Index Recommendations - Every 6 hours
    this.jobs.push(
      cron.schedule('0 */6 * * *', async () => {
        try {
          await indexAdvisor.generateReport();
        } catch (error) {
          logger.error('Failed to generate index recommendations:', error);
        }
      })
    );

    logger.info(`${this.jobs.length} cron jobs initialized`);
  }

  /**
   * Recurring Billing
   * Generates invoices for services due for renewal in 7 days
   */
  async processRecurringBilling() {
    try {
      logger.info('Starting recurring billing process...');

      // Find services that renew in 7 days
      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 7);

      const result = await pool.query(
        `SELECT 
          s.*,
          c.id as customer_id,
          c.name as customer_name,
          c.email as customer_email,
          p.name as product_name
         FROM services s
         JOIN customers c ON s.customer_id = c.id
         JOIN products p ON s.product_id = p.id
         WHERE s.auto_renew = true
         AND s.status = 'active'
         AND s.renewal_date::date = $1::date
         AND NOT EXISTS (
           SELECT 1 FROM invoices 
           WHERE service_id = s.id 
           AND status = 'pending'
         )`,
        [renewalDate]
      );

      logger.info(`Found ${result.rows.length} services due for renewal`);

      for (const service of result.rows) {
        try {
          // Create invoice
          const invoiceResult = await pool.query(
            `INSERT INTO invoices (
              customer_id,
              service_id,
              amount,
              due_date,
              status,
              description,
              billing_cycle
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
              service.customer_id,
              service.id,
              service.price,
              service.renewal_date,
              'pending',
              `Renewal: ${service.product_name} - ${service.domain || service.name}`,
              service.billing_cycle
            ]
          );

          const invoice = invoiceResult.rows[0];

          logger.info(`Invoice created for service ${service.id}: Invoice #${invoice.id}`);

          // Queue invoice email
          await queueService.addEmailJob({
            to: service.customer_email,
            subject: `Invoice #${invoice.id} - Renewal Due`,
            template: 'invoice',
            data: {
              customer_name: service.customer_name,
              invoice_id: invoice.id,
              amount: invoice.amount,
              due_date: invoice.due_date,
              service_name: service.product_name,
              domain: service.domain
            }
          });

          // If customer has saved payment method, auto-charge
          const paymentMethodResult = await pool.query(
            'SELECT stripe_payment_method FROM customers WHERE id = $1',
            [service.customer_id]
          );

          if (paymentMethodResult.rows[0]?.stripe_payment_method) {
            // Queue payment processing
            await queueService.addInvoiceJob({
              invoiceId: invoice.id,
              customerId: service.customer_id,
              amount: invoice.amount,
              paymentMethod: paymentMethodResult.rows[0].stripe_payment_method
            });

            logger.info(`Auto-payment queued for invoice #${invoice.id}`);
          }

        } catch (error) {
          logger.error(`Failed to process renewal for service ${service.id}:`, error);
        }
      }

      logger.info('Recurring billing process completed');
      return { processed: result.rows.length };

    } catch (error) {
      logger.error('Recurring billing process failed:', error);
      throw error;
    }
  }

  /**
   * Service Suspension
   * Suspends services with overdue invoices
   */
  async processServiceSuspensions() {
    try {
      logger.info('Starting service suspension process...');

      // Find services with overdue invoices (past due date + grace period)
      const graceDays = parseInt(process.env.SUSPENSION_GRACE_DAYS || '3');
      const suspensionDate = new Date();
      suspensionDate.setDate(suspensionDate.getDate() - graceDays);

      const result = await pool.query(
        `SELECT DISTINCT
          s.*,
          c.id as customer_id,
          c.name as customer_name,
          c.email as customer_email,
          i.id as invoice_id,
          i.amount as invoice_amount,
          i.due_date
         FROM services s
         JOIN invoices i ON s.id = i.service_id
         JOIN customers c ON s.customer_id = c.id
         WHERE s.status = 'active'
         AND i.status = 'pending'
         AND i.due_date < $1
         ORDER BY s.id`,
        [suspensionDate]
      );

      logger.info(`Found ${result.rows.length} services to suspend`);

      for (const service of result.rows) {
        try {
          // Suspend service
          await pool.query(
            `UPDATE services 
             SET status = 'suspended', suspended_at = NOW(), suspension_reason = $1
             WHERE id = $2`,
            [`Overdue invoice #${service.invoice_id}`, service.id]
          );

          logger.info(`Service ${service.id} suspended (invoice #${service.invoice_id} overdue)`);

          // Send suspension notice
          await queueService.addEmailJob({
            to: service.customer_email,
            subject: `Service Suspended - Payment Required`,
            template: 'suspension',
            data: {
              customer_name: service.customer_name,
              service_name: service.name,
              domain: service.domain,
              invoice_id: service.invoice_id,
              amount_due: service.invoice_amount,
              due_date: service.due_date,
              grace_period: graceDays
            }
          });

          // Log activity
          await pool.query(
            `INSERT INTO activity_logs (customer_id, type, description, metadata)
             VALUES ($1, $2, $3, $4)`,
            [
              service.customer_id,
              'service_suspended',
              `Service ${service.name} suspended for overdue payment`,
              JSON.stringify({ service_id: service.id, invoice_id: service.invoice_id })
            ]
          );

        } catch (error) {
          logger.error(`Failed to suspend service ${service.id}:`, error);
        }
      }

      logger.info('Service suspension process completed');
      return { suspended: result.rows.length };

    } catch (error) {
      logger.error('Service suspension process failed:', error);
      throw error;
    }
  }

  /**
   * SSL Renewal Reminders
   * Sends reminders for SSL certificates expiring soon
   */
  async processSSLRenewals() {
    try {
      logger.info('Starting SSL renewal reminder process...');

      // Find SSL certificates expiring in 30 days
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      const result = await pool.query(
        `SELECT 
          ssl.*,
          s.domain,
          c.name as customer_name,
          c.email as customer_email
         FROM ssl_certificates ssl
         JOIN services s ON ssl.service_id = s.id
         JOIN customers c ON s.customer_id = c.id
         WHERE ssl.status = 'active'
         AND ssl.auto_renew = false
         AND ssl.expires_at < $1
         AND ssl.reminder_sent = false`,
        [expiryDate]
      );

      logger.info(`Found ${result.rows.length} SSL certificates needing renewal reminder`);

      for (const cert of result.rows) {
        try {
          // Send reminder email
          await queueService.addEmailJob({
            to: cert.customer_email,
            subject: `SSL Certificate Expiring Soon - ${cert.domain}`,
            template: 'ssl_renewal',
            data: {
              customer_name: cert.customer_name,
              domain: cert.domain,
              expiry_date: cert.expires_at,
              days_remaining: Math.ceil((new Date(cert.expires_at) - new Date()) / (1000 * 60 * 60 * 24))
            }
          });

          // Mark reminder as sent
          await pool.query(
            'UPDATE ssl_certificates SET reminder_sent = true WHERE id = $1',
            [cert.id]
          );

          logger.info(`SSL renewal reminder sent for ${cert.domain}`);

        } catch (error) {
          logger.error(`Failed to send SSL renewal reminder for ${cert.domain}:`, error);
        }
      }

      logger.info('SSL renewal reminder process completed');
      return { reminders_sent: result.rows.length };

    } catch (error) {
      logger.error('SSL renewal reminder process failed:', error);
      throw error;
    }
  }

  /**
   * Backup Cleanup
   * Deletes old backups based on retention policy
   */
  async processBackupCleanup() {
    try {
      logger.info('Starting backup cleanup process...');

      const retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await pool.query(
        `SELECT * FROM backups
         WHERE created_at < $1
         AND status = 'completed'`,
        [cutoffDate]
      );

      logger.info(`Found ${result.rows.length} old backups to delete`);

      for (const backup of result.rows) {
        try {
          // Delete from storage (MinIO/S3)
          if (backup.file_path) {
            try {
              const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
              
              const s3Client = new S3Client({
                endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
                region: process.env.S3_REGION || 'us-east-1',
                credentials: {
                  accessKeyId: process.env.S3_ACCESS_KEY || '',
                  secretAccessKey: process.env.S3_SECRET_KEY || ''
                },
                forcePathStyle: true
              });
              
              const bucket = process.env.S3_BACKUP_BUCKET || 'backups';
              const key = backup.file_path.replace(`s3://${bucket}/`, '');
              
              await s3Client.send(new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
              }));
              
              logger.info(`Deleted backup file from S3: ${backup.file_path}`);
            } catch (s3Error) {
              logger.error(`Failed to delete S3 file ${backup.file_path}:`, s3Error.message);
            }
          }

          // Delete from database
          await pool.query('DELETE FROM backups WHERE id = $1', [backup.id]);

          logger.info(`Deleted old backup #${backup.id}`);

        } catch (error) {
          logger.error(`Failed to delete backup #${backup.id}:`, error);
        }
      }

      logger.info('Backup cleanup process completed');
      return { deleted: result.rows.length };

    } catch (error) {
      logger.error('Backup cleanup process failed:', error);
      throw error;
    }
  }

  /**
   * Domain Pricing Update
   * Updates domain TLD pricing from NameSilo API
   */
  async processDomainPricingUpdate() {
    try {
      logger.info('Starting domain pricing update...');

      const result = await domainPricingService.updateAllPricing(false);

      if (result.skipped) {
        logger.info('Domain pricing update skipped - not needed yet');
      } else {
        logger.info('Domain pricing update completed', {
          updatedCount: result.updatedCount,
          insertedCount: result.insertedCount,
          totalTlds: result.totalTlds,
        });
      }

      return result;

    } catch (error) {
      logger.error('Domain pricing update failed:', error);
      // Don't throw - continue with other cron jobs
      return { error: error.message };
    }
  }

  /**
   * Manual trigger for testing
   */
  async runJob(jobName) {
    switch (jobName) {
      case 'recurring-billing':
        return await this.processRecurringBilling();
      case 'service-suspension':
        return await this.processServiceSuspensions();
      case 'ssl-renewal':
        return await this.processSSLRenewals();
      case 'backup-cleanup':
        return await this.processBackupCleanup();
      case 'domain-pricing':
        return await this.processDomainPricingUpdate();
      case 'onboarding-sequences':
        return await this.processOnboardingSequences();
      case 'session-cleanup':
        return await this.processSessionCleanup();
      case 'nps-surveys':
        return await this.processNPSSurveys();
      case 'failed-emails':
        return await this.processFailedEmails();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Onboarding Sequences
   * Process scheduled onboarding sequence steps
   */
  async processOnboardingSequences() {
    try {
      logger.info('Starting onboarding sequences processing...');
      const onboarding = await import('./onboardingService.js');
      const result = await onboarding.default.processScheduledSequences();
      logger.info('Onboarding sequences processing completed', result);
      return result;
    } catch (error) {
      logger.error('Onboarding sequences processing failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Session Cleanup
   * Remove expired sessions (older than 7 days)
   */
  async processSessionCleanup() {
    try {
      logger.info('Starting session cleanup...');
      const session = await import('./sessionService.js');
      const result = await session.default.cleanExpiredSessions();
      logger.info('Session cleanup completed', result);
      return result;
    } catch (error) {
      logger.error('Session cleanup failed:', error);
      return { error: error.message };
    }
  }

  /**
   * NPS Surveys
   * Send quarterly NPS surveys to all tenants
   */
  async processNPSSurveys() {
    try {
      logger.info('Starting NPS survey campaign...');
      
      // Get all active tenants
      const result = await pool.query(
        'SELECT DISTINCT tenant_id FROM users WHERE active = true'
      );

      const csat = await import('./csatService.js');
      let totalSent = 0;

      for (const row of result.rows) {
        try {
          const sent = await csat.default.sendNPSSurveys(row.tenant_id);
          totalSent += sent;
        } catch (error) {
          logger.error(`Failed to send NPS surveys for tenant ${row.tenant_id}:`, error);
        }
      }

      logger.info(`NPS survey campaign completed - sent ${totalSent} surveys`);
      return { totalSent };
    } catch (error) {
      logger.error('NPS survey campaign failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Failed Email Retry
   * Retry failed email jobs from the queue
   */
  async processFailedEmails() {
    try {
      logger.info('Starting failed email retry...');
      
      // Get failed emails from email_queue table
      const result = await pool.query(
        `SELECT * FROM email_queue 
         WHERE status = 'failed' 
         AND attempts < max_retries 
         AND created_at > NOW() - INTERVAL '24 hours'
         LIMIT 100`
      );

      let retried = 0;
      for (const email of result.rows) {
        try {
          await queueService.addEmailJob({
            to: email.to_email,
            subject: email.subject,
            html: email.body,
            template: email.template,
            data: email.template_data,
          });

          // Update status to queued
          await pool.query(
            `UPDATE email_queue 
             SET status = 'queued', 
                 attempts = attempts + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [email.id]
          );

          retried++;
        } catch (error) {
          logger.error(`Failed to retry email ${email.id}:`, error);
        }
      }

      logger.info(`Failed email retry completed - retried ${retried} emails`);
      return { retried, total: result.rows.length };
    } catch (error) {
      logger.error('Failed email retry failed:', error);
      return { error: error.message };
    }
  }

  /**
   * Stop all cron jobs
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('All cron jobs stopped');
  }
}

export default new CronService();
