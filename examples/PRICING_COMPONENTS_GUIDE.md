# Pricing Components Integration Guide

## 📦 Files Included

- **`pricingConfig.ts`** - Central pricing configuration file
- **`HostingPricingComponent.tsx`** - Shared hosting pricing component
- **`WordPressPricingComponent.tsx`** - Managed WordPress pricing component
- **`SimplePricingComponents.tsx`** - Email, VPS, Cloud, and Storage pricing components

## 🚀 Quick Start

### 1. Copy Files to Your Marketing Site

Copy all the example files to your marketing site project:

```bash
# From the mPanel examples directory
cp examples/pricingConfig.ts /path/to/marketing-site/src/config/
cp examples/HostingPricingComponent.tsx /path/to/marketing-site/src/components/pricing/
cp examples/WordPressPricingComponent.tsx /path/to/marketing-site/src/components/pricing/
cp examples/SimplePricingComponents.tsx /path/to/marketing-site/src/components/pricing/
```

### 2. Install Dependencies (if not already installed)

```bash
npm install react react-dom
# or
yarn add react react-dom
```

### 3. Import and Use in Your Pages

```tsx
// Example: /pages/hosting.tsx or /app/hosting/page.tsx
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';

export default function HostingPage() {
  return (
    <div>
      <HostingPricingComponent />
    </div>
  );
}
```

## 📋 Component Reference

### Shared Hosting Component

```tsx
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';

<HostingPricingComponent />
```

**Features:**
- 4 billing cycles: Monthly, 1 Year, 2 Years, 3 Years
- 4 plans: Student (FREE), Starter, Premium, Business
- Automatic savings calculation
- Savings badges showing percentage off

### WordPress Component

```tsx
import WordPressPricingComponent from '@/components/pricing/WordPressPricingComponent';

<WordPressPricingComponent />
```

**Features:**
- 4 billing cycles: Monthly, 1 Year, 2 Years, 3 Years
- 4 plans: WP Starter, WP Growth, WP Business, WP Agency
- Purple theme to distinguish from shared hosting

### Email Component

```tsx
import { EmailPricingComponent } from '@/components/pricing/SimplePricingComponents';

<EmailPricingComponent />
```

**Features:**
- 2 billing cycles: Monthly, Yearly
- 3 plans: Basic, Pro, Business
- Per-mailbox pricing

### VPS Component

```tsx
import { VPSPricingComponent } from '@/components/pricing/SimplePricingComponents';

<VPSPricingComponent />
```

**Features:**
- 2 billing cycles: Monthly, Yearly
- 3 plans: Essential, Plus, Pro

### Cloud Component

```tsx
import { CloudPricingComponent } from '@/components/pricing/SimplePricingComponents';

<CloudPricingComponent />
```

**Features:**
- 2 billing cycles: Monthly, Yearly
- 3 plans: Start, Scale, Enterprise

### Storage Component

```tsx
import { StoragePricingComponent } from '@/components/pricing/SimplePricingComponents';

<StoragePricingComponent />
```

**Features:**
- 2 billing cycles: Monthly, Yearly
- 3 plans: Personal, Team, Business

## 🔧 Customization

### Updating Prices

Edit `pricingConfig.ts` to update prices:

```typescript
export const hostingPlans = {
  // ...
  plans: [
    {
      id: "starter",
      name: "Starter",
      type: "shared-hosting",
      pricing: {
        monthly: 7.95,    // Update here
        oneYear: 1.99,    // Update here
        twoYears: 1.69,   // Update here
        threeYears: 1.49, // Update here
      },
    },
    // ...
  ],
};
```

### Adding Features Lists

Extend the pricing config to include features:

```typescript
export const hostingPlans = {
  // ...
  plans: [
    {
      id: "starter",
      name: "Starter",
      type: "shared-hosting",
      pricing: { /* ... */ },
      features: [
        "1 Website",
        "10 GB SSD Storage",
        "Unlimited Bandwidth",
        "Free SSL Certificate",
        "24/7 Support"
      ]
    },
  ],
};
```

Then update the component:

```tsx
{/* Add this inside the pricing card */}
<ul className="mb-6 space-y-2">
  {plan.features?.map((feature, index) => (
    <li key={index} className="flex items-start">
      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
      <span className="text-sm text-gray-600">{feature}</span>
    </li>
  ))}
</ul>
```

### Integrating with mPanel Checkout

Update the button onClick handlers to integrate with mPanel:

```tsx
import { createCheckout } from '@/lib/mpanel-client';

// Inside your component
const handleOrderClick = async (planId: string, billingCycle: string) => {
  try {
    const email = prompt('Enter your email:'); // Or use a proper form
    if (!email) return;

    const checkout = await createCheckout({
      planId,
      term: billingCycle,
      email,
    });

    // Redirect to Stripe checkout
    if (checkout.checkoutUrl) {
      window.location.href = checkout.checkoutUrl;
    }
  } catch (error) {
    console.error('Checkout failed:', error);
    alert('Failed to create checkout. Please try again.');
  }
};

// In your button
<button
  onClick={() => handleOrderClick(plan.id, billingCycle)}
  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg"
>
  Order Now
</button>
```

### Custom Styling

The components use Tailwind CSS classes. Customize by:

