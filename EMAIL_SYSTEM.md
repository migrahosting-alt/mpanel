# mPanel Email System Documentation

## Overview

mPanel includes a comprehensive, department-based email system with professionally designed templates for all customer communications. The system supports 7 departments with unique branding, contact information, and purpose-specific templates.

## Department Email Addresses

| Department | Email Address | Purpose | Availability |
|------------|---------------|---------|--------------|
| **Sales** | sales@migrahosting.com | Sales inquiries, quotes, demos, follow-ups | Mon-Fri, 9AM-6PM EST |
| **Billing** | billing@migrahosting.com | Invoices, payment confirmations, renewals | Mon-Fri, 9AM-6PM EST |
| **Support** | support@migrahosting.com | Technical support, ticket management | 24/7 |
| **Info** | info@migrahosting.com | General information, newsletters | Mon-Fri, 9AM-6PM EST |
| **Student** | student@migrahosting.com | Student program, educational discounts | Mon-Fri, 9AM-6PM EST |
| **Admin** | admin@migrahosting.com | Internal system notifications | Automated |
| **Alerts** | alerts@migrahosting.com | Security, downtime, usage alerts | 24/7 Automated |

## Email Templates

### Sales Templates

#### 1. Welcome Email
**Use Case**: First contact with prospects, introduce MigraHosting

```javascript
import { salesEmails } from '../services/emailService.js';

await salesEmails.sendWelcome('prospect@example.com', {
  firstName: 'John',
  ref: 'website-form',
  campaign: 'q4-2025'
});
```

**Features**:
- Professional welcome message
- Platform benefits overview
- Popular pricing plans table
- "Schedule a Demo" CTA button
- Quick links to features and pricing

#### 2. Custom Quote
**Use Case**: Send personalized quotes to prospects

```javascript
await salesEmails.sendQuote('prospect@example.com', {
  quoteId: 'Q-2025-001',
  customerName: 'John Doe',
  accountManager: 'Sarah Johnson',
  accountManagerEmail: 'sjohnson@migrahosting.com',
  directPhone: '+1 (555) 123-4567',
  validUntil: 'December 31, 2025',
  items: [
    {
      name: 'Business Hosting Plan',
      description: '5 websites, 50GB SSD, 500GB bandwidth',
      quantity: 1,
      price: 29.99
    },
    {
      name: 'Guardian AI Assistant',
      description: 'Professional tier with all tools',
      quantity: 1,
      price: 79.99
    }
  ],
  total: 109.98
});
```

**Features**:
- Quote reference number with badge
- Itemized pricing table
- Account manager contact info
- "Accept Quote" CTA button
- 30-day validity period

#### 3. Follow-Up Email
**Use Case**: Re-engage prospects after initial contact

```javascript
await salesEmails.sendFollowUp('prospect@example.com', {
  firstName: 'John',
  repName: 'Sarah Johnson',
  repId: 'REP-001',
  repEmail: 'sjohnson@migrahosting.com',
  directPhone: '+1 (555) 123-4567',
  demoScheduled: true,
  demoDate: 'November 20, 2025',
  demoTime: '2:00 PM EST'
});
```

### Billing Templates

#### 1. Invoice
**Use Case**: Monthly/annual billing, service invoices

```javascript
import { billingEmails } from '../services/emailService.js';

await billingEmails.sendInvoice('customer@example.com', {
  invoiceNumber: 'INV-2025-11-001',
  customerName: 'John Doe',
  billingPeriod: 'November 2025',
  issueDate: 'November 1, 2025',
  dueDate: 'November 15, 2025',
  items: [
    {
      description: 'Business Hosting Plan',
      period: 'Nov 1 - Nov 30, 2025',
      amount: 29.99
    },
    {
      description: 'Guardian AI Assistant - Professional',
      period: 'Nov 1 - Nov 30, 2025',
      amount: 79.99
    }
  ],
  total: 109.98,
  autoPayEnabled: true,
  lastFour: '4242'
});
```

**Features**:
- Invoice number with badge
- Itemized billing table
- Auto-pay status indicator
- "Pay Invoice" CTA button
- PDF download link
- Payment method display

#### 2. Payment Confirmation
**Use Case**: Confirm successful payment receipt

```javascript
await billingEmails.sendPaymentConfirmation('customer@example.com', {
  customerName: 'John Doe',
  amount: 109.98,
  paymentMethod: 'Visa ending in 4242',
  transactionId: 'TXN-20251115-001',
  paymentDate: 'November 15, 2025',
  invoiceNumber: 'INV-2025-11-001',
  services: [
    {
      name: 'Business Hosting Plan',
      nextBilling: 'December 1, 2025'
    },
    {
      name: 'Guardian AI Assistant',
      nextBilling: 'December 1, 2025'
    }
  ]
});
```

