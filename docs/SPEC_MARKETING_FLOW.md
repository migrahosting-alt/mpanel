# MASTER SPEC – MigraHosting Marketing Site + Billing & Provisioning Flow

**Version**: 1.0.0  
**Date**: November 24, 2025  
**Status**: AUTHORITATIVE - Single Source of Truth

---

## Goal

Make the marketing website fully functional and in sync with our mPanel multi-tenant + billing system, using the pricing we already defined (hosting, WordPress, storage, cloud, etc.).

**No more random logic. No more broken trials. No more fake checkouts.**

This is the authoritative behavior.

---

## 0. How to Use This (for Copilot / Devs)

This document is located at `docs/SPEC_MARKETING_FLOW.md`.

When implementing features, tell Copilot:

> "Use SPEC_MARKETING_FLOW.md as the single source of truth. Fix all pages (home, product pages, pricing, checkout) so they behave exactly as described. Use a single config file for prices. Fix trial toggle, add-ons, coupons, Stripe checkout, and provisioning integration with mPanel."

---

## 1. Global Architecture Rules

### 1.1 Single Source of Truth for Pricing

**File**: `src/config/pricing-config.ts` (or similar)

All product lines must live in this file:
- Shared hosting
- WordPress hosting
- Cloud storage / backup
- Any other plans we already defined

**Example structure**:

```typescript
export type BillingCycle = 'monthly' | 'yearly';

export interface Plan {
  id: string;              // e.g. "hosting-starter"
  productType: 'hosting' | 'wordpress' | 'cloud-storage' | 'cloud-backup';
  name: string;            // "Starter", "Pro", "Business"
  description: string;
  features: string[];
  basePrice: {
    monthly: number;
    yearly: number;
  };
  trialEnabled: boolean;
  trialDays: number;       // 14 (we already agreed on 14-day trial)
  defaultAddons: string[]; // addonIds suggested by default
}

export interface Addon {
  id: string;              // "extra-backups", "priority-support", etc.
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  appliesTo: ('hosting' | 'wordpress' | 'cloud-storage' | 'cloud-backup')[];
}

export interface Coupon {
  code: string;            // "WELCOME10"
  type: 'percent' | 'flat' | 'free-first-month';
  value: number;           // percent or flat value
  appliesToProducts?: ('hosting' | 'wordpress' | 'cloud-storage' | 'cloud-backup')[];
  minSubtotal?: number;
  firstInvoiceOnly?: boolean;
}

export const PLANS: Plan[] = [/* ... */];
export const ADDONS: Addon[] = [/* ... */];
export const COUPONS: Coupon[] = [/* ... */];
```

**RULE**: No component should hardcode prices. Everything must read from `PLANS` / `ADDONS` / `COUPONS`.

### 1.2 Shared Utilities

Create these helpers:
- `src/lib/priceCalculator.ts`
- `src/lib/cartStore.ts`
- `src/lib/apiClient.ts`

#### priceCalculator.ts

```typescript
import { Plan, Addon, Coupon, BillingCycle } from '../config/pricing-config';

export function calculateSubtotal(
  plan: Plan,
  addons: Addon[],
  billingCycle: BillingCycle,
  trialActive: boolean
) {
  const planPrice = trialActive ? 0 : plan.basePrice[billingCycle];
  const addonsPrice = trialActive
    ? 0 // If we decide trial covers addons too
    : addons.reduce((sum, a) => sum + a.price[billingCycle], 0);

  return planPrice + addonsPrice;
}

export function calculateDiscount(
  subtotal: number,
  coupon: Coupon | null
): number {
  if (!coupon) return 0;

  // Apply minSubtotal and product filters if needed
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return 0;

  if (coupon.type === 'percent') {
    return (subtotal * coupon.value) / 100;
  }

  if (coupon.type === 'flat') {
    return Math.min(subtotal, coupon.value);
  }

  if (coupon.type === 'free-first-month') {
    // The business rule can be: if first month invoice -> subtotal discount = subtotal
    return subtotal;
  }

  return 0;
}

export function calculateTotals(options: {
  plan: Plan;
  addons: Addon[];
  billingCycle: BillingCycle;
  trialActive: boolean;
  coupon: Coupon | null;
}) {
  const subtotal = calculateSubtotal(
    options.plan,
    options.addons,
    options.billingCycle,
    options.trialActive
  );
  const discount = calculateDiscount(subtotal, options.coupon);
  const total = Math.max(0, subtotal - discount);

  return { subtotal, discount, total };
}
```

