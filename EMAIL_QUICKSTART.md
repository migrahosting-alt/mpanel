# Email Service - Quick Start

## Required Environment Variables

Add these to your `.env` file:

```env
# Email Provider (choose one)
EMAIL_PROVIDER=smtp              # Options: 'sendgrid', 'mailgun', 'smtp'

# Sender Information
EMAIL_FROM=noreply@migrahosting.com
EMAIL_FROM_NAME=MigraHosting

# Frontend URL (for links in emails)
FRONTEND_URL=http://localhost:3001

# --- SMTP Configuration (if using SMTP) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# --- SendGrid (if using SendGrid) ---
# SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx

# --- Mailgun (if using Mailgun) ---
# MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxx
# MAILGUN_DOMAIN=mg.migrahosting.com
```

## Install Dependencies

```bash
npm install nodemailer @sendgrid/mail mailgun.js form-data
```

## Run Database Migration

```bash
# Apply email_preferences table migration
psql -U postgres -d migrahosting -f prisma/migrations/20241111000002_create_email_preferences/migration.sql
```

## Usage

The email service is automatically integrated and will send emails for:

- 📧 Welcome emails (new user registration)
- 🔐 Password reset emails
- 📄 Invoice notifications (with PDF attachments)
- ✅ Payment receipts
- 🛒 Order confirmations
- 🚀 Service provisioning alerts

## Testing

In development mode without email provider configured, emails are logged to console.

To test email sending:

1. Configure email provider in `.env`
2. Register a new user → triggers welcome email
3. Generate invoice PDF → triggers invoice email
4. Complete checkout → triggers order confirmation

## User Preferences

Users can manage their email preferences at:
- Frontend: `http://localhost:3001/email-preferences`
- API: `GET/PUT /api/email-preferences`

See `EMAIL_SETUP.md` for detailed configuration guide.
