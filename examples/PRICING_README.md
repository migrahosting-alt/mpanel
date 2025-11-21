# 💰 Pricing Components for Marketing Site Integration

Complete pricing components that pull data from centralized configuration files instead of hard-coded values.

## 📦 What's Included

### Configuration Files
| File | Description |
|------|-------------|
| `pricingConfig.ts` | TypeScript pricing configuration (recommended) |
| `pricingConfig.js` | JavaScript pricing configuration (no TypeScript needed) |

### React Components (TypeScript)
| File | Component(s) | Product Type |
|------|-------------|--------------|
| `HostingPricingComponent.tsx` | HostingPricingComponent | Shared Hosting (4 plans) |
| `WordPressPricingComponent.tsx` | WordPressPricingComponent | Managed WordPress (4 plans) |
| `SimplePricingComponents.tsx` | EmailPricingComponent<br>VPSPricingComponent<br>CloudPricingComponent<br>StoragePricingComponent | Email (3 plans)<br>VPS (3 plans)<br>Cloud (3 plans)<br>Storage (3 plans) |

### Examples
| File | Description |
|------|-------------|
| `pricing-vanilla-example.html` | Complete vanilla JavaScript example (no framework) |
| `PRICING_COMPONENTS_GUIDE.md` | Comprehensive integration guide |

## 🚀 Quick Start

### 1. Copy Files to Your Marketing Site

```bash
# Navigate to mPanel examples directory
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel/examples

# Copy to your marketing site
cp pricingConfig.* /path/to/marketing-site/src/config/
cp *PricingComponent*.tsx /path/to/marketing-site/src/components/pricing/
```

### 2. Import and Use

```tsx
// TypeScript/React example
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';
import { EmailPricingComponent } from '@/components/pricing/SimplePricingComponents';

export default function PricingPage() {
  return (
    <div>
      <HostingPricingComponent />
      <EmailPricingComponent />
    </div>
  );
}
```

```jsx
// Vanilla JavaScript example
<script type="module">
  import { hostingPlans, formatPrice } from './pricingConfig.js';
  
  // Use the pricing data
  console.log(hostingPlans.plans);
</script>
```

## 📊 Pricing Data Structure

### Hosting Plans (4 Billing Cycles)
```javascript
{
  student:   $0/mo  (all terms - requires verification)
  starter:   $7.95/mo → $1.99/mo (1 year) → $1.69/mo (2 years) → $1.49/mo (3 years)
  premium:   $8.95/mo → $3.19/mo (1 year) → $2.79/mo (2 years) → $2.49/mo (3 years)
  business:  $9.95/mo → $4.79/mo (1 year) → $4.39/mo (2 years) → $3.99/mo (3 years)
}
```

### WordPress Plans (4 Billing Cycles)
```javascript
{
  wp-starter:   $11.95/mo → $8.95/mo (1 year) → $7.95/mo (2 years) → $6.95/mo (3 years)
  wp-growth:    $16.95/mo → $12.95/mo (1 year) → $11.45/mo (2 years) → $9.95/mo (3 years)
  wp-business:  $24.95/mo → $19.95/mo (1 year) → $17.95/mo (2 years) → $15.95/mo (3 years)
  wp-agency:    $39.95/mo → $32.95/mo (1 year) → $29.95/mo (2 years) → $26.95/mo (3 years)
}
```

### Email Plans (2 Billing Cycles)
```javascript
{
  mail-basic:     $1.50/mo (monthly) → $1.20/mo (yearly)
  mail-pro:       $2.50/mo (monthly) → $2.00/mo (yearly)
  mail-business:  $3.50/mo (monthly) → $3.00/mo (yearly)
}
```

### VPS Plans (2 Billing Cycles)
```javascript
{
  vps-essential:  $7.95/mo (monthly) → $6.95/mo (yearly)
  vps-plus:       $14.95/mo (monthly) → $12.95/mo (yearly)
  vps-pro:        $29.95/mo (monthly) → $24.95/mo (yearly)
}
```

### Cloud Plans (2 Billing Cycles)
```javascript
{
  cloud-start:      $19.95/mo (monthly) → $16.95/mo (yearly)
  cloud-scale:      $39.95/mo (monthly) → $32.95/mo (yearly)
  cloud-enterprise: $79.95/mo (monthly) → $64.95/mo (yearly)
}
```

### Storage Plans (2 Billing Cycles)
```javascript
{
  storage-personal:  $4.95/mo (monthly) → $3.95/mo (yearly)
  storage-team:      $9.95/mo (monthly) → $8.45/mo (yearly)
  storage-business:  $24.95/mo (monthly) → $19.95/mo (yearly)
}
```

## 🛠️ Helper Functions

All configuration files include these helper functions:

### `formatPrice(price, currency)`
```javascript
formatPrice(1.99, 'USD') // Returns: "$1.99"
```

### `getBillingCycleLabel(cycle)`
```javascript
getBillingCycleLabel('oneYear') // Returns: "1 Year"
getBillingCycleLabel('monthly') // Returns: "Monthly"
```

