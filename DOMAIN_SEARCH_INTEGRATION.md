# Domain Search Integration Guide

## Overview

This guide shows you how to integrate mPanel's domain search functionality into your marketing website. The domain search widget connects to:

1. **Domain Pricing API** - Real-time pricing from your mPanel instance
2. **Domain Availability API** - Live WHOIS checks via NameSilo
3. **Shopping Cart** - Add domains and redirect to signup with pre-filled cart

## What You Get

✅ **Live Domain Search** - Check availability across all popular TLDs  
✅ **Real-time Pricing** - Automatically synced with NameSilo  
✅ **Smart Suggestions** - Shows alternative TLDs when first choice is taken  
✅ **Shopping Cart** - Add multiple domains and checkout together  
✅ **Responsive Design** - Works perfectly on mobile and desktop  
✅ **No Authentication Required** - Public API endpoints for marketing site  

---

## Quick Start

### Option 1: React/TypeScript Component

**File:** `examples/DomainSearchWidget.tsx`

```tsx
import DomainSearchWidget from './DomainSearchWidget';

function YourMarketingPage() {
  return (
    <div>
      <h1>Find Your Perfect Domain</h1>
      <DomainSearchWidget />
    </div>
  );
}
```

**Features:**
- TypeScript type safety
- React hooks for state management
- Lucide icons included
- Tailwind CSS styling

### Option 2: Vanilla JavaScript/HTML

**File:** `examples/domain-search-widget.html`

Simply copy the HTML file to your marketing site:

```html
<!-- Embed directly -->
<iframe src="domain-search-widget.html" width="100%" height="800px" frameborder="0"></iframe>

<!-- Or copy the code into your page -->
<!-- See domain-search-widget.html for full code -->
```

**Features:**
- No framework required
- Works with any static site
- Tailwind CSS CDN included
- Pure JavaScript

---

## API Endpoints Used

### 1. Domain Pricing API (Public)

**Endpoint:** `GET https://migrapanel.com/api/domain-pricing/popular`

Returns pricing for the 8 most popular TLDs (.com, .net, .org, .io, .co, .ai, .app, .dev).

**Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "tld": ".com",
      "cost_price": "9.99",
      "registration_price": "11.99",
      "renewal_price": "11.99",
      "transfer_price": "11.99",
      "profit_margin": "20.02",
      "is_active": true
    }
    // ... more TLDs
  ]
}
```

### 2. Domain Availability API (Public)

**Endpoint:** `POST https://migrapanel.com/api/domain-registration/check-availability-public`

Checks if domains are available for registration.

**Request:**
```json
{
  "domains": ["myawesomesite.com", "myawesomesite.net", "myawesomesite.io"]
}
```

**Response:**
```json
{
  "success": true,
  "results": {
    "myawesomesite.com": "available",
    "myawesomesite.net": "unavailable",
    "myawesomesite.io": "available"
  }
}
```

**Rate Limiting:** Maximum 20 domains per request

---

## Integration Steps

### Step 1: Copy Widget Files

Copy the widget file to your marketing site:

```bash
# For React/Next.js
cp examples/DomainSearchWidget.tsx /path/to/your/marketing-site/components/

# For vanilla HTML
cp examples/domain-search-widget.html /path/to/your/marketing-site/public/
```

### Step 2: Verify API URLs

The widgets use `https://migrapanel.com` by default. If your mPanel instance is on a different domain, update the URL:

**React Component:**
```tsx
const MPANEL_URL = 'https://your-mpanel-domain.com';
```

**HTML Version:**
```javascript
const MPANEL_URL = 'https://your-mpanel-domain.com';
```

### Step 3: Add Dependencies (React Only)

```bash
npm install lucide-react
```

Make sure Tailwind CSS is configured in your project.

### Step 4: Configure CORS (Backend)

If your marketing site is on a different domain, ensure CORS is enabled in mPanel:

**File:** `src/server.js`

```javascript
app.use(cors({
  origin: [
    'https://your-marketing-site.com',
    'https://www.your-marketing-site.com'
  ],
  credentials: true
}));
```

### Step 5: Test the Integration

