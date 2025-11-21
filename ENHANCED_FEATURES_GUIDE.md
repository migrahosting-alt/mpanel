# Enhanced Features Implementation Guide

## Overview

This document covers all the enhanced features added to mPanel, including email queues, notification preferences, onboarding automation, CSAT surveys, audit logging, referral system, knowledge base, white labeling, and session management.

## Features Added

### 1. Email & SMS Queue System

**Purpose**: Background processing for reliable email/SMS delivery with retry logic.

**Database Tables**:
- `email_queue` - Queued emails with status tracking
- `sms_queue` - Queued SMS messages
- `email_analytics` - Email engagement tracking

**Service**: `src/services/queueService.js` (enhanced existing file)

**Key Functions**:
```javascript
import { queueEmail, queueSMS, getQueueStats } from './services/queueService.js';

// Queue an email
await queueEmail({
  tenantId,
  from: 'billing@migrahosting.com',
  to: 'customer@example.com',
  subject: 'Invoice #12345',
  html: invoiceHtml,
  department: 'billing',
  template: 'invoice',
  priority: 5, // 1 (highest) to 10 (lowest)
  scheduledFor: futureDate, // Optional
  attachments: [{filename: 'invoice.pdf', path: '/tmp/invoice.pdf'}],
});

// Queue an SMS
await queueSMS({
  tenantId,
  userId,
  to: '+1234567890',
  message: 'Your server is experiencing high load',
  purpose: 'alert',
  priority: 1, // High priority for alerts
});

// Get queue statistics
const stats = await getQueueStats();
```

**Environment Variables**:
```env
# Twilio for SMS
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Bull Queue (uses existing Redis)
REDIS_HOST=localhost
REDIS_PORT=6380
```

**Features**:
- Automatic retry with exponential backoff (3 attempts)
- Priority-based processing
- Scheduled delivery
- Attachment support
- Provider response tracking
- Analytics integration

---

### 2. Notification Preferences

**Purpose**: Let customers control how and when they receive notifications.

**Database Table**: `notification_preferences`

**Service**: `src/services/notificationPreferencesService.js`

**Key Functions**:
```javascript
import notificationPrefs from './services/notificationPreferencesService.js';

// Get user preferences
const prefs = await notificationPrefs.getUserPreferences(userId);

// Update preferences
await notificationPrefs.updatePreferences(userId, {
  emailEnabled: true,
  smsEnabled: true,
  billingNotifications: {
    email: true,
    sms: false,
    frequency: 'instant' // instant, daily, weekly
  },
  marketingNotifications: {
    email: false, // Unsubscribed from marketing
    sms: false,
    frequency: 'never'
  },
  phoneNumber: '+1234567890',
});

// Check if should notify before sending
const shouldSend = await notificationPrefs.shouldNotify(userId, 'billing', 'email');
if (shouldSend) {
  await queueEmail({...});
}

// Verify phone number
await notificationPrefs.sendPhoneVerification(userId, '+1234567890');
await notificationPrefs.verifyPhoneNumber(userId, '123456'); // 6-digit code
```

**Categories**:
- `billing_notifications` - Invoices, payments, renewals
- `support_notifications` - Ticket updates
- `marketing_notifications` - Newsletters, promotions
- `security_notifications` - Login alerts, 2FA
- `product_updates` - New features, maintenance

---

### 3. Onboarding Automation

**Purpose**: Automated drip campaigns to improve customer activation and retention.

**Database Tables**:
- `onboarding_sequences` - Sequence definitions
- `onboarding_progress` - User progress tracking

**Service**: `src/services/onboardingService.js`

**Usage**:
```javascript
import onboarding from './services/onboardingService.js';

// Create custom sequence
await onboarding.createSequence({
  tenantId,
  name: 'New Customer Welcome',
  description: 'Welcome new customers and help them get started',
  triggerEvent: 'user_created',
  steps: [
    { day: 0, template: 'welcome', channel: 'email', name: 'Welcome Email' },
    { day: 1, template: 'getting_started', channel: 'email', name: 'Getting Started' },
    { day: 3, template: 'tips', channel: 'email', name: 'Tips & Tricks' },
    { day: 7, template: 'upgrade', channel: 'email', name: 'Upgrade Offer' },
  ],
});

// Trigger sequence when event occurs
await onboarding.triggerEvent('user_created', userId, tenantId);

// Get user progress
const progress = await onboarding.getUserProgress(userId);

// Pause/resume sequence
await onboarding.pauseSequence(userId, sequenceId);
await onboarding.resumeSequence(userId, sequenceId);
```

