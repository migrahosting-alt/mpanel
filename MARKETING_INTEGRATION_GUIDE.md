# 🔗 Marketing Site → mPanel Integration Guide

Complete guide for connecting your marketing/landing site to mPanel for automated product provisioning.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Integration Flows](#integration-flows)
4. [API Endpoints](#api-endpoints)
5. [Implementation Examples](#implementation-examples)
6. [Webhook Integration](#webhook-integration)
7. [Security Best Practices](#security-best-practices)
8. [Testing](#testing)

---

## Overview

mPanel provides **3 integration methods** for external sites to provision hosting products:

### Method 1: **Public Checkout Flow** (Recommended for Marketing Sites)
- No authentication required for browsing products
- Stripe Checkout handles payment
- Automatic provisioning after payment
- Best for: Landing pages, marketing sites, customer self-service

### Method 2: **API Token Authentication** (For Custom Integrations)
- Use `MPANEL_API_TOKEN` for server-to-server communication
- Direct product provisioning control
- Best for: Custom order systems, admin dashboards

### Method 3: **JWT Authentication** (For Logged-in Users)
- Standard user authentication
- Best for: Client portal, user dashboards

---

## 🔐 Authentication Methods

### 1. Public Endpoints (No Auth Required)

```javascript
// Base URL
const MPANEL_URL = 'https://migrapanel.com'; // Change to your mPanel URL

// Get available plans/products
fetch(`${MPANEL_URL}/api/public/plans`)
  .then(res => res.json())
  .then(data => console.log(data.plans));

// Start checkout session
fetch(`${MPANEL_URL}/api/public/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    planId: 'basic',
    term: 'monthly',
    email: 'customer@example.com',
    successUrl: 'https://yoursite.com/success',
    cancelUrl: 'https://yoursite.com/pricing'
  })
})
  .then(res => res.json())
  .then(data => {
    // Redirect to Stripe Checkout
    window.location.href = data.url;
  });
```

### 2. API Token Authentication

```javascript
// Set in .env file
MPANEL_API_TOKEN=2Yk03D3JZk6TFBjxb/zlo+j76Nh2uO2d/xj76jPa+zFXZgkF6bZJFV84z19YliOthakJqc9mWISMwr3BWTc+PA==...

// Use in requests (server-side only!)
fetch(`${MPANEL_URL}/api/provisioning/provision`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.MPANEL_API_TOKEN}`
  },
  body: JSON.stringify({
    serviceId: 'srv_123',
    customerId: 'cust_456',
    productId: 'prod_789',
    domain: 'example.com'
  })
});
```

⚠️ **WARNING**: Never expose `MPANEL_API_TOKEN` in client-side code!

### 3. JWT Authentication (Standard Login)

```javascript
// Login first
const loginResponse = await fetch(`${MPANEL_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'password123'
  })
});

const { token } = await loginResponse.json();

