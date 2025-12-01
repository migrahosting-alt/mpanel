# Copilot Implementation Guide – Migra mPanel

> YOU ARE CODING FOR MIGRAHOSTING MPANEL  
> Goal: Make every module on **migrapanel.com** actually work, with no blank pages, no hard crashes, and clean wiring to the backend.

---

## 0. Global Principles

1. **Do not invent random architectures.**  
   Use the patterns described here. If something is missing, extend the existing pattern instead of adding a new one.

2. **Never leave a route blank.**  
   If a module has no backend yet:
   - Show a `ComingSoon` / `NotImplemented` component with:
     - Title
     - Short description
     - "Open API docs" / "View config" link if available.

3. **Always fail gracefully.**
   - No uncaught errors in console.
   - On API failure: show a friendly error card with "Retry" button.

4. **TypeScript is the source of truth.**
   - Strong types for API responses.
   - Never use `any` unless absolutely required (and then wrap it in a typed adapter).

5. **Keep UX snappy.**
   - Show skeletons/spinners for loading.
   - Show empty-state cards if list length = 0 (not a blank page).

---

## 1. Tech Stack Assumptions

### 1.1 Frontend

- Framework: **React + TypeScript**
- Router: `react-router-dom` (v6+)
- State: React Query / TanStack Query + local component state
- UI: Tailwind CSS + custom components (`Card`, `Table`, `Badge`, `Button`, etc.)
- Build: Vite

**Base layout:**

- `src/layouts/AdminLayout.tsx` – sidebar + header + content wrapper
- `src/router/routes.tsx` – defines all `/admin/*` and `/` routes

> RULE: All new admin pages go under `/admin/...` and should be children of `AdminLayout`.

### 1.2 Backend

- Node.js (TS preferred)
- HTTP framework: Express (or similar)
- DB: PostgreSQL (via Prisma or equivalent ORM)
- Queue / async: Redis + worker (for provisioning tasks)
- Auth: JWT (already exists) + `Authorization: Bearer <token>` header
- Base API URL from frontend: `https://migrapanel.com/api/`

**Standard API pattern:**

```ts
GET    /api/admin/users
POST   /api/admin/users
GET    /api/admin/users/:id
PATCH  /api/admin/users/:id
DELETE /api/admin/users/:id
```

Apply this same CRUD shape for: customers, servers, websites, domains, products, etc.

---

## 2. Folder Structure Rules

**Frontend**

```
src/
  api/
    admin/
      users.ts
      customers.ts
      servers.ts
      websites.ts
      domains.ts
      products.ts
      invoices.ts
      subscriptions.ts
      provisioning.ts
      dns.ts
      guardian.ts
  modules/
    admin/
      users/
        UsersPage.tsx
        UsersTable.tsx
        UserForm.tsx
      customers/
        CustomersPage.tsx
        CustomerDetails.tsx
      servers/
        ServersPage.tsx
        ServerDetailsDrawer.tsx
      provisioning/
        ProvisioningPage.tsx
        ProvisioningTasksTable.tsx
      websites/
      domains/
      dns/
      billing/
        ProductsPage.tsx
        InvoicesPage.tsx
        SubscriptionsPage.tsx
      guardian/
        GuardianSettingsPage.tsx
      metrics/
        ServerMetricsPage.tsx
  components/
    ui/...
  hooks/
    useApiQuery.ts
    useApiMutation.ts
  router/
    routes.tsx
```

**Rule:**
If you add a new module, it must have:
- `src/api/admin/<module>.ts`
- `src/modules/admin/<module>/<Module>Page.tsx`

---

## 3. Shared Frontend Utilities

### 3.1 API Helper

Use a single helper for all admin requests:

```ts
// src/api/client.ts
export const apiClient = {
  async get<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
    if (!res.ok) throw await buildApiError(res);
    return res.json() as Promise<T>;
  },
  async post<T>(url: string, body: unknown, options: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
    if (!res.ok) throw await buildApiError(res);
    return res.json() as Promise<T>;
  },
  // patch, delete similar...
};

async function buildApiError(res: Response) {
  let msg = `Request failed with ${res.status}`;
  try {
    const data = await res.json();
    if (data?.error || data?.message) msg = data.error || data.message;
  } catch {}
  const err = new Error(msg) as Error & { status?: number };
  err.status = res.status;
  return err;
}
```

**Rule:**
All module APIs must call this helper, never fetch directly.

### 3.2 Standard Page States

Each page should handle 3 states:

**Loading**
```tsx
if (isLoading) return <PageSkeleton title="Users" />;
```

**Error**
```tsx
if (error) return (
  <ErrorState
    title="Failed to load users"
    message={error.message}
    onRetry={refetch}
  />
);
```

**Empty**
```tsx
if (!data?.length) return (
  <EmptyState
    title="No users yet"
    actionLabel="Create first user"
    onAction={openCreateModal}
  />
);
```