**Pre-built Sequences**:
- New Customer Welcome (5 steps over 14 days)
- Trial to Paid Conversion (5 steps over 13 days)

**Cron Job**:
Run daily to process scheduled sequences:
```javascript
import onboarding from './services/onboardingService.js';

// In cron job or background worker
await onboarding.processScheduledSequences();
```

---

### 4. CSAT & NPS Surveys

**Purpose**: Measure customer satisfaction and track Net Promoter Score.

**Database Table**: `csat_surveys`

**Service**: `src/services/csatService.js`

**Usage**:
```javascript
import csat from './services/csatService.js';

// Send survey after support ticket
await csat.sendTicketSurvey(ticketId, userId, tenantId);

// Send custom survey
await csat.sendSurvey({
  tenantId,
  userId,
  surveyType: 'nps', // nps, support_ticket, product, onboarding
  referenceId: orderId,
  referenceType: 'order',
});

// Customer submits response
await csat.submitResponse(surveyId, score, 'Great service!');

// Get metrics
const metrics = await csat.getMetrics(tenantId, 30); // Last 30 days
// Returns: { metrics, nps: 42, period: '30 days' }

// Get surveys needing follow-up (score <= 3)
const followUps = await csat.getFollowUpRequired(tenantId);

// Mark follow-up complete
await csat.completeFollowUp(surveyId, 'Called customer, issue resolved');

// Send quarterly NPS surveys to all active customers
await csat.sendNPSSurveys(tenantId);
```

**Survey Types**:
- **CSAT** (Customer Satisfaction): 1-5 scale, sent after support interactions
- **NPS** (Net Promoter Score): 0-10 scale, sent quarterly to measure loyalty
- **Product**: General product satisfaction
- **Onboarding**: Onboarding experience feedback

**Auto-notifications**:
- Negative feedback (score <= 3) automatically notifies support team
- Follow-up dashboard for support team to address concerns

---

### 5. Audit Logging

**Purpose**: Comprehensive compliance logging for security and regulations.

**Database Table**: `audit_logs`

**Service**: `src/services/auditService.js`

**Usage**:
```javascript
import audit, { ACTIONS } from './services/auditService.js';

// Manual logging
await audit.logAudit({
  tenantId: req.user.tenantId,
  userId: req.user.id,
  userEmail: req.user.email,
  userRole: req.user.role,
  action: ACTIONS.USER_CREATED,
  resourceType: 'user',
  resourceId: newUser.id,
  description: 'Created new user account',
  changes: {
    before: null,
    after: { email: newUser.email, role: newUser.role }
  },
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
  severity: 'info', // debug, info, warning, error, critical
  gdprRelevant: true,
  pciRelevant: false,
});

// Auto-logging middleware (add to server.js)
import { auditMiddleware } from './services/auditService.js';
app.use(auditMiddleware); // Logs all API requests

// Get audit logs
const { logs, total } = await audit.getAuditLogs({
  tenantId,
  userId: specificUser,
  action: ACTIONS.USER_LOGIN,
  severity: 'critical',
  startDate: '2025-01-01',
  endDate: '2025-12-31',
  limit: 100,
  offset: 0,
});

// Get statistics
const stats = await audit.getAuditStats(tenantId, 30);

// Export for compliance
const logsCSV = await audit.exportAuditLogs(tenantId, startDate, endDate, 'csv');
const logsJSON = await audit.exportAuditLogs(tenantId, startDate, endDate, 'json');
```

**Compliance Features**:
- GDPR-relevant flag for data access/deletion
- PCI-relevant flag for payment operations
- Immutable logs (no updates, only inserts)
- Detailed change tracking (before/after states)
- IP address and user agent capture
- Severity levels for alerting

---

