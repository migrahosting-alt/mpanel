/**
 * CSAT (Customer Satisfaction) Service
 * Measure and track customer satisfaction
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';
import queueService from './queueService.js';
import * as emailTemplates from './emailTemplates.js';

/**
 * Create and send CSAT survey
 */
export async function sendSurvey(surveyData) {
  const {
    tenantId,
    userId,
    surveyType,
    referenceId,
    referenceType,
    sendVia = 'email',
  } = surveyData;
  
  try {
    // Create survey record
    const result = await pool.query(
      `INSERT INTO csat_surveys (tenant_id, user_id, survey_type, reference_id, reference_type, sent_via)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenantId, userId, surveyType, referenceId, referenceType, sendVia]
    );
    
    const survey = result.rows[0];
    
    // Get user info
    const userResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];
    
    // Send survey email with beautiful HTML template
    const surveyUrl = `${process.env.APP_URL}/client/survey/${survey.id}`;
    
    await queueService.addEmailJob({
      tenantId,
      from: process.env.EMAIL_SUPPORT,
      to: user.email,
      subject: getSurveySubject(surveyType),
      htmlTemplate: surveyType === 'nps' ? 'npsSurvey' : 'csatSurvey',
      templateData: {
        customerName: user.first_name,
        surveyUrl,
        context
      },
      department: 'support',
      priority: 4,
    });
    
    logger.info(`CSAT survey ${survey.id} sent to user ${userId}`);
    return survey;
  } catch (error) {
    logger.error('Error sending CSAT survey:', error);
    throw error;
  }
}

/**
 * Submit survey response
 */
export async function submitResponse(surveyId, score, feedback = '') {
  try {
    // Determine NPS category if NPS survey
    let npsCategory = null;
    const surveyResult = await pool.query(
      'SELECT survey_type FROM csat_surveys WHERE id = $1',
      [surveyId]
    );
    
    if (surveyResult.rows[0].survey_type === 'nps') {
      if (score >= 0 && score <= 6) npsCategory = 'detractor';
      else if (score >= 7 && score <= 8) npsCategory = 'passive';
      else if (score >= 9 && score <= 10) npsCategory = 'promoter';
    }
    
    // Determine if follow-up is needed
    const followUpRequired = (score <= 3) || (npsCategory === 'detractor');
    
    const result = await pool.query(
      `UPDATE csat_surveys 
       SET responded_at = NOW(), score = $1, feedback = $2, nps_category = $3, follow_up_required = $4
       WHERE id = $5
       RETURNING *`,
      [score, feedback, npsCategory, followUpRequired, surveyId]
    );
    
    // If negative feedback, notify support team
    if (followUpRequired) {
      await notifySupportTeam(result.rows[0]);
    }
    
    logger.info(`Survey ${surveyId} submitted with score ${score}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error submitting survey response:', error);
    throw error;
  }
}

/**
 * Get CSAT metrics for tenant
 */
export async function getMetrics(tenantId, days = 30) {
  try {
    const result = await pool.query(
      `SELECT 
        survey_type,
        COUNT(*) as total_surveys,
        COUNT(*) FILTER (WHERE responded_at IS NOT NULL) as responses,
        ROUND(AVG(score), 2) as avg_score,
        COUNT(*) FILTER (WHERE score >= 4) as positive_responses,
        COUNT(*) FILTER (WHERE score <= 2) as negative_responses,
        COUNT(*) FILTER (WHERE nps_category = 'promoter') as promoters,
        COUNT(*) FILTER (WHERE nps_category = 'passive') as passives,
        COUNT(*) FILTER (WHERE nps_category = 'detractor') as detractors
       FROM csat_surveys
       WHERE tenant_id = $1 
         AND sent_at >= NOW() - INTERVAL '${days} days'
       GROUP BY survey_type`,
      [tenantId]
    );
    
    // Calculate NPS score
    const npsData = result.rows.find(r => r.survey_type === 'nps');
    let nps = null;
    
    if (npsData) {
      const total = parseInt(npsData.responses);
      const promoters = parseInt(npsData.promoters);
      const detractors = parseInt(npsData.detractors);
      
      if (total > 0) {
        nps = Math.round(((promoters - detractors) / total) * 100);
      }
    }
    
    return {
      metrics: result.rows,
      nps,
      period: `${days} days`,
    };
  } catch (error) {
    logger.error('Error getting CSAT metrics:', error);
    throw error;
  }
}

/**
 * Get surveys requiring follow-up
 */
export async function getFollowUpRequired(tenantId) {
  try {
    const result = await pool.query(
      `SELECT cs.*, u.email, u.first_name, u.last_name
       FROM csat_surveys cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.tenant_id = $1 
         AND cs.follow_up_required = true 
         AND cs.follow_up_completed = false
       ORDER BY cs.responded_at DESC`,
      [tenantId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting follow-up surveys:', error);
    throw error;
  }
}

/**
 * Mark follow-up as completed
 */
export async function completeFollowUp(surveyId, notes) {
  try {
    await pool.query(
      `UPDATE csat_surveys 
       SET follow_up_completed = true, follow_up_notes = $1
       WHERE id = $2`,
      [notes, surveyId]
    );
    
    logger.info(`Follow-up completed for survey ${surveyId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error completing follow-up:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Auto-send surveys after support ticket resolved
 */
export async function sendTicketSurvey(ticketId, userId, tenantId) {
  try {
    await sendSurvey({
      tenantId,
      userId,
      surveyType: 'support_ticket',
      referenceId: ticketId,
      referenceType: 'ticket',
    });
  } catch (error) {
    logger.error('Error sending ticket survey:', error);
  }
}

/**
 * Send NPS survey to active customers (quarterly)
 */
export async function sendNPSSurveys(tenantId) {
  try {
    // Get active customers (had activity in last 90 days)
    const result = await pool.query(
      `SELECT DISTINCT u.id, u.tenant_id
       FROM users u
       WHERE u.tenant_id = $1
         AND u.created_at < NOW() - INTERVAL '30 days'
         AND NOT EXISTS (
           SELECT 1 FROM csat_surveys 
           WHERE user_id = u.id 
             AND survey_type = 'nps' 
             AND sent_at > NOW() - INTERVAL '90 days'
         )`,
      [tenantId]
    );
    
    let sent = 0;
    for (const user of result.rows) {
      await sendSurvey({
        tenantId,
        userId: user.id,
        surveyType: 'nps',
      });
      sent++;
    }
    
    logger.info(`Sent ${sent} NPS surveys for tenant ${tenantId}`);
    return { success: true, sent };
  } catch (error) {
    logger.error('Error sending NPS surveys:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify support team of negative feedback
 */
async function notifySupportTeam(survey) {
  try {
    const userResult = await pool.query(
      'SELECT email, first_name, last_name FROM users WHERE id = $1',
      [survey.user_id]
    );
    const user = userResult.rows[0];
    
    await queueService.addEmailJob({
      tenantId: survey.tenant_id,
      from: process.env.EMAIL_ADMIN,
      to: process.env.EMAIL_SUPPORT,
      subject: `Negative Feedback Alert: ${survey.survey_type}`,
      html: `
        <h2>Negative Feedback Received</h2>
        <p><strong>Customer:</strong> ${user.first_name} ${user.last_name} (${user.email})</p>
        <p><strong>Survey Type:</strong> ${survey.survey_type}</p>
        <p><strong>Score:</strong> ${survey.score} / ${survey.survey_type === 'nps' ? '10' : '5'}</p>
        <p><strong>Feedback:</strong> ${survey.feedback || 'No feedback provided'}</p>
        <p><strong>Reference:</strong> ${survey.reference_type} ${survey.reference_id}</p>
        <p><a href="${process.env.APP_URL}/admin/surveys/${survey.id}">View in Dashboard</a></p>
      `,
      department: 'admin',
      priority: 2, // High priority
    });
  } catch (error) {
    logger.error('Error notifying support team:', error);
  }
}

/**
 * Generate survey email HTML
 */
function generateSurveyEmail(surveyType, firstName, surveyUrl) {
  const questions = {
    'support_ticket': {
      title: 'How was your support experience?',
      question: 'On a scale of 1-5, how satisfied were you with our support team?',
    },
    'nps': {
      title: 'We value your feedback',
      question: 'On a scale of 0-10, how likely are you to recommend MigraHosting to a friend or colleague?',
    },
    'product': {
      title: 'Tell us about your experience',
      question: 'How satisfied are you with our product?',
    },
    'onboarding': {
      title: 'How was your onboarding?',
      question: 'How smooth was your onboarding experience?',
    },
  };
  
  const q = questions[surveyType] || questions.product;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .rating-buttons { text-align: center; margin: 30px 0; }
        .rating-button {
          display: inline-block;
          width: 50px;
          height: 50px;
          margin: 5px;
          background: #fff;
          border: 2px solid #8B5CF6;
          border-radius: 50%;
          text-decoration: none;
          color: #8B5CF6;
          font-size: 20px;
          line-height: 46px;
          font-weight: bold;
        }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${q.title}</h1>
        </div>
        <div class="content">
          <p>Hi ${firstName},</p>
          <p>${q.question}</p>
          <div class="rating-buttons">
            ${generateRatingButtons(surveyType, surveyUrl)}
          </div>
          <p style="text-align: center; margin-top: 30px;">
            <a href="${surveyUrl}" style="background: #8B5CF6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Take Survey</a>
          </p>
          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
            This will only take 30 seconds
          </p>
        </div>
        <div class="footer">
          <p>MigraHosting - Reliable Hosting Solutions</p>
          <p>If you no longer wish to receive these emails, <a href="#">unsubscribe</a>.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateRatingButtons(surveyType, baseUrl) {
  const maxScore = surveyType === 'nps' ? 10 : 5;
  const buttons = [];
  
  for (let i = 0; i <= maxScore; i++) {
    buttons.push(
      `<a href="${baseUrl}?score=${i}" class="rating-button">${i}</a>`
    );
  }
  
  return buttons.join('');
}

function getSurveySubject(surveyType) {
  const subjects = {
    'support_ticket': 'How was your support experience?',
    'nps': 'We value your feedback',
    'product': 'Tell us what you think',
    'onboarding': 'How was your onboarding experience?',
  };
  
  return subjects[surveyType] || 'We value your feedback';
}

export default {
  sendSurvey,
  submitResponse,
  getMetrics,
  getFollowUpRequired,
  completeFollowUp,
  sendTicketSurvey,
  sendNPSSurveys,
};