**No page should render as a completely white/blank screen.**

---

## 4. Module-by-Module Rules

### 4.1 Users (`/admin/users`)

**Purpose:** Manage internal mPanel users (staff, support, sales, etc.), not hosting customers.

**Backend endpoints (expected):**
- `GET /api/admin/users` – list users
- `POST /api/admin/users` – create
- `GET /api/admin/users/:id`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id`

**Frontend API wrapper:**
```ts
// src/api/admin/users.ts
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  createdAt: string;
  status: 'active' | 'disabled';
}

export function listAdminUsers() {
  return apiClient.get<AdminUser[]>('/api/admin/users');
}
```

**Page behaviour:**
- Table with columns: Name, Email, Role, Status, Created.
- "Invite user" button → opens modal → calls `POST /api/admin/users`.
- Edit user role/status via side drawer.
- Never crash if API returns 500 → show error card.

### 4.2 Customers (`/admin/customers`)

**Purpose:** End-customer accounts that own hosting subscriptions.

**End-to-end path:**
- Checkout on migrahosting.com creates Customer + Subscription in backend.
- `/admin/customers` shows them.

**Backend endpoints:**
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id`
- `GET /api/admin/customers/:id/subscriptions`
- `GET /api/admin/customers/:id/invoices`

**Frontend:**
- Customers list page → table with search/filter.
- Details page shows:
  - Contact info
  - Active subscriptions
  - Domains hosted
  - Last invoices
- If any sub-API fails, keep the page up and show per-section error.

### 4.3 Servers (`/servers`)

This module must reflect real infrastructure nodes like `srv1.migrahosting.com`.

**Backend endpoints:**
- `GET /api/admin/servers`
- `GET /api/admin/servers/:id`
- `GET /api/admin/servers/:id/metrics` (optional)
- `POST /api/admin/servers` – add new node (hostname, IP, SSH port, tags)

**Server model:**
```ts
export interface ServerNode {
  id: string;
  name: string;         // "srv1"
  hostname: string;     // "srv1.migrahosting.com"
  ipAddress: string;    // "73.139..."
  location: string;     // "US-East"
  provider?: string;    // "Self-hosted"
  status: 'active' | 'offline' | 'degraded';
  createdAt: string;
}
```

**UI:**
- Cards or table showing status badges.
- "View Metrics" button → link to `/server-metrics/:id`.

### 4.4 Server Metrics (`/server-metrics`)

For now, treat this as read-only.

**`GET /api/admin/servers/:id/metrics`** expected shape:
```ts
export interface ServerMetrics {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  uptimeSeconds: number;
}
```

**UI:**
- Simple line charts or stat cards.
- If metrics API not implemented yet → show `NotImplemented` with explanation.

### 4.5 Provisioning (`/provisioning`)

This is **critical** for auto-provision from checkout.

**Concept:**
- Marketing checkout creates a `ProvisioningTask` in database.
- Worker on srv1 picks it up and creates:
  - System user / vhost / DB / DNS.
- mPanel shows task queue (status updates).

**Model:**
```ts
export type ProvisioningStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface ProvisioningTask {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ProvisioningStatus;
  type: 'create_hosting' | 'suspend_hosting' | 'delete_hosting' | 'create_email';
  customerId: string;
  subscriptionId: string;
  serverId: string;
  logs?: string[];
}
```

**Backend endpoints:**
- `GET /api/admin/provisioning/tasks`
- `GET /api/admin/provisioning/tasks/:id`
- `POST /api/admin/provisioning/tasks/:id/retry`

**UI:**
- Tabs: Overview, Tasks, Failed Jobs.
- Tasks tab → table with filter by status.
- Clicking a row opens drawer with logs.
- If API not ready, do not keep showing empty gray. Show:
  > "Provisioning backend not connected yet. Copilot: implement `/api/admin/provisioning/tasks` returning an array of `ProvisioningTask`."

### 4.6 Websites (`/websites`) & Domains (`/domains`)

These are hosting resources.

**Minimal models:**
```ts
export interface HostedWebsite {
  id: string;
  domain: string;
  customerId: string;
  serverId: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface HostedDomain {
  id: string;
  name: string;         // "elizefoundation.org"
  dnsProvider: 'powerdns';
  status: 'active' | 'pending';
}
```

**Backend endpoints:**

**Websites:**
- `GET /api/admin/websites`
- `GET /api/admin/websites/:id`

**Domains:**
- `GET /api/admin/domains`
- `GET /api/admin/domains/:id`

**UI behaviour:**
- Showing list is enough for v1.
- Creation/management can be separate pages later.
- Each row: domain, customer, server, status.

### 4.7 DNS (`/dns`)

This is a view/controller for PowerDNS.

