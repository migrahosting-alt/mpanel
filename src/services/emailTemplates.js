/**
 * Email Templates System for mPanel
 * Professional branded templates for all departments
 * @module emailTemplates
 */

// Department configurations with branding
export const departments = {
  sales: {
    email: 'sales@migrahosting.com',
    name: 'Sales Team',
    color: '#10B981', // Green
    tagline: 'Grow Your Business with MigraHosting',
    phone: '+1 (555) 123-4567',
    description: 'Expert hosting solutions tailored for your success'
  },
  billing: {
    email: 'billing@migrahosting.com',
    name: 'Billing Department',
    color: '#3B82F6', // Blue
    tagline: 'Simple, Transparent Pricing',
    phone: '+1 (555) 123-4568',
    description: 'Your trusted partner for hosting payments'
  },
  support: {
    email: 'support@migrahosting.com',
    name: 'Technical Support',
    color: '#8B5CF6', // Purple
    tagline: '24/7 Expert Support',
    phone: '+1 (555) 123-4569',
    description: 'We\'re here to help you succeed'
  },
  info: {
    email: 'info@migrahosting.com',
    name: 'Information Team',
    color: '#06B6D4', // Cyan
    tagline: 'Your Questions Answered',
    phone: '+1 (555) 123-4570',
    description: 'General inquiries and information'
  },
  student: {
    email: 'student@migrahosting.com',
    name: 'Student Program',
    color: '#F59E0B', // Amber
    tagline: 'Learn, Build, Deploy',
    phone: '+1 (555) 123-4571',
    description: 'Special pricing and resources for students'
  },
  admin: {
    email: 'admin@migrahosting.com',
    name: 'Administration',
    color: '#EF4444', // Red
    tagline: 'System Notifications',
    phone: '+1 (555) 123-4572',
    description: 'Internal administrative communications'
  },
  alerts: {
    email: 'alerts@migrahosting.com',
    name: 'System Alerts',
    color: '#DC2626', // Dark Red
    tagline: 'Important Updates & Alerts',
    phone: '+1 (555) 123-4573',
    description: 'Critical system and security notifications'
  },
  noc: {
    email: 'noc@migrahosting.com',
    name: 'Network Operations Center',
    color: '#0EA5E9', // Sky Blue
    tagline: 'Infrastructure & Uptime Monitoring',
    phone: '+1 (555) 123-4574',
    description: '24/7 network monitoring and operations'
  },
  abuse: {
    email: 'abuse@migrahosting.com',
    name: 'Abuse Prevention',
    color: '#B91C1C', // Crimson
    tagline: 'Report Abuse & Violations',
    phone: '+1 (555) 123-4575',
    description: 'Spam, copyright, and TOS violation reports'
  },
  legal: {
    email: 'legal@migrahosting.com',
    name: 'Legal Department',
    color: '#1F2937', // Dark Gray
    tagline: 'Legal Matters & Compliance',
    phone: '+1 (555) 123-4576',
    description: 'Legal notices, privacy requests, and compliance'
  },
  partnerships: {
    email: 'partnerships@migrahosting.com',
    name: 'Partnerships & Business Development',
    color: '#7C3AED', // Violet
    tagline: 'Grow Together',
    phone: '+1 (555) 123-4577',
    description: 'Reseller, affiliate, and partnership opportunities'
  },
  careers: {
    email: 'careers@migrahosting.com',
    name: 'Careers & Talent',
    color: '#059669', // Emerald
    tagline: 'Join Our Team',
    phone: '+1 (555) 123-4578',
    description: 'Job opportunities and recruitment'
  }
};

/**
 * Base HTML email template with responsive design
 */