#### 3. Payment Failed
**Use Case**: Alert customer of failed payment, request action

```javascript
await billingEmails.sendPaymentFailed('customer@example.com', {
  customerName: 'John Doe',
  invoiceNumber: 'INV-2025-11-001',
  amount: 109.98,
  paymentMethod: 'Visa ending in 4242',
  failureReason: 'Card declined - insufficient funds',
  retryDate: 'November 18, 2025',
  suspensionDate: 'November 25, 2025'
});
```

**Features**:
- High priority alert styling
- Clear failure reason
- Action items (update payment, pay manually, contact bank)
- Automatic retry information
- Service suspension warning

#### 4. Renewal Reminder
**Use Case**: Remind customers of upcoming renewals

```javascript
await billingEmails.sendRenewalReminder('customer@example.com', {
  customerName: 'John Doe',
  renewalDate: 'December 1, 2025',
  renewals: [
    {
      service: 'Business Hosting Plan',
      date: 'December 1, 2025',
      amount: 29.99
    },
    {
      service: 'Guardian AI Assistant',
      date: 'December 1, 2025',
      amount: 79.99
    }
  ],
  total: 109.98,
  autoPayEnabled: true,
  lastFour: '4242'
});
```

### Support Templates

#### 1. Ticket Received
**Use Case**: Confirm support ticket creation

```javascript
import { supportEmails } from '../services/emailService.js';

await supportEmails.sendTicketReceived('customer@example.com', {
  ticketId: 'TKT-2025-001',
  customerName: 'John Doe',
  subject: 'Website not loading',
  priority: 'High',
  createdAt: 'November 15, 2025 at 2:30 PM',
  expectedResponse: '1 hour',
  message: 'My website example.com has been down for the past 30 minutes...'
});
```

**Features**:
- Ticket ID badge
- Priority level display
- Expected response time (Critical: 15min, High: 1hr, Normal: 4hr, Low: 24hr)
- Original message display
- "View Ticket" CTA button
- 24/7 phone support number

#### 2. Ticket Response
**Use Case**: Support agent responds to ticket

```javascript
await supportEmails.sendTicketResponse('customer@example.com', {
  ticketId: 'TKT-2025-001',
  customerName: 'John Doe',
  agentName: 'Mike Thompson',
  status: 'In Progress',
  respondedAt: 'November 15, 2025 at 2:45 PM',
  response: 'Thank you for contacting us. I\'ve checked your server and found the issue was caused by a PHP configuration error. I\'ve fixed it and your website is now loading correctly...',
  attachments: [
    {
      name: 'error-log.txt',
      url: 'https://migrahosting.com/attachments/abc123',
      size: '12.5 KB'
    }
  ]
});
```

#### 3. Ticket Resolved
**Use Case**: Mark ticket as resolved, request feedback

```javascript
await supportEmails.sendTicketResolved('customer@example.com', {
  ticketId: 'TKT-2025-001',
  customerName: 'John Doe',
  subject: 'Website not loading',
  resolvedBy: 'Mike Thompson',
  resolutionTime: '15 minutes',
  closedAt: 'November 15, 2025 at 2:45 PM'
});
```

**Features**:
- Resolution summary
- 5-star rating links
- Reopen ticket option (reply to email)
- Agent name and resolution time

### Info Templates

#### 1. General Inquiry
**Use Case**: Auto-response to general contact form submissions

```javascript
import { infoEmails } from '../services/emailService.js';

await infoEmails.sendGeneralInquiry('prospect@example.com', {
  name: 'Jane Smith',
  inquiryId: 'INQ-2025-001',
  receivedAt: 'November 15, 2025 at 3:00 PM'
});
```

**Features**:
- Thank you message
- Reference number for tracking
- 24-hour response guarantee
- Quick links to knowledge base, tutorials, community, status page
- Resource table with clickable links

#### 2. Newsletter
**Use Case**: Monthly newsletters, product updates, announcements

