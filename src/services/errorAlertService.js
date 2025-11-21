/**
 * Critical Error Alert System
 * Sends email notifications to admins when critical errors occur
 */

import queueService from './queueService.js';
import logger from '../config/logger.js';

const ADMIN_EMAIL = process.env.EMAIL_ADMIN || process.env.EMAIL_SUPPORT || 'admin@migrahosting.com';
const ERROR_THRESHOLD = parseInt(process.env.ERROR_ALERT_THRESHOLD || '5', 10); // Errors per minute before alert
const COOLDOWN_MINUTES = parseInt(process.env.ERROR_ALERT_COOLDOWN || '15', 10); // Minutes between alerts

// Track error counts to prevent spam
const errorCounts = new Map();
const lastAlertTime = new Map();

/**
 * Alert admin about critical error
 */
export async function alertCriticalError(error, context = {}) {
  try {
    const errorKey = context.operation || 'general';
    
    // Check cooldown
    const lastAlert = lastAlertTime.get(errorKey);
    if (lastAlert && Date.now() - lastAlert < COOLDOWN_MINUTES * 60 * 1000) {
      logger.debug(`Alert suppressed for ${errorKey} (cooldown active)`);
      return;
    }

    // Increment error count
    const count = (errorCounts.get(errorKey) || 0) + 1;
    errorCounts.set(errorKey, count);

    // Only alert if threshold reached
    if (count < ERROR_THRESHOLD) {
      logger.debug(`Error count ${count}/${ERROR_THRESHOLD} for ${errorKey}`);
      return;
    }

    // Send alert
    const subject = `🚨 Critical Error Alert: ${context.operation || 'System Error'}`;
    const html = generateErrorAlertEmail(error, context, count);

    await queueService.addEmailJob({
      from: process.env.EMAIL_ADMIN,
      to: ADMIN_EMAIL,
      subject,
      html,
      department: 'admin',
      priority: 1, // Highest priority
    });

    // Update last alert time and reset counter
    lastAlertTime.set(errorKey, Date.now());
    errorCounts.set(errorKey, 0);

    logger.warn(`Critical error alert sent for ${errorKey}`);
  } catch (alertError) {
    logger.error('Failed to send error alert:', alertError);
  }
}

/**
 * Alert about cron job failure
 */
export async function alertCronFailure(jobName, error, details = {}) {
  try {
    const subject = `⚠️ Cron Job Failed: ${jobName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .error-box { background: #fee2e2; border-left: 4px solid #dc2626; padding: 15px; margin: 15px 0; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .code { background: #1f2937; color: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Cron Job Failure</h1>
          </div>
          <div class="content">
            <p><strong>Job Name:</strong> ${jobName}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            
            <div class="error-box">
              <strong>Error Message:</strong><br>
              ${error.message || 'Unknown error'}
            </div>
            
            ${error.stack ? `
              <div class="details">
                <strong>Stack Trace:</strong>
                <pre class="code">${error.stack}</pre>
              </div>
            ` : ''}
            
            ${Object.keys(details).length > 0 ? `
              <div class="details">
                <strong>Additional Details:</strong>
                <pre class="code">${JSON.stringify(details, null, 2)}</pre>
              </div>
            ` : ''}
            
            <p><strong>Action Required:</strong></p>
            <ul>
              <li>Check logs for more details</li>
              <li>Verify database connections</li>
              <li>Ensure external services are accessible</li>
              <li>Consider manually triggering the job: <code>POST /api/admin/cron/trigger/${jobName}</code></li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;

    await queueService.addEmailJob({
      from: process.env.EMAIL_ADMIN,
      to: ADMIN_EMAIL,
      subject,
      html,
      department: 'admin',
      priority: 2,
    });

    logger.warn(`Cron failure alert sent for ${jobName}`);
  } catch (alertError) {
    logger.error('Failed to send cron failure alert:', alertError);
  }
}

/**
 * Alert about queue processing failure
 */
export async function alertQueueFailure(queueName, jobData, error) {
  try {
    const subject = `⚠️ Queue Processing Failed: ${queueName}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ea580c; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .warning-box { background: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 15px 0; }
          .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Queue Processing Failure</h1>
          </div>
          <div class="content">
            <p><strong>Queue:</strong> ${queueName}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            
            <div class="warning-box">
              <strong>Error:</strong> ${error.message || 'Unknown error'}
            </div>
            
            <div class="details">
              <strong>Job Data:</strong>
              <pre>${JSON.stringify(jobData, null, 2).substring(0, 500)}...</pre>
            </div>
            
            <p>The job has been marked as failed and will not be retried automatically.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await queueService.addEmailJob({
      from: process.env.EMAIL_ADMIN,
      to: ADMIN_EMAIL,
      subject,
      html,
      department: 'admin',
      priority: 3,
    });

    logger.warn(`Queue failure alert sent for ${queueName}`);
  } catch (alertError) {
    logger.error('Failed to send queue failure alert:', alertError);
  }
}

