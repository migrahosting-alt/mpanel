# mPanel – Billing & Stripe Backend Rules

This file describes how billing, Stripe, and subscriptions must work in the **mPanel backend**.

Copilot: when I'm working in the migra-panel project, follow this instead of touching the marketing site.

---

## A. Server & Paths

- Backend server: **mPanel-core**
  - IP: `10.1.10.206`
  - App root: `/opt/mpanel`
  - Managed via PM2 (e.g. `tenant-billing` service).
- Frontend mPanel UI is hosted separately on SRV1, **do not mix the two**.

---

## B. Key Files (backend)

- Stripe config:
  - `src/config/stripeConfig.js`
- Checkout controller:
  - `src/controllers/checkoutController.js`
- Checkout routes:
  - `src/routes/checkoutRoutes.js`
- Stripe webhooks:
  - `src/routes/stripeWebhookRoutes.js`
- Public/marketing bridge:
  - `src/routes/marketingApiRoutes.js` (if present)
  - `src/routes/publicRoutes.js`
- DB / migrations:
  - `prisma/migrations/` (raw SQL)
- Provisioning logic stub:
  - `src/services/tenantProvisioningService.js`

---

## C. API Endpoints (for migrahosting-marketing-site frontend to call)

1. `POST /api/checkout/create-session`
   - Input: payload from marketing checkout (plan, cycle, trial, addons, customer, domain, coupon).
   - Behavior:
     - Ensure customer row exists in DB.
     - Create provisional subscription.
     - Create Stripe Checkout Session (mode `subscription`).
     - Store `checkout_session_id` in `subscriptions`.
     - Return: `{ success: true, url, sessionId, subscriptionId }`.

2. `GET /api/checkout/session/:sessionId`
   - Input: `sessionId` from Stripe redirect.
   - Behavior:
     - Lookup subscription by `checkout_session_id`.
     - Return subscription status and tenant info to show on success page.

3. `POST /api/webhooks/stripe`
   - Raw body route for Stripe webhooks.
   - Uses `STRIPE_WEBHOOK_SECRET` to validate.
   - Handles:
     - `checkout.session.completed`
     - `customer.subscription.created|updated|deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Updates `subscriptions` & `invoices` tables accordingly.

---

## D. Database Expectations

Tables (either already exist or must be created/extended via migrations):

- `customers`
- `products`
- `prices`
- `subscriptions`
  - `stripe_customer_id`
  - `stripe_subscription_id`
  - `stripe_payment_intent_id`
  - `checkout_session_id`
  - `metadata` (JSONB)
- `subscription_items`
- `invoices`

`subscriptions.metadata` is used to store:
- `planId`, `billingCycle`, `trialActive`
- `addonIds`
- `domainMode`, `domainValue`
- `customerEmail`
- `productTypes` (e.g. `["hosting"]`)
- `couponCode`

---

## E. Provisioning (stub for now)

Service: `src/services/tenantProvisioningService.js`

- `provisionTenantForSubscription(subscriptionId)` should:
  - Load subscription + customer.
  - Create a tenant row if `tenant_id` is missing.
  - Based on `productTypes`, call stub functions:
    - `provisionHosting`
    - `provisionEmail`
    - `provisionStorage`
  - Set subscription `status = 'active'` when done.

In this phase, these functions can just **log** actions. Later they will call:
- SRV1 APIs to create hosting accounts.
- mail-core to create mailboxes.
- dns-core to create DNS zones, etc.

---

## F. Environment Variables

Backend must read:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL` (base URL for links)
- Any DB connection variables already in the project.

On mPanel-core (`10.1.10.206`), ensure PM2 starts `tenant-billing` with these env vars so Stripe works without warnings.

---

If something in the code disagrees with this file, update the code to match this document. Do not modify `migrahosting-marketing-site/` when working here.