```javascript
await infoEmails.sendNewsletter('subscriber@example.com', {
  firstName: 'Jane',
  title: 'November 2025 Product Updates',
  intro: 'We\'re excited to share what\'s new at MigraHosting this month!',
  sections: [
    {
      title: 'New Feature: Guardian AI Assistant',
      content: 'Meet Abigail, your AI-powered support assistant. Available 24/7 to help with DNS, user management, and backups.',
      image: 'https://migrahosting.com/images/guardian-hero.jpg',
      link: 'https://migrahosting.com/guardian'
    },
    {
      title: 'Domain Pricing Update',
      content: 'We\'ve updated our domain pricing with automatic margin adjustments from NameSilo.',
      link: 'https://migrahosting.com/domains'
    }
  ],
  unsubscribeToken: 'unsub-abc123xyz'
});
```

**Features**:
- Dynamic sections with optional images
- Read more links
- Social media links
- Unsubscribe link in footer

### Student Templates

#### 1. Welcome to Student Program
**Use Case**: Approve student application, provide activation code

```javascript
import { studentEmails } from '../services/emailService.js';

await studentEmails.sendWelcome('student@university.edu', {
  firstName: 'Alex',
  activationCode: 'STUDENT-2025-ABC123',
  expirationDate: 'November 15, 2026'
});
```

**Features**:
- Student benefits checklist (50% off, free domain, priority support)
- Student pricing table (50% discount on all plans)
- Learning resources section
- Verification requirements
- "Activate Account" CTA button

#### 2. Student Renewal
**Use Case**: Remind students to verify status for continued discount

```javascript
await studentEmails.sendRenewal('student@university.edu', {
  firstName: 'Alex',
  expirationDate: 'November 15, 2026'
});
```

**Features**:
- Renewal requirements (upload student ID, enrollment letter, or transcript)
- Step-by-step renewal process
- What happens if not renewed
- "Renew Now" CTA button

### Admin Templates

#### 1. User Created
**Use Case**: Internal notification when new user account is created

```javascript
import { adminEmails } from '../services/emailService.js';

await adminEmails.sendUserCreated('admin@migrahosting.com', {
  userId: 'uuid-abc-123',
  email: 'newuser@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'customer',
  tenantId: 'tenant-001',
  createdAt: 'November 15, 2025 at 3:30 PM',
  createdBy: 'System'
});
```

#### 2. System Report
**Use Case**: Automated daily/weekly/monthly system reports

```javascript
await adminEmails.sendSystemReport('admin@migrahosting.com', {
  reportType: 'Daily Usage',
  reportId: 'RPT-2025-11-15',
  generatedAt: 'November 15, 2025 at 11:59 PM',
  metrics: {
    'Total Users': '1,234',
    'Active Websites': '567',
    'Total Revenue': '$12,345.67',
    'Support Tickets': '45 (12 open)',
    'Server Uptime': '99.98%'
  },
  alerts: [
    'Server CPU usage exceeded 80% threshold',
    '3 payment failures require attention'
  ],
  csvAttachment: '/path/to/report.csv'
});
```

### Alerts Templates

#### 1. Security Alert
**Use Case**: Critical security events (failed logins, suspicious activity)

```javascript
import { alertEmails } from '../services/emailService.js';

await alertEmails.sendSecurityAlert('admin@migrahosting.com', {
  alertId: 'SEC-2025-001',
  alertType: 'Multiple Failed Login Attempts',
  severity: 'critical',
  detectedAt: 'November 15, 2025 at 4:00 PM',
  resource: 'User Account: admin@migrahosting.com',
  status: 'Active',
  description: 'We detected 10 failed login attempts from IP 192.168.1.100 in the last 5 minutes.',
  impact: [
    'Account may be under brute force attack',
    'Temporary IP ban has been applied',
    'User may be locked out temporarily'
  ],
  recommendations: [
    'Review security logs for IP 192.168.1.100',
    'Verify user identity before unlocking account',
    'Consider enabling 2FA for this account',
    'Monitor for additional suspicious activity'
  ]
});
```

**Features**:
- Red alert styling
- Severity badge (critical/high/medium/low)
- Impact analysis
- Recommended actions
- "Review Alert" CTA button
- security@migrahosting.com contact

#### 2. System Downtime
**Use Case**: Scheduled maintenance or unplanned outage notifications

```javascript
await alertEmails.sendSystemDowntime('customer@example.com', {
  title: 'Scheduled Maintenance - November 20, 2025',
  isScheduled: true,
  startTime: 'November 20, 2025 at 2:00 AM EST',
  duration: '2 hours',
  affectedServices: ['Web Hosting', 'Email', 'DNS'],
  status: 'Scheduled',
  description: 'We will be performing critical database upgrades to improve performance and reliability.',
  impacts: [
    'Websites may be temporarily unavailable',
    'Email delivery may be delayed',
    'DNS changes may take longer to propagate'
  ],
  workaround: 'Use our status page for real-time updates during maintenance.',
  incidentId: 'INC-2025-001'
});
```

