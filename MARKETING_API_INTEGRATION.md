# Marketing Website ↔ Control Panel Integration API

## Overview

Complete bidirectional API for seamless communication between your marketing website and mPanel control panel. Enables automation, real-time provisioning, reporting, and synchronization.

## Features

✅ **Account Creation Automation** - Instant customer onboarding from marketing signups  
✅ **Service Provisioning** - Automatic hosting activation and setup  
✅ **Revenue & Analytics Reports** - Real-time business metrics  
✅ **Product Catalog Sync** - Always up-to-date pricing and features  
✅ **Usage Monitoring** - Resource consumption tracking  
✅ **Plan Upgrades/Downgrades** - Seamless service changes  
✅ **Webhook Notifications** - Real-time event updates  
✅ **System Status** - Live infrastructure health  

---

## Authentication

All marketing API endpoints require an API key for authentication.

### Generating an API Key

**Admin Panel** → **Settings** → **API Keys** → **Create Marketing API Key**

Or via API:

```bash
POST /api/marketing/admin/api-keys
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "Marketing Website Production",
  "expiresIn": 365  # Optional: days until expiration
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "apiKey": "mk_abc123...",  # Store securely - shown only once
    "name": "Marketing Website Production",
    "expiresAt": "2025-11-15T00:00:00Z"
  }
}
```

### Using the API Key

Include in all requests:

```bash
curl -H "X-API-Key: mk_abc123..." \
  https://panel.migrahosting.com/api/marketing/...
```

---

## Endpoints

### 📝 Account Creation & Automation

#### Create Customer Account

**Endpoint:** `POST /api/marketing/accounts/create`  
**Rate Limit:** 10 requests/minute  
**Use Case:** Automatically create customer account when someone signs up on marketing website

**Request:**
```json
{
  "email": "customer@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Corp",
  "phone": "+1-555-0123",
  "address": "123 Main St",
  "city": "San Francisco",
  "state": "CA",
  "zip": "94105",
  "country": "US",
  "planId": "shared-starter",  # Optional: auto-provision hosting
  "billingCycle": "monthly",   # monthly, oneYear, twoYears, threeYears
  "promoCode": "LAUNCH50",      # Optional: discount code
  "marketingSource": "google-ads",
  "utmParams": {
    "campaign": "summer-sale",
    "source": "google",
    "medium": "cpc"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customerId": "uuid",
    "serviceId": "uuid",  # If planId provided
    "email": "customer@example.com",
    "status": "active",
    "resetToken": "abc123...",  # For password setup redirect
    "message": "Account created successfully. Welcome email sent."
  }
}
```

**Marketing Website Integration Example:**
```javascript
// Handle marketing website signup form
async function handleSignup(formData) {
  const response = await fetch('https://panel.migrahosting.com/api/marketing/accounts/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': process.env.MPANEL_API_KEY
    },
    body: JSON.stringify({
      email: formData.email,
      firstName: formData.firstName,
      lastName: formData.lastName,
      planId: formData.selectedPlan,
      billingCycle: formData.billingCycle,
      marketingSource: 'website',
      utmParams: getUTMParams()  # From URL
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Redirect to password setup
    window.location.href = `https://panel.migrahosting.com/set-password?token=${result.data.resetToken}`;
  }
}
```

---

#### Provision Service

**Endpoint:** `POST /api/marketing/services/provision`  
**Rate Limit:** 10 requests/minute  
**Use Case:** Add hosting service to existing customer (upsells, upgrades)

**Request:**
```json
{
  "customerId": "uuid",  # OR use customerEmail
  "customerEmail": "customer@example.com",
  "planId": "shared-business",
  "billingCycle": "oneYear",
  "domain": "example.com",  # Optional
  "autoSetup": true  # Auto-provision or manual activation
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceId": "uuid",
    "invoiceId": "uuid",
    "customerId": "uuid",
    "status": "active",
    "price": 59.88,
    "billingCycle": "oneYear",
    "nextDueDate": "2025-12-15T00:00:00Z"
  }
}
```

---

### 📊 Reports & Analytics

#### Revenue Report

**Endpoint:** `GET /api/marketing/reports/revenue?startDate=2024-01-01&endDate=2024-12-31&groupBy=month`  
**Rate Limit:** 100 requests/minute

**Query Parameters:**
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `groupBy`: `day`, `week`, `month`, `year`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "period": "2024-11-01T00:00:00Z",
      "invoice_count": 150,
      "total_revenue": 25000.00,
      "paid_revenue": 22000.00,
      "avg_invoice_amount": 166.67
    }
  ]
}
```

