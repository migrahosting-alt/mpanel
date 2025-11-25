# Thank You Page Setup Guide

## Quick Setup

After a successful checkout, Stripe/mPanel redirects to:
```
https://migrahosting.com/thank-you?session_id={CHECKOUT_SESSION_ID}&email={email}
```

## Option 1: Use Pre-built HTML Template (Fastest)

1. **Upload the file:**
   ```bash
   scp marketing-website-thank-you-page.html your-server:/var/www/html/thank-you.html
   ```

2. **Configure your web server:**
   
   **Nginx:**
   ```nginx
   location /thank-you {
       try_files /thank-you.html =404;
   }
   ```
   
   **Apache:**
   ```apache
   RewriteEngine On
   RewriteRule ^thank-you$ /thank-you.html [L]
   ```

3. **Done!** The page will automatically:
   - Extract session_id from URL
   - Call `/api/marketing/order-status/:sessionId`
   - Display order details
   - Show next steps

## Option 2: Custom Integration

If you want to integrate into your existing thank-you page:

### JavaScript Implementation

```javascript
// Get session ID from URL
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session_id');
const email = urlParams.get('email');

if (sessionId) {
    // Fetch order details
    fetch(`https://mpanel.migrahosting.com/api/marketing/order-status/${sessionId}`, {
        headers: {
            'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const order = data.data;
            
            // Display order information
            document.getElementById('orderNumber').textContent = 
                order.subscriptionId.substring(0, 8);
            document.getElementById('planName').textContent = order.planName;
            document.getElementById('price').textContent = 
                `$${order.price.toFixed(2)}`;
            document.getElementById('email').textContent = 
                order.customerEmail;
            
            // Show discount if applied
            if (order.discount) {
                document.getElementById('discount').innerHTML = `
                    <strong>Discount Applied:</strong> 
                    -$${order.discount.amount.toFixed(2)} 
                    (Original: $${order.discount.originalPrice.toFixed(2)})
                `;
            }
            
            // Show domain if provided
            if (order.domain && !order.domain.startsWith('temp-')) {
                document.getElementById('domain').textContent = order.domain;
            }
        }
    })
    .catch(error => {
        console.error('Error loading order:', error);
        // Fallback: show email confirmation message
        document.getElementById('fallbackMessage').style.display = 'block';
    });
}
```

### Response Data Structure

```json
{
  "success": true,
  "data": {
    "subscriptionId": "uuid-here",
    "status": "active",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "planName": "Starter",
    "price": 7.15,
    "billingCycle": "monthly",
    "domain": "example.com",
    "domainStatus": "pending",
    "promoCode": "WELCOME10",
    "discount": {
      "amount": 0.80,
      "originalPrice": 7.95
    }
  }
}
```

## Option 3: Redirect to Client Portal

If you don't want to create a thank-you page, redirect directly to mPanel:

### Update Redirect URLs

In your checkout integration, add:

```javascript
// After successful checkout
if (data.success) {
    // Redirect to client portal with auto-login (if implemented)
    window.location.href = `https://mpanel.migrahosting.com/login?email=${encodeURIComponent(customerEmail)}&new_account=true`;
}
```

Or update the backend redirect URLs in `marketingApiRoutes.js`:

```javascript
success_url: `https://mpanel.migrahosting.com/welcome`,
cancel_url: `https://migrahosting.com/pricing?canceled=true`,
```

## What to Show on Thank You Page

### Essential Information
1. ✅ Order confirmation message
2. ✅ Order number (use first 8 chars of subscription ID)
3. ✅ Customer email
4. ✅ Plan name and price
5. ✅ Billing cycle

### Optional Details
- Domain name (if provided)
- Discount information (if coupon used)
- Next steps instructions
- Links to:
  - Control panel login
  - Documentation/getting started guide
  - Support page

### Recommended Next Steps Text

```
What's Next?

1. Check your email ({{email}}) for:
   - Your account credentials
   - Control panel access link
   - Getting started guide

2. Your hosting will be provisioned automatically within 5-10 minutes

3. You'll receive a confirmation email when everything is ready

4. Log in to your control panel to:
   - Upload your website
   - Manage domains
   - Configure email accounts
   - View resource usage
```

## Testing

### Test with Successful Payment
```
https://migrahosting.com/thank-you?session_id=sess_test123&email=test@example.com
```

### Test with Free/Test Mode
```
https://migrahosting.com/thank-you?session_id=sess_test123&email=test@example.com&free=true
```

### Test Order Status API
```bash
curl -X GET "https://mpanel.migrahosting.com/api/marketing/order-status/sess_test123" \
  -H "X-API-Key: mpanel_marketing_live_2025_secure_key_abc123xyz"
```

## Troubleshooting

### "Order not found" Error
- Session ID might be invalid or expired
- Check database for subscription with matching checkoutSessionId
- Verify API key is correct

### Page Shows Loading Forever
- Check browser console for errors
- Verify API endpoint is accessible
- Check CORS settings if domain is different

### Wrong Information Displayed
- Clear browser cache
- Check session ID in URL matches database
- Verify API response format

## Production Checklist

- [ ] Thank you page is accessible at `/thank-you`
- [ ] Page handles session_id parameter correctly
- [ ] Order status API is being called successfully
- [ ] Error states are handled gracefully
- [ ] Mobile responsive design
- [ ] Links to control panel work
- [ ] Email confirmation mentions are accurate
- [ ] SEO meta tags are set (noindex recommended)
- [ ] Analytics tracking added (optional)
- [ ] Loading states shown during API calls

## Files Provided

1. `marketing-website-thank-you-page.html` - Complete standalone HTML page
2. This setup guide
3. API endpoint: `/api/marketing/order-status/:sessionId`

---

**Need help?** Check the main integration guide: `MARKETING_CHECKOUT_INTEGRATION.md`
