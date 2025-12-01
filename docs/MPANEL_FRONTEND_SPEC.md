## mPanel Frontend Specification (MigraHosting Control Panel)

This document tells the frontend (React + TypeScript) how each **mPanel module** should behave and which **API endpoints** it talks to.

The goal is:

1. No more blank pages.
2. Every sidebar item either:
   - Loads real data, or
   - Clearly shows "Coming soon" with a helpful placeholder.
3. All flows needed for **automatic provisioning from MigraHosting.com** are end-to-end working.

---

## 1. Global Principles

- The SPA is React + TypeScript, using React Router.
- All API calls go through a centralized client: `src/lib/apiClient.ts`.
- Base URL: `/api` (proxied by nginx/OLS to the mpanel-core backend).
- All requests send and expect JSON, except file uploads.

### 1.1 Authentication

- Auth token is a JWT stored in **httpOnly cookie** or **Authorization: Bearer** header.
- On load, the frontend calls `GET /api/auth/me`.
  - If 200: user object `{ id, email, name, roles, tenantId }`.
  - If 401: redirect to `/login`.

Global auth bootstrap logic:

```ts
// Pseudocode
const me = await api.get('/auth/me');
if (me.ok) {
  setUser(me.data);
} else {
  redirectToLogin();
}
```

All protected routes depend on user existing.

### 1.2 Error & Loading States

Every page component MUST handle:

- loading → show skeleton or spinner.
- error → show inline error box, never blank page.
- empty → show empty-state card (e.g. “No servers yet”).

---

## 2. Core Resource Models (Frontend Types)

```ts
// Tenant / Account model
export interface Tenant {
  id: string;
  name: string;
  slug: string;         // 'migrahosting'
  status: 'active' | 'suspended';
}

// User model
export interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];      // ['super_admin', 'admin']
  tenantId: string;
  status: 'active' | 'disabled';
}

// Server model
export interface Server {
  id: string;
  name: string;         // srv1
  hostname: string;     // srv1.migrahosting.com
  ipAddress: string;    // 31.220.98.95
  location: string;     // 'US-East'
  provider: string;     // 'On-Prem', 'Contabo', etc.
  cpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
  status: 'active' | 'offline' | 'maintenance';
}

// Product / Plan
export interface Product {
  id: string;
  name: string;          // 'Starter', 'WP Growth'
  code: string;          // 'starter', 'wp_growth'
  billingPeriod: 'monthly' | 'annually' | 'triennially';
  priceCents: number;
  isAddOn: boolean;
}

// Subscription model
export interface Subscription {
  id: string;
  customerId: string;
  productId: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  nextBillingAt: string | null;
  createdAt: string;
  meta: Record<string, any>;
}

// Provisioning Task
export interface ProvisioningTask {
  id: string;
  type: 'hosting_account' | 'domain_dns' | 'email_account';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  serverId: string | null;
  subscriptionId: string | null;
  customerId: string | null;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Sidebar Modules & Expected Behavior

Each section corresponds to an item in the left menu of mPanel.

### 3.1 Dashboard (/admin)

Purpose: Overview metrics & quick links.

Primary API calls:

- `GET /api/dashboard/summary`
  - Returns high-level KPIs: total revenue, active customers, active subscriptions, etc.
- `GET /api/invoices/recent?limit=5`
- `GET /api/subscriptions/active?limit=5`

If any endpoint 500s, show partial content and a warning banner, not a blank page.

### 3.2 Users (/admin/users)

Current problem: Blank screen.

Expected behavior:

- On mount: `GET /api/admin/users?limit=50&offset=0`
- Table of users with: Name, email, roles, status, date created.
- Actions:
  - Create User (`POST /api/admin/users`)
  - Edit User (`PUT /api/admin/users/:id`)
  - Disable User (`POST /api/admin/users/:id/disable`)

If the backend endpoint doesn’t exist yet:

- Show a card: “User management is not yet available – backend work in progress.”
- Don’t infinite-spin.

### 3.3 Customers (/admin/customers)

Current problem: Blank screen.

Expected behavior:

- `GET /api/customers?limit=50&offset=0`
- Show: Name, primary email, total subscriptions, status.
- Click row → `/admin/customers/:id`
  - `GET /api/customers/:id`
  - `GET /api/customers/:id/subscriptions`
  - `GET /api/customers/:id/invoices`

For now, if `/api/customers` 404s:

- Show placeholder, not a blank screen.

### 3.4 Guardian AI (/admin/guardian)

Current problem: Blank page.

Short-term behavior:

- This is a settings/config view only.
- On mount: `GET /api/guardian/settings` (if 404 → show default template with button “Enable soon”).
- Fields:
  - Widget ID
  - Default greeting
  - Allowed domains (migrahosting.com, migrapanel.com)
  - Status toggle

No need for full chat admin yet – just avoid blank page.

### 3.5 Server Management

**Servers (/servers)**

Expected backend: Already somewhat wired (we saw srv1 info).

Frontend behavior:

- `GET /api/servers` → list cards.
- “View Metrics” button → `/servers/:id/metrics`
  - `GET /api/servers/:id/metrics` (if not implemented → show “Metrics not yet available.”).
- “Manage” button → `/servers/:id`
  - `GET /api/servers/:id`
  - Tabbed UI: Overview, Provisioning, Services.

**Server Metrics (/server-metrics)**

Short term: placeholder is fine.

- Call `GET /api/servers/metrics/summary` if it exists.
- If 404 → show placeholder “Metrics module not installed yet”.

### 3.6 Provisioning (/provisioning)

This is critical for auto-provision.

Tabs:

- Overview
- Tasks
- Failed Jobs

API calls:

- `GET /api/provisioning/summary`
  - Returns counts of pending, in_progress, completed, failed.
- `GET /api/provisioning/tasks?status=pending&limit=20`
- `GET /api/provisioning/tasks?status=failed&limit=20`

The table rows use `ProvisioningTask` model.

Each row’s action button can:

- “Retry” → `POST /api/provisioning/tasks/:id/retry`
- “View log” → `GET /api/provisioning/tasks/:id/log`

If these endpoints don’t exist yet, show a banner: “Provisioning API not implemented yet. Backend must expose /api/provisioning/... routes.”

### 3.7 Role Management (/admin/roles)

Appears to already render. Frontend expectations:

- `GET /api/admin/roles` returns list of roles, each with capabilities.
- “Create Role”: `POST /api/admin/roles`
- “Permissions”: `GET /api/admin/roles/:id/permissions` and `PUT /api/admin/roles/:id/permissions`

If backend is not ready, keep UI but make saves no-op with a warning.

### 3.8 Websites (/websites)

For auto-provision:

Each hosting subscription from MigraHosting marketing site should create a website record:

- `POST /api/websites` with:
  - customerId
  - serverId (srv1 for now)
  - primaryDomain
  - planCode (starter, wp_growth, etc.)
  - status

Frontend behavior:

- On list page: `GET /api/websites?limit=50&offset=0`
- On detail page: `GET /api/websites/:id`

Show: Domain, server, status, createdAt. Provide links for site/file manager/database (placeholders OK).

### 3.9 Domains (/domains)

- `GET /api/domains?limit=50&offset=0`
- Each row minimal fields: Domain name, status, DNS provider, linked website ID.

If backend not ready: show placeholder table with “coming soon”.

### 3.10 DNS, Email, File Manager, Databases

For now instruct frontend to **not crash** when these APIs 404.

Example pattern:

```ts
try {
  const res = await api.get('/dns/zones');
  if (res.status === 404) {
    setState({ mode: 'stub' });
  } else {
    setState({ mode: 'data', zones: res.data });
  }
} catch (e) {
  setState({ mode: 'error', error: e });
}
```

---

## 4. Checkout → mPanel Integration (Important)

When a customer buys on MigraHosting.com, the workflow is:

1. Customer completes payment via Stripe on marketing site.
2. Marketing API calls Stripe to confirm payment.
3. After payment, marketing API sends a webhook to mPanel:

```
POST /api/provisioning/webhooks/order-created

