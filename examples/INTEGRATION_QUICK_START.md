# mPanel Marketing Site Integration - Quick Start

## 🚀 Quick Integration (Copy & Paste)

### 1. JavaScript Client Library

Save this as `mpanel-client.js` in your marketing site:

```javascript
// mpanel-client.js - Drop-in integration for mPanel
class MPanelClient {
  constructor(baseURL = 'https://migrapanel.com') {
    this.baseURL = baseURL;
  }

  async getPlans() {
    const response = await fetch(`${this.baseURL}/api/public/plans`);
    if (!response.ok) throw new Error('Failed to fetch plans');
    const data = await response.json();
    return data.plans;
  }

  async createCheckout(planId, term, email, successUrl, cancelUrl) {
    const response = await fetch(`${this.baseURL}/api/public/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        term,
        email,
        successUrl: successUrl || `${window.location.origin}/success`,
        cancelUrl: cancelUrl || window.location.href
      })
    });
    if (!response.ok) throw new Error('Failed to create checkout');
    return response.json();
  }
}

// Usage:
// const client = new MPanelClient('https://your-mpanel-domain.com');
// const plans = await client.getPlans();
// const checkout = await client.createCheckout('basic', 'monthly', 'user@email.com');
// window.location.href = checkout.url;
```

### 2. HTML Pricing Page Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hosting Plans</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <div id="plans" class="max-w-7xl mx-auto px-4 py-12"></div>

  <script>
    const MPANEL_URL = 'https://migrapanel.com'; // mPanel API URL

    async function loadPlans() {
      const response = await fetch(`${MPANEL_URL}/api/public/plans`);
      const data = await response.json();
      
      const container = document.getElementById('plans');
      container.innerHTML = data.plans.map(plan => `
        <div class="bg-white rounded-lg shadow p-6 mb-4">
          <h3 class="text-2xl font-bold">${plan.name}</h3>
          <p class="text-gray-600">${plan.description}</p>
          <div class="text-3xl font-bold my-4">
            $${plan.monthly_price}/month
          </div>
          <button onclick="buyPlan('${plan.id}')" 
                  class="bg-blue-600 text-white px-6 py-2 rounded">
            Get Started
          </button>
        </div>
      `).join('');
    }

    async function buyPlan(planId) {
      const email = prompt('Enter your email:');
      if (!email) return;

      const response = await fetch(`${MPANEL_URL}/api/public/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          term: 'monthly',
          email,
          successUrl: window.location.origin + '/success.html',
          cancelUrl: window.location.href
        })
      });

      const data = await response.json();
      window.location.href = data.url; // Redirect to Stripe
    }

    loadPlans();
  </script>
</body>
</html>
```

### 3. React Integration

```jsx
// useMPanel.js - React Hook
import { useState, useEffect } from 'react';

export function useMPanel(baseURL = 'https://migrapanel.com') {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${baseURL}/api/public/plans`)
      .then(res => res.json())
      .then(data => {
        setPlans(data.plans);
        setLoading(false);
      });
  }, [baseURL]);

  const createCheckout = async (planId, term, email) => {
    const response = await fetch(`${baseURL}/api/public/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        term,
        email,
        successUrl: `${window.location.origin}/success`,
        cancelUrl: window.location.href
      })
    });
    const data = await response.json();
    return data.url;
  };

  return { plans, loading, createCheckout };
}