### `getMonthsForCycle(cycle)`
```javascript
getMonthsForCycle('oneYear')    // Returns: 12
getMonthsForCycle('threeYears') // Returns: 36
```

### `getPriceWithSavings(monthlyPrice, termPrice, months)`
```javascript
getPriceWithSavings(7.95, 23.88, 12)
// Returns: { price: 23.88, savings: 71.52, savingsPercent: 75 }
```

## 🔧 Customization

### Update Prices
Edit `pricingConfig.ts` or `pricingConfig.js`:

```javascript
export const hostingPlans = {
  plans: [
    {
      id: "starter",
      pricing: {
        monthly: 7.95,    // Update here
        oneYear: 1.99,    // Update here
        // ...
      },
    },
  ],
};
```

### Add Features
Extend the plan objects:

```javascript
{
  id: "starter",
  name: "Starter",
  pricing: { /* ... */ },
  features: [
    "1 Website",
    "10 GB SSD Storage",
    "Unlimited Bandwidth",
    "Free SSL Certificate"
  ]
}
```

### Integrate with mPanel Checkout
See `PRICING_COMPONENTS_GUIDE.md` for complete integration examples with:
- Email collection
- Stripe checkout flow
- Loading states
- Error handling

## 📱 Features

✅ **Responsive Design** - Mobile-first, works on all screen sizes  
✅ **Savings Calculation** - Automatic savings percentage and amount display  
✅ **Dynamic Billing Cycles** - Switch between monthly/yearly/multi-year terms  
✅ **Type Safety** - Full TypeScript support with types exported  
✅ **No Hardcoding** - All prices pulled from central config  
✅ **Framework Agnostic** - Works with React, Next.js, Astro, Vue, or vanilla JS  
✅ **Tailwind CSS** - Pre-styled with Tailwind utility classes  
✅ **mPanel Integration Ready** - Examples include checkout API calls  

## 🎨 Component Previews

### Shared Hosting
4 pricing cards with billing cycle selector (Monthly/1 Year/2 Years/3 Years)

### WordPress
4 pricing cards with purple theme, optimized for WordPress hosting

### Email/VPS/Cloud/Storage
3 pricing cards each with monthly/yearly toggle

## 📋 Integration Checklist

- [ ] Copy `pricingConfig.ts` or `pricingConfig.js` to your project
- [ ] Copy relevant component files (`.tsx` for React/TypeScript)
- [ ] Update import paths to match your project structure
- [ ] Install dependencies (React if not already installed)
- [ ] Customize styling if needed (Tailwind classes)
- [ ] Integrate mPanel checkout API (see guide)
- [ ] Test all billing cycle switches
- [ ] Verify mobile responsiveness
- [ ] Test checkout flow end-to-end

## 🔗 mPanel Integration

These components are designed to work seamlessly with mPanel's checkout API:

```javascript
// Example checkout integration
import { MPanelClient } from '@/lib/mpanel-client';

const mpanel = new MPanelClient('https://migrapanel.com');

const handleOrder = async (planId, billingCycle, email) => {
  const session = await mpanel.createCheckout({
    planId,
    term: billingCycle,
    email,
    successUrl: `${window.location.origin}/checkout/success`,
    cancelUrl: window.location.href,
  });
  
  window.location.href = session.checkoutUrl;
};
```

See `examples/mpanel-client.js` and `INTEGRATION_QUICK_START.md` for complete details.

## 📚 Documentation

- **`PRICING_COMPONENTS_GUIDE.md`** - Complete integration guide with examples
- **`INTEGRATION_QUICK_START.md`** - mPanel API integration quick start
- **`MARKETING_INTEGRATION_GUIDE.md`** - Full marketing site integration docs

## 🧪 Testing

### Test in Browser
Open `pricing-vanilla-example.html` in a browser to see the pricing table in action without any build tools.

### Test with Your Framework
1. Copy files to your project
2. Import the component
3. Run your dev server
4. Navigate to the pricing page

## 💡 Best Practices

1. **Single Source of Truth**: Always update `pricingConfig.ts/js` - never hardcode prices
2. **Type Safety**: Use TypeScript version for better IDE autocomplete
3. **Sync with mPanel**: Consider fetching plans from mPanel API for real-time sync
4. **Accessibility**: Add ARIA labels and keyboard navigation
5. **Loading States**: Show spinners during API calls
6. **Error Handling**: Display user-friendly error messages

## 🆘 Support

Need help integrating these components?

- Check `PRICING_COMPONENTS_GUIDE.md` for detailed examples
- Review `pricing-vanilla-example.html` for working code
- See mPanel API docs in `INTEGRATION_QUICK_START.md`

## 📝 License

These components are part of mPanel and licensed for use with MigraHosting services.

---

**Created:** November 16, 2025  
**Version:** 1.0.0  
**Compatible with:** React 18+, Next.js 13+, Astro, Vue 3, Vanilla JS