### 6. Referral System

**Purpose**: Customer referral program with commission tracking.

**Database Table**: `referrals`

**Service**: `src/services/referralService.js`

**Usage**:
```javascript
import referral from './services/referralService.js';

// Create referral code for user
const ref = await referral.createReferral(userId, tenantId);
// Returns: { referral_code: 'A3F2B8E1', ... }

// Share referral link
const referralUrl = `${APP_URL}/signup?ref=${ref.referral_code}`;

// Track click
await referral.trackClick(referralCode, req.ip);

// When referred user signs up
await referral.processSignup(referralCode, newUserId, newUserEmail);
// Auto-sends email to referrer

// When referred user makes first payment
await referral.processConversion(referredUserId, 25.00); // $25 commission
// Auto-sends commission notification to referrer

// Get user's referrals
const { referrals, stats } = await referral.getUserReferrals(userId);
// stats: { total_referrals, completed, total_clicks, total_commission, pending_commission }

// Admin: Mark commission as paid
await referral.markCommissionPaid(referralId);

// Get tenant statistics
const stats = await referral.getReferralStats(tenantId);
```

**Commission Settings**:
Customize per tenant:
- `commission_type`: 'percentage' or 'fixed'
- `commission_amount`: Amount or percentage
- `commission_status`: 'pending' → 'approved' → 'paid'

**Integration Example**:
```javascript
// In user registration
if (req.body.referralCode) {
  await referral.processSignup(req.body.referralCode, newUser.id, newUser.email);
}

// In payment success webhook
await referral.processConversion(userId, 25.00); // Fixed $25 or calculate percentage
```

---

### 7. Knowledge Base

**Purpose**: Self-service help articles with full-text search.

**Database Table**: `kb_articles`

**Service**: `src/services/knowledgeBaseService.js`

**Usage**:
```javascript
import kb from './services/knowledgeBaseService.js';

// Create article
const article = await kb.createArticle({
  tenantId,
  authorId: userId,
  title: 'How to Deploy a Website',
  content: '# Deployment Guide\n\n...',
  excerpt: 'Learn how to deploy your website in 5 minutes',
  categoryId: null,
  tags: ['deployment', 'tutorial', 'beginner'],
  status: 'draft', // draft, published, archived
  metaTitle: 'Deploy Website - MigraHosting Help',
  metaDescription: 'Step-by-step guide...',
});

// Publish article
await kb.updateArticle(article.id, { status: 'published' });

// Search articles (full-text search)
const results = await kb.searchArticles('domain ssl certificate', {
  tenantId,
  status: 'published',
  limit: 10,
});

// Get article by slug
const article = await kb.getArticle('how-to-deploy-a-website');

// Vote on helpfulness
await kb.voteArticle(articleId, true); // helpful
await kb.voteArticle(articleId, false); // not helpful

// Get popular articles
const popular = await kb.getPopularArticles(tenantId, 10);

// Get articles by tag
const tutorials = await kb.getArticlesByTag('tutorial', tenantId);

// Get statistics
const stats = await kb.getKBStats(tenantId);
```

**Features**:
- Full-text search with PostgreSQL `tsvector`
- Auto-generated slugs from titles
- View tracking
- Helpfulness voting
- Tag system
- SEO meta fields
- Category organization

**Frontend Integration**:
```javascript
// Public help center
GET /api/kb/articles?search=domain&limit=10

// Article page
GET /api/kb/articles/how-to-deploy-a-website

// Submit vote
POST /api/kb/articles/:id/vote { helpful: true }
```

---

### 8. White Label / Branding

**Purpose**: Per-tenant customization for resellers and agencies.

**Database Table**: `white_label_settings`

**Service**: `src/services/whiteLabelService.js`

