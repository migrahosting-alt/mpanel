/**
 * Advanced Email Marketing Service
 * Drip campaigns, A/B testing, analytics, template builder
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import nodemailer from 'nodemailer';
import { marked } from 'marked';

class EmailMarketingService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Create email campaign
   */
  async createCampaign(tenantId, userId, campaignData) {
    try {
      const {
        name,
        subject,
        fromName,
        fromEmail,
        replyTo,
        templateId,
        segmentId,
        scheduledAt
      } = campaignData;

      const result = await pool.query(
        `INSERT INTO email_campaigns 
         (tenant_id, user_id, name, subject, from_name, from_email, reply_to, 
          template_id, segment_id, scheduled_at, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
         RETURNING *`,
        [tenantId, userId, name, subject, fromName, fromEmail, replyTo, 
         templateId, segmentId, scheduledAt]
      );

      logger.info('Email campaign created', { campaignId: result.rows[0].id });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create campaign', { error: error.message });
      throw error;
    }
  }

  /**
   * Create drip campaign sequence
   */
  async createDripCampaign(tenantId, userId, dripData) {
    try {
      const { name, triggerEvent, segmentId, emails } = dripData;

      // Create drip campaign
      const campaignResult = await pool.query(
        `INSERT INTO drip_campaigns 
         (tenant_id, user_id, name, trigger_event, segment_id, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING *`,
        [tenantId, userId, name, triggerEvent, segmentId]
      );

      const campaign = campaignResult.rows[0];

      // Create email sequence
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        
        await pool.query(
          `INSERT INTO drip_emails 
           (drip_campaign_id, sequence_number, subject, template_id, delay_days, delay_hours)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [campaign.id, i + 1, email.subject, email.templateId, 
           email.delayDays || 0, email.delayHours || 0]
        );
      }

      logger.info('Drip campaign created', { 
        campaignId: campaign.id, 
        emailCount: emails.length 
      });

      return campaign;
    } catch (error) {
      logger.error('Failed to create drip campaign', { error: error.message });
      throw error;
    }
  }

  /**
   * Send campaign to recipients
   */
  async sendCampaign(campaignId) {
    try {
      // Get campaign details
      const campaignResult = await pool.query(
        `SELECT c.*, t.html_content, t.text_content 
         FROM email_campaigns c
         LEFT JOIN email_templates t ON c.template_id = t.id
         WHERE c.id = $1`,
        [campaignId]
      );

      const campaign = campaignResult.rows[0];

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw new Error(`Campaign is ${campaign.status}`);
      }

      // Get recipients from segment
      const recipientsResult = await pool.query(
        `SELECT DISTINCT u.id, u.email, u.name
         FROM users u
         JOIN customer_segments cs ON u.id = cs.customer_id
         WHERE cs.segment_id = $1 AND u.email_verified = true`,
        [campaign.segment_id]
      );

      const recipients = recipientsResult.rows;

      // Update campaign status
      await pool.query(
        'UPDATE email_campaigns SET status = $1, sent_at = NOW() WHERE id = $2',
        ['sending', campaignId]
      );

      // Send emails
      let sentCount = 0;
      let failedCount = 0;

      for (const recipient of recipients) {
        try {
          await this.sendEmail(campaign, recipient);
          sentCount++;

          // Record send
          await pool.query(
            `INSERT INTO email_sends 
             (campaign_id, user_id, email, status)
             VALUES ($1, $2, $3, 'sent')`,
            [campaignId, recipient.id, recipient.email]
          );
        } catch (error) {
          failedCount++;
          logger.error('Failed to send campaign email', { 
            error: error.message, 
            recipient: recipient.email 
          });

          await pool.query(
            `INSERT INTO email_sends 
             (campaign_id, user_id, email, status, error_message)
             VALUES ($1, $2, $3, 'failed', $4)`,
            [campaignId, recipient.id, recipient.email, error.message]
          );
        }
      }

      // Update campaign status
      await pool.query(
        `UPDATE email_campaigns 
         SET status = 'sent', sent_count = $1, failed_count = $2
         WHERE id = $3`,
        [sentCount, failedCount, campaignId]
      );

      logger.info('Campaign sent', { 
        campaignId, 
        sent: sentCount, 
        failed: failedCount 
      });

      return { success: true, sent: sentCount, failed: failedCount };
    } catch (error) {
      logger.error('Failed to send campaign', { error: error.message, campaignId });
      throw error;
    }
  }

  /**
   * Send individual email
   */
  async sendEmail(campaign, recipient) {
    const trackingId = crypto.randomUUID();

    // Replace personalization variables
    let htmlContent = campaign.html_content || '';
    let textContent = campaign.text_content || '';
    let subject = campaign.subject;

    const variables = {
      '{{name}}': recipient.name || 'there',
      '{{email}}': recipient.email,
      '{{unsubscribe_url}}': `${process.env.APP_URL}/unsubscribe/${trackingId}`,
      '{{tracking_pixel}}': `${process.env.APP_URL}/track/open/${trackingId}.gif`
    };

    for (const [key, value] of Object.entries(variables)) {
      htmlContent = htmlContent.replace(new RegExp(key, 'g'), value);
      textContent = textContent.replace(new RegExp(key, 'g'), value);
      subject = subject.replace(new RegExp(key, 'g'), value);
    }

    await this.transporter.sendMail({
      from: `${campaign.from_name} <${campaign.from_email}>`,
      to: recipient.email,
      replyTo: campaign.reply_to,
      subject: subject,
      html: htmlContent,
      text: textContent,
      headers: {
        'X-Campaign-ID': campaign.id,
        'X-Tracking-ID': trackingId
      }
    });
  }

  /**
   * Create A/B test campaign
   */
  async createABTest(tenantId, userId, testData) {
    try {
      const { name, variantA, variantB, testPercentage, segmentId } = testData;

      const result = await pool.query(
        `INSERT INTO ab_tests 
         (tenant_id, user_id, name, variant_a_subject, variant_a_template_id,
          variant_b_subject, variant_b_template_id, test_percentage, segment_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
         RETURNING *`,
        [tenantId, userId, name, variantA.subject, variantA.templateId,
         variantB.subject, variantB.templateId, testPercentage, segmentId]
      );

      logger.info('A/B test created', { testId: result.rows[0].id });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create A/B test', { error: error.message });
      throw error;
    }
  }

  /**
   * Track email open
   */
  async trackOpen(trackingId) {
    try {
      const result = await pool.query(
        `UPDATE email_sends 
         SET opened = true, opened_at = NOW(), open_count = open_count + 1
         WHERE tracking_id = $1
         RETURNING campaign_id`,
        [trackingId]
      );

      if (result.rows.length > 0) {
        // Update campaign stats
        await pool.query(
          'UPDATE email_campaigns SET open_count = open_count + 1 WHERE id = $1',
          [result.rows[0].campaign_id]
        );
      }

      logger.debug('Email open tracked', { trackingId });
    } catch (error) {
      logger.error('Failed to track open', { error: error.message });
    }
  }

  /**
   * Track email click
   */
  async trackClick(trackingId, url) {
    try {
      const result = await pool.query(
        `UPDATE email_sends 
         SET clicked = true, clicked_at = NOW(), click_count = click_count + 1
         WHERE tracking_id = $1
         RETURNING campaign_id`,
        [trackingId]
      );

      if (result.rows.length > 0) {
        // Record click details
        await pool.query(
          `INSERT INTO email_clicks (tracking_id, url, clicked_at)
           VALUES ($1, $2, NOW())`,
          [trackingId, url]
        );

        // Update campaign stats
        await pool.query(
          'UPDATE email_campaigns SET click_count = click_count + 1 WHERE id = $1',
          [result.rows[0].campaign_id]
        );
      }

      logger.debug('Email click tracked', { trackingId, url });
    } catch (error) {
      logger.error('Failed to track click', { error: error.message });
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId) {
    try {
      const result = await pool.query(
        `SELECT 
           c.*,
           COUNT(DISTINCT es.id) as total_sent,
           COUNT(DISTINCT CASE WHEN es.opened THEN es.id END) as total_opens,
           COUNT(DISTINCT CASE WHEN es.clicked THEN es.id END) as total_clicks,
           COUNT(DISTINCT CASE WHEN es.bounced THEN es.id END) as total_bounces,
           COUNT(DISTINCT CASE WHEN es.unsubscribed THEN es.id END) as total_unsubscribes,
           ROUND(
             COUNT(DISTINCT CASE WHEN es.opened THEN es.id END)::numeric / 
             NULLIF(COUNT(DISTINCT es.id), 0) * 100, 2
           ) as open_rate,
           ROUND(
             COUNT(DISTINCT CASE WHEN es.clicked THEN es.id END)::numeric / 
             NULLIF(COUNT(DISTINCT es.id), 0) * 100, 2
           ) as click_rate
         FROM email_campaigns c
         LEFT JOIN email_sends es ON c.id = es.campaign_id
         WHERE c.id = $1
         GROUP BY c.id`,
        [campaignId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get campaign analytics', { error: error.message });
      throw error;
    }
  }

  /**
   * Create email template
   */
  async createTemplate(tenantId, userId, templateData) {
    try {
      const { name, subject, htmlContent, textContent, category } = templateData;

      const result = await pool.query(
        `INSERT INTO email_templates 
         (tenant_id, user_id, name, subject, html_content, text_content, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [tenantId, userId, name, subject, htmlContent, textContent, category]
      );

      logger.info('Email template created', { templateId: result.rows[0].id });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create template', { error: error.message });
      throw error;
    }
  }

  /**
   * Process drip campaign triggers
   */
  async processDripTriggers() {
    try {
      // Get active drip campaigns
      const campaignsResult = await pool.query(
        'SELECT * FROM drip_campaigns WHERE status = $1',
        ['active']
      );

      for (const campaign of campaignsResult.rows) {
        // Get subscribers who triggered the event
        const subscribersResult = await pool.query(
          `SELECT DISTINCT u.id, u.email, u.name, ue.created_at as trigger_time
           FROM users u
           JOIN user_events ue ON u.id = ue.user_id
           LEFT JOIN drip_subscribers ds ON u.id = ds.user_id AND ds.drip_campaign_id = $1
           WHERE ue.event_type = $2 
             AND ue.created_at >= NOW() - INTERVAL '1 hour'
             AND ds.id IS NULL`,
          [campaign.id, campaign.trigger_event]
        );

        // Subscribe new users to drip
        for (const subscriber of subscribersResult.rows) {
          await pool.query(
            `INSERT INTO drip_subscribers (drip_campaign_id, user_id, subscribed_at)
             VALUES ($1, $2, $3)`,
            [campaign.id, subscriber.id, subscriber.trigger_time]
          );

          logger.info('User subscribed to drip campaign', {
            campaignId: campaign.id,
            userId: subscriber.id
          });
        }
      }

      // Send scheduled drip emails
      await this.sendScheduledDripEmails();

    } catch (error) {
      logger.error('Failed to process drip triggers', { error: error.message });
    }
  }

  /**
   * Send scheduled drip emails
   */
  async sendScheduledDripEmails() {
    try {
      const result = await pool.query(
        `SELECT ds.*, de.*, u.email, u.name, dc.tenant_id
         FROM drip_subscribers ds
         JOIN drip_emails de ON ds.drip_campaign_id = de.drip_campaign_id
         JOIN users u ON ds.user_id = u.id
         JOIN drip_campaigns dc ON ds.drip_campaign_id = dc.id
         LEFT JOIN drip_email_sends des ON ds.id = des.subscriber_id AND de.id = des.drip_email_id
         WHERE des.id IS NULL
           AND ds.subscribed_at + (de.delay_days || ' days')::INTERVAL + (de.delay_hours || ' hours')::INTERVAL <= NOW()
           AND ds.status = 'active'
         LIMIT 100`
      );

      for (const email of result.rows) {
        try {
          // Get template
          const templateResult = await pool.query(
            'SELECT * FROM email_templates WHERE id = $1',
            [email.template_id]
          );

          const template = templateResult.rows[0];

          // Send email
          const campaign = {
            ...email,
            html_content: template.html_content,
            text_content: template.text_content,
            subject: email.subject
          };

          await this.sendEmail(campaign, email);

          // Record send
          await pool.query(
            `INSERT INTO drip_email_sends (subscriber_id, drip_email_id, sent_at)
             VALUES ($1, $2, NOW())`,
            [email.id, email.drip_email_id]
          );

          logger.info('Drip email sent', { 
            subscriberId: email.id, 
            emailId: email.drip_email_id 
          });

        } catch (error) {
          logger.error('Failed to send drip email', { error: error.message });
        }
      }

    } catch (error) {
      logger.error('Failed to send scheduled drip emails', { error: error.message });
    }
  }
}

export default new EmailMarketingService();
