/**
 * Marketing Website API Routes
 * Public endpoints for marketing website integration
 * Handles contact forms, newsletter signups, and cross-platform communication
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import queueService from '../services/queueService.js';
import * as emailTemplates from '../services/emailTemplates.js';
import pool from '../db/index.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

const router = express.Router();

// Rate limiters for different endpoints
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 submissions per hour per IP
  message: { error: 'Too many contact form submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 signups per hour per IP
  message: { error: 'Too many newsletter signups. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 2, // 2 demo requests per hour per IP
  message: { error: 'Too many demo requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const earlyAccessLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // 3 signups per day per IP
  message: { error: 'Too many early access signups. Please try again tomorrow.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/marketing/contact
 * Handle contact form submissions from marketing website
 * Rate limited: 5 requests per hour per IP
 */
router.post('/contact', contactLimiter, async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      company, 
      subject, 
      message, 
      department = 'sales',
      source = 'website'
    } = req.body;
    
    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Name, email, and message are required' 
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Store contact inquiry in database
    const inquiry = await pool.query(
      `INSERT INTO contact_inquiries 
       (name, email, phone, company, subject, message, department, source, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [name, email, phone, company, subject, message, department, source, req.ip]
    );
    
    const inquiryId = inquiry.rows[0].id;
    
    // Determine which department email to use
    const departmentEmails = {
      sales: process.env.EMAIL_SALES,
      support: process.env.EMAIL_SUPPORT,
      info: process.env.EMAIL_INFO,
      partnerships: process.env.EMAIL_PARTNERSHIPS,
      careers: process.env.EMAIL_CAREERS,
      billing: process.env.EMAIL_BILLING,
    };
    
    const toEmail = departmentEmails[department] || process.env.EMAIL_INFO;
    
    // Send email to department
    await queueService.addEmailJob({
      from: process.env.EMAIL_INFO,
      to: toEmail,
      subject: subject || `New ${department} inquiry from ${name}`,
      html: emailTemplates.infoTemplates.generalInquiry({
        customerName: 'Team',
        inquiryType: department.charAt(0).toUpperCase() + department.slice(1),
        senderName: name,
        senderEmail: email,
        senderPhone: phone || 'Not provided',
        senderCompany: company || 'Not provided',
        message: message,
        inquiryId: inquiryId,
      }),
      department: 'info',
      template: 'contact_form',
      priority: department === 'support' ? 2 : 4,
    });
    
    // Send auto-reply to customer with HTML template
    await queueService.addEmailJob({
      from: toEmail,
      to: email,
      subject: `Thank you for contacting MigraHosting ${department === 'sales' ? 'Sales' : 'Support'}`,
      htmlTemplate: 'contactFormAutoReply',
      templateData: {
        name,
        email,
        department: department.charAt(0).toUpperCase() + department.slice(1),
        subject: subject || 'General Inquiry',
        message,
        inquiryId
      },
      department,
      priority: 5,
    });
    
    logger.info(`Contact form submission from ${email} to ${department}`);
    
    res.json({ 
      success: true,
      message: 'Thank you for contacting us! We\'ll get back to you soon.',
      inquiryId 
    });
  } catch (error) {
    logger.error('Error processing contact form:', error);
    res.status(500).json({ error: 'Failed to submit contact form' });
  }
});

/**
 * POST /api/public/newsletter
 * Newsletter signup from marketing website
 * Rate limited: 3 requests per hour per IP
 */
router.post('/newsletter', newsletterLimiter, async (req, res) => {
  try {
    const { email, name, source = 'website' } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Check if already subscribed
    const existing = await pool.query(
      'SELECT id FROM newsletter_subscribers WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      return res.json({ 
        success: true,
        message: 'You are already subscribed to our newsletter!' 
      });
    }
    
    // Add to newsletter
    await pool.query(
      `INSERT INTO newsletter_subscribers (email, name, source, subscribed_at)
       VALUES ($1, $2, $3, NOW())`,
      [email, name, source]
    );
    
    // Send welcome email with HTML template
    await queueService.addEmailJob({
      from: process.env.EMAIL_INFO,
      to: email,
      subject: 'Welcome to MigraHosting Newsletter!',
      htmlTemplate: 'newsletterWelcome',
      templateData: {
        name: name || 'Subscriber',
        email
      },
      department: 'info',
      priority: 5,
    });
    
    logger.info(`Newsletter signup: ${email}`);
    
    res.json({ 
      success: true,
      message: 'Successfully subscribed to newsletter!' 
    });
  } catch (error) {
    logger.error('Error processing newsletter signup:', error);
    res.status(500).json({ error: 'Failed to subscribe to newsletter' });
  }
});

/**
 * POST /api/public/demo-request
 * Request product demo from marketing website
 * Rate limited: 2 requests per hour per IP
 */
router.post('/demo-request', demoLimiter, async (req, res) => {
  try {
    const { name, email, phone, company, employeeCount, message } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    
    // Store demo request
    const demo = await pool.query(
      `INSERT INTO demo_requests 
       (name, email, phone, company, employee_count, message, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, email, phone, company, employeeCount, message, req.ip]
    );
    
    // Notify sales team
    await queueService.addEmailJob({
      from: process.env.EMAIL_SALES,
      to: process.env.EMAIL_SALES,
      subject: `New Demo Request from ${company || name}`,
      html: emailTemplates.salesTemplates.quote({
        customerName: 'Sales Team',
        quoteName: 'Demo Request',
        items: [
          { name: 'Contact Name', description: name, price: '' },
          { name: 'Email', description: email, price: '' },
          { name: 'Phone', description: phone || 'Not provided', price: '' },
          { name: 'Company', description: company || 'Not provided', price: '' },
          { name: 'Employee Count', description: employeeCount || 'Not provided', price: '' },
          { name: 'Message', description: message || 'No message', price: '' },
        ],
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        contactEmail: process.env.EMAIL_SALES,
        contactPhone: process.env.SALES_PHONE || '+1-800-MIGRA',
      }),
      department: 'sales',
      template: 'demo_request',
      priority: 2, // High priority
    });
    
    // Send confirmation to requester with HTML template
    await queueService.addEmailJob({
      from: process.env.EMAIL_SALES,
      to: email,
      subject: 'Your MigraHosting Demo Request',
      htmlTemplate: 'demoRequestConfirmation',
      templateData: {
        name,
        email,
        company,
        phone,
        message,
        requestId: result.rows[0].id
      },
      department: 'sales',
      priority: 3,
    });
    
    res.json({ 
      success: true,
      message: 'Demo request submitted! We\'ll contact you within 24 hours.',
      requestId: demo.rows[0].id
    });
  } catch (error) {
    logger.error('Error processing demo request:', error);
    res.status(500).json({ error: 'Failed to submit demo request' });
  }
});