**Usage**:
```javascript
import whiteLabel from './services/whiteLabelService.js';

// Get tenant settings
const settings = await whiteLabel.getSettings(tenantId);

// Update branding
await whiteLabel.updateSettings(tenantId, {
  companyName: 'Acme Hosting',
  logoUrl: 'https://example.com/logo.png',
  logoDarkUrl: 'https://example.com/logo-dark.png',
  faviconUrl: 'https://example.com/favicon.ico',
  primaryColor: '#FF6B35',
  secondaryColor: '#004E89',
  accentColor: '#1A936F',
  customDomain: 'hosting.acme.com',
  emailFromName: 'Acme Hosting',
  emailFromAddress: 'noreply@acme.com',
  portalTitle: 'Acme Hosting Portal',
  portalWelcomeMessage: 'Welcome to your hosting dashboard!',
  supportEmail: 'support@acme.com',
  supportPhone: '+1-800-ACME',
  customCss: '.btn-primary { background: #FF6B35; }',
});

// Verify custom domain
await whiteLabel.verifyCustomDomain(tenantId, 'hosting.acme.com');

// Get branding CSS
const css = await whiteLabel.getBrandingCSS(tenantId);

// Upload logo
await whiteLabel.uploadLogo(tenantId, logoFile, 'light');
await whiteLabel.uploadLogo(tenantId, logoDarkFile, 'dark');
```

**Email Integration**:
Replace default MigraHosting branding in emails:
```javascript
const settings = await whiteLabel.getSettings(tenantId);

// Use custom branding
const fromName = settings.email_from_name || 'MigraHosting';
const fromEmail = settings.email_from_address || 'noreply@migrahosting.com';
const logoUrl = settings.logo_url || defaultLogo;
```

**Frontend Integration**:
```javascript
// Inject branding CSS
<link rel="stylesheet" href="/api/white-label/css" />

// Use custom favicon
<link rel="icon" href={settings.faviconUrl} />

// Custom portal title
<title>{settings.portalTitle || 'MigraHosting'}</title>
```

---

### 9. Session Management

**Purpose**: Track user sessions across devices with security monitoring.

**Database Table**: `user_sessions`

**Service**: `src/services/sessionService.js`

**Usage**:
```javascript
import session from './services/sessionService.js';

// Create session on login
const deviceInfo = session.parseDeviceInfo(req.get('user-agent'));
const newSession = await session.createSession(
  userId,
  tenantId,
  deviceInfo,
  req.ip
);

// Get user's active sessions
const sessions = await session.getUserSessions(userId);
// Returns: [{ device_name: 'Chrome on Windows', ip_address, last_activity_at, ... }]

// Update activity (call on each request)
await session.updateActivity(sessionToken);

// Terminate specific session
await session.terminateSession(sessionId, userId);

// Logout from all devices (except current)
await session.terminateAllSessions(userId, currentSessionId);

// Detect suspicious activity
const { suspicious, reasons } = await session.detectSuspiciousActivity(
  userId,
  req.ip,
  req.get('user-agent')
);

if (suspicious) {
  // Send security alert
  await alertEmails.sendSecurityAlert(user.email, {
    alertType: 'Suspicious Login',
    details: reasons.join(', '),
  });
}

// Clean expired sessions (cron job)
await session.cleanExpiredSessions();

// Get session statistics
const stats = await session.getSessionStats(tenantId);
```

**Security Features**:
- Multi-device tracking
- Suspicious activity detection (new IPs, multiple countries)
- Session expiration (7 days default)
- Force logout all devices
- Device fingerprinting
- Activity timestamp tracking

**Frontend Integration**:
```javascript
// Show active sessions to user
GET /api/sessions

// Logout from specific device
DELETE /api/sessions/:id

// Logout all devices
DELETE /api/sessions/all
```

---

## Installation

### 1. Install Dependencies

```bash
npm install bull twilio
```

### 2. Run Migrations

```bash
docker cp prisma/migrations/20251117_add_notification_system/migration.sql mpanel-postgres:/tmp/migration.sql
docker exec mpanel-postgres psql -U mpanel -d mpanel -f /tmp/migration.sql
```

### 3. Update Environment Variables

Add to `.env`:

```env
# Twilio SMS
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Email queue uses existing REDIS and SMTP settings

# App URL for links in emails
APP_URL=https://panel.migrahosting.com
```

### 4. Start Queue Workers

The queue workers start automatically with the existing queueService.js. No additional processes needed.

### 5. Setup Cron Jobs

Add to your cron scheduler (or use node-cron):