#### 3. Usage Alert
**Use Case**: Resource usage thresholds (bandwidth, storage, etc.)

```javascript
await alertEmails.sendUsageAlert('customer@example.com', {
  customerName: 'John Doe',
  resourceType: 'Bandwidth',
  currentUsage: '450 GB',
  limit: '500 GB',
  percentage: 90,
  severity: 'warning',
  service: 'Business Hosting Plan'
});
```

**Features**:
- Usage percentage display
- Current usage vs limit
- Severity-based styling (warning at 80%, critical at 95%)
- Upgrade options
- Usage optimization tips

#### 4. Backup Status
**Use Case**: Notify about backup completion or failure

```javascript
await alertEmails.sendBackupStatus('customer@example.com', {
  customerName: 'John Doe',
  backupId: 'BKP-2025-11-15-001',
  backupType: 'Daily Automated',
  success: true,
  startTime: 'November 15, 2025 at 3:00 AM',
  endTime: 'November 15, 2025 at 3:15 AM',
  duration: '15 minutes',
  backupSize: '2.5 GB',
  location: 'US-East-1 Storage',
  contents: [
    'All website files (1.2 GB)',
    'All databases (800 MB)',
    'Email accounts (500 MB)'
  ]
});
```

## Email Service API

### Basic Usage

```javascript
import emailService, { 
  salesEmails, 
  billingEmails, 
  supportEmails 
} from './services/emailService.js';

// Send a sales welcome email
await salesEmails.sendWelcome('prospect@example.com', { firstName: 'John' });

// Send an invoice
await billingEmails.sendInvoice('customer@example.com', invoiceData);

// Send ticket confirmation
await supportEmails.sendTicketReceived('customer@example.com', ticketData);
```

### Generic Send

```javascript
import { sendDepartmentEmail } from './services/emailService.js';

await sendDepartmentEmail(
  'sales',           // department
  'to@example.com',  // recipient
  'Custom Subject',  // subject
  'welcome',         // template name
  { firstName: 'John' }, // data
  { cc: 'manager@migrahosting.com' } // options
);
```

### Test Email Connection

```javascript
import { testEmailConnection } from './services/emailService.js';

const result = await testEmailConnection();
if (result.success) {
  console.log('Email configured correctly!');
} else {
  console.error('Email error:', result.error);
}
```

## Environment Variables

Add to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Or use SendGrid directly
SENDGRID_API_KEY=your-sendgrid-api-key

# From address
SMTP_FROM=MigraHosting <noreply@migrahosting.com>

# Department emails (optional, defaults in code)
EMAIL_SALES=sales@migrahosting.com
EMAIL_BILLING=billing@migrahosting.com
EMAIL_SUPPORT=support@migrahosting.com
EMAIL_INFO=info@migrahosting.com
EMAIL_STUDENT=student@migrahosting.com
EMAIL_ADMIN=admin@migrahosting.com
EMAIL_ALERTS=alerts@migrahosting.com
```

## Integration Examples

### Sales Flow (New Prospect)

```javascript
// 1. Lead captures through website form
const leadData = {
  email: 'prospect@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp',
  phone: '+1 (555) 123-4567'
};

// 2. Send welcome email
await salesEmails.sendWelcome(leadData.email, {
  firstName: leadData.firstName,
  ref: 'website-contact-form',
  campaign: 'inbound-leads-2025'
});

// 3. Sales rep creates quote
const quoteData = {
  quoteId: 'Q-2025-001',
  customerName: `${leadData.firstName} ${leadData.lastName}`,
  accountManager: 'Sarah Johnson',
  // ... items, total, etc.
};

await salesEmails.sendQuote(leadData.email, quoteData);

// 4. Follow-up in 3 days if no response
setTimeout(async () => {
  await salesEmails.sendFollowUp(leadData.email, {
    firstName: leadData.firstName,
    repName: 'Sarah Johnson',
    repId: 'REP-001'
  });
}, 3 * 24 * 60 * 60 * 1000);
```

### Billing Flow (Monthly Invoicing)

```javascript
// 1. Generate invoice
const invoice = await createInvoice(customerId);

// 2. Send invoice email
await billingEmails.sendInvoice(customer.email, {
  invoiceNumber: invoice.id,
  customerName: customer.name,
  // ... invoice details
  autoPayEnabled: customer.autopay,
  lastFour: customer.payment_method.last4
});