For v1, just implement:
- `GET /api/admin/dns/zones`
- `GET /api/admin/dns/zones/:id`

**Model:**
```ts
export interface DnsZone {
  id: number;
  name: string;      // "migrahosting.com."
  kind: 'MASTER' | 'NATIVE';
  serial: number;
  recordsCount: number;
}
```

**UI:**
- Table of zones.
- Clicking opens read-only list of records in drawer.

### 4.8 Billing – Products / Invoices / Subscriptions

These must reflect Stripe + internal DB.

**Products (`/products`)**
- `GET /api/admin/products`
- `POST /api/admin/products` (optional for now; you can sync from Stripe too)

**Model:**
```ts
export interface BillingProduct {
  id: string;
  name: string;
  stripePriceId: string;
  billingPeriod: 'monthly' | 'yearly' | 'triennially';
  category: 'shared_hosting' | 'vps' | 'addon';
  amountCents: number;
}
```

**UI:** Table listing existing products used by marketing checkout.

**Invoices (`/invoices`)**
- `GET /api/admin/invoices`
- `GET /api/admin/invoices/:id`

**Subscriptions (`/subscriptions`)**
- `GET /api/admin/subscriptions`
- `GET /api/admin/subscriptions/:id`

**Important linking rule:**

Each subscription should have:
- `customerId`
- `productId`
- `serverId` (where it runs)
- `provisioningTaskId` last run

### 4.9 Guardian AI (`/admin/guardian`)

For now this is mostly configuration, not the actual chat widget.

**Backend endpoints (minimal):**
- `GET /api/admin/guardian/settings`
- `PATCH /api/admin/guardian/settings`

**Model:**
```ts
export interface GuardianSettings {
  enabled: boolean;
  widgetUrl: string; // e.g. https://migrapanel.com/guardian/widget.js
  allowedDomains: string[];
  fallbackMode: 'off' | 'faq-only' | 'ticket-creation';
}
```

**UI:**
- Switch for "Enable MigraGuardian".
- Text input for `widgetUrl`.
- Multiline text or tag input for allowed domains.
- Save button → PATCH.

**Rule:**
Do not auto-load the widget script inside mPanel admin—it's only for marketing / client portals.

---

## 5. Auto-Provisioning Flow (High-Level Wiring)

To help connect servers + marketing + mPanel:

1. **Customer checks out on migrahosting.com:**
   - Marketing API (on srv1) creates:
     - Customer
     - Subscription
     - ProvisioningTask (type = 'create_hosting', serverId = srv1, etc.)

2. **Provisioning worker (on srv1) polls tasks:**
   - `status=pending` → mark running.
   - Creates Linux user, vhost, DB, DNS.
   - On success → `status=completed`.
   - On failure → `status=failed`, append logs.

3. **mPanel Provisioning UI:**
   - Uses `/api/admin/provisioning/tasks` to show real-time list.

4. **Websites & Domains UI:**
   - Shows created websites/domains for that subscription.

**Rule for Copilot:**
Whenever you implement a UI that depends on this flow, always:
- Load from the corresponding `/api/admin/...` endpoint.
- Do not duplicate the provisioning logic on the frontend. That lives in workers / backend.

---

## 6. Error Handling & Logging Conventions

### 6.1 Console Logs

Every major module should prefix logs:
- `[Users]`
- `[Customers]`
- `[Servers]`
- `[Provisioning]`
- `[Billing]`
- `[Guardian]`

Example:
```ts
console.error('[Provisioning] Failed to load tasks', error);
```

### 6.2 API Error Shape

Assume backend returns:
```json
{ "error": "Human readable message" }
```

If shape is different, adapt in the API wrapper rather than inside every component.

---

## 7. What NOT to Do

**Do NOT:**
- Add new global state libraries (Redux, Zustand, etc.) unless spec says so.
- Create random routes like `/manage-users`; use `/admin/users`.
- Use inline CSS or untyped `any` for responses.

**Do NOT:**
- Delete existing components or pages.
- Break imports that are already wired into the router.
- Hard-code secrets, IPs, or tokens.

**Do NOT:**
- Trigger backend provisioning directly from the admin UI in weird ways.
- Use proper endpoints like `POST /api/admin/provisioning/tasks/:id/retry`.

---

## 8. Step-By-Step Order of Fixes (For Copilot)

When improving mPanel, Copilot should follow this order:

1. **Users & Role Management**
   - Make `/admin/users` fully working CRUD.

2. **Customers + Billing (Products, Subscriptions, Invoices)**
   - So marketing checkout has a visible result.

3. **Servers + Provisioning**
   - Link subscriptions to server + provisioning tasks.

4. **Websites + Domains + DNS**
   - Show what's actually hosted and DNS zones.

5. **Metrics & Guardian Settings**
   - Nice-to-have, not blocking core hosting flow.

---

**End of Copilot guide for Migra mPanel**