/**
 * Alert about system health issues
 */
export async function alertSystemHealth(issue, metrics = {}) {
  try {
    const subject = `🏥 System Health Alert: ${issue}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .metric { background: white; padding: 10px; margin: 10px 0; border-left: 4px solid #f59e0b; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 System Health Alert</h1>
          </div>
          <div class="content">
            <p><strong>Issue:</strong> ${issue}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Server:</strong> ${process.env.HOSTNAME || 'Unknown'}</p>
            
            <h3>Metrics:</h3>
            ${Object.entries(metrics).map(([key, value]) => `
              <div class="metric">
                <strong>${key}:</strong> ${value}
              </div>
            `).join('')}
            
            <p><strong>Recommended Actions:</strong></p>
            <ul>
              <li>Check server resources (CPU, memory, disk)</li>
              <li>Review application logs</li>
              <li>Verify database connectivity</li>
              <li>Check external service dependencies</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;

    await queueService.addEmailJob({
      from: process.env.EMAIL_ADMIN,
      to: ADMIN_EMAIL,
      subject,
      html,
      department: 'admin',
      priority: 2,
    });

    logger.warn(`System health alert sent: ${issue}`);
  } catch (alertError) {
    logger.error('Failed to send system health alert:', alertError);
  }
}

/**
 * Generate error alert email HTML
 */
function generateErrorAlertEmail(error, context, errorCount) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .critical { background: #fee2e2; border: 2px solid #dc2626; padding: 15px; margin: 15px 0; border-radius: 4px; }
        .details { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .code { background: #1f2937; color: #f3f4f6; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 CRITICAL ERROR ALERT</h1>
        </div>
        <div class="content">
          <div class="critical">
            <h2>Error Threshold Reached!</h2>
            <p><strong>${errorCount} errors</strong> occurred in the last ${COOLDOWN_MINUTES} minutes.</p>
          </div>
          
          <div class="details">
            <p><strong>Operation:</strong> ${context.operation || 'Unknown'}</p>
            <p><strong>Tenant:</strong> ${context.tenantId || 'N/A'}</p>
            <p><strong>User:</strong> ${context.userId || 'N/A'}</p>
            <p><strong>Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          </div>
          
          <div class="details">
            <strong>Error Message:</strong>
            <pre class="code">${error.message || 'Unknown error'}</pre>
          </div>
          
          ${error.stack ? `
            <div class="details">
              <strong>Stack Trace:</strong>
              <pre class="code">${error.stack.substring(0, 1000)}...</pre>
            </div>
          ` : ''}
          
          ${context.request ? `
            <div class="details">
              <strong>Request Details:</strong>
              <pre class="code">${JSON.stringify(context.request, null, 2).substring(0, 500)}...</pre>
            </div>
          ` : ''}
          
          <p style="margin-top: 20px;"><strong>⚠️ IMMEDIATE ACTION REQUIRED</strong></p>
          <ul>
            <li>Check application logs immediately</li>
            <li>Verify system resources and dependencies</li>
            <li>Monitor error rates for continued issues</li>
            <li>Consider rolling back recent deployments if pattern persists</li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Reset error counts (called periodically or manually)
 */
export function resetErrorCounts() {
  const keys = Array.from(errorCounts.keys());
  keys.forEach(key => {
    if (errorCounts.get(key) === 0) {
      errorCounts.delete(key);
      lastAlertTime.delete(key);
    } else {
      errorCounts.set(key, 0);
    }
  });
  logger.debug('Error counts reset');
}

// Reset counts every hour
setInterval(resetErrorCounts, 60 * 60 * 1000);

export default {
  alertCriticalError,
  alertCronFailure,
  alertQueueFailure,
  alertSystemHealth,
  resetErrorCounts,
};