// PricingPage.jsx - Usage Example
function PricingPage() {
  const { plans, loading, createCheckout } = useMPanel();

  const handleBuy = async (planId) => {
    const email = prompt('Enter your email:');
    if (email) {
      const checkoutUrl = await createCheckout(planId, 'monthly', email);
      window.location.href = checkoutUrl;
    }
  };

  if (loading) return <div>Loading plans...</div>;

  return (
    <div className="grid grid-cols-3 gap-6">
      {plans.map(plan => (
        <div key={plan.id} className="border rounded-lg p-6">
          <h3 className="text-2xl font-bold">{plan.name}</h3>
          <p className="text-gray-600">{plan.description}</p>
          <div className="text-3xl font-bold my-4">
            ${plan.monthly_price}/mo
          </div>
          <button 
            onClick={() => handleBuy(plan.id)}
            className="bg-blue-600 text-white px-6 py-2 rounded w-full">
            Get Started
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 4. WordPress Integration (PHP)

```php
<?php
// mpanel-integration.php - WordPress Plugin/Theme

function mpanel_get_plans() {
    $mpanel_url = 'https://migrapanel.com'; // mPanel API URL
    
    $response = wp_remote_get($mpanel_url . '/api/public/plans');
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    return $data['plans'] ?? [];
}

function mpanel_create_checkout($plan_id, $term, $email) {
    $mpanel_url = 'https://migrapanel.com'; // mPanel API URL
    
    $response = wp_remote_post($mpanel_url . '/api/public/checkout', [
        'headers' => ['Content-Type' => 'application/json'],
        'body' => json_encode([
            'planId' => $plan_id,
            'term' => $term,
            'email' => $email,
            'successUrl' => home_url('/success'),
            'cancelUrl' => home_url('/pricing')
        ])
    ]);
    
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    return $data['url'] ?? null;
}

// Shortcode: [mpanel_pricing]
add_shortcode('mpanel_pricing', function() {
    $plans = mpanel_get_plans();
    
    ob_start();
    ?>
    <div class="mpanel-pricing">
        <?php foreach ($plans as $plan): ?>
        <div class="plan">
            <h3><?php echo esc_html($plan['name']); ?></h3>
            <p><?php echo esc_html($plan['description']); ?></p>
            <div class="price">$<?php echo esc_html($plan['monthly_price']); ?>/mo</div>
            <a href="<?php echo admin_url('admin-ajax.php?action=mpanel_checkout&plan=' . $plan['id']); ?>" 
               class="btn">Get Started</a>
        </div>
        <?php endforeach; ?>
    </div>
    <?php
    return ob_get_clean();
});
?>
```

## 📋 Integration Checklist

### Step 1: mPanel URL Configuration
The examples are pre-configured for production:
- **Production**: `https://migrapanel.com` (already set)
- **Local Development**: Change to `http://localhost:2271`
- **Staging**: `https://staging.migrapanel.com`

### Step 2: Set Up Stripe Webhooks
1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://your-mpanel-domain.com/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `payment_intent.succeeded`
4. Copy webhook secret to mPanel `.env` → `STRIPE_WEBHOOK_SECRET`

### Step 3: Test the Integration
```bash
# Test plans endpoint
curl https://migrapanel.com/api/public/plans

# Should return JSON with plans array
```

### Step 4: Deploy
- Copy client code to your marketing site
- Update all URLs from localhost to production
- Test checkout flow end-to-end

## 🔗 Available API Endpoints

### Public Endpoints (No Auth Required)

**GET** `/api/public/plans`
- Returns all available hosting plans
- Response: `{ plans: [...] }`

**POST** `/api/public/checkout`
- Creates Stripe checkout session
- Body: `{ planId, term, email, successUrl, cancelUrl }`
- Response: `{ url: "stripe-checkout-url", id: "session-id" }`

**POST** `/api/webhooks/stripe`
- Stripe webhook receiver (Stripe signature required)
- Handles payment events and provisions services

## 🎯 Quick Copy Commands

```bash
# Copy just the client library
cp examples/mpanel-client.js /path/to/marketing-site/src/

# Copy the demo page
cp examples/marketing-demo.html /path/to/marketing-site/pricing.html

# Copy success page
cp examples/success.html /path/to/marketing-site/success.html
```

## 🔐 Environment Variables

Add to your marketing site `.env`:
```env
NEXT_PUBLIC_MPANEL_URL=https://migrapanel.com
# or for Vite/Vue
VITE_MPANEL_URL=https://migrapanel.com
```

## ✅ That's It!

Your marketing site can now:
- ✅ Display plans from mPanel
- ✅ Create Stripe checkout sessions
- ✅ Automatically provision services after payment
- ✅ Redirect customers to mPanel client portal

**Support:** Check `MARKETING_INTEGRATION_GUIDE.md` for detailed documentation.