**Use Case: Marketing Dashboard Widget**
```javascript
// Display monthly revenue chart
async function fetchRevenueData() {
  const response = await fetch(
    'https://panel.migrahosting.com/api/marketing/reports/revenue?groupBy=month',
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  const result = await response.json();
  renderRevenueChart(result.data);
}
```

---

#### Customer Acquisition Report

**Endpoint:** `GET /api/marketing/reports/customers?source=google-ads&startDate=2024-11-01`  
**Rate Limit:** 100 requests/minute

**Query Parameters:**
- `startDate` (optional): ISO 8601 date
- `endDate` (optional): ISO 8601 date
- `source` (optional): Filter by marketing source

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "signup_date": "2024-11-15",
      "marketing_source": "google-ads",
      "utm_source": "google",
      "utm_campaign": "summer-sale",
      "customer_count": 45,
      "active_count": 42,
      "avg_age_days": 15.3
    }
  ]
}
```

**Use Case: Attribution Analysis**
```javascript
// Track which marketing campaigns convert best
async function analyzeMarketingROI() {
  const campaigns = ['google-ads', 'facebook-ads', 'organic'];
  
  for (const campaign of campaigns) {
    const response = await fetch(
      `https://panel.migrahosting.com/api/marketing/reports/customers?source=${campaign}`,
      { headers: { 'X-API-Key': API_KEY } }
    );
    
    const result = await response.json();
    console.log(`${campaign}: ${result.data.reduce((sum, d) => sum + d.customer_count, 0)} customers`);
  }
}
```

---

#### Usage Statistics

**Endpoint:** `GET /api/marketing/reports/usage`  
**Rate Limit:** 100 requests/minute

**Response:**
```json
{
  "success": true,
  "data": {
    "total_services": 500,
    "active_services": 475,
    "suspended_services": 25,
    "total_disk_used": 524288000000,  # bytes
    "total_bandwidth_used": 1048576000000,  # bytes
    "avg_uptime": 99.97
  }
}
```

---

### 🛍️ Product Catalog Sync

#### Get Product Catalog

**Endpoint:** `GET /api/marketing/products/catalog?category=shared-hosting&active=true`  
**Rate Limit:** 100 requests/minute

**Query Parameters:**
- `category` (optional): Filter by product type
- `active` (optional, default: true): Only show active products

**Response:**
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": "shared-starter",
      "name": "Starter",
      "type": "shared-hosting",
      "description": "Perfect for personal websites",
      "features": ["10GB SSD", "Unlimited Bandwidth", "Free SSL"],
      "pricing": {
        "monthly": 7.95,
        "oneYear": 1.99,
        "twoYears": 1.69,
        "threeYears": 1.49
      },
      "stock_quantity": 1000,
      "is_active": true,
      "display_order": 1
    }
  ]
}
```

**Use Case: Pricing Page Sync**
```javascript
// Keep marketing website pricing up-to-date
async function updatePricingPage() {
  const response = await fetch(
    'https://panel.migrahosting.com/api/marketing/products/catalog',
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  const result = await response.json();
  
  // Update pricing cards dynamically
  result.data.forEach(product => {
    updatePricingCard(product.id, {
      name: product.name,
      price: product.pricing.oneYear,
      features: product.features
    });
  });
}

// Run every hour to stay synchronized
setInterval(updatePricingPage, 3600000);
```

---

#### Check Product Availability

**Endpoint:** `GET /api/marketing/products/:id/availability`  
**Rate Limit:** 100 requests/minute

**Response:**
```json
{
  "success": true,
  "data": {
    "available": true,
    "stockRemaining": 950,
    "activeServices": 50
  }
}
```

---

### 🔄 Service Management

#### Get Customer Services

