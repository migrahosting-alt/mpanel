/**
 * Email Service for mPanel
 * Handles all email sending with department-specific templates
 * @module emailService
 */

import nodemailer from 'nodemailer';
import logger from '../config/logger.js';
import {
  departments,
  salesTemplates,
  billingTemplates,
  supportTemplates,
  infoTemplates,
  studentTemplates,
  adminTemplates,
  alertTemplates,
  nocTemplates,
  abuseTemplates,
  legalTemplates,
  partnershipsTemplates,
  careersTemplates
} from './emailTemplates.js';

// Create reusable transporter
let transporter = null;

/**
 * Initialize email transporter with SMTP configuration
 */
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'apikey',
        pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
      },
      // Connection pool
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      // Timeouts
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 30000
    });

    // Verify connection
    transporter.verify((error, success) => {
      if (error) {
        logger.error('SMTP connection failed:', error);
      } else {
        logger.info('SMTP server is ready to send emails');
      }
    });
  }

  return transporter;
}

/**
 * Generic send email function
 * @param {string} from - Sender email address
 * @param {string|string[]} to - Recipient email address(es)
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {Object} options - Additional options (cc, bcc, attachments, etc.)
 */
async function sendEmail(from, to, subject, html, options = {}) {
  try {
    const transporter = getTransporter();
    
    const mailOptions = {
      from: from || process.env.SMTP_FROM || 'noreply@migrahosting.com',
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
      ...options // cc, bcc, attachments, replyTo, etc.
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('Email sent successfully:', {
      messageId: info.messageId,
      to: mailOptions.to,
      subject: mailOptions.subject
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
}

/**
 * SALES EMAIL FUNCTIONS
 */
export const salesEmails = {
  /**
   * Send welcome email to new prospect
   */
  async sendWelcome(to, data) {
    const html = salesTemplates.welcome(data);
    return sendEmail(
      departments.sales.email,
      to,
      'Welcome to MigraHosting',
      html,
      {
        replyTo: departments.sales.email,
        headers: {
          'X-Department': 'Sales',
          'X-Campaign': data.campaign || 'welcome'
        }
      }
    );
  },

  /**
   * Send custom quote
   */
  async sendQuote(to, data) {
    const html = salesTemplates.quote(data);
    return sendEmail(
      departments.sales.email,
      to,
      `Custom Quote #${data.quoteId} from MigraHosting`,
      html,
      {
        replyTo: data.accountManagerEmail || departments.sales.email,
        cc: data.accountManagerEmail,
        headers: {
          'X-Department': 'Sales',
          'X-Quote-ID': data.quoteId
        }
      }
    );
  },

  /**
   * Send follow-up email
   */
  async sendFollowUp(to, data) {
    const html = salesTemplates.followUp(data);
    return sendEmail(
      departments.sales.email,
      to,
      'Following Up - MigraHosting',
      html,
      {
        replyTo: data.repEmail || departments.sales.email,
        headers: {
          'X-Department': 'Sales',
          'X-Rep-ID': data.repId
        }
      }
    );
  }
};

/**
 * BILLING EMAIL FUNCTIONS
 */
export const billingEmails = {
  /**
   * Send invoice
   */
  async sendInvoice(to, data) {
    const html = billingTemplates.invoice(data);
    return sendEmail(
      departments.billing.email,
      to,
      `Invoice #${data.invoiceNumber} from MigraHosting`,
      html,
      {
        replyTo: departments.billing.email,
        headers: {
          'X-Department': 'Billing',
          'X-Invoice-Number': data.invoiceNumber,
          'X-Invoice-Total': data.total.toString()
        },
        attachments: data.pdfAttachment ? [{
          filename: `invoice-${data.invoiceNumber}.pdf`,
          path: data.pdfAttachment
        }] : []
      }
    );
  },

  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(to, data) {
    const html = billingTemplates.paymentConfirmation(data);
    return sendEmail(
      departments.billing.email,
      to,
      'Payment Received - Thank You!',
      html,
      {
        replyTo: departments.billing.email,
        headers: {
          'X-Department': 'Billing',
          'X-Transaction-ID': data.transactionId,
          'X-Invoice-Number': data.invoiceNumber
        }
      }
    );
  },

  /**
   * Send payment failed notification
   */
  async sendPaymentFailed(to, data) {
    const html = billingTemplates.paymentFailed(data);
    return sendEmail(
      departments.billing.email,
      to,
      'Payment Failed - Action Required',
      html,
      {
        replyTo: departments.billing.email,
        priority: 'high',
        headers: {
          'X-Department': 'Billing',
          'X-Invoice-Number': data.invoiceNumber,
          'X-Priority': 'High'
        }
      }
    );
  },

  /**
   * Send upcoming renewal reminder
   */
  async sendRenewalReminder(to, data) {
    const html = billingTemplates.upcomingRenewal(data);
    return sendEmail(
      departments.billing.email,
      to,
      'Upcoming Renewal Reminder',
      html,
      {
        replyTo: departments.billing.email,
        headers: {
          'X-Department': 'Billing',
          'X-Renewal-Date': data.renewalDate
        }
      }
    );
  }
};

/**
 * SUPPORT EMAIL FUNCTIONS
 */
export const supportEmails = {
  /**
   * Send ticket received confirmation
   */
  async sendTicketReceived(to, data) {
    const html = supportTemplates.ticketReceived(data);
    return sendEmail(
      departments.support.email,
      to,
      `Support Ticket #${data.ticketId} Created`,
      html,
      {
        replyTo: departments.support.email,
        headers: {
          'X-Department': 'Support',
          'X-Ticket-ID': data.ticketId,
          'X-Priority': data.priority
        }
      }
    );
  },

  /**
   * Send ticket response
   */
  async sendTicketResponse(to, data) {
    const html = supportTemplates.ticketResponse(data);
    return sendEmail(
      departments.support.email,
      to,
      `Ticket #${data.ticketId} Updated`,
      html,
      {
        replyTo: departments.support.email,
        inReplyTo: data.originalMessageId,
        headers: {
          'X-Department': 'Support',
          'X-Ticket-ID': data.ticketId,
          'X-Agent': data.agentName
        },
        attachments: data.attachments || []
      }
    );
  },

  /**
   * Send ticket resolved notification
   */
  async sendTicketResolved(to, data) {
    const html = supportTemplates.ticketResolved(data);
    return sendEmail(
      departments.support.email,
      to,
      `Ticket #${data.ticketId} Resolved`,
      html,
      {
        replyTo: departments.support.email,
        headers: {
          'X-Department': 'Support',
          'X-Ticket-ID': data.ticketId,
          'X-Resolved-By': data.resolvedBy
        }
      }
    );
  }
};

/**
 * INFO EMAIL FUNCTIONS
 */
export const infoEmails = {
  /**
   * Send general inquiry confirmation
   */
  async sendGeneralInquiry(to, data) {
    const html = infoTemplates.generalInquiry(data);
    return sendEmail(
      departments.info.email,
      to,
      'Thank You for Contacting MigraHosting',
      html,
      {
        replyTo: departments.info.email,
        headers: {
          'X-Department': 'Info',
          'X-Inquiry-ID': data.inquiryId
        }
      }
    );
  },

  /**
   * Send newsletter
   */
  async sendNewsletter(to, data) {
    const html = infoTemplates.newsletter(data);
    return sendEmail(
      departments.info.email,
      to,
      data.title,
      html,
      {
        replyTo: departments.info.email,
        headers: {
          'X-Department': 'Info',
          'X-Newsletter': 'true',
          'List-Unsubscribe': `<https://migrahosting.com/unsubscribe/${data.unsubscribeToken}>`
        }
      }
    );
  }
};

/**
 * STUDENT EMAIL FUNCTIONS
 */
export const studentEmails = {
  /**
   * Send student program welcome
   */
  async sendWelcome(to, data) {
    const html = studentTemplates.welcome(data);
    return sendEmail(
      departments.student.email,
      to,
      'Welcome to MigraHosting Student Program',
      html,
      {
        replyTo: departments.student.email,
        headers: {
          'X-Department': 'Student',
          'X-Program': 'Student',
          'X-Activation-Code': data.activationCode
        }
      }
    );
  },

  /**
   * Send student renewal reminder
   */
  async sendRenewal(to, data) {
    const html = studentTemplates.renewal(data);
    return sendEmail(
      departments.student.email,
      to,
      'Student Program Renewal Required',
      html,
      {
        replyTo: departments.student.email,
        headers: {
          'X-Department': 'Student',
          'X-Expiration': data.expirationDate
        }
      }
    );
  }
};

/**
 * ADMIN EMAIL FUNCTIONS
 */
export const adminEmails = {
  /**
   * Send user created notification
   */
  async sendUserCreated(to, data) {
    const html = adminTemplates.userCreated(data);
    return sendEmail(
      departments.admin.email,
      to,
      'New User Account Created',
      html,
      {
        replyTo: departments.admin.email,
        headers: {
          'X-Department': 'Admin',
          'X-User-ID': data.userId,
          'X-Event': 'user.created'
        }
      }
    );
  },

  /**
   * Send system report
   */
  async sendSystemReport(to, data) {
    const html = adminTemplates.systemReport(data);
    return sendEmail(
      departments.admin.email,
      to,
      `${data.reportType} Report`,
      html,
      {
        replyTo: departments.admin.email,
        headers: {
          'X-Department': 'Admin',
          'X-Report-Type': data.reportType,
          'X-Report-ID': data.reportId
        },
        attachments: data.csvAttachment ? [{
          filename: `${data.reportType}-${data.reportId}.csv`,
          path: data.csvAttachment
        }] : []
      }
    );
  }
};

/**
 * ALERTS EMAIL FUNCTIONS
 */
export const alertEmails = {
  /**
   * Send security alert
   */
  async sendSecurityAlert(to, data) {
    const html = alertTemplates.securityAlert(data);
    return sendEmail(
      departments.alerts.email,
      to,
      `[${data.severity.toUpperCase()}] Security Alert: ${data.alertType}`,
      html,
      {
        replyTo: 'security@migrahosting.com',
        priority: 'high',
        headers: {
          'X-Department': 'Alerts',
          'X-Alert-Type': 'security',
          'X-Severity': data.severity,
          'X-Alert-ID': data.alertId
        }
      }
    );
  },

  /**
   * Send system downtime notification
   */
  async sendSystemDowntime(to, data) {
    const html = alertTemplates.systemDowntime(data);
    return sendEmail(
      departments.alerts.email,
      to,
      data.title,
      html,
      {
        replyTo: departments.alerts.email,
        priority: data.isScheduled ? 'normal' : 'high',
        headers: {
          'X-Department': 'Alerts',
          'X-Alert-Type': 'downtime',
          'X-Incident-ID': data.incidentId,
          'X-Scheduled': data.isScheduled.toString()
        }
      }
    );
  },

  /**
   * Send usage alert
   */
  async sendUsageAlert(to, data) {
    const html = alertTemplates.usageAlert(data);
    return sendEmail(
      departments.alerts.email,
      to,
      `Resource Usage Alert - ${data.percentage}% Used`,
      html,
      {
        replyTo: departments.alerts.email,
        priority: data.severity === 'critical' ? 'high' : 'normal',
        headers: {
          'X-Department': 'Alerts',
          'X-Alert-Type': 'usage',
          'X-Resource': data.resourceType,
          'X-Percentage': data.percentage.toString()
        }
      }
    );
  },

  /**
   * Send backup status notification
   */
  async sendBackupStatus(to, data) {
    const html = alertTemplates.backupStatus(data);
    return sendEmail(
      departments.alerts.email,
      to,
      `Backup ${data.success ? 'Completed' : 'Failed'} - ${data.backupId}`,
      html,
      {
        replyTo: departments.alerts.email,
        priority: data.success ? 'normal' : 'high',
        headers: {
          'X-Department': 'Alerts',
          'X-Alert-Type': 'backup',
          'X-Backup-ID': data.backupId,
          'X-Success': data.success.toString()
        }
      }
    );
  }
};

/**
 * NOC EMAIL FUNCTIONS
 */
export const nocEmails = {
  async sendServerAlert(to, data) {
    const html = nocTemplates.serverAlert(data);
    return sendEmail(
      departments.noc.email,
      to,
      `[${data.severity.toUpperCase()}] Server Alert: ${data.alertType}`,
      html,
      {
        replyTo: departments.noc.email,
        priority: data.severity === 'critical' ? 'high' : 'normal',
        headers: {
          'X-Department': 'NOC',
          'X-Server-ID': data.serverId,
          'X-Severity': data.severity
        }
      }
    );
  },

  async sendMaintenanceScheduled(to, data) {
    const html = nocTemplates.maintenanceScheduled(data);
    return sendEmail(
      departments.noc.email,
      to,
      'Scheduled Maintenance Notification',
      html,
      {
        replyTo: departments.noc.email,
        headers: {
          'X-Department': 'NOC',
          'X-Maintenance-ID': data.maintenanceId,
          'X-Maintenance-Date': data.maintenanceDate
        }
      }
    );
  }
};

/**
 * ABUSE EMAIL FUNCTIONS
 */
export const abuseEmails = {
  async sendReportReceived(to, data) {
    const html = abuseTemplates.reportReceived(data);
    return sendEmail(
      departments.abuse.email,
      to,
      `Abuse Report #${data.reportId} Received`,
      html,
      {
        replyTo: departments.abuse.email,
        headers: {
          'X-Department': 'Abuse',
          'X-Report-ID': data.reportId,
          'X-Report-Type': data.reportType
        }
      }
    );
  },

  async sendViolationNotice(to, data) {
    const html = abuseTemplates.violationNotice(data);
    return sendEmail(
      departments.abuse.email,
      to,
      'Terms of Service Violation Notice',
      html,
      {
        replyTo: departments.abuse.email,
        priority: 'high',
        headers: {
          'X-Department': 'Abuse',
          'X-Case-ID': data.caseId,
          'X-Violation-Type': data.violationType,
          'X-Severity': data.severity
        }
      }
    );
  }
};

/**
 * LEGAL EMAIL FUNCTIONS
 */
export const legalEmails = {
  async sendGdprRequest(to, data) {
    const html = legalTemplates.gdprRequest(data);
    return sendEmail(
      departments.legal.email,
      to,
      `GDPR ${data.requestType} Request Confirmation`,
      html,
      {
        replyTo: 'dpo@migrahosting.com',
        headers: {
          'X-Department': 'Legal',
          'X-Request-ID': data.requestId,
          'X-Request-Type': data.requestType,
          'X-GDPR-Article': data.article
        }
      }
    );
  },

  async sendSubpoena(to, data) {
    const html = legalTemplates.subpoena(data);
    return sendEmail(
      departments.legal.email,
      to,
      'Legal Document Received',
      html,
      {
        replyTo: departments.legal.email,
        headers: {
          'X-Department': 'Legal',
          'X-Case-Number': data.caseNumber,
          'X-Document-Type': data.documentType
        }
      }
    );
  }
};

/**
 * PARTNERSHIPS EMAIL FUNCTIONS
 */
export const partnershipsEmails = {
  async sendInquiryReceived(to, data) {
    const html = partnershipsTemplates.inquiryReceived(data);
    return sendEmail(
      departments.partnerships.email,
      to,
      'Partnership Inquiry Received',
      html,
      {
        replyTo: departments.partnerships.email,
        headers: {
          'X-Department': 'Partnerships',
          'X-Inquiry-ID': data.inquiryId,
          'X-Partnership-Type': data.partnershipType
        }
      }
    );
  },

  async sendApplicationApproved(to, data) {
    const html = partnershipsTemplates.applicationApproved(data);
    return sendEmail(
      departments.partnerships.email,
      to,
      'Partnership Application Approved',
      html,
      {
        replyTo: departments.partnerships.email,
        headers: {
          'X-Department': 'Partnerships',
          'X-Partner-ID': data.partnerId,
          'X-Program-Type': data.programType
        }
      }
    );
  }
};

/**
 * CAREERS EMAIL FUNCTIONS
 */
export const careersEmails = {
  async sendApplicationReceived(to, data) {
    const html = careersTemplates.applicationReceived(data);
    return sendEmail(
      departments.careers.email,
      to,
      `Application Received - ${data.position}`,
      html,
      {
        replyTo: departments.careers.email,
        headers: {
          'X-Department': 'Careers',
          'X-Application-ID': data.applicationId,
          'X-Position': data.position
        }
      }
    );
  },

  async sendInterviewScheduled(to, data) {
    const html = careersTemplates.interviewScheduled(data);
    return sendEmail(
      departments.careers.email,
      to,
      'Interview Scheduled',
      html,
      {
        replyTo: departments.careers.email,
        headers: {
          'X-Department': 'Careers',
          'X-Position': data.position,
          'X-Interview-Date': data.interviewDate
        }
      }
    );
  }
};

/**
 * Send email from any department (generic)
 */
export async function sendDepartmentEmail(department, to, subject, templateName, data, options = {}) {
  if (!departments[department]) {
    throw new Error(`Invalid department: ${department}`);
  }

  const templateMap = {
    sales: salesTemplates,
    billing: billingTemplates,
    support: supportTemplates,
    info: infoTemplates,
    student: studentTemplates,
    admin: adminTemplates,
    alerts: alertTemplates,
    noc: nocTemplates,
    abuse: abuseTemplates,
    legal: legalTemplates,
    partnerships: partnershipsTemplates,
    careers: careersTemplates
  };

  const templates = templateMap[department];
  if (!templates || !templates[templateName]) {
    throw new Error(`Template ${templateName} not found for department ${department}`);
  }

  const html = templates[templateName](data);
  
  return sendEmail(
    departments[department].email,
    to,
    subject,
    html,
    {
      replyTo: departments[department].email,
      headers: {
        'X-Department': departments[department].name,
        ...options.headers
      },
      ...options
    }
  );
}

/**
 * Test email connection
 */
export async function testEmailConnection() {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    logger.info('Email connection test successful');
    return { success: true, message: 'SMTP connection verified' };
  } catch (error) {
    logger.error('Email connection test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get email statistics (if using a service that provides them)
 */
export async function getEmailStats() {
  // Placeholder for email statistics
  // Can be implemented with SendGrid API, AWS SES API, etc.
  return {
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0
  };
}

export default {
  sendEmail,
  salesEmails,
  billingEmails,
  supportEmails,
  infoEmails,
  studentEmails,
  adminEmails,
  alertEmails,
  nocEmails,
  abuseEmails,
  legalEmails,
  partnershipsEmails,
  careersEmails,
  sendDepartmentEmail,
  testEmailConnection,
  getEmailStats,
  departments
};
