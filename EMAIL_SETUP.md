# Email Service Configuration Guide

## Overview
The email service supports three providers:
- **SendGrid** (recommended for production)
- **Mailgun** (alternative)
- **SMTP** (fallback, works with any provider)

## Environment Variables

### General Settings
```env
EMAIL_PROVIDER=smtp           # Options: 'sendgrid', 'mailgun', 'smtp'
EMAIL_FROM=noreply@migrahosting.com
EMAIL_FROM_NAME=MigraHosting
FRONTEND_URL=https://panel.migrahosting.com
```

### SendGrid Configuration
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
```

**Setup Steps:**
1. Sign up at https://sendgrid.com
2. Go to Settings → API Keys
3. Create API Key with "Full Access" permission
4. Add to `.env` file

### Mailgun Configuration
```env
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=mg.migrahosting.com
```

**Setup Steps:**
1. Sign up at https://www.mailgun.com
2. Add and verify your domain
3. Get API Key from Settings → API Keys
4. Add to `.env` file

### SMTP Configuration (Generic)
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

**Common SMTP Providers:**

**Gmail:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password  # Generate at myaccount.google.com/apppasswords
```

**Outlook/Office 365:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

**AWS SES:**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## Email Types

### Invoice Emails
- Sent when invoice PDF is generated
- Includes PDF attachment
- User preference: `invoice_emails`

### Payment Receipt Emails
- Sent after successful payment
- Includes payment details
- User preference: `payment_emails`

### Order Confirmation Emails
- Sent after successful checkout
- Lists purchased services
- User preference: `payment_emails`

### Service Provisioned Emails
- Sent when new service is activated
- Includes service details
- User preference: `service_emails`

### Welcome Emails
- Sent when user account is created
- Always sent (cannot be disabled)

### Password Reset Emails
- Sent when user requests password reset
- Always sent (security requirement)
- User preference: `security_emails` (cannot be disabled)

## Development Mode

In development without email provider configured, emails are logged to console:
```bash
📧 EMAIL (console only): { to, subject, text }
```

## Testing Email Service

### Test Email Sending
```javascript
const emailService = require('./src/services/emailService');

// Initialize service
await emailService.initialize();

// Test welcome email
const testUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User'
};

await emailService.sendWelcomeEmail(testUser);
```

### Test via API
```bash
# Create a user (triggers welcome email)
POST /api/auth/register
{
  "email": "newuser@example.com",
  "password": "securepass123",
  "firstName": "New",
  "lastName": "User"
}

# Generate invoice (triggers invoice email)
GET /api/invoices/:id/pdf

# Complete payment (triggers payment receipt)
POST /api/invoices/:id/mark-paid
```

## Email Templates

All emails include:
- Professional HTML formatting
- Plain text fallback
- Responsive design
- Company branding (customizable)
- Unsubscribe link (for marketing emails)

Templates are defined in `src/services/emailService.js`:
- `sendWelcomeEmail()`
- `sendPasswordResetEmail()`
- `sendInvoiceEmail()`
- `sendPaymentReceiptEmail()`
- `sendOrderConfirmationEmail()`
- `sendServiceProvisionedEmail()`

## User Email Preferences

Users can manage preferences at `/email-preferences`:
- ✅ Invoice Emails (recommended)
- ✅ Payment Receipts (recommended)
- ✅ Service Notifications (recommended)
- 🔒 Security Alerts (required, cannot disable)
- 📢 Marketing & Updates (optional)

Stored in `email_preferences` table.

## Database Schema

```sql
CREATE TABLE email_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  invoice_emails BOOLEAN DEFAULT true,
  payment_emails BOOLEAN DEFAULT true,
  service_emails BOOLEAN DEFAULT true,
  marketing_emails BOOLEAN DEFAULT false,
  security_emails BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
```

## Troubleshooting

### Emails not sending
1. Check `.env` configuration
2. Verify API keys are correct
3. Check console logs for errors
4. Test SMTP credentials with `nodemailer`

### SendGrid issues
- Verify API key has "Mail Send" permission
- Check sender verification status
- Review activity feed in SendGrid dashboard

### Mailgun issues
- Ensure domain is verified
- Check DNS records (SPF, DKIM)
- Verify sandbox vs production domain

### SMTP issues
- Test connection with telnet: `telnet smtp.example.com 587`
- Check firewall/security groups
- For Gmail, enable "Less secure app access" or use App Password

## Production Recommendations

1. **Use SendGrid or Mailgun** for reliability
2. **Verify your domain** with DKIM/SPF records
3. **Enable DMARC** for email authentication
4. **Monitor email logs** for bounce/spam rates
5. **Set up webhooks** for delivery status tracking
6. **Use dedicated IP** for high volume (optional)
7. **Implement rate limiting** to prevent abuse

## Email Deliverability Best Practices

1. **Warm up IP address** gradually (for dedicated IPs)
2. **Maintain low bounce rate** (<5%)
3. **Monitor spam complaints** (<0.1%)
4. **Use consistent "From" address**
5. **Include unsubscribe links** (for marketing)
6. **Authenticate with SPF/DKIM/DMARC**
7. **Avoid spam trigger words**
8. **Test emails** before sending to large lists

## Support

For email service issues:
- SendGrid: https://support.sendgrid.com
- Mailgun: https://help.mailgun.com
- AWS SES: https://docs.aws.amazon.com/ses
