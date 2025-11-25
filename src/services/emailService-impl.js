// src/services/emailService.js
/**
 * Email Service - Transactional Email Integration
 * Supports SendGrid, Mailgun, or SMTP fallback
 * Usage: await emailService.sendInvoice(user, invoice);
 */

import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

class EmailService {
  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp'; // 'sendgrid', 'mailgun', 'smtp'
    this.from = process.env.EMAIL_FROM || 'noreply@migrahosting.com';
    this.fromName = process.env.EMAIL_FROM_NAME || 'MigraHosting';
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email provider
   */
  async initialize() {
    if (this.initialized) return;

    try {
      switch (this.provider) {
        case 'sendgrid':
          await this.initSendGrid();
          break;
        case 'mailgun':
          await this.initMailgun();
          break;
        case 'smtp':
        default:
          await this.initSMTP();
          break;
      }
      this.initialized = true;
      logger.info(`Email service initialized with provider: ${this.provider}`);
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      // Fallback to console logging in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Email service not configured - emails will be logged to console');
        this.initialized = true;
      }
    }
  }

  /**
   * Initialize SendGrid
   */
  async initSendGrid() {
    const sgMail = require('@sendgrid/mail');
    const apiKey = process.env.SENDGRID_API_KEY;
    
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }
    
    sgMail.setApiKey(apiKey);
    this.transporter = sgMail;
  }

  /**
   * Initialize Mailgun
   */
  async initMailgun() {
    const formData = require('form-data');
    const Mailgun = require('mailgun.js');
    
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    
    if (!apiKey || !domain) {
      throw new Error('MAILGUN_API_KEY or MAILGUN_DOMAIN not configured');
    }
    
    const mailgun = new Mailgun(formData);
    this.transporter = mailgun.client({ username: 'api', key: apiKey });
    this.mailgunDomain = domain;
  }

  /**
   * Initialize SMTP (nodemailer)
   */
  async initSMTP() {
    const config = {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      config.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      };
    }

    this.transporter = nodemailer.createTransport(config);
    
    // Verify connection
    if (config.host !== 'localhost') {
      await this.transporter.verify();
    }
  }

  /**
   * Send email (provider-agnostic)
   */
  async send({ to, subject, text, html, attachments = [] }) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Development fallback - log to console
    if (!this.transporter && process.env.NODE_ENV === 'development') {
      logger.info('📧 EMAIL (console only):', { to, subject, text: text?.substring(0, 100) });
      return { success: true, messageId: 'dev-' + Date.now() };
    }

    try {
      let result;

      switch (this.provider) {
        case 'sendgrid':
          result = await this.sendViaSendGrid({ to, subject, text, html, attachments });
          break;
        case 'mailgun':
          result = await this.sendViaMailgun({ to, subject, text, html, attachments });
          break;
        case 'smtp':
        default:
          result = await this.sendViaSMTP({ to, subject, text, html, attachments });
          break;
      }

      logger.info(`Email sent to ${to}: ${subject}`);
      return result;
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send transactional email with optional HTML template
   * Used by queueService for background email jobs
   */
  async sendTransactional({ to, subject, template, data, htmlContent }) {
    // If htmlContent pre-rendered, use it
    if (htmlContent) {
      return this.send({
        to,
        subject,
        text: subject, // Fallback text
        html: htmlContent
      });
    }

    // Otherwise use old template system (if exists)
    // This maintains backward compatibility
    return this.send({
      to,
      subject,
      text: JSON.stringify(data), // Basic fallback
      html: `<p>${subject}</p><pre>${JSON.stringify(data, null, 2)}</pre>`
    });
  }

  /**
   * Send via SendGrid
   */
  async sendViaSendGrid({ to, subject, text, html, attachments }) {
    const msg = {
      to,
      from: { email: this.from, name: this.fromName },
      subject,
      text,
      html,
    };

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments.map(att => ({
        content: att.content.toString('base64'),
        filename: att.filename,
        type: att.contentType || 'application/octet-stream',
        disposition: 'attachment',
      }));
    }

    const result = await this.transporter.send(msg);
    return { success: true, messageId: result[0]?.headers?.['x-message-id'] };
  }

  /**
   * Send via Mailgun
   */
  async sendViaMailgun({ to, subject, text, html, attachments }) {
    const data = {
      from: `${this.fromName} <${this.from}>`,
      to,
      subject,
      text,
      html,
    };

    if (attachments && attachments.length > 0) {
      data.attachment = attachments.map(att => ({
        data: att.content,
        filename: att.filename,
      }));
    }

    const result = await this.transporter.messages.create(this.mailgunDomain, data);
    return { success: true, messageId: result.id };
  }

  /**
   * Send via SMTP (nodemailer)
   */
  async sendViaSMTP({ to, subject, text, html, attachments }) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.from}>`,
      to,
      subject,
      text,
      html,
      attachments,
    };

    const result = await this.transporter.sendMail(mailOptions);
    return { success: true, messageId: result.messageId };
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to MigraHosting!';
    const text = `Hi ${user.first_name || 'there'},\n\nWelcome to MigraHosting! Your account has been created successfully.\n\nYou can now log in to your control panel at: ${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}\n\nIf you have any questions, feel free to contact our support team.\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MigraHosting!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>Welcome to MigraHosting! Your account has been created successfully.</p>
            <p>You can now log in to your control panel and start managing your hosting services.</p>
            <a href="${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}" class="button">Go to Control Panel</a>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}/reset-password?token=${resetToken}`;
    const subject = 'Password Reset Request';
    const text = `Hi ${user.first_name || 'there'},\n\nYou requested a password reset for your MigraHosting account.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .warning { background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>You requested a password reset for your MigraHosting account.</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <div class="warning">
              <strong>⏰ This link will expire in 1 hour.</strong>
            </div>
            <p>If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send invoice email with PDF attachment
   */
  async sendInvoiceEmail(user, invoice, pdfBuffer) {
    const subject = `Invoice #${invoice.invoice_number} - MigraHosting`;
    const text = `Hi ${user.first_name || 'there'},\n\nYour invoice #${invoice.invoice_number} is ready.\n\nAmount: $${invoice.total}\nDue Date: ${new Date(invoice.due_date).toLocaleDateString()}\nStatus: ${invoice.status}\n\nPlease find the invoice attached.\n\nYou can view and pay your invoice online at: ${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}/billing/invoices/${invoice.id}\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .invoice-details { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice #${invoice.invoice_number}</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>Your invoice is ready and attached to this email.</p>
            
            <div class="invoice-details">
              <div class="detail-row">
                <span><strong>Invoice Number:</strong></span>
                <span>#${invoice.invoice_number}</span>
              </div>
              <div class="detail-row">
                <span><strong>Amount:</strong></span>
                <span>$${invoice.total}</span>
              </div>
              <div class="detail-row">
                <span><strong>Due Date:</strong></span>
                <span>${new Date(invoice.due_date).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <span><strong>Status:</strong></span>
                <span>${invoice.status}</span>
              </div>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}/billing/invoices/${invoice.id}" class="button">View & Pay Invoice</a>
            
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments = [];
    if (pdfBuffer) {
      attachments.push({
        filename: `invoice-${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
    }

    return this.send({
      to: user.email,
      subject,
      text,
      html,
      attachments,
    });
  }

  /**
   * Send payment receipt email
   */
  async sendPaymentReceiptEmail(user, payment, invoice) {
    const subject = `Payment Receipt - Invoice #${invoice.invoice_number}`;
    const text = `Hi ${user.first_name || 'there'},\n\nThank you for your payment!\n\nPayment Details:\nAmount: $${payment.amount}\nInvoice: #${invoice.invoice_number}\nPayment Method: ${payment.payment_method}\nDate: ${new Date(payment.created_at).toLocaleDateString()}\n\nYour invoice has been marked as paid.\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .receipt-details { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
          .success-badge { background: #d1fae5; color: #065f46; padding: 4px 12px; border-radius: 12px; font-size: 14px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Payment Received</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>Thank you for your payment! We've received your payment successfully.</p>
            
            <div class="receipt-details">
              <div class="detail-row">
                <span><strong>Amount Paid:</strong></span>
                <span>$${payment.amount}</span>
              </div>
              <div class="detail-row">
                <span><strong>Invoice:</strong></span>
                <span>#${invoice.invoice_number}</span>
              </div>
              <div class="detail-row">
                <span><strong>Payment Method:</strong></span>
                <span>${payment.payment_method}</span>
              </div>
              <div class="detail-row">
                <span><strong>Date:</strong></span>
                <span>${new Date(payment.created_at).toLocaleDateString()}</span>
              </div>
              <div class="detail-row">
                <span><strong>Status:</strong></span>
                <span class="success-badge">Paid</span>
              </div>
            </div>
            
            <p>Your invoice has been marked as paid and your services will remain active.</p>
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send order confirmation email
   */
  async sendOrderConfirmationEmail(user, order, services) {
    const subject = `Order Confirmation #${order.id} - MigraHosting`;
    const servicesList = services.map(s => `- ${s.name} (${s.type})`).join('\n');
    const text = `Hi ${user.first_name || 'there'},\n\nThank you for your order!\n\nOrder #${order.id}\nTotal: $${order.total_amount}\nPayment Method: ${order.payment_method}\n\nServices:\n${servicesList}\n\nYour services are being provisioned and will be ready shortly.\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .order-details { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .service-item { padding: 12px; background: #f9fafb; margin: 8px 0; border-radius: 4px; }
          .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>Thank you for your order! Your payment has been processed successfully.</p>
            
            <div class="order-details">
              <h3>Order #${order.id}</h3>
              <p><strong>Total:</strong> $${order.total_amount}</p>
              <p><strong>Payment Method:</strong> ${order.payment_method}</p>
              
              <h4>Services:</h4>
              ${services.map(s => `<div class="service-item">${s.name} (${s.type})</div>`).join('')}
            </div>
            
            <p>Your services are being provisioned and will be ready shortly. You'll receive another email once everything is set up.</p>
            
            <a href="${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}/services" class="button">View Services</a>
            
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * Send service provisioned email
   */
  async sendServiceProvisionedEmail(user, service) {
    const subject = `Your ${service.type} Service is Ready!`;
    const text = `Hi ${user.first_name || 'there'},\n\nYour ${service.type} service "${service.name}" has been provisioned and is ready to use!\n\nService Details:\nType: ${service.type}\nName: ${service.name}\nStatus: ${service.status}\n\nYou can manage this service in your control panel.\n\nBest regards,\nThe MigraHosting Team`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .service-card { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Service Ready!</h1>
          </div>
          <div class="content">
            <p>Hi ${user.first_name || 'there'},</p>
            <p>Great news! Your ${service.type} service has been provisioned and is ready to use.</p>
            
            <div class="service-card">
              <h3>${service.name}</h3>
              <p><strong>Type:</strong> ${service.type}</p>
              <p><strong>Status:</strong> ${service.status}</p>
            </div>
            
            <a href="${process.env.FRONTEND_URL || 'https://panel.migrahosting.com'}/services" class="button">Manage Service</a>
            
            <p>You can now start using your service through the control panel.</p>
            <p>Best regards,<br>The MigraHosting Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }
}

// Export singleton instance
const emailService = new EmailService();
export default emailService;
