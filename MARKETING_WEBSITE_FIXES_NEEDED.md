# Marketing Website Frontend Fixes Required

## Overview
The mPanel backend API is working correctly. All issues listed below are **frontend problems** that need to be fixed on the marketing website (migrahosting.com).

---

## 1. ❌ 14-Day Free Trial Toggle Not Working

**Location:** Pricing page - Starter plan card

**Current Issue:** 
- Toggle switch shows "14-Day Free Trial" with "Try risk-free for 14 days"
- Toggle appears to be ON (teal color) but doesn't affect checkout
- When user clicks "Checkout now", they still get charged immediately

**What Needs to Happen:**
When toggle is ON:
1. Add `testMode: true` to checkout API request
2. OR set a special flag indicating free trial period
3. Backend will set price to $0 and status to "trial"
4. User gets 14 days free, then auto-charged

**Files to Edit (on marketing website):**
```javascript
// In your pricing card component (likely PricingCard.jsx or similar)

const [freeTrialEnabled, setFreeTrialEnabled] = useState(false);

// When calling checkout API:
const checkoutData = {
  planSlug: "starter",
  // ... other fields
  testMode: freeTrialEnabled,  // Add this
  // OR
  freeTrial: freeTrialEnabled,  // Alternative approach
};
```

**Backend Support:** Already implemented - just send `testMode: true` in request

---

## 2. ❌ Shopping Cart Allows Multiple Hosting Plans

**Location:** Shopping cart page (`/cart`)

**Current Issue:**
- Screenshot shows 2 "Starter hosting" items in cart:
  - Annually (1 year) - $29.88
  - Triennially (3 years) - $53.64
- Users should only be able to have ONE hosting plan at a time

**Required Fix:**
```javascript
// In your cart management (likely useCart hook or CartContext)

function addToCart(item) {
  // Check if item is a hosting plan
  if (item.type === 'hosting') {
    // Remove any existing hosting plans first
    const filteredCart = cart.filter(cartItem => cartItem.type !== 'hosting');
    setCart([...filteredCart, item]);
    
    showNotification('Previous hosting plan replaced');
  } else {
    // Domains, addons, etc can have multiples
    setCart([...cart, item]);
  }
}
```

**Better UX:**
- Show warning: "You already have a hosting plan. Replace it with this one?"
- Provide "Replace Plan" button instead of "Add to Cart"

---

## 3. ❌ No Option to Add Domains or Other Products

**Location:** Shopping cart page

**Current Issue:**
- Warning banner shows "Domain Required for Hosting"
- But no way to add domain from cart page
- Link says "Search for domains →" but doesn't seem functional

**Required Features:**

### Option A: Domain Search Widget in Cart
```jsx
// Add to cart page
<div className="domain-search-widget">
  <h3>Add a Domain</h3>
  <input 
    type="text" 
    placeholder="Search for your domain..."
    onChange={handleDomainSearch}
  />
  <button onClick={searchDomain}>Search</button>
  
  {searchResults && (
    <div className="search-results">
      {searchResults.map(domain => (
        <div key={domain.name}>
          <span>{domain.name}</span>
          <span>${domain.price}/year</span>
          <button onClick={() => addDomainToCart(domain)}>
            Add to Cart
          </button>
        </div>
      ))}
    </div>
  )}
</div>
```

### Option B: Quick Links
```jsx
<div className="add-more-products">
  <a href="/domains">+ Add Domain</a>
  <a href="/ssl">+ Add SSL Certificate</a>
  <a href="/email">+ Add Email Hosting</a>
</div>
```

---

## 4. ❌ Missing Coupon Code Input

**Location:** Checkout page or Cart summary

**Current Issue:**
- Backend supports coupon codes (WELCOME10, SAVE20, etc.)
- No input field visible in screenshots