{
  "source": "migrahosting.com",
  "stripeCustomerId": "cus_123",
  "stripeSubscriptionId": "sub_456",
  "customerEmail": "client@example.com",
  "customerName": "Client Name",
  "items": [
    { "code": "starter", "type": "hosting" },
    { "code": "wp_growth", "type": "addon" },
    { "code": "daily_backups_30d", "type": "addon" },
    { "code": "domain_registration", "type": "domain", "domain": "techstartup.net" }
  ]
}
```

Backend mPanel should:

- Create/lookup Customer.
- Create Subscription records for each recurring item.
- Create a ProvisioningTask record for each thing that needs to be created:
  - Hosting account
  - Domain DNS provisioning
  - Email mailbox plan

Provisioning worker on mpanel-core picks up tasks and talks to:

- srv1 (web hosting, databases, file system)
- dns-core (PowerDNS)
- mail-core (Postfix/Dovecot) – later.

Frontend effect:

- Under Provisioning → Tasks, new tasks show up immediately without manual creation.
- Under Customers, you can open the new customer and see their subscriptions and websites.

---

## 5. Copilot Guidance – “Do This / Don’t Do This”

**Do**

- Create all API calls in `src/lib/apiClient.ts` instead of sprinkling `fetch` everywhere.
- Type responses using interfaces above.
- Handle partial failure: 404 → show stub / “coming soon”; 500 → show error toast but keep page usable.
- Keep routing consistent: `/admin/users`, `/admin/customers`, `/servers`, `/websites`, `/domains`, `/provisioning`.
- Preserve the existing design system and layout components; only replace internal data logic.

**Don’t**

- Don’t create new random folders – stay within `src/pages`, `src/features`, or the existing structure.
- Don’t assume all endpoints exist; guard each call appropriately.
- Don’t block the whole app if one call fails; offer retry buttons where appropriate.

When a module is fixed, navigating to it should always show one of:

- Populated data
- Empty-state message
- “Not installed yet” message

Never a blank screen.

---

## 6. Minimum Modules That Must Work for Auto-Provision

These backend + frontend pairings must function for MigraHosting to run production orders:

- **Auth + Dashboard**
  - `GET /api/auth/me`
  - `GET /api/dashboard/summary`

- **Customers**
  - `GET /api/customers`
  - `GET /api/customers/:id`

- **Products & Subscriptions**
  - `GET /api/products`
  - `GET /api/subscriptions`
  - `GET /api/customers/:id/subscriptions`

- **Servers**
  - `GET /api/servers`

- **Websites**
  - `GET /api/websites`
  - `GET /api/websites/:id`

- **Provisioning**
  - `GET /api/provisioning/summary`
  - `GET /api/provisioning/tasks`

- **Order Webhook (backend)**
  - `POST /api/provisioning/webhooks/order-created`

As long as these work, MigraHosting.com can take real orders and mPanel will have enough UI to manage them, even if other modules are still stubs.

Very important: fix every single module so it either loads data or clearly communicates its status.
