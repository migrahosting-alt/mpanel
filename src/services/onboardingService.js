/**
 * Onboarding Service
 * Automated customer onboarding sequences
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';
import queueService from './queueService.js';
import * as emailTemplates from './emailTemplates.js';

/**
 * Create onboarding sequence
 */
export async function createSequence(sequenceData) {
  const { tenantId, name, description, triggerEvent, steps } = sequenceData;
  
  try {
    const result = await pool.query(
      `INSERT INTO onboarding_sequences (tenant_id, name, description, trigger_event, steps)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tenantId, name, description, triggerEvent, JSON.stringify(steps)]
    );
    
    logger.info(`Created onboarding sequence: ${name}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating onboarding sequence:', error);
    throw error;
  }
}

/**
 * Get all sequences for tenant
 */
export async function getSequences(tenantId) {
  try {
    const result = await pool.query(
      'SELECT * FROM onboarding_sequences WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting sequences:', error);
    throw error;
  }
}

/**
 * Start onboarding sequence for user
 */
export async function startSequence(userId, sequenceId, tenantId) {
  try {
    // Check if already enrolled
    const existing = await pool.query(
      'SELECT id FROM onboarding_progress WHERE user_id = $1 AND sequence_id = $2',
      [userId, sequenceId]
    );
    
    if (existing.rows.length > 0) {
      logger.warn(`User ${userId} already enrolled in sequence ${sequenceId}`);
      return existing.rows[0];
    }
    
    // Create progress record
    const result = await pool.query(
      `INSERT INTO onboarding_progress (sequence_id, user_id, tenant_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sequenceId, userId, tenantId]
    );
    
    // Schedule first step
    await scheduleNextStep(userId, sequenceId);
    
    logger.info(`Started onboarding sequence ${sequenceId} for user ${userId}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error starting onboarding sequence:', error);
    throw error;
  }
}

/**
 * Schedule next step in sequence
 */
async function scheduleNextStep(userId, sequenceId) {
  try {
    // Get sequence and progress
    const [sequenceResult, progressResult] = await Promise.all([
      pool.query('SELECT * FROM onboarding_sequences WHERE id = $1', [sequenceId]),
      pool.query('SELECT * FROM onboarding_progress WHERE user_id = $1 AND sequence_id = $2', [userId, sequenceId]),
    ]);
    
    if (sequenceResult.rows.length === 0 || progressResult.rows.length === 0) {
      return;
    }
    
    const sequence = sequenceResult.rows[0];
    const progress = progressResult.rows[0];
    const steps = sequence.steps;
    const currentStep = progress.current_step;
    
    if (currentStep >= steps.length) {
      // Sequence completed
      await pool.query(
        'UPDATE onboarding_progress SET status = $1, completed_at = NOW() WHERE id = $2',
        ['completed', progress.id]
      );
      logger.info(`Onboarding sequence ${sequenceId} completed for user ${userId}`);
      return;
    }
    
    const step = steps[currentStep];
    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + (step.day || 0));
    scheduledFor.setHours(step.hour || 10, step.minute || 0, 0, 0); // Default 10 AM
    
    // Get user info
    const userResult = await pool.query(
      'SELECT email, first_name, last_name, phone_number FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
    // Queue notification based on channel
    if (step.channel === 'email' || !step.channel) {
      // Get template
      const template = getTemplate(step.template, {
        customerName: `${user.first_name} ${user.last_name}`,
        email: user.email,
        step: step.name,
      });
      
      // Use HTML template if available, fallback to old template system
      const jobData = {
        tenantId: progress.tenant_id,
        from: process.env.EMAIL_INFO,
        to: user.email,
        subject: template.subject || step.subject || 'Welcome to MigraHosting',
        department: 'info',
        priority: 3,
        scheduledFor: scheduledFor,
      };

      // Check if this is the welcome step - use beautiful HTML template
      if (step.template === 'welcome' || step.name === 'Welcome Email') {
        jobData.htmlTemplate = 'onboardingWelcome';
        jobData.templateData = {
          customerName: `${user.first_name} ${user.last_name}`,
          email: user.email,
          customerId: userId
        };
      } else {
        // Use old template system for other emails
        jobData.html = template.html;
        jobData.template = step.template;
      }
      
      await queueService.addEmailJob(jobData);
    } else if (step.channel === 'sms' && user.phone_number) {
      // Send SMS via queue
      await queueService.addSMSJob({
        userId: userId,
        to: user.phone_number,
        message: step.message || 'Welcome to MigraHosting!',
        purpose: 'onboarding',
        priority: 3,
      });
      logger.info(`Onboarding SMS step queued for user ${userId}`);
    }
    
    // Update progress
    const stepsCompleted = progress.steps_completed || [];
    stepsCompleted.push({
      step: currentStep,
      scheduled_at: scheduledFor,
      name: step.name,
    });
    
    await pool.query(
      'UPDATE onboarding_progress SET current_step = $1, steps_completed = $2 WHERE id = $3',
      [currentStep + 1, JSON.stringify(stepsCompleted), progress.id]
    );
    
    logger.info(`Scheduled step ${currentStep} for user ${userId} in sequence ${sequenceId}`);
  } catch (error) {
    logger.error('Error scheduling next step:', error);
  }
}

/**
 * Get template for onboarding step
 */
function getTemplate(templateName, data) {
  // Map template names to actual templates
  const templates = {
    'welcome': emailTemplates.infoTemplates.generalInquiry,
    'getting_started': emailTemplates.infoTemplates.newsletter,
    'tips': emailTemplates.infoTemplates.newsletter,
    'upgrade': emailTemplates.salesTemplates.quote,
  };
  
  const templateFn = templates[templateName] || templates.welcome;
  const html = templateFn(data);
  
  return {
    html,
    subject: getSubjectForTemplate(templateName, data),
  };
}

function getSubjectForTemplate(templateName, data) {
  const subjects = {
    'welcome': `Welcome to MigraHosting, ${data.customerName}!`,
    'getting_started': 'Getting Started with Your Hosting',
    'tips': 'Tips for Optimizing Your Website',
    'upgrade': 'Upgrade Your Plan for More Features',
  };
  
  return subjects[templateName] || 'Message from MigraHosting';
}

/**
 * Trigger sequences based on event
 */
export async function triggerEvent(event, userId, tenantId) {
  try {
    // Find active sequences for this event
    const result = await pool.query(
      'SELECT * FROM onboarding_sequences WHERE trigger_event = $1 AND active = true AND tenant_id = $2',
      [event, tenantId]
    );
    
    for (const sequence of result.rows) {
      await startSequence(userId, sequence.id, tenantId);
    }
    
    logger.info(`Triggered ${result.rows.length} sequences for event: ${event}`);
  } catch (error) {
    logger.error('Error triggering event sequences:', error);
  }
}

/**
 * Pause sequence for user
 */
export async function pauseSequence(userId, sequenceId) {
  try {
    await pool.query(
      'UPDATE onboarding_progress SET status = $1 WHERE user_id = $2 AND sequence_id = $3',
      ['paused', userId, sequenceId]
    );
    
    logger.info(`Paused sequence ${sequenceId} for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error pausing sequence:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resume sequence for user
 */
export async function resumeSequence(userId, sequenceId) {
  try {
    await pool.query(
      'UPDATE onboarding_progress SET status = $1 WHERE user_id = $2 AND sequence_id = $3',
      ['active', userId, sequenceId]
    );
    
    // Schedule next step
    await scheduleNextStep(userId, sequenceId);
    
    logger.info(`Resumed sequence ${sequenceId} for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error resuming sequence:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user progress in sequences
 */
export async function getUserProgress(userId) {
  try {
    const result = await pool.query(
      `SELECT op.*, os.name, os.steps
       FROM onboarding_progress op
       JOIN onboarding_sequences os ON op.sequence_id = os.id
       WHERE op.user_id = $1
       ORDER BY op.started_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting user progress:', error);
    throw error;
  }
}

/**
 * Process scheduled sequences (run via cron)
 */
export async function processScheduledSequences() {
  try {
    // Get all active sequences
    const result = await pool.query(
      `SELECT * FROM onboarding_progress 
       WHERE status = 'active'`
    );
    
    for (const progress of result.rows) {
      await scheduleNextStep(progress.user_id, progress.sequence_id);
    }
    
    logger.info(`Processed ${result.rows.length} active sequences`);
  } catch (error) {
    logger.error('Error processing scheduled sequences:', error);
  }
}

// Default sequences
export const defaultSequences = [
  {
    name: 'New Customer Welcome',
    description: 'Welcome new customers and help them get started',
    triggerEvent: 'user_created',
    steps: [
      { day: 0, template: 'welcome', channel: 'email', name: 'Welcome Email' },
      { day: 1, template: 'getting_started', channel: 'email', name: 'Getting Started Guide' },
      { day: 3, template: 'tips', channel: 'email', name: 'Optimization Tips' },
      { day: 7, template: 'tips', channel: 'email', name: 'Week 1 Check-in' },
      { day: 14, template: 'upgrade', channel: 'email', name: 'Upgrade Offer' },
    ],
  },
  {
    name: 'Trial to Paid Conversion',
    description: 'Convert trial users to paid customers',
    triggerEvent: 'trial_started',
    steps: [
      { day: 0, template: 'welcome', channel: 'email', name: 'Trial Welcome' },
      { day: 3, template: 'tips', channel: 'email', name: 'Feature Highlights' },
      { day: 7, template: 'tips', channel: 'email', name: 'Success Stories' },
      { day: 10, template: 'upgrade', channel: 'email', name: 'Trial Ending Soon' },
      { day: 13, template: 'upgrade', channel: 'email', name: 'Last Chance' },
    ],
  },
];

export default {
  createSequence,
  getSequences,
  startSequence,
  triggerEvent,
  pauseSequence,
  resumeSequence,
  getUserProgress,
  processScheduledSequences,
  defaultSequences,
};