**Required Implementation:**
```jsx
// Add to checkout summary or cart page

const [couponCode, setCouponCode] = useState('');
const [couponValid, setCouponValid] = useState(null);
const [discount, setDiscount] = useState(null);

async function validateCoupon() {
  const response = await fetch('/api/marketing/validate-coupon', {
    method: 'POST',
    headers: {
      'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: couponCode,
      planSlug: selectedPlan.slug
    })
  });
  
  const data = await response.json();
  
  if (data.valid) {
    setCouponValid(true);
    setDiscount(data.discountPreview);
    showSuccess(`Coupon applied! Save $${data.discountPreview.discountAmount}`);
  } else {
    setCouponValid(false);
    showError('Invalid coupon code');
  }
}

// In your JSX:
<div className="coupon-section">
  <input 
    type="text"
    placeholder="Enter coupon code"
    value={couponCode}
    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
  />
  <button onClick={validateCoupon}>Apply</button>
  
  {discount && (
    <div className="discount-applied">
      ✓ {discount.discountAmount} off - Final price: ${discount.finalPrice}
    </div>
  )}
</div>
```

---

## 5. ❌ Checkout Page Has No Header/Branding

**Location:** `/checkout` page (Account & Billing Details page)

**Current Issue:**
- Screenshot shows form but no MigraHosting header/logo
- No navigation
- Looks disconnected from main site

**Required Fix:**
```jsx
// Add to checkout page layout

<CheckoutPage>
  <Header>
    <Logo />
    <StepIndicator currentStep={2} totalSteps={3} />
  </Header>
  
  <main>
    {/* Existing form fields */}
  </main>
  
  <Footer>
    <SecurityBadges />
    <SupportLink />
  </Footer>
</CheckoutPage>
```

**Elements to Add:**
1. **Logo/Brand** - Top left
2. **Step Indicator** - "Cart → Checkout → Payment"
3. **Security Badges** - SSL, payment logos
4. **Back to Cart** link
5. **Help/Support** link

---

## 6. ❌ Billing Page Needs Better Design

**Location:** Account & Billing Details form

**Current Issue:**
- Form works but design is basic
- Could use better visual hierarchy
- No progress indication

**Improvements Needed:**

### Visual Enhancements:
```jsx
<div className="billing-page">
  {/* Progress Steps */}
  <div className="checkout-progress">
    <div className="step completed">1. Cart</div>
    <div className="step active">2. Details</div>
    <div className="step">3. Payment</div>
  </div>
  
  {/* Two-column layout */}
  <div className="checkout-layout">
    <div className="billing-form">
      {/* Left side: Form fields */}
      <section className="personal-info">
        <h2>Personal Information</h2>
        {/* Existing fields with better styling */}
      </section>
      
      <section className="billing-address">
        <h2>Billing Address</h2>
        {/* Existing fields */}
      </section>
      
      <section className="panel-password">
        <h2>Control Panel Password</h2>
        <PasswordStrengthIndicator />
        {/* Password field */}
      </section>
      
      <section className="domain-optional">
        <h2>Domain Name (Optional)</h2>
        {/* Domain field */}
      </section>
    </div>
    
    <div className="order-summary-sidebar">
      {/* Right side: Order summary */}
      <h3>Order Summary</h3>
      <OrderItems />
      <CouponCode />
      <PriceBreakdown />
      <TotalPrice />
      <SecurityBadges />
    </div>
  </div>
</div>
```

### Form Validation:
- Real-time validation with visual feedback
- Required field indicators
- Password strength meter
- Email format validation
- Phone number formatting

---

## 7. ❌ Payment Page Shows Only One Product

**Location:** Stripe checkout page

**Current Issue:**
- Payment page shows: "Starter $7.95 yearly billing"
- If user has multiple items in cart (domain, SSL, etc.), only shows hosting

**Root Cause:**
The checkout API currently only handles **one hosting plan** at a time. It doesn't support multi-item carts.

**Backend Changes Needed:**
The current checkout endpoint needs to be modified to accept an array of items:

```javascript
// Current (single item):
POST /api/marketing/checkout-intent
{
  "planSlug": "starter",
  "billingCycle": "monthly"
}

// Needed (multiple items):
POST /api/marketing/checkout-intent
{
  "items": [
    {
      "type": "hosting",
      "planSlug": "starter",
      "billingCycle": "annually"
    },
    {
      "type": "domain",
      "domainName": "example.com",
      "years": 1
    },
    {
      "type": "ssl",
      "sslType": "standard",
      "years": 1
    }
  ],
  "customer": { ... },
  "account": { ... }
}
```

**This requires backend API modification** - currently not supported.