function getBaseTemplate(department, subject, content, additionalLinks = []) {
  const dept = departments[department];
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #f3f4f6;
      color: #1f2937;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    
    .header {
      background: linear-gradient(135deg, ${dept.color} 0%, ${dept.color}dd 100%);
      padding: 40px 30px;
      text-align: center;
    }
    
    .logo {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      display: inline-block;
      margin-bottom: 10px;
    }
    
    .tagline {
      color: #ffffff;
      font-size: 14px;
      opacity: 0.95;
    }
    
    .content {
      padding: 40px 30px;
    }
    
    .content h1 {
      color: #111827;
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 20px 0;
    }
    
    .content h2 {
      color: #374151;
      font-size: 18px;
      font-weight: 600;
      margin: 30px 0 15px 0;
    }
    
    .content p {
      color: #4b5563;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    
    .button {
      display: inline-block;
      background-color: ${dept.color};
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      transition: background-color 0.3s;
    }
    
    .button:hover {
      background-color: ${dept.color}dd;
    }
    
    .info-box {
      background-color: #f9fafb;
      border-left: 4px solid ${dept.color};
      padding: 20px;
      margin: 25px 0;
      border-radius: 4px;
    }
    
    .info-box h3 {
      margin: 0 0 10px 0;
      color: #111827;
      font-size: 16px;
      font-weight: 600;
    }
    
    .info-box p {
      margin: 0;
      font-size: 14px;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    
    .table th {
      background-color: #f9fafb;
      color: #374151;
      font-weight: 600;
      padding: 12px;
      text-align: left;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .table td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
      color: #4b5563;
    }
    
    .footer {
      background-color: #f9fafb;
      padding: 40px 30px;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-content {
      margin-bottom: 25px;
    }
    
    .contact-info {
      color: #6b7280;
      font-size: 14px;
      line-height: 1.8;
    }
    
    .contact-info strong {
      color: #374151;
      display: inline-block;
      width: 80px;
    }
    
    .quick-links {
      margin: 25px 0;
    }
    
    .quick-links a {
      color: ${dept.color};
      text-decoration: none;
      margin-right: 20px;
      font-size: 14px;
      font-weight: 500;
    }
    
    .quick-links a:hover {
      text-decoration: underline;
    }
    
    .social-links {
      margin: 25px 0;
    }
    
    .social-links a {
      display: inline-block;
      margin-right: 15px;
      color: #6b7280;
      text-decoration: none;
      font-size: 14px;
    }
    
    .footer-note {
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.6;
      margin-top: 25px;
      padding-top: 25px;
      border-top: 1px solid #e5e7eb;
    }
    
    .badge {
      display: inline-block;
      background-color: ${dept.color}22;
      color: ${dept.color};
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
    }
    
    @media only screen and (max-width: 600px) {
      .header {
        padding: 30px 20px;
      }
      .content {
        padding: 30px 20px;
      }
      .footer {
        padding: 30px 20px;
      }
      .quick-links a {
        display: block;
        margin: 10px 0;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="header">
      <a href="https://migrahosting.com" class="logo">MigraHosting</a>
      <div class="tagline">${dept.tagline}</div>
    </div>
    
    <!-- Content -->
    <div class="content">
      ${content}
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-content">
        <h3 style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">
          ${dept.name}
        </h3>
        <div class="contact-info">
          <div><strong>Email:</strong> <a href="mailto:${dept.email}" style="color: ${dept.color}; text-decoration: none;">${dept.email}</a></div>
          <div><strong>Phone:</strong> ${dept.phone}</div>
          <div><strong>Hours:</strong> ${department === 'support' || department === 'alerts' ? '24/7 Available' : 'Mon-Fri, 9AM-6PM EST'}</div>
          <div><strong>Website:</strong> <a href="https://migrahosting.com" style="color: ${dept.color}; text-decoration: none;">migrahosting.com</a></div>
        </div>
      </div>
      
      <div class="quick-links">
        <a href="https://migrahosting.com/login">Customer Portal</a>
        <a href="https://migrahosting.com/docs">Documentation</a>
        <a href="https://status.migrahosting.com">System Status</a>
        <a href="https://migrahosting.com/support">Get Help</a>
        ${additionalLinks.map(link => `<a href="${link.url}">${link.text}</a>`).join('')}
      </div>
      
      <div class="social-links">
        <a href="https://twitter.com/migrahosting">Twitter</a>
        <a href="https://linkedin.com/company/migrahosting">LinkedIn</a>
        <a href="https://github.com/migrahosting">GitHub</a>
        <a href="https://discord.gg/migrahosting">Discord</a>
      </div>
      
      <div class="footer-note">
        <p>This email was sent by MigraHosting (${dept.name}). If you have questions, please contact us at ${dept.email}.</p>
        <p>MigraHosting, Inc. | 123 Cloud Street, Tech City, TC 12345 | <a href="https://migrahosting.com/privacy" style="color: #6b7280;">Privacy Policy</a> | <a href="https://migrahosting.com/terms" style="color: #6b7280;">Terms of Service</a></p>
        <p>&copy; ${new Date().getFullYear()} MigraHosting. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * SALES TEMPLATES
 */
export const salesTemplates = {
  welcome: (data) => {
    const content = `
      <h1>Welcome to MigraHosting! 🚀</h1>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>Thank you for your interest in MigraHosting! We're excited to help you find the perfect hosting solution for your business.</p>
      
      <div class="info-box">
        <h3>Why Choose MigraHosting?</h3>
        <p>✓ 99.99% Uptime SLA<br>
        ✓ 24/7 Expert Support<br>
        ✓ Free SSL Certificates<br>
        ✓ Daily Backups<br>
        ✓ CDN Integration<br>
        ✓ AI-Powered Tools</p>
      </div>
      
      <p>Our sales team is ready to answer your questions and create a custom solution that fits your needs and budget.</p>
      
      <a href="https://migrahosting.com/schedule-demo?ref=${data.ref || 'email'}" class="button">Schedule a Demo</a>
      
      <h2>Popular Plans</h2>
      <table class="table">
        <tr>
          <th>Plan</th>
          <th>Features</th>
          <th>Price</th>
        </tr>
        <tr>
          <td><strong>Starter</strong></td>
          <td>1 Website, 10GB SSD, 100GB Bandwidth</td>
          <td>$9.99/mo</td>
        </tr>
        <tr>
          <td><strong>Business</strong></td>
          <td>5 Websites, 50GB SSD, 500GB Bandwidth</td>
          <td>$29.99/mo</td>
        </tr>
        <tr>
          <td><strong>Enterprise</strong></td>
          <td>Unlimited Sites, 200GB SSD, Unmetered</td>
          <td>$99.99/mo</td>
        </tr>
      </table>
      
      <p>Questions? Reply to this email or call us at ${departments.sales.phone}.</p>
      
      <p>Best regards,<br>
      <strong>The MigraHosting Sales Team</strong></p>
    `;
    
    return getBaseTemplate('sales', 'Welcome to MigraHosting', content, [
      { text: 'View All Plans', url: 'https://migrahosting.com/pricing' },
      { text: 'Contact Sales', url: 'https://migrahosting.com/contact-sales' }
    ]);
  },
  
  quote: (data) => {
    const content = `
      <h1>Your Custom Quote <span class="badge">Quote #${data.quoteId}</span></h1>
      <p>Hi ${data.customerName},</p>
      <p>Thank you for requesting a quote. We've prepared a custom hosting solution based on your requirements.</p>
      
      <div class="info-box">
        <h3>Quote Details</h3>
        <p><strong>Valid Until:</strong> ${data.validUntil}<br>
        <strong>Account Manager:</strong> ${data.accountManager}<br>
        <strong>Reference:</strong> ${data.quoteId}</p>
      </div>
      
      <h2>Proposed Solution</h2>
      <table class="table">
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Price</th>
        </tr>
        ${data.items.map(item => `
        <tr>
          <td><strong>${item.name}</strong><br><small>${item.description}</small></td>
          <td>${item.quantity}</td>
          <td>$${item.price.toFixed(2)}</td>
        </tr>
        `).join('')}
        <tr style="background-color: #f9fafb; font-weight: 600;">
          <td colspan="2"><strong>Total</strong></td>
          <td><strong>$${data.total.toFixed(2)}/mo</strong></td>
        </tr>
      </table>
      
      <a href="https://migrahosting.com/quote/${data.quoteId}/accept" class="button">Accept Quote & Get Started</a>
      
      <p>This quote is valid for 30 days. Have questions or need adjustments? Reply to this email or call me directly.</p>
      
      <p>Looking forward to working with you!</p>
      <p><strong>${data.accountManager}</strong><br>
      Sales Account Manager<br>
      Direct: ${data.directPhone || departments.sales.phone}</p>
    `;
    
    return getBaseTemplate('sales', `Custom Quote #${data.quoteId}`, content);
  },
  
  followUp: (data) => {
    const content = `
      <h1>Following Up on Your Hosting Inquiry</h1>
      <p>Hi ${data.firstName},</p>
      <p>I wanted to follow up on our conversation about MigraHosting. Do you have any questions I can help answer?</p>
      
      ${data.demoScheduled ? `
      <div class="info-box">
        <h3>Your Demo is Scheduled</h3>
        <p><strong>Date:</strong> ${data.demoDate}<br>
        <strong>Time:</strong> ${data.demoTime}<br>
        <strong>Duration:</strong> 30 minutes</p>
      </div>
      ` : `
      <p>I'd love to show you how MigraHosting can help you:</p>
      <ul>
        <li>Reduce hosting costs by up to 40%</li>
        <li>Improve website performance with our global CDN</li>
        <li>Simplify management with our AI-powered control panel</li>
        <li>Scale effortlessly as your business grows</li>
      </ul>
      
      <a href="https://migrahosting.com/schedule-demo?rep=${data.repId}" class="button">Schedule a Quick Demo</a>
      `}
      
      <p>In the meantime, here are some resources that might be helpful:</p>
      <ul>
        <li><a href="https://migrahosting.com/case-studies" style="color: ${departments.sales.color};">Customer Success Stories</a></li>
        <li><a href="https://migrahosting.com/pricing" style="color: ${departments.sales.color};">Pricing & Plans</a></li>
        <li><a href="https://migrahosting.com/migration" style="color: ${departments.sales.color};">Free Migration Service</a></li>
      </ul>
      
      <p>Feel free to reply with any questions or give me a call at ${data.directPhone || departments.sales.phone}.</p>
      
      <p>Best regards,<br>
      <strong>${data.repName}</strong><br>
      Sales Representative</p>
    `;
    
    return getBaseTemplate('sales', 'Following Up - MigraHosting', content);
  }
};

/**
 * BILLING TEMPLATES
 */
export const billingTemplates = {
  invoice: (data) => {
    const content = `
      <h1>Invoice <span class="badge">#${data.invoiceNumber}</span></h1>
      <p>Hi ${data.customerName},</p>
      <p>Your invoice for ${data.billingPeriod} is now available.</p>
      
      <div class="info-box">
        <h3>Invoice Summary</h3>
        <p><strong>Invoice Number:</strong> ${data.invoiceNumber}<br>
        <strong>Issue Date:</strong> ${data.issueDate}<br>
        <strong>Due Date:</strong> ${data.dueDate}<br>
        <strong>Total Amount:</strong> <span style="font-size: 18px; color: ${departments.billing.color};">$${data.total.toFixed(2)}</span></p>
      </div>
      
      <table class="table">
        <tr>
          <th>Description</th>
          <th>Period</th>
          <th>Amount</th>
        </tr>
        ${data.items.map(item => `
        <tr>
          <td><strong>${item.description}</strong></td>
          <td>${item.period}</td>
          <td>$${item.amount.toFixed(2)}</td>
        </tr>
        `).join('')}
        <tr style="background-color: #f9fafb; font-weight: 600;">
          <td colspan="2"><strong>Total Due</strong></td>
          <td><strong>$${data.total.toFixed(2)}</strong></td>
        </tr>
      </table>
      
      ${data.autoPayEnabled ? `
      <div class="info-box">
        <h3>Auto-Pay Enabled ✓</h3>
        <p>Your payment will be automatically processed on ${data.dueDate} using your saved payment method ending in ${data.lastFour}.</p>
      </div>
      ` : `
      <a href="https://migrahosting.com/billing/invoice/${data.invoiceNumber}/pay" class="button">Pay Invoice Now</a>
      `}
      
      <p><a href="https://migrahosting.com/billing/invoice/${data.invoiceNumber}/download" style="color: ${departments.billing.color};">Download PDF Invoice</a></p>
      
      <p>Questions about your invoice? Reply to this email or contact our billing team.</p>
      
      <p>Thank you for your business!</p>
      <p><strong>MigraHosting Billing Team</strong></p>
    `;
    
    return getBaseTemplate('billing', `Invoice #${data.invoiceNumber}`, content, [
      { text: 'View All Invoices', url: 'https://migrahosting.com/billing/invoices' },
      { text: 'Payment Methods', url: 'https://migrahosting.com/billing/payment-methods' }
    ]);
  },
  
  paymentConfirmation: (data) => {
    const content = `
      <h1>Payment Received ✓</h1>
      <p>Hi ${data.customerName},</p>
      <p>We've successfully received your payment. Thank you!</p>
      
      <div class="info-box">
        <h3>Payment Details</h3>
        <p><strong>Amount Paid:</strong> <span style="font-size: 18px; color: ${departments.billing.color};">$${data.amount.toFixed(2)}</span><br>
        <strong>Payment Method:</strong> ${data.paymentMethod}<br>
        <strong>Transaction ID:</strong> ${data.transactionId}<br>
        <strong>Date:</strong> ${data.paymentDate}<br>
        <strong>Invoice:</strong> #${data.invoiceNumber}</p>
      </div>
      
      <table class="table">
        <tr>
          <th>Service</th>
          <th>Next Billing Date</th>
          <th>Status</th>
        </tr>
        ${data.services.map(service => `
        <tr>
          <td><strong>${service.name}</strong></td>
          <td>${service.nextBilling}</td>
          <td><span style="color: ${departments.billing.color}; font-weight: 600;">Active</span></td>
        </tr>
        `).join('')}
      </table>
      
      <a href="https://migrahosting.com/billing/invoice/${data.invoiceNumber}/receipt" class="button">Download Receipt</a>
      
      <p>Your services will continue without interruption. We'll send you a reminder before your next billing date.</p>
      
      <p>Thank you for being a valued MigraHosting customer!</p>
      <p><strong>MigraHosting Billing Team</strong></p>
    `;
    
    return getBaseTemplate('billing', 'Payment Confirmation', content);
  },
  
  paymentFailed: (data) => {
    const content = `
      <h1>Payment Failed - Action Required</h1>
      <p>Hi ${data.customerName},</p>
      <p>We attempted to process your payment for invoice #${data.invoiceNumber}, but unfortunately it failed.</p>
      
      <div class="info-box" style="border-left-color: #EF4444;">
        <h3>Payment Issue</h3>
        <p><strong>Invoice:</strong> #${data.invoiceNumber}<br>
        <strong>Amount:</strong> $${data.amount.toFixed(2)}<br>
        <strong>Payment Method:</strong> ${data.paymentMethod}<br>
        <strong>Reason:</strong> ${data.failureReason}<br>
        <strong>Retry Date:</strong> ${data.retryDate}</p>
      </div>
      
      <h2>What You Need to Do</h2>
      <p>To avoid service interruption, please take one of these actions:</p>
      <ul>
        <li><strong>Update your payment method</strong> if the card has expired or been replaced</li>
        <li><strong>Make a manual payment</strong> using a different payment method</li>
        <li><strong>Contact your bank</strong> if you believe the payment should have succeeded</li>
      </ul>
      
      <a href="https://migrahosting.com/billing/invoice/${data.invoiceNumber}/pay" class="button">Pay Now</a>
      
      <p style="margin-top: 25px;"><a href="https://migrahosting.com/billing/payment-methods" style="color: ${departments.billing.color};">Update Payment Method</a></p>
      
      <p><strong>Important:</strong> We'll automatically retry this payment on ${data.retryDate}. If payment is not received by ${data.suspensionDate}, your services may be suspended.</p>
      
      <p>Need help? Contact our billing team - we're here to assist you.</p>
      
      <p><strong>MigraHosting Billing Team</strong></p>
    `;
    
    return getBaseTemplate('billing', 'Payment Failed - Action Required', content);
  },
  
  upcomingRenewal: (data) => {
    const content = `
      <h1>Upcoming Renewal Reminder</h1>
      <p>Hi ${data.customerName},</p>
      <p>This is a friendly reminder that your MigraHosting services will renew soon.</p>
      
      <table class="table">
        <tr>
          <th>Service</th>
          <th>Renewal Date</th>
          <th>Amount</th>
        </tr>
        ${data.renewals.map(renewal => `
        <tr>
          <td><strong>${renewal.service}</strong></td>
          <td>${renewal.date}</td>
          <td>$${renewal.amount.toFixed(2)}</td>
        </tr>
        `).join('')}
        <tr style="background-color: #f9fafb; font-weight: 600;">
          <td colspan="2"><strong>Total</strong></td>
          <td><strong>$${data.total.toFixed(2)}</strong></td>
        </tr>
      </table>
      
      ${data.autoPayEnabled ? `
      <div class="info-box">
        <h3>Auto-Renewal Enabled ✓</h3>
        <p>Your payment method ending in ${data.lastFour} will be automatically charged on ${data.renewalDate}.</p>
        <p><a href="https://migrahosting.com/billing/payment-methods" style="color: ${departments.billing.color};">Manage Payment Methods</a></p>
      </div>
      ` : `
      <div class="info-box" style="border-left-color: #F59E0B;">
        <h3>Action Required</h3>
        <p>Auto-renewal is not enabled. Please make a manual payment before ${data.renewalDate} to avoid service interruption.</p>
      </div>
      <a href="https://migrahosting.com/billing/renew" class="button">Renew Now</a>
      `}
      
      <p>Want to make changes? You can upgrade, downgrade, or cancel anytime from your customer portal.</p>
      
      <p><strong>MigraHosting Billing Team</strong></p>
    `;
    
    return getBaseTemplate('billing', 'Upcoming Renewal Reminder', content);
  }
};

/**
 * SUPPORT TEMPLATES
 */
export const supportTemplates = {
  ticketReceived: (data) => {
    const content = `
      <h1>Support Ticket Created <span class="badge">#${data.ticketId}</span></h1>
      <p>Hi ${data.customerName},</p>
      <p>We've received your support request and our team is reviewing it now.</p>
      
      <div class="info-box">
        <h3>Ticket Details</h3>
        <p><strong>Ticket ID:</strong> #${data.ticketId}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Priority:</strong> ${data.priority}<br>
        <strong>Created:</strong> ${data.createdAt}<br>
        <strong>Expected Response:</strong> ${data.expectedResponse}</p>
      </div>
      
      <h2>Your Message</h2>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${data.message}
      </div>
      
      <a href="https://migrahosting.com/support/ticket/${data.ticketId}" class="button">View Ticket</a>
      
      <h2>What Happens Next?</h2>
      <p>Our support team typically responds within:</p>
      <ul>
        <li><strong>Critical:</strong> 15 minutes</li>
        <li><strong>High:</strong> 1 hour</li>
        <li><strong>Normal:</strong> 4 hours</li>
        <li><strong>Low:</strong> 24 hours</li>
      </ul>
      
      <p>You can reply to this email to add more information to your ticket, or visit your customer portal to check status.</p>
      
      <p><strong>Need urgent help?</strong> Call us at ${departments.support.phone} (24/7)</p>
      
      <p>Best regards,<br>
      <strong>MigraHosting Support Team</strong></p>
    `;
    
    return getBaseTemplate('support', `Support Ticket #${data.ticketId} Created`, content, [
      { text: 'Knowledge Base', url: 'https://migrahosting.com/kb' },
      { text: 'Video Tutorials', url: 'https://migrahosting.com/tutorials' },
      { text: 'Community Forum', url: 'https://community.migrahosting.com' }
    ]);
  },
  
  ticketResponse: (data) => {
    const content = `
      <h1>Update on Ticket <span class="badge">#${data.ticketId}</span></h1>
      <p>Hi ${data.customerName},</p>
      <p>Our support team has responded to your ticket.</p>
      
      <div class="info-box">
        <h3>Response from ${data.agentName}</h3>
        <p><strong>Status:</strong> ${data.status}<br>
        <strong>Responded:</strong> ${data.respondedAt}</p>
      </div>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${data.response}
      </div>
      
      <a href="https://migrahosting.com/support/ticket/${data.ticketId}" class="button">Reply to Ticket</a>
      
      ${data.attachments && data.attachments.length > 0 ? `
      <h2>Attachments</h2>
      <ul>
        ${data.attachments.map(att => `<li><a href="${att.url}" style="color: ${departments.support.color};">${att.name}</a> (${att.size})</li>`).join('')}
      </ul>
      ` : ''}
      
      <p>If this resolves your issue, you can close the ticket from your portal. Otherwise, feel free to reply with any follow-up questions.</p>
      
      <p>Best regards,<br>
      <strong>${data.agentName}</strong><br>
      Support Engineer</p>
    `;
    
    return getBaseTemplate('support', `Ticket #${data.ticketId} Updated`, content);
  },
  
  ticketResolved: (data) => {
    const content = `
      <h1>Ticket Resolved <span class="badge">#${data.ticketId}</span></h1>
      <p>Hi ${data.customerName},</p>
      <p>Great news! Your support ticket has been marked as resolved.</p>
      
      <div class="info-box">
        <h3>Resolution Summary</h3>
        <p><strong>Ticket:</strong> #${data.ticketId}<br>
        <strong>Subject:</strong> ${data.subject}<br>
        <strong>Resolved By:</strong> ${data.resolvedBy}<br>
        <strong>Resolution Time:</strong> ${data.resolutionTime}<br>
        <strong>Closed:</strong> ${data.closedAt}</p>
      </div>
      
      <h2>How Was Your Experience?</h2>
      <p>We'd love to hear your feedback on how we handled your support request.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="margin-bottom: 15px;">Rate your support experience:</p>
        <a href="https://migrahosting.com/support/feedback/${data.ticketId}/5" style="display: inline-block; margin: 0 5px; font-size: 32px; text-decoration: none;">⭐</a>
        <a href="https://migrahosting.com/support/feedback/${data.ticketId}/4" style="display: inline-block; margin: 0 5px; font-size: 32px; text-decoration: none;">⭐</a>
        <a href="https://migrahosting.com/support/feedback/${data.ticketId}/3" style="display: inline-block; margin: 0 5px; font-size: 32px; text-decoration: none;">⭐</a>
        <a href="https://migrahosting.com/support/feedback/${data.ticketId}/2" style="display: inline-block; margin: 0 5px; font-size: 32px; text-decoration: none;">⭐</a>
        <a href="https://migrahosting.com/support/feedback/${data.ticketId}/1" style="display: inline-block; margin: 0 5px; font-size: 32px; text-decoration: none;">⭐</a>
      </div>
      
      <p>Need to reopen this ticket? Just reply to this email.</p>
      
      <p>Thank you for being a MigraHosting customer!</p>
      <p><strong>MigraHosting Support Team</strong></p>
    `;
    
    return getBaseTemplate('support', `Ticket #${data.ticketId} Resolved`, content);
  }
};

/**
 * INFO TEMPLATES
 */
export const infoTemplates = {
  generalInquiry: (data) => {
    const content = `
      <h1>Thank You for Contacting Us</h1>
      <p>Hi ${data.name || 'there'},</p>
      <p>Thank you for reaching out to MigraHosting. We've received your inquiry and will respond shortly.</p>
      
      <div class="info-box">
        <h3>Your Inquiry</h3>
        <p><strong>Reference:</strong> ${data.inquiryId}<br>
        <strong>Received:</strong> ${data.receivedAt}<br>
        <strong>Expected Response:</strong> Within 24 hours</p>
      </div>
      
      <h2>While You Wait</h2>
      <p>Here are some resources that might help answer your questions:</p>
      
      <table class="table">
        <tr>
          <td><strong>📚 Knowledge Base</strong></td>
          <td><a href="https://migrahosting.com/kb" style="color: ${departments.info.color};">Browse Articles</a></td>
        </tr>
        <tr>
          <td><strong>🎓 Video Tutorials</strong></td>
          <td><a href="https://migrahosting.com/tutorials" style="color: ${departments.info.color};">Watch & Learn</a></td>
        </tr>
        <tr>
          <td><strong>💬 Community Forum</strong></td>
          <td><a href="https://community.migrahosting.com" style="color: ${departments.info.color};">Join Discussion</a></td>
        </tr>
        <tr>
          <td><strong>📊 System Status</strong></td>
          <td><a href="https://status.migrahosting.com" style="color: ${departments.info.color};">Check Status</a></td>
        </tr>
      </table>
      
      <h2>Quick Links</h2>
      <ul>
        <li><a href="https://migrahosting.com/pricing" style="color: ${departments.info.color};">Pricing & Plans</a></li>
        <li><a href="https://migrahosting.com/features" style="color: ${departments.info.color};">Platform Features</a></li>
        <li><a href="https://migrahosting.com/migration" style="color: ${departments.info.color};">Free Migration Service</a></li>
        <li><a href="https://migrahosting.com/about" style="color: ${departments.info.color};">About MigraHosting</a></li>
      </ul>
      
      <p>We look forward to connecting with you soon!</p>
      <p><strong>MigraHosting Information Team</strong></p>
    `;
    
    return getBaseTemplate('info', 'Thank You for Your Inquiry', content);
  },
  
  newsletter: (data) => {
    const content = `
      <h1>${data.title}</h1>
      <p>Hi ${data.firstName || 'there'},</p>
      <p>${data.intro}</p>
      
      ${data.sections.map(section => `
      <h2>${section.title}</h2>
      ${section.image ? `<img src="${section.image}" alt="${section.title}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 15px 0;">` : ''}
      <p>${section.content}</p>
      ${section.link ? `<a href="${section.link}" style="color: ${departments.info.color}; font-weight: 600;">Read More →</a>` : ''}
      `).join('')}
      
      <div class="info-box">
        <h3>Stay Connected</h3>
        <p>Follow us on social media for daily tips, updates, and hosting insights!</p>
      </div>
      
      <p>Thank you for being part of the MigraHosting community!</p>
      <p><strong>The MigraHosting Team</strong></p>
      
      <p style="font-size: 12px; color: #9ca3af; margin-top: 30px;">
        Don't want to receive newsletters? <a href="https://migrahosting.com/unsubscribe/${data.unsubscribeToken}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    `;
    
    return getBaseTemplate('info', data.title, content);
  }
};

/**
 * STUDENT TEMPLATES
 */
export const studentTemplates = {
  welcome: (data) => {
    const content = `
      <h1>Welcome to MigraHosting Student Program! 🎓</h1>
      <p>Hi ${data.firstName},</p>
      <p>Congratulations! Your student application has been approved. We're excited to support your learning journey!</p>
      
      <div class="info-box">
        <h3>Your Student Benefits</h3>
        <p>✓ <strong>50% OFF all hosting plans</strong><br>
        ✓ Free .edu domain for 1 year<br>
        ✓ Priority support queue<br>
        ✓ Access to exclusive tutorials<br>
        ✓ Free SSL & CDN<br>
        ✓ GitHub Student Pack integration</p>
      </div>
      
      <a href="https://migrahosting.com/student/activate?code=${data.activationCode}" class="button">Activate Student Account</a>
      
      <h2>Student Pricing</h2>
      <table class="table">
        <tr>
          <th>Plan</th>
          <th>Regular Price</th>
          <th>Student Price</th>
        </tr>
        <tr>
          <td><strong>Student Starter</strong></td>
          <td><s>$9.99/mo</s></td>
          <td style="color: ${departments.student.color}; font-weight: 600;">$4.99/mo</td>
        </tr>
        <tr>
          <td><strong>Student Pro</strong></td>
          <td><s>$29.99/mo</s></td>
          <td style="color: ${departments.student.color}; font-weight: 600;">$14.99/mo</td>
        </tr>
        <tr>
          <td><strong>Student Premium</strong></td>
          <td><s>$99.99/mo</s></td>
          <td style="color: ${departments.student.color}; font-weight: 600;">$49.99/mo</td>
        </tr>
      </table>
      
      <h2>Learning Resources Just for You</h2>
      <ul>
        <li><strong>Web Development Masterclass:</strong> Free video course series</li>
        <li><strong>Deploy Your First App:</strong> Step-by-step guide</li>
        <li><strong>Student Community:</strong> Connect with other student developers</li>
        <li><strong>Career Resources:</strong> Portfolio templates & resume tips</li>
      </ul>
      
      <div class="info-box">
        <h3>Important Information</h3>
        <p><strong>Verification Required:</strong> Upload your student ID or .edu email proof<br>
        <strong>Valid Until:</strong> ${data.expirationDate}<br>
        <strong>Renewal:</strong> Automatic with valid student status</p>
      </div>
      
      <p>Questions about the student program? Reply to this email - we're here to help!</p>
      
      <p>Happy coding! 🚀</p>
      <p><strong>MigraHosting Student Program Team</strong></p>
    `;
    
    return getBaseTemplate('student', 'Welcome to MigraHosting Student Program', content, [
      { text: 'Student Portal', url: 'https://migrahosting.com/student' },
      { text: 'Learning Center', url: 'https://migrahosting.com/learn' },
      { text: 'Student FAQ', url: 'https://migrahosting.com/student/faq' }
    ]);
  },
  
  renewal: (data) => {
    const content = `
      <h1>Student Program Renewal Required</h1>
      <p>Hi ${data.firstName},</p>
      <p>Your MigraHosting student program benefits will expire soon. To continue enjoying 50% off, please verify your current student status.</p>
      
      <div class="info-box">
        <h3>Account Status</h3>
        <p><strong>Current Expiration:</strong> ${data.expirationDate}<br>
        <strong>Student Discount:</strong> Active (expires soon)<br>
        <strong>Action Required:</strong> Upload verification document</p>
      </div>
      
      <h2>How to Renew</h2>
      <ol>
        <li>Log in to your student portal</li>
        <li>Upload one of these documents:
          <ul>
            <li>Current student ID card</li>
            <li>Enrollment verification letter</li>
            <li>Recent transcript (grades can be redacted)</li>
          </ul>
        </li>
        <li>Wait 24-48 hours for verification</li>
        <li>Your discount will be extended for another year!</li>
      </ol>
      
      <a href="https://migrahosting.com/student/renew" class="button">Renew Student Status</a>
      
      <p><strong>What happens if I don't renew?</strong><br>
      After ${data.expirationDate}, your account will automatically convert to regular pricing. You can downgrade or cancel anytime with no penalty.</p>
      
      <p>Questions? We're here to help!</p>
      <p><strong>MigraHosting Student Program Team</strong></p>
    `;
    
    return getBaseTemplate('student', 'Student Program Renewal Required', content);
  }
};

/**
 * ADMIN TEMPLATES
 */
export const adminTemplates = {
  userCreated: (data) => {
    const content = `
      <h1>New User Account Created</h1>
      <p>A new user account has been created in the system.</p>
      
      <table class="table">
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
        <tr>
          <td><strong>User ID</strong></td>
          <td>${data.userId}</td>
        </tr>
        <tr>
          <td><strong>Email</strong></td>
          <td>${data.email}</td>
        </tr>
        <tr>
          <td><strong>Name</strong></td>
          <td>${data.firstName} ${data.lastName}</td>
        </tr>
        <tr>
          <td><strong>Role</strong></td>
          <td>${data.role}</td>
        </tr>
        <tr>
          <td><strong>Tenant</strong></td>
          <td>${data.tenantId || 'N/A'}</td>
        </tr>
        <tr>
          <td><strong>Created At</strong></td>
          <td>${data.createdAt}</td>
        </tr>
        <tr>
          <td><strong>Created By</strong></td>
          <td>${data.createdBy}</td>
        </tr>
      </table>
      
      <a href="https://migrahosting.com/admin/users/${data.userId}" class="button">View User Profile</a>
      
      <p><strong>MigraHosting System</strong></p>
    `;
    
    return getBaseTemplate('admin', 'New User Account Created', content);
  },
  
  systemReport: (data) => {
    const content = `
      <h1>${data.reportType} Report</h1>
      <p>Generated: ${data.generatedAt}</p>
      
      <h2>Summary</h2>
      <table class="table">
        ${Object.entries(data.metrics).map(([key, value]) => `
        <tr>
          <td><strong>${key}</strong></td>
          <td>${value}</td>
        </tr>
        `).join('')}
      </table>
      
      ${data.alerts && data.alerts.length > 0 ? `
      <h2>Alerts</h2>
      <div class="info-box" style="border-left-color: #EF4444;">
        <ul>
          ${data.alerts.map(alert => `<li>${alert}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      <a href="https://migrahosting.com/admin/reports/${data.reportId}" class="button">View Full Report</a>
      
      <p><strong>MigraHosting System</strong></p>
    `;
    
    return getBaseTemplate('admin', `${data.reportType} Report`, content);
  }
};

/**
 * ALERTS TEMPLATES
 */
export const alertTemplates = {
  securityAlert: (data) => {
    const content = `
      <h1>🔒 Security Alert <span class="badge" style="background-color: #DC262622; color: #DC2626;">${data.severity}</span></h1>
      <p><strong>ATTENTION REQUIRED</strong></p>
      
      <div class="info-box" style="border-left-color: #DC2626; background-color: #FEE2E2;">
        <h3>${data.alertType}</h3>
        <p><strong>Detected:</strong> ${data.detectedAt}<br>
        <strong>Severity:</strong> ${data.severity}<br>
        <strong>Affected Resource:</strong> ${data.resource}<br>
        <strong>Status:</strong> ${data.status}</p>
      </div>
      
      <h2>Details</h2>
      <p>${data.description}</p>
      
      ${data.impact ? `
      <h2>Potential Impact</h2>
      <ul>
        ${data.impact.map(item => `<li>${item}</li>`).join('')}
      </ul>
      ` : ''}
      
      <h2>Recommended Actions</h2>
      <ol>
        ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
      </ol>
      
      <a href="https://migrahosting.com/admin/security/alert/${data.alertId}" class="button" style="background-color: #DC2626;">Review Alert</a>
      
      <p><strong>This is an automated security alert. Do not reply to this email.</strong></p>
      <p>For urgent security concerns, contact: security@migrahosting.com</p>
      
      <p><strong>MigraHosting Security Team</strong></p>
    `;
    
    return getBaseTemplate('alerts', `Security Alert: ${data.alertType}`, content);
  },
  
  systemDowntime: (data) => {
    const content = `
      <h1>${data.isScheduled ? '📅 Scheduled Maintenance' : '⚠️ Unplanned Downtime'}</h1>
      
      <div class="info-box" style="border-left-color: ${data.isScheduled ? '#F59E0B' : '#DC2626'};">
        <h3>${data.title}</h3>
        <p><strong>Start Time:</strong> ${data.startTime}<br>
        <strong>Expected Duration:</strong> ${data.duration}<br>
        <strong>Affected Services:</strong> ${data.affectedServices.join(', ')}<br>
        <strong>Status:</strong> ${data.status}</p>
      </div>
      
      <h2>What's Happening?</h2>
      <p>${data.description}</p>
      
      <h2>Impact</h2>
      <ul>
        ${data.impacts.map(impact => `<li>${impact}</li>`).join('')}
      </ul>
      
      ${data.workaround ? `
      <h2>Workaround</h2>
      <p>${data.workaround}</p>
      ` : ''}
      
      <a href="https://status.migrahosting.com/incident/${data.incidentId}" class="button">View Status Page</a>
      
      <p>We'll send you another update when this ${data.isScheduled ? 'maintenance' : 'incident'} is resolved.</p>
      
      <p><strong>MigraHosting Operations Team</strong></p>
    `;
    
    return getBaseTemplate('alerts', data.title, content);
  },
  
  usageAlert: (data) => {
    const content = `
      <h1>Resource Usage Alert</h1>
      <p>Hi ${data.customerName},</p>
      <p>Your account has reached ${data.percentage}% of your ${data.resourceType} limit.</p>
      
      <div class="info-box" style="border-left-color: ${data.severity === 'critical' ? '#DC2626' : '#F59E0B'};">
        <h3>Usage Details</h3>
        <p><strong>Resource:</strong> ${data.resourceType}<br>
        <strong>Current Usage:</strong> ${data.currentUsage}<br>
        <strong>Limit:</strong> ${data.limit}<br>
        <strong>Percentage:</strong> ${data.percentage}%<br>
        <strong>Service:</strong> ${data.service}</p>
      </div>
      
      <h2>What This Means</h2>
      <p>${data.severity === 'critical' 
        ? 'You are approaching your resource limit. Service may be throttled or suspended if limit is exceeded.'
        : 'You are using a significant portion of your allocated resources. Consider upgrading to avoid potential service interruption.'
      }</p>
      
      <h2>Recommended Actions</h2>
      <ul>
        <li><strong>Upgrade your plan</strong> to get more ${data.resourceType}</li>
        <li><strong>Optimize usage</strong> by cleaning up unused files or reducing traffic</li>
        <li><strong>Add extra resources</strong> as a one-time purchase</li>
      </ul>
      
      <a href="https://migrahosting.com/account/upgrade" class="button">Upgrade Plan</a>
      
      <p style="margin-top: 25px;"><a href="https://migrahosting.com/account/usage" style="color: ${departments.alerts.color};">View Detailed Usage Statistics</a></p>
      
      <p>Need help optimizing your usage? Contact our support team!</p>
      
      <p><strong>MigraHosting Monitoring System</strong></p>
    `;
    
    return getBaseTemplate('alerts', `Resource Usage Alert - ${data.percentage}% Used`, content);
  },
  
  backupStatus: (data) => {
    const content = `
      <h1>${data.success ? '✅ Backup Completed' : '❌ Backup Failed'}</h1>
      <p>Hi ${data.customerName},</p>
      <p>Your ${data.backupType} backup has ${data.success ? 'completed successfully' : 'failed'}.</p>
      
      <div class="info-box" style="border-left-color: ${data.success ? '#10B981' : '#DC2626'};">
        <h3>Backup Details</h3>
        <p><strong>Backup ID:</strong> ${data.backupId}<br>
        <strong>Type:</strong> ${data.backupType}<br>
        <strong>Started:</strong> ${data.startTime}<br>
        <strong>Completed:</strong> ${data.endTime || 'N/A'}<br>
        <strong>Duration:</strong> ${data.duration}<br>
        ${data.success ? `<strong>Size:</strong> ${data.backupSize}<br>
        <strong>Location:</strong> ${data.location}` : `<strong>Error:</strong> ${data.error}`}</p>
      </div>
      
      ${data.success ? `
      <h2>Backup Contents</h2>
      <ul>
        ${data.contents.map(item => `<li>${item}</li>`).join('')}
      </ul>
      
      <a href="https://migrahosting.com/backups/${data.backupId}" class="button">View Backup Details</a>
      
      <p>Your backup is stored securely and can be restored anytime from your control panel.</p>
      ` : `
      <h2>What Went Wrong?</h2>
      <p>${data.errorDetails}</p>
      
      <h2>Next Steps</h2>
      <ul>
        <li>We'll automatically retry this backup in ${data.retryIn}</li>
        <li>Check your account has sufficient storage space</li>
        <li>Contact support if this issue persists</li>
      </ul>
      
      <a href="https://migrahosting.com/support/new?subject=Backup%20Failed%20${data.backupId}" class="button">Contact Support</a>
      `}
      
      <p><strong>MigraHosting Backup System</strong></p>
    `;
    
    return getBaseTemplate('alerts', `Backup ${data.success ? 'Completed' : 'Failed'} - ${data.backupId}`, content);
  }
};

/**
 * NOC (Network Operations Center) TEMPLATES
 */
export const nocTemplates = {
  serverAlert: (data) => {
    const content = `
      <h1>⚠️ Server Alert <span class="badge" style="background-color: ${data.severity === 'critical' ? '#DC2626' : '#F59E0B'}22; color: ${data.severity === 'critical' ? '#DC2626' : '#F59E0B'};">${data.severity.toUpperCase()}</span></h1>
      <p>Automated alert from network monitoring system.</p>
      
      <div class="info-box" style="border-left-color: ${data.severity === 'critical' ? '#DC2626' : '#F59E0B'};">
        <h3>${data.alertType}</h3>
        <p><strong>Server:</strong> ${data.serverName} (${data.serverIp})<br>
        <strong>Detected:</strong> ${data.detectedAt}<br>
        <strong>Severity:</strong> ${data.severity}<br>
        <strong>Status:</strong> ${data.status}<br>
        <strong>Uptime:</strong> ${data.uptime || 'N/A'}</p>
      </div>
      
      <h2>Metrics</h2>
      <table class="table">
        <tr>
          <th>Metric</th>
          <th>Current</th>
          <th>Threshold</th>
          <th>Status</th>
        </tr>
        ${data.metrics.map(metric => `
        <tr>
          <td><strong>${metric.name}</strong></td>
          <td>${metric.current}</td>
          <td>${metric.threshold}</td>
          <td><span style="color: ${metric.ok ? '#10B981' : '#DC2626'}; font-weight: 600;">${metric.ok ? '✓ OK' : '✗ Alert'}</span></td>
        </tr>
        `).join('')}
      </table>
      
      <h2>Recommended Actions</h2>
      <ol>
        ${data.actions.map(action => `<li>${action}</li>`).join('')}
      </ol>
      
      <a href="https://migrahosting.com/noc/server/${data.serverId}" class="button">View Server Dashboard</a>
      
      ${data.autoRemediation ? `
      <div class="info-box">
        <h3>Auto-Remediation Applied</h3>
        <p>${data.autoRemediation}</p>
      </div>
      ` : ''}
      
      <p><strong>MigraHosting NOC</strong></p>
    `;
    
    return getBaseTemplate('noc', data.alertType, content);
  },
  
  maintenanceScheduled: (data) => {
    const content = `
      <h1>📅 Scheduled Maintenance Notification</h1>
      <p>This is an advance notification of upcoming scheduled maintenance.</p>
      
      <div class="info-box">
        <h3>Maintenance Details</h3>
        <p><strong>Date:</strong> ${data.maintenanceDate}<br>
        <strong>Start Time:</strong> ${data.startTime}<br>
        <strong>Expected Duration:</strong> ${data.duration}<br>
        <strong>Maintenance Window:</strong> ${data.window}<br>
        <strong>Type:</strong> ${data.maintenanceType}</p>
      </div>
      
      <h2>What We're Doing</h2>
      <p>${data.description}</p>
      
      <h2>Affected Services</h2>
      <ul>
        ${data.affectedServices.map(service => `<li>${service}</li>`).join('')}
      </ul>
      
      <h2>Expected Impact</h2>
      <table class="table">
        <tr>
          <th>Service</th>
          <th>Impact Level</th>
          <th>Details</th>
        </tr>
        ${data.impacts.map(impact => `
        <tr>
          <td><strong>${impact.service}</strong></td>
          <td><span style="color: ${impact.level === 'high' ? '#DC2626' : impact.level === 'medium' ? '#F59E0B' : '#10B981'}; font-weight: 600;">${impact.level.toUpperCase()}</span></td>
          <td>${impact.details}</td>
        </tr>
        `).join('')}
      </table>
      
      <h2>What You Should Do</h2>
      <ul>
        ${data.customerActions.map(action => `<li>${action}</li>`).join('')}
      </ul>
      
      <a href="https://status.migrahosting.com/maintenance/${data.maintenanceId}" class="button">View Status Page</a>
      
      <p>We'll send updates before, during, and after the maintenance window.</p>
      
      <p><strong>MigraHosting NOC</strong></p>
    `;
    
    return getBaseTemplate('noc', 'Scheduled Maintenance Notification', content);
  }
};

/**
 * ABUSE TEMPLATES
 */
export const abuseTemplates = {
  reportReceived: (data) => {
    const content = `
      <h1>Abuse Report Received <span class="badge">#${data.reportId}</span></h1>
      <p>${data.reporterName ? `Dear ${data.reporterName}` : 'Thank you for your report'},</p>
      <p>We have received your abuse report and our team is investigating.</p>
      
      <div class="info-box">
        <h3>Report Details</h3>
        <p><strong>Report ID:</strong> #${data.reportId}<br>
        <strong>Type:</strong> ${data.reportType}<br>
        <strong>Received:</strong> ${data.receivedAt}<br>
        <strong>Priority:</strong> ${data.priority}<br>
        <strong>Status:</strong> Under Investigation</p>
      </div>
      
      <h2>What Happens Next?</h2>
      <ol>
        <li><strong>Investigation</strong> - Our abuse team will review your report within ${data.investigationTime}</li>
        <li><strong>Verification</strong> - We'll verify the reported content/activity</li>
        <li><strong>Action</strong> - If violation is confirmed, appropriate action will be taken</li>
        <li><strong>Follow-up</strong> - You'll receive a status update within ${data.followUpTime}</li>
      </ol>
      
      <h2>Reported Content/Activity</h2>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid ${departments.abuse.color}; margin: 20px 0;">
        <p><strong>Subject:</strong> ${data.subject}<br>
        ${data.url ? `<strong>URL:</strong> ${data.url}<br>` : ''}
        ${data.ipAddress ? `<strong>IP Address:</strong> ${data.ipAddress}<br>` : ''}
        <strong>Category:</strong> ${data.category}</p>
      </div>
      
      ${data.evidenceUrls && data.evidenceUrls.length > 0 ? `
      <h2>Evidence Received</h2>
      <ul>
        ${data.evidenceUrls.map((url, i) => `<li>Attachment ${i + 1}: <a href="${url}" style="color: ${departments.abuse.color};">View</a></li>`).join('')}
      </ul>
      ` : ''}
      
      <a href="https://migrahosting.com/abuse/report/${data.reportId}" class="button">Track Report Status</a>
      
      <p>If you have additional information, please reply to this email with report ID #${data.reportId}.</p>
      
      <p><strong>MigraHosting Abuse Prevention Team</strong></p>
    `;
    
    return getBaseTemplate('abuse', `Abuse Report #${data.reportId} Received`, content);
  },
  
  violationNotice: (data) => {
    const content = `
      <h1>⚠️ Terms of Service Violation Notice</h1>
      <p>Hi ${data.customerName},</p>
      <p>We have detected activity on your account that violates our Terms of Service.</p>
      
      <div class="info-box" style="border-left-color: #DC2626; background-color: #FEE2E2;">
        <h3>Violation Details</h3>
        <p><strong>Case ID:</strong> ${data.caseId}<br>
        <strong>Severity:</strong> ${data.severity}<br>
        <strong>Detected:</strong> ${data.detectedAt}<br>
        <strong>Account:</strong> ${data.accountId}<br>
        <strong>Service:</strong> ${data.serviceName}</p>
      </div>
      
      <h2>Violation Type: ${data.violationType}</h2>
      <p>${data.description}</p>
      
      <h2>Evidence</h2>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        ${data.evidence}
      </div>
      
      <h2>Required Actions</h2>
      <ol>
        ${data.requiredActions.map(action => `<li>${action}</li>`).join('')}
      </ol>
      
      <div class="info-box" style="border-left-color: #F59E0B;">
        <h3>⏰ Action Required By: ${data.deadline}</h3>
        <p>Failure to take corrective action may result in:
        <ul>
          <li>Service suspension</li>
          <li>Account termination</li>
          <li>Legal action if applicable</li>
        </ul>
        </p>
      </div>
      
      <a href="https://migrahosting.com/abuse/case/${data.caseId}" class="button" style="background-color: #DC2626;">Respond to Violation Notice</a>
      
      <p>If you believe this is an error, please contact us immediately at ${departments.abuse.email} with case ID ${data.caseId}.</p>
      
      <p><strong>MigraHosting Abuse Prevention Team</strong></p>
    `;
    
    return getBaseTemplate('abuse', 'Terms of Service Violation Notice', content);
  }
};

/**
 * LEGAL TEMPLATES
 */
export const legalTemplates = {
  gdprRequest: (data) => {
    const content = `
      <h1>GDPR Data Request Confirmation</h1>
      <p>Dear ${data.requesterName},</p>
      <p>We have received your GDPR data ${data.requestType} request.</p>
      
      <div class="info-box">
        <h3>Request Details</h3>
        <p><strong>Request ID:</strong> ${data.requestId}<br>
        <strong>Type:</strong> ${data.requestType}<br>
        <strong>Received:</strong> ${data.receivedAt}<br>
        <strong>Status:</strong> Processing<br>
        <strong>Expected Completion:</strong> ${data.completionDate}</p>
      </div>
      
      <h2>What We're Processing</h2>
      <p>Under GDPR Article ${data.article}, you have requested:</p>
      <ul>
        ${data.dataCategories.map(cat => `<li>${cat}</li>`).join('')}
      </ul>
      
      <h2>Next Steps</h2>
      <ol>
        <li><strong>Identity Verification</strong> - We'll verify your identity to protect your data (completed)</li>
        <li><strong>Data Collection</strong> - We'll gather all requested information from our systems</li>
        <li><strong>Review</strong> - Our legal team will review the data for completeness</li>
        <li><strong>Delivery</strong> - You'll receive the data via secure download link within ${data.processingTime}</li>
      </ol>
      
      ${data.requestType === 'deletion' ? `
      <div class="info-box" style="border-left-color: #DC2626;">
        <h3>⚠️ Important: Data Deletion Request</h3>
        <p>This is a permanent action that cannot be reversed. Your data will be completely removed from our systems within 30 days.
        <br><br>
        <strong>Services that will be affected:</strong><br>
        ${data.affectedServices.map(s => `• ${s}<br>`).join('')}
        </p>
      </div>
      ` : ''}
      
      <a href="https://migrahosting.com/legal/gdpr/${data.requestId}" class="button">Track Request Status</a>
      
      <p>If you have questions about this request, please contact our Data Protection Officer at dpo@migrahosting.com.</p>
      
      <p><strong>MigraHosting Legal Department</strong></p>
    `;
    
    return getBaseTemplate('legal', `GDPR ${data.requestType} Request Confirmation`, content);
  },
  
  subpoena: (data) => {
    const content = `
      <h1>Legal Document Received</h1>
      <p>Dear ${data.recipientName},</p>
      <p>This is to confirm receipt of a legal document requiring our response.</p>
      
      <div class="info-box">
        <h3>Document Details</h3>
        <p><strong>Case Number:</strong> ${data.caseNumber}<br>
        <strong>Document Type:</strong> ${data.documentType}<br>
        <strong>Received:</strong> ${data.receivedAt}<br>
        <strong>Issuing Authority:</strong> ${data.authority}<br>
        <strong>Response Due:</strong> ${data.dueDate}</p>
      </div>
      
      <h2>Our Process</h2>
      <ol>
        <li><strong>Review</strong> - Our legal team is reviewing the document</li>
        <li><strong>Verification</strong> - We'll verify the authenticity and jurisdiction</li>
        <li><strong>Compliance</strong> - We'll prepare our response in accordance with applicable laws</li>
        <li><strong>Response</strong> - We'll submit our response by ${data.dueDate}</li>
      </ol>
      
      ${data.customerNotification ? `
      <div class="info-box" style="border-left-color: #F59E0B;">
        <h3>Customer Notification</h3>
        <p>As this matter may involve customer data, affected customers will be notified in accordance with our privacy policy and applicable laws.</p>
      </div>
      ` : ''}
      
      <p>For questions regarding this matter, please contact our legal department at ${departments.legal.email}.</p>
      
      <p><strong>MigraHosting Legal Department</strong></p>
    `;
    
    return getBaseTemplate('legal', 'Legal Document Received', content);
  }
};

/**
 * PARTNERSHIPS TEMPLATES
 */
export const partnershipsTemplates = {
  inquiryReceived: (data) => {
    const content = `
      <h1>Partnership Inquiry Received</h1>
      <p>Hi ${data.companyName || data.contactName},</p>
      <p>Thank you for your interest in partnering with MigraHosting!</p>
      
      <div class="info-box">
        <h3>Your Inquiry</h3>
        <p><strong>Reference:</strong> ${data.inquiryId}<br>
        <strong>Partnership Type:</strong> ${data.partnershipType}<br>
        <strong>Received:</strong> ${data.receivedAt}<br>
        <strong>Expected Response:</strong> 2-3 business days</p>
      </div>
      
      <h2>Partnership Opportunities</h2>
      <table class="table">
        <tr>
          <th>Program</th>
          <th>Benefits</th>
          <th>Commission/Discount</th>
        </tr>
        <tr>
          <td><strong>Reseller Program</strong></td>
          <td>White-label hosting, custom pricing, dedicated support</td>
          <td>Up to 40% margin</td>
        </tr>
        <tr>
          <td><strong>Affiliate Program</strong></td>
          <td>Marketing materials, tracking dashboard, monthly payouts</td>
          <td>20% recurring commission</td>
        </tr>
        <tr>
          <td><strong>Integration Partner</strong></td>
          <td>API access, co-marketing, technical support</td>
          <td>Revenue share</td>
        </tr>
        <tr>
          <td><strong>Agency Partner</strong></td>
          <td>Volume discounts, priority support, client management tools</td>
          <td>15-25% discount</td>
        </tr>
      </table>
      
      <h2>Next Steps</h2>
      <p>Our partnerships team will review your inquiry and reach out within 2-3 business days to discuss:</p>
      <ul>
        <li>Your business goals and requirements</li>
        <li>The best partnership program for your needs</li>
        <li>Pricing and commission structure</li>
        <li>Technical integration details (if applicable)</li>
        <li>Marketing support and co-branding opportunities</li>
      </ul>
      
      <a href="https://migrahosting.com/partners" class="button">Learn More About Partnerships</a>
      
      <p>We're excited about the possibility of working together!</p>
      
      <p><strong>MigraHosting Partnerships Team</strong></p>
    `;
    
    return getBaseTemplate('partnerships', 'Partnership Inquiry Received', content);
  },
  
  applicationApproved: (data) => {
    const content = `
      <h1>🎉 Partnership Application Approved!</h1>
      <p>Hi ${data.contactName},</p>
      <p>Congratulations! Your ${data.programType} application has been approved.</p>
      
      <div class="info-box">
        <h3>Partner Account Details</h3>
        <p><strong>Partner ID:</strong> ${data.partnerId}<br>
        <strong>Program:</strong> ${data.programType}<br>
        <strong>Commission Rate:</strong> ${data.commissionRate}<br>
        <strong>Account Manager:</strong> ${data.accountManager}<br>
        <strong>Activation Date:</strong> ${data.activationDate}</p>
      </div>
      
      <h2>Getting Started</h2>
      <ol>
        <li><strong>Activate Your Account</strong> - Set your password and complete your profile</li>
        <li><strong>Access Partner Portal</strong> - Dashboard with real-time analytics</li>
        <li><strong>Download Resources</strong> - Marketing materials and documentation</li>
      </ol>
      
      <a href="https://partners.migrahosting.com/activate/${data.activationCode}" class="button">Activate Partner Account</a>
      
      <h2>Your Benefits</h2>
      <table class="table">
        <tr>
          <th>Benefit</th>
          <th>Details</th>
        </tr>
        ${data.benefits.map(benefit => `
        <tr>
          <td><strong>${benefit.name}</strong></td>
          <td>${benefit.description}</td>
        </tr>
        `).join('')}
      </table>
      
      <p>Looking forward to a successful partnership!</p>
      
      <p><strong>${data.accountManager}</strong><br>
      Partner Account Manager</p>
    `;
    
    return getBaseTemplate('partnerships', 'Partnership Application Approved', content);
  }
};

/**
 * CAREERS TEMPLATES
 */
export const careersTemplates = {
  applicationReceived: (data) => {
    const content = `
      <h1>Application Received - Thank You!</h1>
      <p>Hi ${data.applicantName},</p>
      <p>Thank you for applying to join the MigraHosting team!</p>
      
      <div class="info-box">
        <h3>Application Details</h3>
        <p><strong>Position:</strong> ${data.position}<br>
        <strong>Department:</strong> ${data.department}<br>
        <strong>Location:</strong> ${data.location}<br>
        <strong>Application ID:</strong> ${data.applicationId}<br>
        <strong>Submitted:</strong> ${data.submittedAt}</p>
      </div>
      
      <h2>What Happens Next?</h2>
      <ol>
        <li><strong>Resume Review</strong> (1-2 weeks) - Our hiring team will review your application</li>
        <li><strong>Initial Screening</strong> (if selected) - Phone/video call for initial conversation</li>
        <li><strong>Technical Interview</strong> (if applicable) - Technical assessment or coding challenge</li>
        <li><strong>Team Interviews</strong> - Meet with team members and leadership</li>
        <li><strong>Offer</strong> - We'll extend an offer to the selected candidate</li>
      </ol>
      
      <a href="https://migrahosting.com/careers/application/${data.applicationId}" class="button">View Application Status</a>
      
      <p>Thank you again for your interest in MigraHosting!</p>
      
      <p><strong>MigraHosting Talent Team</strong></p>
    `;
    
    return getBaseTemplate('careers', `Application Received - ${data.position}`, content);
  },
  
  interviewScheduled: (data) => {
    const content = `
      <h1>Interview Scheduled 📅</h1>
      <p>Hi ${data.applicantName},</p>
      <p>Great news! We'd like to invite you for an interview for the ${data.position} position.</p>
      
      <div class="info-box">
        <h3>Interview Details</h3>
        <p><strong>Position:</strong> ${data.position}<br>
        <strong>Interview Type:</strong> ${data.interviewType}<br>
        <strong>Date:</strong> ${data.interviewDate}<br>
        <strong>Time:</strong> ${data.interviewTime} (${data.timezone})<br>
        <strong>Duration:</strong> ${data.duration}<br>
        ${data.location ? `<strong>Location:</strong> ${data.location}<br>` : ''}
        ${data.meetingLink ? `<strong>Video Link:</strong> <a href="${data.meetingLink}" style="color: ${departments.careers.color};">${data.meetingLink}</a><br>` : ''}
        <strong>Interviewer(s):</strong> ${data.interviewers.join(', ')}</p>
      </div>
      
      <h2>What to Expect</h2>
      <p>${data.interviewDescription}</p>
      
      ${data.preparation && data.preparation.length > 0 ? `
      <h2>How to Prepare</h2>
      <ul>
        ${data.preparation.map(item => `<li>${item}</li>`).join('')}
      </ul>
      ` : ''}
      
      <a href="${data.calendarLink || '#'}" class="button">Add to Calendar</a>
      
      <p>We're looking forward to meeting you!</p>
      
      <p><strong>MigraHosting Talent Team</strong></p>
    `;
    
    return getBaseTemplate('careers', 'Interview Scheduled', content);
  }
};

export default {
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
};