**RULE**: The weird behavior you're seeing (like $29 turning into some random number) should disappear once everything uses this shared logic.

---

## 2. Page-by-Page Behavior

### 2.1 HOME PAGE (/)

**Goal**: Clean marketing only, but links must work correctly.

**Primary CTAs**:
- "View Hosting Plans" → `/hosting`
- "View WordPress Plans" → `/wordpress`
- "View Cloud Storage" → `/cloud-storage`
- "Get Started" → goes to default main product (e.g. `/hosting`)

**RULE**: No pricing calculations happen here. Just links.

### 2.2 PRODUCT PAGES

#### 2.2.1 Hosting (/hosting)

**Content**:
- Pricing cards for: Starter, Pro, Business
- Each card:
  - Reads from `PLANS` where `productType === 'hosting'`
  - Shows features, monthly/yearly toggle (if available), price

**Actions**:
1. **Billing cycle toggle** (Monthly / Yearly)
   - Updates displayed price
2. **"Start 14-Day Free Trial" button**:
   - Sets `trialActive = true`
   - Sets selected `planId`
   - Redirects: `/checkout?plan=hosting-starter&trial=1` (with correct id)
3. **"Buy Now" (no trial) button**:
   - `trialActive = false`
   - Redirect: `/checkout?plan=hosting-starter`

Same behavior for Pro / Business, just different `planId`.

#### 2.2.2 WordPress (/wordpress)

Same logic as hosting, but `productType === 'wordpress'`.

Buttons behave identically:
- With trial → `/checkout?plan=wp-starter&trial=1`
- Without trial → `/checkout?plan=wp-starter`

#### 2.2.3 Cloud Storage / Backup (/cloud-storage, /cloud-backup)

Same pattern:
- Load plans from `PLANS` where `productType` matches
- Show specs, price, features
- Buttons go to `/checkout` with the correct `planId` and `trial` query param if applicable

### 2.3 GLOBAL PRICING PAGE (/pricing)

**Goal**: Combined view for all products.

**Sections**:
- Tabs or sections for:
  - Hosting
  - WordPress
  - Cloud Storage
  - Cloud Backup

Each section uses the same plan component as product pages, reusing:
- Plan cards
- Trial toggle behavior
- "Get Started" CTA → `/checkout?...`

**RULE**: `/pricing` must not have its own weird price logic. It must reuse the same components and pricing from `PLANS`.

---

## 3. CHECKOUT FLOW – CLICK BY CLICK

**Route**: `/checkout`

### 3.1 On Load

**Input**: Query parameters:
- `plan` → selected plan id
- `trial` → "1" or "0" / absent
- `cycle` → "monthly" or "yearly", default to monthly

**Steps**:
1. Parse query params
2. Load plan from `PLANS` by id
3. If `trial=1` and `plan.trialEnabled` is true → `trialActive = true`, otherwise `false`
4. Set `billingCycle` based on `cycle` param or default
5. Load default addons from `ADDONS` using `plan.productType` and `plan.defaultAddons`
6. If plan is not found → show error and a button "Back to Pricing"

### 3.2 Checkout Layout

**Sections** (on a single page or a multi-step wizard):
1. Order Summary
2. Add-ons selection
3. Coupon
4. Account & Domain info
5. Billing info
6. Totals + Complete Order button

#### 3.2.1 Order Summary

**Shows**:
- Selected plan name & product type
- Billing cycle
- Trial status (e.g., "14-day free trial, then $X/month")

Any change to plan, cycle, trial, or addons must trigger:
```typescript
const { subtotal, discount, total } = calculateTotals(/* ... */)
```
And update the UI.

#### 3.2.2 Add-ons Selection

**Problem now**: You said "order add-ons don't appear" – currently broken.

**Behavior**:
1. Fetch all applicable addons for this plan:
```typescript
const eligibleAddons = ADDONS.filter(a =>
  a.appliesTo.includes(plan.productType)
);
```
2. Show them with checkboxes/toggles
3. When toggled:
   - Update the `selectedAddonIds` array in cartStore
   - Recompute totals with `calculateTotals()`

#### 3.2.3 Coupon Code

**UI**:
- Input: "Coupon code"
- Button: "Apply"

**Behavior**:
1. On click "Apply":
   - Normalize code: `code.trim().toUpperCase()`
   - Find coupon in `COUPONS`
   - If no match → show error: "Invalid coupon code."
   - If match:
     - Store coupon in cart state
     - Recompute totals with `calculateTotals(...)`
     - Show line items:
       - Subtotal
       - Discount
       - Final total