**Endpoint:** `GET /api/marketing/customers/:customerId/services`  
**Rate Limit:** 100 requests/minute

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Business Hosting",
      "status": "active",
      "price": 29.95,
      "billing_cycle": "monthly",
      "next_due_date": "2024-12-15",
      "domain": "example.com",
      "disk_used": 5368709120,
      "bandwidth_used": 10737418240,
      "plan_name": "Business",
      "plan_type": "shared-hosting"
    }
  ]
}
```

---

#### Upgrade Service

**Endpoint:** `POST /api/marketing/services/:serviceId/upgrade`  
**Rate Limit:** 10 requests/minute

**Request:**
```json
{
  "newPlanId": "shared-premium",
  "promoCode": "UPGRADE20"  # Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "serviceId": "uuid",
    "newPlanId": "shared-premium",
    "newPrice": 59.95,
    "upgradeAmount": 15.23,  # Prorated charge
    "invoiceId": "uuid",
    "message": "Service upgraded successfully"
  }
}
```

**Use Case: Upsell Widget**
```javascript
// Show upgrade offers in customer portal
async function offerUpgrade(serviceId, currentPlan, upgradePlan) {
  const response = await fetch(
    `https://panel.migrahosting.com/api/marketing/services/${serviceId}/upgrade`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({ newPlanId: upgradePlan })
    }
  );
  
  const result = await response.json();
  
  if (result.success) {
    showSuccessMessage(`Upgraded to ${upgradePlan}! Prorated charge: $${result.data.upgradeAmount}`);
  }
}
```

---

### 📡 Real-Time Updates

#### Get System Status

**Endpoint:** `GET /api/marketing/status/system`  
**Rate Limit:** 100 requests/minute

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "operational",  # operational, degraded, major_outage
    "servers": {
      "total_servers": 10,
      "online_servers": 10,
      "avg_cpu": 45.2,
      "avg_memory": 62.5,
      "avg_uptime": 99.98
    },
    "recentIncidents": [],
    "lastUpdated": "2024-11-15T12:00:00Z"
  }
}
```

**Use Case: Status Page**
```javascript
// Display live system status
async function updateStatusPage() {
  const response = await fetch(
    'https://panel.migrahosting.com/api/marketing/status/system',
    { headers: { 'X-API-Key': API_KEY } }
  );
  
  const result = await response.json();
  
  document.getElementById('status-badge').textContent = result.data.status;
  document.getElementById('uptime').textContent = `${result.data.servers.avg_uptime}%`;
}

// Update every 30 seconds
setInterval(updateStatusPage, 30000);
```

---

#### Register Webhook

**Endpoint:** `POST /api/marketing/webhooks/register`  
**Rate Limit:** 100 requests/minute

**Request:**
```json
{
  "url": "https://marketing.migrahosting.com/webhooks/mpanel",
  "events": [
    "customer.created",
    "service.activated",
    "invoice.paid",
    "service.suspended",
    "service.upgraded"
  ],
  "secret": "your-webhook-secret"  # Optional: auto-generated if not provided
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhookId": "uuid",
    "secret": "whsec_abc123...",
    "message": "Webhook registered successfully"
  }
}
```

**Webhook Payload Example:**
```json
{
  "event": "customer.created",
  "timestamp": "2024-11-15T12:00:00Z",
  "data": {
    "customerId": "uuid",
    "email": "customer@example.com",
    "plan": "shared-starter",
    "marketingSource": "google-ads"
  },
  "signature": "sha256=..."  # HMAC signature for verification
}
```

**Webhook Handler Example:**
```javascript
// Express.js webhook handler
app.post('/webhooks/mpanel', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const payload = req.body;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  if (`sha256=${expectedSignature}` !== signature) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = JSON.parse(payload);
  
  // Handle different events
  switch (event.event) {
    case 'customer.created':
      // Send welcome campaign email via marketing automation
      sendWelcomeEmail(event.data.email);
      break;
      
    case 'invoice.paid':
      // Track conversion in Google Analytics
      trackConversion(event.data.customerId, event.data.amount);
      break;
      
    case 'service.upgraded':
      // Trigger upsell success email
      sendUpgradeConfirmation(event.data.customerId);
      break;
  }
  
  res.json({ received: true });
});
```

---

## Rate Limiting

