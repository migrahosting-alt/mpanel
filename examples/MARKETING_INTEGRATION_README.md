# Marketing Site Integration - Quick Reference

## 🎯 What You're Integrating

A complete domain search widget that:
- Checks domain availability in real-time
- Shows competitive pricing
- Lets users add domains to cart
- Redirects to mPanel for checkout

---

## 📦 Files You Need

### Option 1: React/TypeScript
**File:** `DomainSearchWidget.tsx`  
**Use if:** Your marketing site uses React, Next.js, or similar

### Option 2: Vanilla HTML/JavaScript
**File:** `domain-search-widget.html`  
**Use if:** Your marketing site is static HTML, WordPress, or any other platform

---

## 🚀 5-Minute Setup (HTML Version)

1. **Copy the file to your site:**
   ```bash
   cp domain-search-widget.html /your/website/public/
   ```

2. **Embed in your page:**
   ```html
   <iframe src="/domain-search-widget.html" 
           width="100%" 
           height="800px" 
           frameborder="0"></iframe>
   ```

3. **Done!** The widget will automatically connect to `https://migrapanel.com`

---

## 🚀 5-Minute Setup (React Version)

1. **Install dependencies:**
   ```bash
   npm install lucide-react
   ```

2. **Copy component:**
   ```bash
   cp DomainSearchWidget.tsx /your/marketing-site/components/
   ```

3. **Import and use:**
   ```tsx
   import DomainSearchWidget from '@/components/DomainSearchWidget';
   
   function DomainsPage() {
     return (
       <div>
         <h1>Find Your Perfect Domain</h1>
         <DomainSearchWidget />
       </div>
     );
   }
   ```

4. **Done!** Make sure Tailwind CSS is configured.

---

## ⚙️ Configuration

### Change API URL (Optional)

If your mPanel instance is NOT at `https://migrapanel.com`, update the URL:

**React Component (Line 21):**
```tsx
const MPANEL_URL = 'https://your-actual-domain.com';
```

**HTML Version (Line 155):**
```javascript
const MPANEL_URL = 'https://your-actual-domain.com';
```

### Customize Colors

**React:** Edit className properties  
**HTML:** Edit class attributes

Example - Change blue theme to purple:
```
Find: bg-blue-600
Replace: bg-purple-600

Find: text-blue-600
Replace: text-purple-600

Find: border-blue-500
Replace: text-purple-500
```

---

## 🔌 API Endpoints Used

Your widget connects to these public endpoints (no authentication required):

### 1. Get Domain Pricing
```
GET https://migrapanel.com/api/domain-pricing/popular
```

Returns pricing for .com, .net, .org, .io, .co, .ai, .app, .dev

### 2. Check Domain Availability
```
POST https://migrapanel.com/api/domain-registration/check-availability-public
Body: {"domains": ["example.com", "example.net"]}
```

Returns which domains are available for registration.

---

## 🎨 How It Works

1. **User enters domain name** (e.g., "myawesomesite")
2. **Widget checks availability** for all popular TLDs (.com, .net, etc.)
3. **Shows results** with pricing from your database
4. **User adds domains to cart**
5. **Clicks "Proceed to Checkout"**
6. **Redirects to mPanel signup** with domains pre-filled:
   ```
   https://migrapanel.com/signup?domains=myawesomesite.com,myawesomesite.io
   ```

---

## 🧪 Testing

### Test the Widget Locally:

**HTML Version:**
```bash
# Open directly in browser
open domain-search-widget.html

# Or serve with Python
python3 -m http.server 8000
# Then visit: http://localhost:8000/domain-search-widget.html
```

**React Version:**
```bash
npm run dev
# Visit your development server
```

### Test API Endpoints:

```bash
# Test pricing
curl https://migrapanel.com/api/domain-pricing/popular

# Test availability (replace with actual domain)
curl -X POST https://migrapanel.com/api/domain-registration/check-availability-public \
  -H "Content-Type: application/json" \
  -d '{"domains": ["test12345.com"]}'
```

---

## 🐛 Common Issues

### Issue: "Failed to fetch pricing"
**Cause:** CORS or backend not running  
**Fix:** Contact backend team to whitelist your marketing site domain in CORS settings

### Issue: Pricing shows $0.00
**Cause:** Database not populated  
**Fix:** Backend team needs to run pricing setup

### Issue: All domains show unavailable
**Cause:** NameSilo API not configured  
**Fix:** Backend team needs to whitelist server IP in NameSilo account

---

## 📱 Mobile Responsive

Both widgets are fully responsive and work great on:
- ✅ Desktop (Chrome, Firefox, Safari, Edge)
- ✅ Tablets (iPad, Android tablets)
- ✅ Mobile (iOS Safari, Android Chrome)

No additional configuration needed!

---

## 🎨 Styling

Both widgets use **Tailwind CSS**:

**HTML Version:** Uses Tailwind CDN (no setup needed)  
**React Version:** Requires Tailwind in your project

### Not using Tailwind?

You'll need to either:
1. Add Tailwind to your project
2. Or convert the classes to your CSS framework

---

## 🔐 Security

The widget only uses **public API endpoints** - no API keys or authentication required in your frontend code. All sensitive operations (domain registration, payments) happen on the mPanel backend after user signs up.

---

## 📊 Analytics Integration

### Track domain searches:

```javascript
// Add to searchDomains() function
gtag('event', 'domain_search', {
  search_term: searchTerm
});
```

### Track cart additions:

```javascript
// Add to addToCart() function
gtag('event', 'add_to_cart', {
  items: [{
    item_name: domain.domain,
    item_category: 'domain',
    price: parseFloat(domain.price)
  }]
});
```

### Track checkouts:

```javascript
// Add to checkout() function
gtag('event', 'begin_checkout', {
  value: cartTotal,
  items: cart.map(d => ({
    item_name: d.domain,
    price: parseFloat(d.price)
  }))
});
```

---

## 🆘 Need Help?

1. **Check the detailed guide:** `DOMAIN_SEARCH_INTEGRATION.md`
2. **Contact backend team** for:
   - CORS configuration
   - API endpoint issues
   - Database/pricing problems
3. **Check browser console** for JavaScript errors
4. **Test API endpoints directly** with curl (see Testing section)

---

## ✨ What's Next?

After basic integration works:

1. **Customize styling** to match your brand
2. **Add analytics tracking** (see above)
3. **A/B test** different CTAs and layouts
4. **Add trust badges** ("100% secure", "Instant activation", etc.)
5. **Show testimonials** from happy domain customers

---

**Quick Start Checklist:**
- [ ] Copy widget file to your project
- [ ] Update `MPANEL_URL` if needed
- [ ] Test locally in browser
- [ ] Deploy to staging
- [ ] Verify API calls work
- [ ] Test checkout flow
- [ ] Deploy to production
- [ ] Monitor conversions

**Ready to go!** 🚀