// Use token for authenticated requests
fetch(`${MPANEL_URL}/api/provisioning/tasks`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

---

## 🔄 Integration Flows

### Flow 1: **Stripe Checkout Integration** (Recommended)

```
┌─────────────────┐
│ Marketing Site  │
│   (Pricing Page)│
└────────┬────────┘
         │
         │ 1. User clicks "Buy Now"
         ↓
┌─────────────────────────────────┐
│ GET /api/public/plans           │  ← List available products
└────────┬────────────────────────┘
         │
         │ 2. User selects plan
         ↓
┌─────────────────────────────────┐
│ POST /api/public/checkout       │  ← Create Stripe session
│ {planId, term, email}           │
└────────┬────────────────────────┘
         │
         │ 3. Redirect to Stripe
         ↓
┌─────────────────┐
│ Stripe Checkout │  ← Customer pays
└────────┬────────┘
         │
         │ 4. Payment complete
         ↓
┌─────────────────────────────────┐
│ Stripe Webhook                  │
│ → POST /webhooks/stripe         │
└────────┬────────────────────────┘
         │
         │ 5. Webhook triggers provisioning
         ↓
┌─────────────────────────────────┐
│ Provisioning Queue              │
│ → Creates customer account      │
│ → Provisions hosting service    │
│ → Sets up DNS, email, database  │
│ → Sends welcome email           │
└─────────────────────────────────┘
         │
         │ 6. Customer receives credentials
         ↓
┌─────────────────┐
│ Customer Email  │
└─────────────────┘
```

### Flow 2: **Direct API Provisioning** (Custom Integration)

```
┌─────────────────┐
│ Your System     │
│ (Order Manager) │
└────────┬────────┘
         │
         │ 1. Create customer in your system
         ↓
┌─────────────────────────────────┐
│ POST /api/customers             │  ← Create customer in mPanel
│ Authorization: Bearer API_TOKEN │
│ {name, email, company}          │
└────────┬────────────────────────┘
         │
         │ 2. Create service record
         ↓
┌─────────────────────────────────┐
│ POST /api/services              │  ← Create service
│ {customerId, productId, domain} │
└────────┬────────────────────────┘
         │
         │ 3. Trigger provisioning
         ↓
┌─────────────────────────────────┐
│ POST /api/provisioning/provision│  ← Queue provisioning job
│ {serviceId, customerId,         │
│  productId, domain}             │
└────────┬────────────────────────┘
         │
         │ 4. Monitor progress
         ↓
┌─────────────────────────────────┐
│ GET /api/provisioning/tasks/:id │  ← Check status
└────────┬────────────────────────┘
         │
         │ 5. Job completes
         ↓
┌─────────────────┐
│ Service Active  │
└─────────────────┘
```

---

## 📡 API Endpoints

### Public Endpoints (No Auth)

#### Get Available Plans
```http
GET /api/public/plans
```

**Response**:
```json
{
  "plans": [
    {
      "id": "basic",
      "name": "Basic Hosting",
      "price": {
        "monthly": 9.99,
        "annually": 99.99
      },
      "features": ["10GB Storage", "Unlimited Bandwidth", "SSL Included"]
    }
  ]
}
```

#### Create Checkout Session
```http
POST /api/public/checkout
Content-Type: application/json

{
  "planId": "basic",
  "term": "monthly",
  "email": "customer@example.com",
  "successUrl": "https://yoursite.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancelUrl": "https://yoursite.com/pricing"
}
```

**Response**:
```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "id": "cs_test_123..."
}
```

### Authenticated Endpoints (Require API Token or JWT)

#### Create Customer
```http
POST /api/customers
Authorization: Bearer {API_TOKEN}
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Inc",
  "phone": "+1234567890"
}
```

#### Provision Service
```http
POST /api/provisioning/provision
Authorization: Bearer {API_TOKEN}
Content-Type: application/json

{
  "serviceId": "srv_abc123",
  "customerId": "cust_xyz789",
  "productId": "prod_hosting_basic",
  "domain": "example.com"
}
```

**Response**:
```json
{
  "message": "Provisioning job queued",
  "jobId": "job_queue_456",
  "serviceId": "srv_abc123",
  "status": "queued"
}
```

#### Check Provisioning Status
```http
GET /api/provisioning/tasks/{jobId}
Authorization: Bearer {API_TOKEN}
```

**Response**:
```json
{
  "id": "job_queue_456",
  "status": "completed",
  "serviceId": "srv_abc123",
  "progress": 100,
  "steps": {
    "create_account": "completed",
    "setup_dns": "completed",
    "provision_email": "completed",
    "create_database": "completed"
  },
  "completedAt": "2024-11-16T10:30:00Z"
}
```

---

## 💻 Implementation Examples

### Example 1: Simple Pricing Page Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Hosting Plans</title>
</head>
<body>
  <div id="plans"></div>

  <script>
    const MPANEL_URL = 'https://migrapanel.com';

    // Fetch and display plans
    async function loadPlans() {
      const response = await fetch(`${MPANEL_URL}/api/public/plans`);
      const { plans } = await response.json();

      const container = document.getElementById('plans');
      
      plans.forEach(plan => {
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.innerHTML = `
          <h3>${plan.name}</h3>
          <p class="price">$${plan.price.monthly}/mo</p>
          <ul>
            ${plan.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
          <button onclick="buyPlan('${plan.id}', 'monthly')">
            Get Started
          </button>
        `;
        container.appendChild(card);
      });
    }

    // Start checkout
    async function buyPlan(planId, term) {
      const email = prompt('Enter your email:');
      if (!email) return;

      const response = await fetch(`${MPANEL_URL}/api/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          term,
          email,
          successUrl: window.location.origin + '/success',
          cancelUrl: window.location.origin + '/pricing'
        })
      });

      const { url } = await response.json();
      window.location.href = url; // Redirect to Stripe
    }

    loadPlans();
  </script>
</body>
</html>
```

### Example 2: Server-Side Order Processing (Node.js)

```javascript
// orderProcessor.js
import fetch from 'node-fetch';

const MPANEL_URL = process.env.MPANEL_URL || 'https://migrapanel.com';
const API_TOKEN = process.env.MPANEL_API_TOKEN;

class MPanelClient {
  constructor() {
    this.baseURL = MPANEL_URL;
    this.token = API_TOKEN;
  }

  async createCustomer(customerData) {
    const response = await fetch(`${this.baseURL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(customerData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create customer: ${response.statusText}`);
    }

    return response.json();
  }

  async provisionService(provisionData) {
    const response = await fetch(`${this.baseURL}/api/provisioning/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify(provisionData)
    });

    if (!response.ok) {
      throw new Error(`Failed to provision: ${response.statusText}`);
    }

    return response.json();
  }

  async checkProvisioningStatus(jobId) {
    const response = await fetch(
      `${this.baseURL}/api/provisioning/tasks/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    return response.json();
  }
}

// Usage example
async function processOrder(orderData) {
  const client = new MPanelClient();

  try {
    // Step 1: Create customer
    const customer = await client.createCustomer({
      name: orderData.customerName,
      email: orderData.email,
      company: orderData.company
    });

    console.log('Customer created:', customer.data.id);

    // Step 2: Provision service
    const provision = await client.provisionService({
      serviceId: orderData.serviceId,
      customerId: customer.data.id,
      productId: orderData.productId,
      domain: orderData.domain
    });

    console.log('Provisioning started:', provision.jobId);

    // Step 3: Monitor progress
    let status;
    do {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      status = await client.checkProvisioningStatus(provision.jobId);
      console.log('Status:', status.status, '- Progress:', status.progress + '%');
    } while (status.status !== 'completed' && status.status !== 'failed');

    if (status.status === 'completed') {
      console.log('✅ Service provisioned successfully!');
      return { success: true, customer, status };
    } else {
      console.error('❌ Provisioning failed:', status.error);
      return { success: false, error: status.error };
    }

  } catch (error) {
    console.error('Order processing error:', error);
    throw error;
  }
}

// Export for use in your app
export { MPanelClient, processOrder };
```

### Example 3: React Integration

```jsx
// PricingPage.jsx
import React, { useState, useEffect } from 'react';

const MPANEL_URL = process.env.REACT_APP_MPANEL_URL || 'https://migrapanel.com';

export default function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await fetch(`${MPANEL_URL}/api/public/plans`);
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planId, term) => {
    try {
      const email = prompt('Enter your email:');
      if (!email) return;

      const response = await fetch(`${MPANEL_URL}/api/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          term,
          email,
          successUrl: `${window.location.origin}/checkout/success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      alert('Checkout failed. Please try again.');
    }
  };

  if (loading) return <div>Loading plans...</div>;

  return (
    <div className="pricing-grid">
      {plans.map(plan => (
        <div key={plan.id} className="plan-card">
          <h3>{plan.name}</h3>
          <p className="price">${plan.price.monthly}/month</p>
          <ul>
            {plan.features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
          <button onClick={() => handleCheckout(plan.id, 'monthly')}>
            Get Started
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔔 Webhook Integration

### Stripe Webhook Setup

**1. Configure Webhook URL in Stripe Dashboard:**
```
https://your-mpanel-domain.com/api/webhooks/stripe
```

**2. Select Events to Listen:**
- `checkout.session.completed`
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

**3. Get Webhook Secret:**
```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**4. Webhook Handler** (already implemented in `src/server.js`):
```javascript
app.post('/webhooks/stripe', 
  bodyParser.raw({ type: 'application/json' }), 
  (req, res) => {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyWebhookSignature(req.body, signature);
    
    // Handles:
    // - Customer creation
    // - Service provisioning trigger
    // - Subscription management
    // - Invoice generation
    
    res.json({ received: true });
  }
);
```

---

## 🔒 Security Best Practices

### 1. **Protect API Token**
```javascript
// ✅ GOOD - Server-side only
// server.js or API route
const API_TOKEN = process.env.MPANEL_API_TOKEN;

// ❌ BAD - Never in client-side code!
// const API_TOKEN = '2Yk03D3JZk6TFBjxb...'; // EXPOSED!
```

### 2. **Use Environment Variables**
```bash
# .env (server-side)
MPANEL_URL=https://panel.yourdomain.com
MPANEL_API_TOKEN=your-secret-token-here

# .env.local (client-side React/Vue)
REACT_APP_MPANEL_URL=https://panel.yourdomain.com
# NO API TOKEN HERE!
```

### 3. **Validate Webhook Signatures**
```javascript
// Verify Stripe webhooks (already implemented)
const event = StripeService.verifyWebhookSignature(
  req.body, 
  req.headers['stripe-signature']
);
```

### 4. **Use HTTPS in Production**
```javascript
const MPANEL_URL = process.env.NODE_ENV === 'production'
  ? 'https://panel.yourdomain.com'
  : 'https://migrapanel.com';
```

### 5. **Rate Limiting** (Configure on mPanel)
```javascript
// Already implemented in src/server.js
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

---

## 🧪 Testing

### 1. **Test Public Endpoints**

```bash
# Get plans
curl https://migrapanel.com/api/public/plans

# Start checkout (test mode)
curl -X POST https://migrapanel.com/api/public/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "basic",
    "term": "monthly",
    "email": "test@example.com",
    "successUrl": "http://localhost:3000/success",
    "cancelUrl": "http://localhost:3000/pricing"
  }'
```

### 2. **Test Authenticated Endpoints**

```bash
# Set your API token
API_TOKEN="your-token-here"

# Create customer
curl -X POST https://migrapanel.com/api/customers \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Customer",
    "email": "test@example.com",
    "company": "Test Co"
  }'

# Provision service
curl -X POST https://migrapanel.com/api/provisioning/provision \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "srv_test_123",
    "customerId": "cust_test_456",
    "productId": "prod_basic",
    "domain": "test-domain.com"
  }'

# Check status
curl https://migrapanel.com/api/provisioning/tasks/job_queue_123 \
  -H "Authorization: Bearer $API_TOKEN"
```

### 3. **Test Stripe Webhook Locally**

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:2271/api/webhooks/stripe

# Trigger test event
stripe trigger checkout.session.completed
```

---

## 📚 Quick Reference

### Environment Variables Needed

**Marketing Site (.env)**:
```env
# Public-facing mPanel URL
MPANEL_URL=https://migrapanel.com

# Only if using direct API calls (server-side only!)
MPANEL_API_TOKEN=your-secret-token
```

**mPanel (.env)**:
```env
# Already configured in your .env file
MPANEL_API_TOKEN=2Yk03D3JZk6TFBjxb/zlo+j76Nh2uO2d/xj76jPa+zFXZgkF6bZJFV84z19YliOthakJqc9mWISMwr3BWTc+PA==...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Key URLs

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/public/plans` | GET | None | List products |
| `/api/public/checkout` | POST | None | Start Stripe checkout |
| `/api/webhooks/stripe` | POST | Signature | Stripe events |
| `/api/customers` | POST | Token/JWT | Create customer |
| `/api/provisioning/provision` | POST | Token/JWT | Queue provisioning |
| `/api/provisioning/tasks/:id` | GET | Token/JWT | Check status |

---

## 🎯 Recommended Integration Path

For most marketing sites, we recommend:

1. **Use Public Checkout Flow** (`/api/public/checkout`)
   - Simple to implement
   - Secure (no tokens needed)
   - Stripe handles payment
   - Automatic provisioning

2. **Handle Success Callback** on your success page
   - Parse `session_id` from URL
   - Display order confirmation
   - Optionally create user account

3. **Let Webhooks Handle Provisioning**
   - Stripe sends payment confirmation
   - mPanel automatically provisions service
   - Customer receives email with credentials

4. **Monitor via Admin Dashboard**
   - Use mPanel's `/provisioning` page
   - Track all provisioning jobs
   - Retry failed provisions

---

## 📞 Support

For integration assistance:
- Documentation: Check `API_EXAMPLES.md`, `ARCHITECTURE.md`
- Backend logs: `logs/mpanel.log`
- Provisioning queue: `http://localhost:2272/provisioning`
- Health check: `https://migrapanel.com/api/health`

---

**Last Updated**: November 16, 2025  
**mPanel Version**: 1.0.0