| Endpoint Type | Rate Limit |
|--------------|-----------|
| Account creation | 10 requests/minute |
| Service provisioning | 10 requests/minute |
| Reports | 100 requests/minute |
| Catalog sync | 100 requests/minute |
| Status checks | 100 requests/minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1731672000
```

---

## Error Handling

**Error Response Format:**
```json
{
  "error": "Customer already exists",
  "code": "CUSTOMER_EXISTS",
  "details": {
    "customerId": "uuid"
  }
}
```

**Common HTTP Status Codes:**
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Invalid API key
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource already exists
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Security Best Practices

### API Key Security

✅ **Store API keys securely** - Use environment variables, never commit to git  
✅ **Use HTTPS only** - All API calls must use TLS  
✅ **Rotate keys regularly** - Recommended: every 90 days  
✅ **Monitor usage** - Check API key activity logs  
✅ **Revoke compromised keys** - Immediately disable if exposed  

### Webhook Security

✅ **Verify signatures** - Always validate webhook signatures  
✅ **Use HTTPS endpoints** - Webhooks only sent to HTTPS URLs  
✅ **Implement replay protection** - Check timestamp to prevent replay attacks  
✅ **Whitelist IPs** - Optional: Restrict to mPanel server IPs  

---

## Complete Integration Example

### Marketing Website Checkout Flow

```javascript
// 1. Customer selects plan on marketing website
const selectedPlan = {
  id: 'shared-business',
  billingCycle: 'oneYear',
  price: 59.88
};

// 2. Customer fills out signup form
const customerData = {
  email: 'customer@example.com',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Corp'
};

// 3. Process payment via Stripe (marketing website)
const stripePayment = await stripe.paymentIntents.create({
  amount: selectedPlan.price * 100,
  currency: 'usd',
  customer: stripeCustomerId
});

// 4. Create account in mPanel (after successful payment)
const mpanelResponse = await fetch('https://panel.migrahosting.com/api/marketing/accounts/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.MPANEL_API_KEY
  },
  body: JSON.stringify({
    ...customerData,
    planId: selectedPlan.id,
    billingCycle: selectedPlan.billingCycle,
    marketingSource: 'website',
    utmParams: {
      campaign: req.cookies.utm_campaign,
      source: req.cookies.utm_source,
      medium: req.cookies.utm_medium
    }
  })
});

const mpanelResult = await mpanelResponse.json();

if (mpanelResult.success) {
  // 5. Redirect to control panel for password setup
  res.redirect(`https://panel.migrahosting.com/set-password?token=${mpanelResult.data.resetToken}&welcome=true`);
  
  // 6. Marketing automation: Add to email sequence
  await mailchimp.lists.addListMember({
    list_id: 'customers',
    email_address: customerData.email,
    status: 'subscribed',
    merge_fields: {
      FNAME: customerData.firstName,
      LNAME: customerData.lastName,
      PLAN: selectedPlan.id
    }
  });
}
```

---

## Database Schema

### Required Tables

```sql
-- API Keys table (if not exists)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  key_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of API key
  name VARCHAR(255) NOT NULL,
  scope VARCHAR(50) DEFAULT 'marketing',  -- marketing, general, admin
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);

-- Marketing Webhooks table
CREATE TABLE IF NOT EXISTS marketing_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  api_key_id UUID REFERENCES api_keys(id),
  url VARCHAR(500) NOT NULL,
  events JSONB NOT NULL,  -- Array of event types
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at TIMESTAMP
);

CREATE INDEX idx_marketing_webhooks_tenant_id ON marketing_webhooks(tenant_id);
```

---

## Monitoring & Logs

### API Usage Metrics

Available via Prometheus:
```
marketing_api_requests_total{endpoint, status}
marketing_api_response_time_seconds{endpoint}
marketing_api_rate_limit_hits_total{api_key}
```

### Activity Logs

All marketing API calls are logged:
```sql
SELECT * FROM api_activity_logs 
WHERE api_key_id = 'uuid' 
ORDER BY created_at DESC 
LIMIT 100;
```

---

## Support

**Documentation:** https://docs.migrahosting.com/marketing-api  
**API Status:** https://status.migrahosting.com  
**Support Email:** api@migrahosting.com  
**Slack Channel:** #api-integration  

---

## Changelog

### v1.0.0 (2024-11-15)
- Initial release
- Account creation automation
- Service provisioning
- Revenue & customer reports
- Product catalog sync
- Webhook notifications
- System status API