1. Open your marketing site with the domain search widget
2. Search for a domain (e.g., "myawesomesite")
3. Verify pricing appears correctly
4. Check availability results
5. Add domains to cart
6. Click "Proceed to Checkout"
7. Verify redirect to mPanel signup with domains in URL

---

## Customization

### Change Colors

**React Component:**

```tsx
// Search button
className="bg-blue-600 hover:bg-blue-700"
// Change to your brand color:
className="bg-purple-600 hover:bg-purple-700"

// Available domains
className="border-green-200 bg-green-50"
// Change to:
className="border-blue-200 bg-blue-50"
```

**HTML Version:**

Same approach - search for color classes and replace:
- `bg-blue-600` → `bg-purple-600`
- `text-green-600` → `text-blue-600`

### Add More TLDs

By default, the widget shows 8 popular TLDs. To add more:

1. **Update Database** (on mPanel backend):

```sql
INSERT INTO domain_pricing (tld, cost_price, registration_price, renewal_price, transfer_price, profit_margin)
VALUES 
  ('.xyz', 11.99, 14.99, 14.99, 14.99, 25.02),
  ('.tech', 39.99, 47.99, 47.99, 47.99, 20.01);
```

2. **Widget automatically includes all active TLDs** - no code changes needed!

### Customize Signup Redirect

When users click "Proceed to Checkout", they're redirected with domains in the URL:

```
https://migrapanel.com/signup?domains=myawesomesite.com,myawesomesite.io
```

To customize this flow:

**React Component:**
```tsx
const checkout = () => {
  const domains = cart.map(d => d.domain).join(',');
  // Option 1: Direct signup
  window.location.href = `${MPANEL_URL}/signup?domains=${encodeURIComponent(domains)}`;
  
  // Option 2: Custom checkout page
  window.location.href = `${MPANEL_URL}/checkout/domains?items=${encodeURIComponent(domains)}`;
  
  // Option 3: Open in new tab
  window.open(`${MPANEL_URL}/signup?domains=${encodeURIComponent(domains)}`, '_blank');
};
```

---

## Advanced Features

### Add Promo Codes

Modify the checkout URL to include promo codes:

```javascript
const checkout = () => {
  const domains = cart.map(d => d.domain).join(',');
  const promoCode = 'LAUNCH50'; // 50% off
  window.location.href = `${MPANEL_URL}/signup?domains=${encodeURIComponent(domains)}&promo=${promoCode}`;
};
```

### Track Conversions

Add analytics tracking:

```javascript
const checkout = () => {
  // Google Analytics
  gtag('event', 'begin_checkout', {
    currency: 'USD',
    value: cartTotal,
    items: cart.map(d => ({
      item_id: d.tld,
      item_name: d.domain,
      price: parseFloat(d.price)
    }))
  });

  // Facebook Pixel
  fbq('track', 'InitiateCheckout', {
    value: cartTotal,
    currency: 'USD',
    content_ids: cart.map(d => d.domain),
    content_type: 'product'
  });

  // Proceed to mPanel
  const domains = cart.map(d => d.domain).join(',');
  window.location.href = `${MPANEL_URL}/signup?domains=${encodeURIComponent(domains)}`;
};
```

### Add Domain Suggestions

Show alternative domains when search term is unavailable:

```javascript
// In searchDomains() function, add this after getting results:
if (searchResults.every(r => !r.available)) {
  // All unavailable - suggest alternatives
  const suggestions = [
    `get${cleanDomain}.com`,
    `${cleanDomain}online.com`,
    `${cleanDomain}hq.com`,
    `my${cleanDomain}.com`
  ];
  
  // Check availability of suggestions
  // ... (similar API call)
}
```

---

## Troubleshooting

### Issue: "Failed to fetch pricing"

**Cause:** CORS not configured or mPanel backend not running

**Solution:**
1. Check mPanel is running: `curl https://migrapanel.com/api/health`
2. Verify CORS settings in `src/server.js`
3. Check browser console for CORS errors

### Issue: "Failed to check domain availability"

**Cause:** NameSilo API not configured or sandbox mode issue

**Solution:**
1. Check `.env` file has `NAMESILO_API_KEY=your-key`
2. Verify NameSilo API key is valid
3. Check NameSilo sandbox mode: `NAMESILO_SANDBOX=true` (for testing)
4. Review logs: `docker compose logs -f mpanel-backend`