// 3. Process payment (if auto-pay)
if (customer.autopay) {
  const payment = await processPayment(invoice.id);
  
  if (payment.success) {
    // Send confirmation
    await billingEmails.sendPaymentConfirmation(customer.email, {
      customerName: customer.name,
      amount: payment.amount,
      // ... payment details
    });
  } else {
    // Send failure notification
    await billingEmails.sendPaymentFailed(customer.email, {
      customerName: customer.name,
      invoiceNumber: invoice.id,
      failureReason: payment.error,
      // ... retry details
    });
  }
}
```

### Support Flow (Ticket Lifecycle)

```javascript
// 1. Customer creates ticket
const ticket = await createSupportTicket({
  customerId: customer.id,
  subject: 'Website not loading',
  message: 'My website example.com has been down...',
  priority: 'high'
});

// 2. Send confirmation
await supportEmails.sendTicketReceived(customer.email, {
  ticketId: ticket.id,
  customerName: customer.name,
  subject: ticket.subject,
  priority: ticket.priority,
  message: ticket.message,
  // ...
});

// 3. Agent responds
const response = await addTicketResponse(ticket.id, {
  agentId: 'agent-001',
  message: 'I\'ve identified the issue...'
});

await supportEmails.sendTicketResponse(customer.email, {
  ticketId: ticket.id,
  agentName: response.agent.name,
  response: response.message,
  // ...
});

// 4. Ticket resolved
await markTicketResolved(ticket.id);

await supportEmails.sendTicketResolved(customer.email, {
  ticketId: ticket.id,
  subject: ticket.subject,
  resolvedBy: response.agent.name,
  resolutionTime: '15 minutes'
});
```

### Alert Flow (Usage Monitoring)

```javascript
// Scheduled job runs every hour
cron.schedule('0 * * * *', async () => {
  const customers = await getCustomersNearLimit();
  
  for (const customer of customers) {
    const usage = await getResourceUsage(customer.id);
    
    if (usage.percentage >= 90) {
      await alertEmails.sendUsageAlert(customer.email, {
        customerName: customer.name,
        resourceType: usage.type,
        currentUsage: usage.current,
        limit: usage.limit,
        percentage: usage.percentage,
        severity: usage.percentage >= 95 ? 'critical' : 'warning',
        service: customer.plan_name
      });
    }
  }
});
```

## Template Customization

All templates are in `src/services/emailTemplates.js`. To customize:

1. **Colors**: Change department colors in the `departments` object
2. **Content**: Edit template functions (e.g., `salesTemplates.welcome`)
3. **Styling**: Modify the `getBaseTemplate()` function for global styles
4. **Logo**: Replace MigraHosting text with `<img>` tag in header
5. **Footer**: Edit footer section in `getBaseTemplate()`

Example custom color:

```javascript
export const departments = {
  sales: {
    email: 'sales@migrahosting.com',
    color: '#FF6B35', // Change to your brand color
    // ...
  }
};
```

## Best Practices

1. **Test Before Production**: Always test emails with `testEmailConnection()` first
2. **Personalize**: Use customer names, account details for better engagement
3. **Track Opens/Clicks**: Use SendGrid or similar for analytics
4. **Unsubscribe Links**: Required for newsletters (already included)
5. **Mobile Responsive**: All templates are mobile-friendly by default
6. **Plain Text Fallback**: Consider adding plain text versions for accessibility
7. **Rate Limiting**: Don't send too many emails at once (use queues)
8. **Error Handling**: Always wrap email sends in try/catch
9. **Logging**: All emails are logged with messageId for debugging

## Troubleshooting

**Emails not sending?**
- Check SMTP credentials in `.env`
- Verify firewall allows outbound port 587
- Run `testEmailConnection()` to diagnose
- Check logs: `logs/mpanel.log`

**Emails going to spam?**
- Add SPF record: `v=spf1 include:sendgrid.net ~all`
- Add DKIM (configure in SendGrid)
- Add DMARC record
- Use verified sender domain

**Template rendering issues?**
- Check data object has all required fields
- Review browser console for HTML errors
- Test with minimal data first

## Support

For email system issues:
- Check logs: `src/logs/mpanel.log`
- Review SMTP errors in console
- Contact: support@migrahosting.com
- Docs: https://migrahosting.com/docs/email

---

**Last Updated**: November 17, 2025  
**Version**: 1.0.0  
**mPanel Email System** - Professional communications for all departments