```javascript
import cron from 'node-cron';
import onboarding from './services/onboardingService.js';
import session from './services/sessionService.js';
import csat from './services/csatService.js';

// Process onboarding sequences daily at 10 AM
cron.schedule('0 10 * * *', async () => {
  await onboarding.processScheduledSequences();
});

// Clean expired sessions daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  await session.cleanExpiredSessions();
});

// Send quarterly NPS surveys (1st of every quarter)
cron.schedule('0 10 1 */3 *', async () => {
  await csat.sendNPSSurveys(tenantId);
});
```

---

## Integration Examples

### Example 1: User Registration with Onboarding

```javascript
// In user registration controller
async function register(req, res) {
  const user = await createUser(req.body);
  
  // Create notification preferences
  await notificationPrefs.createDefaultPreferences(user.id, user.tenant_id);
  
  // Create referral code
  await referral.createReferral(user.id, user.tenant_id);
  
  // Start onboarding sequence
  await onboarding.triggerEvent('user_created', user.id, user.tenant_id);
  
  // Log audit event
  await audit.logAudit({
    tenantId: user.tenant_id,
    userId: user.id,
    action: ACTIONS.USER_CREATED,
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: req.ip,
  });
  
  res.json({ user });
}
```

### Example 2: Support Ticket Resolution with CSAT

```javascript
// When ticket is resolved
async function resolveTicket(req, res) {
  await updateTicket(ticketId, { status: 'resolved' });
  
  // Send CSAT survey
  await csat.sendTicketSurvey(ticketId, userId, tenantId);
  
  res.json({ success: true });
}
```

### Example 3: Invoice Creation with Queue

```javascript
// When creating invoice
async function createInvoice(req, res) {
  const invoice = await generateInvoice(customerId);
  
  // Check notification preferences
  const shouldEmail = await notificationPrefs.shouldNotify(
    invoice.user_id,
    'billing',
    'email'
  );
  
  if (shouldEmail) {
    await queueEmail({
      tenantId: invoice.tenant_id,
      from: process.env.EMAIL_BILLING,
      to: invoice.customer_email,
      subject: `Invoice #${invoice.id}`,
      html: billingTemplates.invoice(invoiceData),
      department: 'billing',
      template: 'invoice',
      priority: 4,
      attachments: [{ filename: 'invoice.pdf', path: invoice.pdf_path }],
    });
  }
  
  res.json({ invoice });
}
```

### Example 4: First Payment with Referral Commission

```javascript
// When payment succeeds
async function handlePaymentSuccess(paymentIntent) {
  const userId = paymentIntent.metadata.user_id;
  
  // Process referral commission
  await referral.processConversion(userId, 25.00); // $25 commission
  
  // Send payment confirmation
  await queueEmail({...});
  
  // Log audit event
  await audit.logAudit({
    action: ACTIONS.INVOICE_PAID,
    resourceType: 'invoice',
    pciRelevant: true,
  });
}
```

---

## API Endpoints (To Be Created)

### Notification Preferences

```
GET    /api/notification-preferences          Get current user preferences
PUT    /api/notification-preferences          Update preferences
POST   /api/notification-preferences/verify   Send phone verification
POST   /api/notification-preferences/confirm  Verify phone with code
POST   /api/notification-preferences/unsubscribe/:category  Unsubscribe
```

### CSAT Surveys

```
GET    /api/surveys                   Get surveys for current user
POST   /api/surveys/:id/respond       Submit survey response
GET    /api/admin/surveys             Get all surveys (admin)
GET    /api/admin/surveys/metrics     Get CSAT/NPS metrics
GET    /api/admin/surveys/followups   Get surveys needing follow-up
POST   /api/admin/surveys/:id/followup Complete follow-up
```

### Referrals

```
GET    /api/referrals                 Get current user's referrals
GET    /api/referrals/stats           Get referral statistics
POST   /api/referrals/track/:code     Track referral click
```

### Knowledge Base

```
GET    /api/kb/articles               Search articles
GET    /api/kb/articles/:slug         Get article by slug
POST   /api/kb/articles/:id/vote      Vote on article
GET    /api/kb/popular                Get popular articles
GET    /api/kb/tags/:tag              Get articles by tag
POST   /api/admin/kb/articles         Create article (admin)
PUT    /api/admin/kb/articles/:id     Update article (admin)
```

### White Label

```
GET    /api/white-label               Get current tenant settings
PUT    /api/white-label               Update settings (admin)
GET    /api/white-label/css           Get branding CSS
POST   /api/white-label/logo          Upload logo (admin)
POST   /api/white-label/verify-domain Verify custom domain
```

### Sessions

```
GET    /api/sessions                  Get current user sessions
DELETE /api/sessions/:id              Terminate specific session
DELETE /api/sessions/all              Logout all devices
GET    /api/admin/sessions/stats      Get session statistics
```

### Audit Logs

```
GET    /api/admin/audit               Get audit logs (admin)
GET    /api/admin/audit/stats         Get audit statistics
GET    /api/admin/audit/export        Export audit logs
```

---

## Performance Considerations

### Indexing

All tables have proper indexes created in the migration. Key indexes:

- `email_queue`: status, scheduled_for, priority
- `audit_logs`: tenant_id, user_id, action, created_at
- `kb_articles`: search_vector (GIN index for full-text search)
- `user_sessions`: user_id + active, session_token, expires_at

### Queue Processing

- Bull queue uses Redis for job storage
- Concurrent processing: 5 jobs at a time
- Automatic retry with exponential backoff
- Failed jobs kept for 30 days for debugging

### Caching Recommendations

```javascript
// Cache notification preferences (5 minutes)
const prefs = await redis.get(`prefs:${userId}`);
if (!prefs) {
  prefs = await notificationPrefs.getUserPreferences(userId);
  await redis.setex(`prefs:${userId}`, 300, JSON.stringify(prefs));
}