**Temporary Workaround:**
For now, checkout should only process the hosting plan. Domains/addons need separate checkout flow.

---

## 8. ✅ 404 After Payment - Already Fixed

**Solution Provided:**
1. Backend now redirects to: `https://migrahosting.com/thank-you?session_id={ID}&email={email}`
2. HTML template provided: `marketing-website-thank-you-page.html`
3. Setup guide: `THANK_YOU_PAGE_SETUP.md`

**Action Required:**
Upload `marketing-website-thank-you-page.html` to your marketing website at `/thank-you` route.

---

## 9. ℹ️ Test Mode is Correct

**Current Status:**
Payment showing as "TEST MODE" is **intentional and correct** for development.

**To Switch to Live Mode:**
1. Get live Stripe keys from Stripe dashboard
2. Update backend `.env` file:
   ```bash
   STRIPE_SECRET_KEY=sk_live_xxxxx  # Change from sk_test_
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```
3. Restart backend: `pm2 restart mpanel-backend`

**Don't switch to live until:**
- [ ] All frontend issues fixed
- [ ] Thank you page implemented
- [ ] Tested thoroughly with test cards
- [ ] Webhook endpoint configured
- [ ] SSL certificate valid

---

## Priority Implementation Order

### 🔴 Critical (Do First):
1. **Thank You Page** - Prevents 404 after payment
2. **Single Hosting Plan in Cart** - Prevents confusion
3. **Checkout Page Header** - Professional appearance

### 🟡 Important (Do Soon):
4. **Coupon Code Input** - Revenue optimization
5. **Free Trial Toggle** - Feature differentiation
6. **Billing Page Design** - User experience

### 🟢 Enhancement (Do Later):
7. **Domain Search in Cart** - Convenience feature
8. **Multi-item Checkout** - Requires backend changes

---

## Testing Checklist

After implementing fixes, test this flow:

1. **Pricing Page**
   - [ ] Can select plan and billing cycle
   - [ ] Free trial toggle works (Starter plan only)
   - [ ] Click "Checkout now" adds to cart

2. **Shopping Cart**
   - [ ] Shows selected plan with correct price
   - [ ] Changing plan replaces previous one (not adds)
   - [ ] Domain search/add functionality works
   - [ ] "Proceed to Checkout" goes to billing page

3. **Checkout/Billing Page**
   - [ ] Header with logo visible
   - [ ] All form fields work
   - [ ] Validation shows errors
   - [ ] Coupon code input visible and works
   - [ ] Order summary shows on sidebar
   - [ ] "Complete Order" button enabled when valid

4. **Payment Page (Stripe)**
   - [ ] Shows correct total amount
   - [ ] Shows all cart items (when multi-item supported)
   - [ ] Test mode indicator visible
   - [ ] Can complete payment with test card

5. **Thank You Page**
   - [ ] Redirects successfully after payment
   - [ ] Shows order details correctly
   - [ ] Displays customer email
   - [ ] Links to control panel work
   - [ ] No 404 errors

---

## Code Examples Repository

All code examples provided above are **frontend code** that needs to be added to your marketing website codebase.

**Backend API is ready and working:**
- ✅ Checkout endpoint
- ✅ Coupon validation endpoint
- ✅ Order status endpoint
- ✅ Proper redirects configured

**Frontend needs work on:**
- ❌ Cart management logic
- ❌ Checkout form layout
- ❌ Coupon UI component
- ❌ Thank you page
- ❌ Trial mode toggle

---

## Support Resources

1. **API Documentation:** `/opt/mpanel/MARKETING_CHECKOUT_INTEGRATION.md`
2. **Thank You Page Guide:** `/opt/mpanel/THANK_YOU_PAGE_SETUP.md`
3. **Thank You Page Template:** `/opt/mpanel/marketing-website-thank-you-page.html`

**Available Coupon Codes for Testing:**
- `WELCOME10` - 10% off
- `SAVE20` - 20% off  
- `FIRST50` - 50% off
- `FIXED5` - $5.00 off

**Test Credit Cards (Stripe Test Mode):**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- 3D Secure: `4000 0025 0000 3155`

---

*All fixes are frontend changes on migrahosting.com - no backend changes needed.*