### Issue: Domains show wrong prices

**Cause:** Pricing not updated from NameSilo

**Solution:**
```bash
# Trigger manual pricing update
curl -X POST https://migrapanel.com/api/domain-pricing/update \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"force": true}'

# Or wait for daily cron (3 AM)
```

### Issue: All domains show as unavailable

**Cause:** NameSilo API error or rate limiting

**Solution:**
1. Check NameSilo API status
2. Verify API key permissions
3. Check rate limits (60 requests/minute)
4. Review backend logs for API errors

---

## Testing Checklist

- [ ] Domain search returns results
- [ ] Pricing displays correctly
- [ ] Available domains are highlighted in green
- [ ] Unavailable domains show as gray
- [ ] Add to cart works
- [ ] Remove from cart works
- [ ] Cart total calculates correctly
- [ ] Checkout redirects to mPanel signup
- [ ] Domain names appear in signup URL
- [ ] Mobile layout is responsive
- [ ] Loading states work correctly
- [ ] Error messages display properly

---

## Production Checklist

### Before Launch:

1. **Disable NameSilo Sandbox Mode**
   ```env
   NAMESILO_SANDBOX=false
   ```

2. **Enable Production Pricing Updates**
   ```env
   NODE_ENV=production
   ```
   This enables the daily 3 AM cron job for automatic pricing updates.

3. **Set Up SSL**
   - Ensure `https://migrapanel.com` has valid SSL certificate
   - Test API endpoints over HTTPS

4. **Configure Rate Limiting**
   - Add rate limiting middleware to public endpoints
   - Suggested: 100 requests per IP per hour

5. **Enable Monitoring**
   - Set up alerts for API failures
   - Monitor domain search conversion rate
   - Track popular TLDs

6. **Test with Real Domains**
   - Try searching for known available domains
   - Try searching for known taken domains (google.com, etc.)
   - Verify pricing matches NameSilo exactly

---

## Support

### Documentation
- **Pricing Config Guide:** `PRICING_COMPONENTS_GUIDE.md`
- **NameSilo Integration:** `NAMESILO_INTEGRATION.md`
- **Domain Pricing Guide:** `DOMAIN_PRICING_GUIDE.md`

### API Reference
- Domain Pricing: `GET /api/domain-pricing/popular`
- Availability Check: `POST /api/domain-registration/check-availability-public`

### Need Help?
- Check backend logs: `docker compose logs -f mpanel-backend`
- Review browser console for client-side errors
- Test API endpoints with curl/Postman
- Verify NameSilo API key and permissions

---

## Example Implementations

### Landing Page Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Get Your Domain - Your Company</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <header>
    <nav><!-- Your navigation --></nav>
  </header>

  <main>
    <section class="hero">
      <h1>Start Your Online Journey</h1>
      <p>Find the perfect domain for your business</p>
    </section>

    <!-- Domain Search Widget -->
    <section class="domain-search py-12">
      <iframe src="/domain-search-widget.html" width="100%" height="800px" frameborder="0"></iframe>
    </section>

    <section class="features">
      <!-- Your features section -->
    </section>
  </main>

  <footer><!-- Your footer --></footer>
</body>
</html>
```

### React/Next.js Page

```tsx
import DomainSearchWidget from '@/components/DomainSearchWidget';

export default function DomainsPage() {
  return (
    <div className="container mx-auto py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">
          Find Your Perfect Domain
        </h1>
        <p className="text-xl text-gray-600">
          Search millions of domains with real-time pricing
        </p>
      </div>

      <DomainSearchWidget />

      <div className="mt-12 grid md:grid-cols-3 gap-8">
        <div className="text-center">
          <h3 className="font-bold mb-2">Competitive Pricing</h3>
          <p>Always cheaper than the big guys</p>
        </div>
        <div className="text-center">
          <h3 className="font-bold mb-2">Free WHOIS Privacy</h3>
          <p>Protect your personal information</p>
        </div>
        <div className="text-center">
          <h3 className="font-bold mb-2">Easy Management</h3>
          <p>Manage all domains in one place</p>
        </div>
      </div>
    </div>
  );
}
```

---

**Last Updated:** November 16, 2025  
**mPanel Version:** 1.0.0  
**API Compatibility:** v1