// Cache white label settings (1 hour)
const settings = await redis.get(`wl:${tenantId}`);
if (!settings) {
  settings = await whiteLabel.getSettings(tenantId);
  await redis.setex(`wl:${tenantId}`, 3600, JSON.stringify(settings));
}
```

---

## Testing

### Queue Testing

```javascript
// Test email queue
const result = await queueEmail({
  from: 'test@migrahosting.com',
  to: 'your-email@example.com',
  subject: 'Test Email',
  html: '<h1>Test</h1>',
  department: 'info',
  priority: 5,
});

// Check queue stats
const stats = await getQueueStats();
console.log(stats);
```

### Onboarding Testing

```javascript
// Test onboarding sequence
await onboarding.triggerEvent('user_created', testUserId, testTenantId);

// Check progress
const progress = await onboarding.getUserProgress(testUserId);
console.log(progress);
```

### CSAT Testing

```javascript
// Send test survey
await csat.sendSurvey({
  tenantId: testTenantId,
  userId: testUserId,
  surveyType: 'nps',
});

// Submit test response
await csat.submitResponse(surveyId, 9, 'Great product!');

// Check metrics
const metrics = await csat.getMetrics(testTenantId);
console.log(metrics);
```

---

## Monitoring

### Queue Health

```javascript
// Monitor queue health
const stats = await getQueueStats();

if (stats.email.database.failed > 100) {
  // Alert: Too many failed emails
}

if (stats.email.database.pending > 1000) {
  // Alert: Queue backlog building up
}
```

### Audit Compliance

```javascript
// Monthly audit report
const stats = await audit.getAuditStats(tenantId, 30);

if (stats.critical_events > 10) {
  // Alert: High number of critical events
}

if (stats.gdpr_events > 0) {
  // Review GDPR-related activities
}
```

---

## Next Steps

1. ✅ Database tables created
2. ✅ Services implemented
3. ⏳ Create API endpoints (routes + controllers)
4. ⏳ Add to frontend UI
5. ⏳ Setup cron jobs
6. ⏳ Test end-to-end
7. ⏳ Deploy to production

---

## Support

For questions or issues:
- Check individual service files for detailed JSDoc comments
- Review integration examples above
- Test with small data sets before production use
- Monitor queue and audit logs regularly

---

**Last Updated**: November 17, 2025
**Version**: 1.1.0
**Status**: Services Implemented, Ready for API Integration