**Important**: Coupon applies to the order total (subtotal) – NOT random parts.

#### 3.2.4 Account & Domain Info

**Fields**:
- Full name
- Email
- Company (optional)
- Domain choice:
  - Use my own domain
  - Register a new domain
  - Temporary subdomain (optional)
- Phone
- Country
- Address, City, State, ZIP

**Validation**:
- Name, email, domain selection, country, address: required
- Email format validated
- If invalid → user cannot proceed

#### 3.2.5 Billing Info

At this stage, we do not collect card details directly – Stripe will handle payment.

Billing info fields are used for:
- Customer object in our DB
- Stripe customer metadata
- Invoices

### 3.3 "Complete Order" Button – Correct Behavior

**Current bug**: It goes straight to the "thank you" page without Stripe payment.

**Expected behavior**:

1. On click "Complete Order":
   - Validate all form fields (no missing required info)
   - Gather payload:
   ```typescript
   const payload = {
     planId: plan.id,
     billingCycle,
     trialActive,
     addonIds: selectedAddonIds,
     couponCode: coupon?.code ?? null,
     customer: {
       name,
       email,
       phone,
       company,
       address: { line1, city, state, zip, country },
     },
     domain: {
       mode: 'existing' | 'register' | 'subdomain',
       value: domainValue,
     },
   };
   ```
   
2. Call:
   ```typescript
   POST /api/billing/create-checkout-session
   ```
   
3. If the API returns `{ url: 'https://checkout.stripe.com/...' }`:
   ```typescript
   window.location.href = response.url;
   ```
   
4. If error → show a proper error message "We couldn't start payment. Please try again."

**RULE**: NO redirect to "thank you" until Stripe checkout has completed and the session is confirmed via backend.

---

## 4. POST-PAYMENT BEHAVIOR

### 4.1 Stripe Webhook

**Backend endpoint** (example):
```
POST /api/billing/stripe/webhook
```

On successful payment event:
1. Verify signature
2. Find internal order by Stripe session id
3. Mark order as paid
4. Call mPanel provisioning API:
   ```
   POST https://api.migrahosting.com/api/live.php?q=createTenant
   Body: {
     planId,
     billingCycle,
     trialActive,
     addons,
     customer,
     domain,
   }
   ```
5. If provisioning succeeds:
   - Generate client portal credentials (or fetch from mPanel)
   - Store tenant info
   - Trigger emails (see next section)

### 4.2 Email Flow

After payment + provisioning:

1. **Welcome email**:
   - Subject: "Welcome to MigraHosting – Your account is ready"
   - Body: portal URL, username, temp password / invite link

2. **DNS Instructions email** (if "use my own domain"):
   - Show A / CNAME / NS records and how to point domain

3. **Invoice email**:
   - Payment amount, plan, date, last 4 of card (from Stripe metadata)

### 4.3 Redirect Back to Site

After Stripe checkout success, Stripe should redirect to:
- **Success URL**: `/checkout/success?session_id=...`
- **Cancel URL**: `/checkout/cancel`

#### /checkout/success behavior:

1. Call backend endpoint:
   ```
   GET /api/billing/checkout-session?session_id=...
   ```

2. If session is paid and provisioning done:
   - Show "Thank you" page with:
     - Plan name
     - Total paid
     - Next billing date
     - Portal URL / button ("Go to My Portal")

3. If session not resolved yet:
   - Show short "We're finalizing your order..." and poll until done

**RULE**: The success page must be driven by Stripe and backend state, not just "we assume it paid".

---

## 5. mPanel Integration Expectations

- Marketing site does NOT provision directly
- It calls the backend, and backend calls mPanel
- All panel-related actions (create tenant, assign plan, domain provisioning) must be encapsulated in backend functions
- The marketing frontend only calls the backend

---

## 6. Final Instruction for Copilot / Devs

1. Treat this document as the **single source of truth** for how the marketing website, pricing, checkout, discounts, Stripe, and provisioning must behave
2. Remove any custom or random logic that conflicts with this spec
3. Make prices, trials, add-ons, and coupons all derive from `pricing-config.ts`
4. Fix the routing and flows so every "Get Started" / plan button leads cleanly into the checkout flow and then to Stripe
5. Ensure that no order can be marked complete without a successful Stripe session + backend confirmation + provisioning call to mPanel

---

**End of Spec**

This document supersedes all previous implementations and is the authoritative reference for the marketing → mPanel integration flow.