1. **Changing colors:**
   ```tsx
   // Change bg-blue-600 to bg-purple-600, etc.
   className="bg-purple-600 hover:bg-purple-700"
   ```

2. **Adjusting layout:**
   ```tsx
   // Change grid columns
   className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
   ```

3. **Adding animations:**
   ```tsx
   className="transform hover:scale-105 transition-transform duration-200"
   ```

## 🎨 Framework-Specific Examples

### Next.js 13+ (App Router)

```tsx
// app/pricing/page.tsx
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';
import { EmailPricingComponent } from '@/components/pricing/SimplePricingComponents';

export default function PricingPage() {
  return (
    <main>
      <HostingPricingComponent />
      <EmailPricingComponent />
    </main>
  );
}
```

### Next.js (Pages Router)

```tsx
// pages/pricing.tsx
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';

export default function PricingPage() {
  return <HostingPricingComponent />;
}
```

### Astro

```astro
---
// src/pages/pricing.astro
import HostingPricingComponent from '@/components/pricing/HostingPricingComponent';
---

<html>
  <body>
    <HostingPricingComponent client:load />
  </body>
</html>
```

### Vanilla React (Vite/CRA)

```tsx
// src/pages/Pricing.tsx
import HostingPricingComponent from '../components/pricing/HostingPricingComponent';

function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HostingPricingComponent />
    </div>
  );
}

export default PricingPage;
```

## 📊 Price Comparison Table Example

Create a comparison table using the pricing config:

```tsx
import { hostingPlans, formatPrice } from '@/config/pricingConfig';

export function PriceComparisonTable() {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Plan</th>
          <th>Monthly</th>
          <th>1 Year</th>
          <th>2 Years</th>
          <th>3 Years</th>
        </tr>
      </thead>
      <tbody>
        {hostingPlans.plans.map((plan) => (
          <tr key={plan.id}>
            <td>{plan.name}</td>
            <td>{formatPrice(plan.pricing.monthly)}</td>
            <td>{formatPrice(plan.pricing.oneYear)}</td>
            <td>{formatPrice(plan.pricing.twoYears)}</td>
            <td>{formatPrice(plan.pricing.threeYears)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## 🔐 Integration with mPanel API

### Complete Checkout Flow

```tsx
import { useState } from 'react';
import { MPanelClient } from '@/lib/mpanel-client';

const mpanel = new MPanelClient('https://migrapanel.com');

export function PricingCard({ plan, billingCycle }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Create checkout session
      const session = await mpanel.createCheckout({
        planId: plan.id,
        term: billingCycle,
        email: email,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      // Redirect to Stripe
      window.location.href = session.checkoutUrl;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pricing-card">
      {/* ... pricing display ... */}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="w-full mb-3 px-4 py-2 border rounded"
      />
      
      <button
        onClick={handleCheckout}
        disabled={loading || !email}
        className="w-full bg-blue-600 text-white py-3 rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Order Now'}
      </button>
    </div>
  );
}
```

## 🧪 Testing

### Test Different Billing Cycles

```tsx
// Test all billing cycles
const testCycles = ['monthly', 'oneYear', 'twoYears', 'threeYears'];
testCycles.forEach(cycle => {
  console.log(`Testing ${cycle}:`, hostingPlans.plans[0].pricing[cycle]);
});
```

### Verify Savings Calculations

```tsx
import { getPriceWithSavings } from '@/config/pricingConfig';

const monthly = 7.95;
const yearly = 1.99 * 12;
const result = getPriceWithSavings(monthly, yearly, 12);

console.log('Savings:', result.savings);
console.log('Savings %:', result.savingsPercent);
```

## 📝 Best Practices

1. **Keep pricing in sync**: Always update `pricingConfig.ts` - never hardcode prices in components
2. **Use helper functions**: Leverage `formatPrice()`, `getBillingCycleLabel()`, etc.
3. **Type safety**: Import types from `pricingConfig.ts` for TypeScript projects
4. **Accessibility**: Add proper ARIA labels to buttons and form elements
5. **Mobile responsive**: All components are mobile-first, test on different screen sizes
6. **Loading states**: Show loading indicators during checkout API calls
7. **Error handling**: Display user-friendly error messages

## 🔄 Syncing with mPanel

To keep your marketing site prices in sync with mPanel:

### Option 1: Manual Updates
Update `pricingConfig.ts` whenever you change prices in mPanel.

### Option 2: API-Driven (Recommended)
Fetch prices from mPanel API:

```tsx
import { useEffect, useState } from 'react';

export function usePricingFromAPI() {
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    fetch('https://migrapanel.com/api/public/plans')
      .then(res => res.json())
      .then(data => setPlans(data))
      .catch(err => console.error('Failed to fetch plans:', err));
  }, []);

  return plans;
}

// In your component
const apiPlans = usePricingFromAPI();
const plans = apiPlans || hostingPlans; // Fallback to static config
```

## 📞 Support

For issues or questions about pricing integration:
- Check mPanel documentation: `/examples/INTEGRATION_QUICK_START.md`
- Review API examples: `/examples/marketing-demo.html`
- Contact: support@migrahosting.com

---

**Last Updated:** November 16, 2025
**Version:** 1.0.0