/**
 * GET /api/public/pricing
 * Get current pricing for marketing website
 */
router.get('/pricing', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM hosting_plans 
       WHERE active = true 
       ORDER BY price ASC`
    );
    
    res.json({ data: result.rows });
  } catch (error) {
    logger.error('Error getting pricing:', error);
    res.status(500).json({ error: 'Failed to get pricing' });
  }
});

/**
 * GET /api/public/features
 * Get feature list for marketing website
 */
router.get('/features', async (req, res) => {
  try {
    const features = {
      hosting: [
        'SSD Storage',
        'Free SSL Certificates',
        'Daily Backups',
        '99.9% Uptime SLA',
        'Unlimited Bandwidth',
        'Email Accounts',
        'One-Click Installs',
        'Website Builder',
      ],
      control_panel: [
        'Intuitive Dashboard',
        'Domain Management',
        'DNS Zone Editor',
        'File Manager',
        'Database Management',
        'Email Management',
        'SSL Management',
        'Analytics & Reports',
      ],
      support: [
        '24/7 Support',
        'Live Chat',
        'Email Support',
        'Phone Support',
        'Knowledge Base',
        'Video Tutorials',
        'Migration Assistance',
        'Priority Support (Premium)',
      ],
      security: [
        'DDoS Protection',
        'Firewall',
        'Malware Scanning',
        'Automatic Updates',
        'Two-Factor Auth',
        'IP Whitelisting',
        'Security Monitoring',
        'Incident Response',
      ],
    };
    
    res.json({ data: features });
  } catch (error) {
    logger.error('Error getting features:', error);
    res.status(500).json({ error: 'Failed to get features' });
  }
});

/**
 * POST /api/marketing/early-access
 * Sign up for early access program
 * Rate limited: 3 requests per day per IP
 */
router.post('/early-access', earlyAccessLimiter, async (req, res) => {
  try {
    const { email, name, useCase, company } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Generate access code
    const accessCode = crypto.randomBytes(8).toString('hex').toUpperCase();
    
    await pool.query(
      `INSERT INTO early_access_signups (email, name, use_case, company, access_code)
       VALUES ($1, $2, $3, $4, $5)`,
      [email, name, useCase, company, accessCode]
    );
    
    // Send email with access code using HTML template
    await queueService.addEmailJob({
      from: process.env.EMAIL_INFO,
      to: email,
      subject: 'Welcome to MigraHosting Early Access!',
      htmlTemplate: 'earlyAccessCode',
      templateData: {
        name: name || 'there',
        email,
        accessCode
      },
      department: 'info',
      priority: 2,
    });
    
    res.json({ 
      success: true,
      message: 'Check your email for your early access code!',
      accessCode: accessCode.substring(0, 4) + '****' // Partial code for confirmation
    });
  } catch (error) {
    logger.error('Error processing early access signup:', error);
    res.status(500).json({ error: 'Failed to sign up for early access' });
  }
});

/**
 * GET /api/public/status
 * System status for marketing website
 */
router.get('/status', async (req, res) => {
  try {
    // Check database
    await pool.query('SELECT 1');
    
    // Get uptime stats (simplified)
    const status = {
      status: 'operational',
      uptime: '99.98%',
      services: {
        web: 'operational',
        email: 'operational',
        dns: 'operational',
        database: 'operational',
      },
      lastIncident: null,
      updated: new Date().toISOString(),
    };
    
    res.json(status);
  } catch (error) {
    logger.error('Error getting status:', error);
    res.status(503).json({ 
      status: 'degraded',
      error: 'Service temporarily unavailable' 
    });
  }
});

/**
 * POST /api/public/unsubscribe
 * Unsubscribe from newsletter
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    await pool.query(
      'UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE email = $1',
      [email]
    );
    
    res.json({ 
      success: true,
      message: 'You have been unsubscribed from our newsletter.' 
    });
  } catch (error) {
    logger.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
