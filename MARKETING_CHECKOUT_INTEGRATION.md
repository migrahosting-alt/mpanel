# Marketing Website → mPanel Checkout Integration Guide

## Quick Reference

**API Endpoint:** `https://mpanel.migrahosting.com/api/marketing/checkout-intent`  
**API Key:** `mpanel_marketing_live_2025_secure_key_abc123xyz`

## Available Plans

| Plan Name | Plan Slug | Monthly Price |
|-----------|-----------|---------------|
| Student   | `student` | $0.00 (FREE)  |
| Starter   | `starter` | $7.95         |
| Premium   | `premium` | $8.95         |
| Business  | `business`| $9.95         |

## Required Request Format

```javascript
const checkoutData = {
  // REQUIRED: Plan identification
  planSlug: "starter",  // Must be: student, starter, premium, or business
  
  // REQUIRED: Billing cycle
  billingCycle: "monthly",  // Options: monthly, quarterly, semiannually, annually
  
  // OPTIONAL: Domain (can be null or empty string)
  domain: "example.com",  // Must include TLD (.com, .net, etc.) or null
  
  // REQUIRED: Domain mode
  domainMode: "new_registration",  // Options: "new_registration" or "external"
  
  // REQUIRED: Customer information
  customer: {
    email: "customer@example.com",      // REQUIRED
    firstName: "John",                   // OPTIONAL but recommended
    lastName: "Doe"                      // OPTIONAL but recommended
  },
  
  // REQUIRED: Account credentials
  account: {
    password: "SecurePass123!"  // REQUIRED: minimum 8 characters
  },
  
  // OPTIONAL: Promo code
  promoCode: "WELCOME10",  // Optional: validates against database
  
  // OPTIONAL: Auto-provision flag
  autoProvision: true  // Optional: auto-provision after payment (default: false)
};

// Make the request
fetch('https://mpanel.migrahosting.com/api/marketing/checkout-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz'
  },
  body: JSON.stringify(checkoutData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    // Redirect to Stripe checkout or thank you page
    window.location.href = data.data.checkoutUrl;
  } else {
    // Show error message
    console.error('Checkout failed:', data.error);
  }
});
```

## Coupon Code Validation (Optional)

Before submitting checkout, you can validate a coupon code:

```javascript
fetch('https://mpanel.migrahosting.com/api/marketing/validate-coupon', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz'
  },
  body: JSON.stringify({
    code: "WELCOME10",
    planSlug: "starter"  // Optional: to show discount preview
  })
})
.then(response => response.json())
.then(data => {
  if (data.valid) {
    console.log('Discount:', data.discountPreview);
    // Show: "Save $0.80! Final price: $7.15"
  } else {
    console.log('Invalid coupon');
  }
});
```

## Available Coupon Codes

| Code | Discount | Max Uses | Expires |
|------|----------|----------|---------|
| WELCOME10 | 10% off | Unlimited | May 2026 |
| SAVE20 | 20% off | 100 uses | Feb 2026 |
| FIRST50 | 50% off | 50 uses | Dec 2025 |
| FIXED5 | $5.00 off | Unlimited | Nov 2026 |

## Success Response

```json
{
  "success": true,
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
    "subscriptionId": "uuid...",
    "customerId": "uuid...",
    "domainId": "uuid...",
    "status": "pending_payment",
    "price": 7.95,
    "originalPrice": 7.95,
    "discount": {
      "amount": 0.80,
      "code": "WELCOME10",
      "finalPrice": 7.15
    },
    "paymentRequired": true
  }
}
```

## Error Response

```json
{
  "error": "Plan not found"
}
```

## Common Errors & Fixes

### ❌ "Plan not found"
**Cause:** Wrong `planSlug` value  
**Fix:** Use exact slugs: `student`, `starter`, `premium`, `business` (NOT `shared_starter`)

### ❌ "domainMode must be new_registration or external"
**Cause:** Missing or invalid `domainMode` field  
**Fix:** Always include `"domainMode": "new_registration"` in request

### ❌ "planSlug, customer.email, and account.password are required"
**Cause:** Missing required fields  
**Fix:** Ensure all required fields are present in the request body

### ❌ "Invalid domain format"
**Cause:** Domain without TLD (e.g., "example" instead of "example.com")  
**Fix:** Always include TLD or send `null`/empty string if no domain

## HTML Form Example

```html
<form id="checkoutForm">
  <!-- Plan Selection (hidden, set by plan buttons) -->
  <input type="hidden" id="planSlug" value="starter">
  
  <!-- Customer Info -->
  <input type="email" id="email" required placeholder="Email">
  <input type="text" id="firstName" placeholder="First Name">
  <input type="text" id="lastName" placeholder="Last Name">
  
  <!-- Password -->
  <input type="password" id="password" required minlength="8" placeholder="Panel Password">
  
  <!-- Domain (optional) -->
  <input type="text" id="domain" placeholder="yourdomain.com (optional)">
  
  <!-- Coupon Code (optional) -->
  <input type="text" id="promoCode" placeholder="Coupon Code (optional)">
  
  <button type="submit">Complete Order</button>
</form>

<script>
document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const domain = document.getElementById('domain').value.trim();
  
  const checkoutData = {
    planSlug: document.getElementById('planSlug').value,
    billingCycle: "monthly",
    domain: domain || null,  // Send null if empty
    domainMode: "new_registration",  // REQUIRED
    customer: {
      email: document.getElementById('email').value,
      firstName: document.getElementById('firstName').value || null,
      lastName: document.getElementById('lastName').value || null
    },
    account: {
      password: document.getElementById('password').value
    },
    promoCode: document.getElementById('promoCode').value || undefined
  };
  
  try {
    const response = await fetch('https://mpanel.migrahosting.com/api/marketing/checkout-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz'
      },
      body: JSON.stringify(checkoutData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Redirect to checkout or thank you page
      window.location.href = data.data.checkoutUrl;
    } else {
      alert('Checkout failed: ' + data.error);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    alert('Network error. Please try again.');
  }
});
</script>
```

## Testing Checklist

- [ ] Plan slug is correct (student, starter, premium, business)
- [ ] domainMode is included ("new_registration" or "external")
- [ ] Email, password are provided
- [ ] Domain includes TLD or is null
- [ ] Coupon code validates before checkout (optional)
- [ ] Success redirects to checkoutUrl
- [ ] Errors are displayed to user

## Production Deployment

1. Replace API endpoint with production URL
2. Keep API key secure (don't expose in frontend)
3. Use HTTPS for all requests
4. Handle errors gracefully
5. Show loading state during checkout
6. Test with all plan types
7. Test with and without coupons
8. Test with and without domains

---

**Support:** If integration issues persist, check backend logs or contact dev team.
