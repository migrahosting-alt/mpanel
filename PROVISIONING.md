# Automated Provisioning System Documentation

## Overview

The MPanel Automated Provisioning System is a **WHMCS-like automation platform** that automatically creates and configures hosting accounts when customers make purchases. This system eliminates manual intervention and provides instant service activation.

## Table of Contents

1. [Architecture](#architecture)
2. [How It Works](#how-it-works)
3. [Components](#components)
4. [Setup & Configuration](#setup--configuration)
5. [API Reference](#api-reference)
6. [Database Schema](#database-schema)
7. [Cron Jobs](#cron-jobs)
8. [Troubleshooting](#troubleshooting)
9. [Control Panel Integration](#control-panel-integration)

---

## Architecture

```
Customer Purchase (Stripe Checkout)
           ↓
    Checkout Success Handler
           ↓
    Create Service Record (status: pending)
           ↓
    Queue Provisioning Job (Redis)
           ↓
    Queue Worker Picks Up Job
           ↓
┌──────────────────────────────────┐
│  Provisioning Service (6 Steps)  │
├──────────────────────────────────┤
│ 1. Create Hosting Account        │
│ 2. Configure DNS                 │
│ 3. Install SSL Certificate       │
│ 4. Setup Email Account           │
│ 5. Create Databases              │
│ 6. Send Welcome Email            │
└──────────────────────────────────┘
           ↓
    Update Service Status (active)
           ↓
    Customer Receives Welcome Email
    with Login Credentials
```

---

## How It Works

### 1. Customer Purchases a Service

When a customer completes checkout via Stripe:

```javascript
// checkoutController.js - handleCheckoutSuccess()
const service = await pool.query(
  `INSERT INTO services (customer_id, product_id, domain, status)
   VALUES ($1, $2, $3, 'pending')`,
  [customerId, productId, domain]
);

// Queue provisioning
await queueService.addProvisioningJob({
  serviceId: service.id,
  customerId: customerId,
  productId: productId,
  domain: domain
});
```

### 2. Queue System Processes Job Asynchronously

Redis-based queue ensures:
- **Non-blocking**: Checkout completes immediately
- **Retry logic**: Failed jobs retry up to 3 times
- **Error handling**: Failed jobs logged for manual intervention

### 3. Provisioning Service Executes 6 Steps

Each step is independent and logged:

#### Step 1: Create Hosting Account
- Generates unique username (domain-based)
- Creates secure random password
- Assigns to least-loaded server
- Calls cPanel/Plesk/DirectAdmin API
- Stores encrypted credentials

#### Step 2: Configure DNS
- Creates DNS zone
- Adds default records (A, CNAME, MX, TXT)
- Configures nameservers

#### Step 3: Install SSL Certificate
- Requests Let's Encrypt certificate via AutoSSL
- Installs on account
- Sets auto-renewal

#### Step 4: Setup Email
- Creates default mailbox (admin@domain.com)
- Configures quota based on package
- Stores credentials

#### Step 5: Create Databases
- Creates MySQL database and user
- Sets permissions
- Stores credentials

#### Step 6: Send Welcome Email
- Renders HTML template
- Includes login credentials
- Provides getting started guide

### 4. Service Status Updated

On success:
```sql
UPDATE services SET status = 'active', provisioned_at = NOW() WHERE id = ?
```

On failure:
```sql
UPDATE services SET status = 'pending', provisioning_error = ? WHERE id = ?
```

---

## Components

### Core Services

#### 1. `provisioningService.js`
**Main orchestrator** - coordinates all provisioning steps

Key methods:
- `provisionService(serviceId, customerId, productId, domain)` - Main entry point
- `createHostingAccount()` - Step 1
- `configureDNS()` - Step 2
- `installSSL()` - Step 3
- `setupEmail()` - Step 4
- `createDatabases()` - Step 5
- `sendWelcomeEmail()` - Step 6

#### 2. `queueService.js`
**Redis-based job queue** with retry logic

Features:
- Async job processing
- Automatic retry (up to 3 attempts)
- Failed job tracking
- Queue statistics

#### 3. `cronService.js`
**Scheduled tasks** for automation

Jobs:
- Recurring billing (daily 2 AM)
- Service suspension (daily 3 AM)
- SSL renewal reminders (daily 4 AM)
- Backup cleanup (daily 5 AM)

### API Routes

#### `provisioningRoutes.js`

```
POST   /api/provisioning/provision      - Queue provisioning job
POST   /api/provisioning/manual         - Manual sync provisioning
GET    /api/provisioning/tasks          - List all tasks
GET    /api/provisioning/tasks/:id      - Get task status
POST   /api/provisioning/retry/:id      - Retry failed task
GET    /api/provisioning/stats          - Queue statistics
GET    /api/provisioning/failed         - List failed jobs
DELETE /api/provisioning/failed         - Clear failed jobs
```

---

## Setup & Configuration

### 1. Environment Variables

Add to `.env`:

```bash
# Queue Service
REDIS_HOST=localhost
REDIS_PORT=6380
REDIS_PASSWORD=

# Cron Jobs
ENABLE_CRON=true                    # Set to true in production
SUSPENSION_GRACE_DAYS=3             # Days before suspending overdue services
BACKUP_RETENTION_DAYS=30            # Days to keep backups

# Email
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=587
EMAIL_FROM=noreply@migrahosting.com
SUPPORT_EMAIL=support@migrahosting.com

# Encryption
ENCRYPTION_KEY=your-32-char-encryption-key

# Company
COMPANY_NAME=MigraHosting
COMPANY_DOMAIN=migrahosting.com
```

### 2. Run Database Migration

```bash
cd mpanel-main/mpanel-main
psql -U postgres -d mpanel -f prisma/migrations/20251112034108_provisioning/migration.sql
```

This creates:
- `servers` table
- `provisioning_tasks` table
- Adds columns to `services` table

### 3. Add Your First Server

```sql
INSERT INTO servers (
  hostname,
  ip_address,
  control_panel,
  control_panel_url,
  api_token,
  status
) VALUES (
  'server1.migrahosting.com',
  '192.168.1.100',
  'cpanel',
  'https://server1.migrahosting.com:2087',
  'your-whm-api-token',
  'active'
);
```

### 4. Start the Services

```bash
# Start Redis (if not running)
docker-compose up -d redis

# Start mPanel backend
node src/server.js
```

The system will:
- Initialize queue service
- Start queue workers
- Initialize cron jobs (if enabled)

---

## API Reference

### Queue a Provisioning Job

```http
POST /api/provisioning/provision
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "serviceId": 123,
  "customerId": 456,
  "productId": 789,
  "domain": "example.com"
}
```

**Response:**
```json
{
  "message": "Provisioning job queued",
  "jobId": "job_1699234567890_abc123",
  "serviceId": 123,
  "status": "queued"
}
```

### Get Task Status

```http
GET /api/provisioning/tasks/job_1699234567890_abc123
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "id": "job_1699234567890_abc123",
  "status": "completed",
  "completedAt": 1699234590000,
  "result": {
    "steps": [
      { "step": "account", "status": "success", "data": { "username": "examplecom" } },
      { "step": "dns", "status": "success", "data": { "zone_id": 1, "records": 5 } },
      { "step": "ssl", "status": "success", "data": { "provider": "letsencrypt" } },
      { "step": "email", "status": "success", "data": { "default_email": "admin@example.com" } },
      { "step": "database", "status": "success", "data": { "databases_created": 1 } },
      { "step": "welcome_email", "status": "success", "data": { "sent": true } }
    ]
  }
}
```

### Retry Failed Task

```http
POST /api/provisioning/retry/job_1699234567890_abc123
Authorization: Bearer <admin-token>
```

### Get Queue Statistics

```http
GET /api/provisioning/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "queue": {
    "provisioning": { "pending": 3, "processing": 1 },
    "emails": { "pending": 5, "processing": 0 },
    "invoices": { "pending": 2, "processing": 0 },
    "failed": 1,
    "processing_total": 1
  },
  "tasks": {
    "last_7_days": {
      "pending": 5,
      "processing": 1,
      "completed": 47,
      "failed": 2
    }
  }
}
```

---

## Database Schema

### `servers`
Stores hosting servers for account creation

```sql
CREATE TABLE servers (
  id SERIAL PRIMARY KEY,
  hostname VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45) NOT NULL,
  control_panel VARCHAR(50),          -- 'cpanel', 'plesk', 'directadmin'
  control_panel_url VARCHAR(255),
  api_token TEXT,
  max_accounts INTEGER DEFAULT 500,
  status VARCHAR(20) DEFAULT 'active',
  location VARCHAR(100),
  nameserver1 VARCHAR(255),
  nameserver2 VARCHAR(255)
);
```

### `provisioning_tasks`
Tracks provisioning job status

```sql
CREATE TABLE provisioning_tasks (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id),
  customer_id INTEGER REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processing', 'completed', 'failed'
  result_data JSONB,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);
```

### `services` (updated)
Added provisioning-related columns

```sql
ALTER TABLE services ADD COLUMN username VARCHAR(50);
ALTER TABLE services ADD COLUMN password_encrypted TEXT;
ALTER TABLE services ADD COLUMN server_id INTEGER REFERENCES servers(id);
ALTER TABLE services ADD COLUMN provisioning_error TEXT;
ALTER TABLE services ADD COLUMN provisioned_at TIMESTAMP;
```

---

## Cron Jobs

### Recurring Billing

**Schedule:** Daily at 2:00 AM  
**Purpose:** Auto-generate invoices for services renewing in 7 days

Logic:
1. Find services with `renewal_date` = today + 7 days
2. Create invoice with `status = 'pending'`
3. Send invoice email
4. If customer has saved payment method, auto-charge

**Manual trigger:**
```javascript
const result = await cronService.runJob('recurring-billing');
```

### Service Suspension

**Schedule:** Daily at 3:00 AM  
**Purpose:** Suspend services with overdue invoices

Logic:
1. Find services with invoices past due date + grace period (3 days default)
2. Update service `status = 'suspended'`
3. Send suspension notice email
4. Log activity

**Manual trigger:**
```javascript
const result = await cronService.runJob('service-suspension');
```

### SSL Renewal Reminders

**Schedule:** Daily at 4:00 AM  
**Purpose:** Remind customers of expiring SSL certificates

Logic:
1. Find SSL certificates expiring in 30 days with `auto_renew = false`
2. Send reminder email
3. Mark `reminder_sent = true`

### Backup Cleanup

**Schedule:** Daily at 5:00 AM  
**Purpose:** Delete old backups based on retention policy

Logic:
1. Find backups older than `BACKUP_RETENTION_DAYS` (30 default)
2. Delete files from storage
3. Delete database records

---

## Troubleshooting

### Provisioning Jobs Stuck in Queue

**Check queue stats:**
```http
GET /api/provisioning/stats
```

**Check Redis connection:**
```bash
redis-cli -p 6380 ping
```

**Restart queue workers:**
```bash
# Restart mPanel backend
pm2 restart mpanel
```

### Failed Provisioning Jobs

**View failed jobs:**
```http
GET /api/provisioning/failed
```

**Retry a failed job:**
```http
POST /api/provisioning/retry/job_xxxxx
```

**Clear failed jobs queue:**
```http
DELETE /api/provisioning/failed
```

### Service Created but Not Provisioned

**Check service status:**
```sql
SELECT id, domain, status, provisioning_error FROM services WHERE id = ?;
```

**Check provisioning tasks:**
```sql
SELECT * FROM provisioning_tasks WHERE service_id = ?;
```

**Manual provisioning:**
```http
POST /api/provisioning/manual
{
  "serviceId": 123,
  "customerId": 456,
  "productId": 789,
  "domain": "example.com"
}
```

### Cron Jobs Not Running

**Check if cron is enabled:**
```bash
# In .env
ENABLE_CRON=true
NODE_ENV=production
```

**Manual trigger:**
```javascript
// In Node REPL or test script
import cronService from './src/services/cronService.js';
await cronService.runJob('recurring-billing');
```

---

## Control Panel Integration

### cPanel/WHM

Currently using **stub methods** - replace with real API calls:

```javascript
// src/services/provisioningService.js

async createCPanelAccount(server, accountData) {
  const WHM = require('@cpanel/api'); // Install: npm install @cpanel/api
  
  const whm = new WHM({
    host: server.hostname,
    port: 2087,
    secure: true,
    token: server.api_token
  });

  const result = await whm.api.createAccount({
    username: accountData.username,
    domain: accountData.domain,
    password: accountData.password,
    email: accountData.email,
    plan: accountData.package,
    quota: accountData.quota
  });

  return {
    success: true,
    cpanel_url: `https://${server.hostname}:2083`,
    whm_url: `https://${server.hostname}:2087`
  };
}
```

### Plesk

```javascript
async createPleskAccount(server, accountData) {
  const axios = require('axios');
  
  const response = await axios.post(
    `${server.control_panel_url}/api/v2/domains`,
    {
      name: accountData.domain,
      hosting_type: 'virtual',
      owner_login: accountData.username,
      password: accountData.password
    },
    {
      headers: {
        'X-API-Key': server.api_token
      }
    }
  );

  return {
    success: true,
    plesk_url: server.control_panel_url
  };
}
```

### DirectAdmin

```javascript
async createDirectAdminAccount(server, accountData) {
  const axios = require('axios');
  
  const params = new URLSearchParams({
    action: 'create',
    username: accountData.username,
    email: accountData.email,
    passwd: accountData.password,
    domain: accountData.domain,
    package: accountData.package,
    ip: server.ip_address
  });

  const response = await axios.post(
    `${server.control_panel_url}/CMD_API_ACCOUNT_USER`,
    params,
    {
      auth: {
        username: 'admin',
        password: server.api_token
      }
    }
  );

  return {
    success: true,
    da_url: server.control_panel_url
  };
}
```

---

## Next Steps

1. **Implement Real Control Panel APIs** - Replace stub methods with actual WHM/Plesk/DirectAdmin API calls
2. **Build Admin UI** - Frontend dashboard to monitor provisioning queue
3. **Add Server Management** - API routes and UI to manage servers
4. **End-to-End Testing** - Test full flow from purchase to account activation
5. **Client Portal** - Build customer-facing dashboard for service management

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/migrahosting/mpanel/issues
- Documentation: https://docs.migrahosting.com
- Email: support@migrahosting.com

---

**Last Updated:** November 12, 2024  
**Version:** 1.0.0  
**Author:** MigraHosting Development Team
