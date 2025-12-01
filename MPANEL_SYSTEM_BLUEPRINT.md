# mPanel System Blueprint

> Source of truth for mPanel architecture and module behavior.  
> GitHub Copilot and human devs should treat this as the guide when fixing or adding code.

---

## 0. Big Picture

mPanel is the central **billing + provisioning + management** platform for all Migra services.

Key goals:

1. Accept orders from **migrahosting.com** (marketing site).
2. Turn paid orders into **Subscriptions + Provisioning Tasks**.
3. Workers on **srv1** (and later other nodes) consume tasks and create:
   - Websites / hosting accounts
   - DNS records
   - Mail / DB / backup configs
4. mPanel UI lets admins see & manage everything across multiple servers.

Many modules are currently **placeholders** or **half wired**.  
Priority is to **stabilize core path**:

**Stripe → Order → Customer → Subscription → Provisioning Task → Worker → Website created.**

After that, secondary modules (DNS, email, backups, etc.) should extend the same pattern.

---

## 1. Infrastructure Topology

### 1.1 Servers

- **srv1-web (10.1.10.10)**
  - Role: Hosting node for client sites + marketing site.
  - Services:
    - `migrahosting.com` marketing frontend (Vite React).
    - Migra marketing API (Stripe helper) at `https://migrahosting.com/api/*` (proxy to `srv1:4242` / Node).
    - Web vhosts for client sites (nginx).
    - On-box worker for provisioning: `migra-provisioning` (Node + shell).
  - Nginx reverse proxies:
    - `https://migrahosting.com` → local marketing site
    - `https://migrapanel.com` → `mpanel-core:2272` (frontend) and `mpanel-core:2271` (API)

- **mpanel-core (10.1.10.206)**
  - Role: mPanel UI + API backend.
  - Services:
    - **mPanel frontend SPA**: Production React app served on port `2272` via Express static server.
    - **mPanel backend API**: Node/Express on port `2271`.
    - Both managed by PM2:
      - `tenant-billing` (backend on 2271)
      - `mpanel-frontend` (frontend on 2272)
  - Architecture:
    - Frontend: `/opt/mpanel/dist/` → served by `/opt/mpanel/frontend/prod-server.js`
    - Backend: `/opt/mpanel/src/server.js`
    - API base: `http://10.1.10.206:2271/api/*`
    - Frontend URL: `http://10.1.10.206:2272/`
  - Access via: `https://migrapanel.com` (proxied through srv1-web nginx)

- **db-core (10.1.10.210)**
  - Role: PostgreSQL database server.
  - Used by: mPanel API via `DATABASE_URL`.
  - Database: `mpanel_production`
  - User: `mpanel_app` / `mpanel_Sikse7171222!`

- **dns-core (10.1.10.102)**
  - Role: PowerDNS authoritative DNS (future integration).
  - mPanel will eventually provision DNS zones / records via API.

- **mail-core (10.1.10.101)**
  - Role: Postfix/Dovecot mail server (future integration).
  - mPanel will eventually provision mailboxes and link to hosting accounts.

> **IMPORTANT:** All cross-service communication from mPanel happens **from mPanel API → other services** via HTTP or DB.  
> The **marketing site** never talks directly to DB; it calls **mPanel API**.

---

## 2. Services and Main Flows

### 2.1 Core services

- **mpanel-ui** (frontend)
  - Location: `mpanel-core:/opt/mpanel/frontend/`
  - Production build: `mpanel-core:/opt/mpanel/dist/`
  - Served by: Express static server on port 2272
  - Talks only to `mpanel-api` at `/api/*`.
  - Uses JWT/session-based admin auth for admin area (`/admin/*`) and client portal (`/client/*`) in the future.

- **mpanel-api** (backend)
  - Location: `mpanel-core:/opt/mpanel/src/`
  - Entry point: `src/server.js`
  - Port: 2271
  - Express / Node service.
  - Data access via raw SQL queries.
  - Exposes:
    - **Public** endpoints for marketing site (orders, plans).
    - **Admin** endpoints for mPanel UI.
    - **Worker** endpoints for provisioning tasks.
    - (Later) tenant/client endpoints.

- **marketing-api** (on srv1-web)
  - Node service for Stripe Payment Intents and checkout.
  - Called by `migrahosting.com` checkout pages.
  - After successful payment it notifies `mpanel-api`.

- **migra-provisioning** (worker on srv1-web)
  - Node loop + shell scripts.
  - Polls `mpanel-api` for provisioning tasks.
  - Creates hosting resources (at first: directories + placeholder site, later full vhost, DB, etc.).

---

## 3. Critical Flow: Order → Provisioning

This must always work even if other modules are broken.

### 3.1 Flow steps

1. **Client builds cart on migrahosting.com**
   - Frontend knows:
     - `planSlug` (e.g. `starter`, `wp-growth`).
     - Addons / domain / billing cycle.
   - Frontend calls `marketing-api` (srv1) to create Stripe Payment Intent.

2. **Stripe payment succeeds**
   - `marketing-api` (srv1) receives the success event (either via redirect + confirm or webhook).
   - It then sends a **POST** to `mpanel-api`, e.g.:

   ```http
   POST https://migrapanel.com/api/public/orders/stripe-completed
   Content-Type: application/json

   {
     "stripePaymentIntentId": "pi_xxx",
     "customerEmail": "client@example.com",
     "customerName": "Client Name",
     "items": [
       { "productSlug": "starter", "qty": 1, "unitPrice": 29.88, "billingPeriod": "year" },
       { "productSlug": "wp-growth", "qty": 1, "unitPrice": 10.95, "billingPeriod": "month" },
       { "productSlug": "daily-backups-30d", "qty": 1, "unitPrice": 4.99, "billingPeriod": "month" }
     ],
     "primaryDomain": "techstartup.net"
   }
   ```

3. **mPanel API handles order**
   - Creates or finds Customer by email.
   - Creates Order + OrderItems.
   - Creates Subscription records from order items.
   - Creates one or more ProvisioningTask rows with status = "pending":
     - One per subscription or one grouped by domain (your choice, but must be consistent).

4. **Worker on srv1 polls tasks**
   - `migra-provisioning` calls:
     ```http
     POST https://migrapanel.com/api/worker/tasks/claim
     ```
   - If a task is returned, runs a shell script to create site, then calls:
     ```http
     POST https://migrapanel.com/api/worker/tasks/:id/complete
     ```
     with status = "success" | "failed".

5. **On success**
   - mPanel marks the subscription status = "active".
   - Provisioning module UI shows Completed task with link to site, server, and domain.

---

## 4. Shared Conventions

- All new API routes live under `/api/*`.

- Prefer REST with clear naming:
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `GET /api/admin/customers`
  - `GET /api/admin/provisioning/tasks`

- Entities should live in database schema with clear names:
  - User, Role, Permission, Customer, Server, Product, Subscription, Invoice, ProvisioningTask, Website, Domain, DnsRecord, etc.

- For any module that is NOT implemented yet:
  - The API should return a controlled "Not implemented" error.
  - Frontend should show a friendly "Coming soon / disabled" state instead of blank screen.

---

## 5. Module-by-Module Blueprint

This section describes what each sidebar module should do, and what endpoints + data it depends on.

### 5.1 Dashboard

**Route:** `/dashboard`

**Purpose:** Overview of revenue, active customers, subscriptions, recent invoices.

**Backend endpoints:**

```
GET /api/admin/dashboard/summary
```

Returns:
```json
{
  "totalRevenue30d": 1234.56,
  "totalRevenueAllTime": 9876.54,
  "activeCustomers": 12,
  "pendingInvoices": 3,
  "recentInvoices": [ ... ],
  "activeSubscriptions": [ ... ]
}
```

**How to fix:**
- Implement a simple aggregation query using raw SQL.
- Handle empty DB (no data) gracefully (0 values, empty arrays).

---

### 5.2 Users

**Route:** `/admin/users`

**Expected behavior:**
- List admin users (rows: name, email, role, status).
- Create / edit / deactivate users.

**Backend:**
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id` (soft delete recommended).

**Data model:**
- User table + relation to Role.

**Current issue:** Blank page ⇒ likely API not implemented or route not wired.

**Fix path:**
- Implement the endpoints with basic CRUD.
- In frontend, ensure the page calls `GET /api/admin/users` on mount and renders a table.
- If request fails with 401, redirect to login.

---

### 5.3 Customers

**Route:** `/admin/customers`

**Purpose:** List end customers who purchased hosting.

**Backend endpoints:**
- `GET /api/admin/customers`
- `GET /api/admin/customers/:id`
- `GET /api/admin/customers/:id/subscriptions`
- `GET /api/admin/customers/:id/invoices`

**Data model:**
- Customer with fields: id, name, email, phone, createdAt, tenantId (if multi-tenant).

**Fix path:**
- Ensure the order handling creates Customer there.
- Hook the Customers page to the `GET /api/admin/customers` endpoint and show real rows.

---

### 5.4 Guardian AI

**Route:** `/admin/guardian`

**For now:** Read-only config page:
- Show API keys, status, last heartbeat, and simple "Deploy/Restart" buttons.

**Backend endpoints:**
- `GET /api/admin/guardian/status`
- `POST /api/admin/guardian/deploy` (stub: returns success, logs message).

**Fix path:**
- If the AI agent service is not ready, return a stubbed response like:
  ```json
  {
    "status": "offline",
    "lastHeartbeat": null,
    "notes": "Guardian AI backend not implemented yet."
  }
  ```
- Frontend should never crash; show offline badge.

---

### 5.5 Server Management / Servers

**Routes:**
- `/servers` — list of infrastructure servers.
- `/servers/:id` — detail view.

**Data model:**

Server:
- id, name (srv1, dns-core, mail-core, db-core, mpanel-core)
- fqdn, ipAddress, role, location, status, sshUser, tags.

**Backend:**
- `GET /api/admin/servers`
- `POST /api/admin/servers`
- `PATCH /api/admin/servers/:id`

**During fixing:**
- Hard-code at least the main nodes: srv1, dns-core, mail-core, db-core, mpanel-core.
- Use Server record to attach Provisioning tasks and Websites.

---

### 5.6 Provisioning

**Route:** `/provisioning`

**Tabs:**
- Overview — summary counts.
- Tasks — table of provisioning tasks.
- Failed Jobs — filtered list for failures.

**Data model:**

ProvisioningTask:
- id, status (pending, in_progress, success, failed)
- serverId, subscriptionId, type (hosting, dns, mail, etc.)
- payload (JSON blob), errorMessage, createdAt, updatedAt.

**Backend endpoints:**
- `GET /api/admin/provisioning/tasks?status=...`
- `GET /api/admin/provisioning/tasks/:id`

**Worker endpoints** (described earlier):
- `POST /api/worker/tasks/claim`
- `POST /api/worker/tasks/:id/complete`

**Fix path:**
- Ensure these tables exist and endpoints are implemented.
- UI should use `GET /api/admin/provisioning/tasks` to populate the tabs.
- Never crash when list is empty.

---

### 5.7 Role Management (RBAC)

**Route:** `/role-management`

**Current UI:** Already shows role cards. Backend should provide real data.

**Data model:**
- Role and Permission.

**Backend endpoints:**
- `GET /api/admin/roles`
- `POST /api/admin/roles`
- `PATCH /api/admin/roles/:id`

**Fix path:**
- Seed some default roles (super_admin, admin, editor, support, customer) in a migration.
- Page fetches `GET /api/admin/roles` and maps to cards.

---

### 5.8 Servers Metrics

**Route:** `/server-metrics`

**Low priority for now.**

**For early implementation:**
- Make it read-only with a note: "Metrics integration is not yet wired. Data below is placeholder."

**Backend:**
- `GET /api/admin/servers/:id/metrics` can return static or very simple data from DB or a JSON file.

---

### 5.9 Websites

**Route:** `/websites`

**Purpose:**
- Show one row per hosted website / domain.

**Data model:**

Website:
- id, domain, serverId, customerId, subscriptionId, status.

**Backend:**
- `GET /api/admin/websites`
- `GET /api/admin/websites/:id`

**Fix path:**
- When worker successfully provisions a site, it should create a Website record pointing to the Server and Customer.
- UI lists them with basic info and link to open the site in a new tab.

---

### 5.10 Domains + DNS

**Routes:**
- `/domains`
- `/dns`

**Integration target:** dns-core PowerDNS.

**Short term:**
- Represent domains in DB without actually touching PDNS until DNS integration is ready.

**Data model:**
- Domain table & DnsRecord table.

**Backend endpoints:**
- `GET /api/admin/domains`
- `POST /api/admin/domains`
- Later: `POST /api/admin/domains/:id/sync-pdns`.

**Fix path:**
- Ensure domain from order (primaryDomain) is created as Domain with link to website and customer.
- Render basic domain list UI (status: managed/unmanaged).

---

### 5.11 Email, File Manager, Databases

**For now:** Mark as "Coming soon" with stub APIs:
- `GET /api/admin/email/overview` → returns not implemented.
- `GET /api/admin/filemanager/overview` → not implemented.
- `GET /api/admin/databases/overview` → not implemented.

**Frontend for these pages should:**
- Call endpoint.
- If it receives `{ notImplemented: true }` or 501 status, show a friendly message card instead of blank screen.
- This prevents the "white page" feeling and stops React from crashing.

---

### 5.12 Enterprise Features

(Premium, SSL, App Installer, API Keys, Backups, AI Features, WebSocket, GraphQL API, Analytics, Kubernetes, CDN, Monitoring, API Marketplace, White-Label)

**These are phase 2–3 features.**

**Guidelines:**

DO NOT break navigation:
- Each route should at least mount a simple placeholder component with:
  - Title, short description, "Coming soon" tag.

**If some are partly implemented** (e.g. SSL, Backups):
- Wire them to minimal backend endpoints, but treat everything else as future work.

**Pattern for a "Coming soon" module:**

```jsx
// Example: src/pages/admin/BackupsPage.tsx
export function BackupsPage() {
  return (
    <ComingSoonCard
      title="Backups"
      description="Automated full-system and client backups will be managed here."
      docLink="https://internal.migra/docs/backups-plan"
    />
  );
}
```

---

### 5.13 Billing: Products, Invoices, Subscriptions

**These modules are high priority after provisioning.**

**Routes:**
- `/products`
- `/invoices`
- `/subscriptions`

**Data model:**
- Product / Price / Invoice / Subscription.

**Backend:**
- `GET /api/admin/products`
- `GET /api/admin/invoices`
- `GET /api/admin/subscriptions`

**Fix path:**
- Ensure plans and add-ons from marketing site exist as Product rows with a slug that matches what marketing uses.
- When orders are created from Stripe, generate:
  - 1 subscription per recurring item.
  - 1 invoice per checkout (or per billing cycle).

**UI:**
- Products: show name, slug, billing cycle, price, active flag.
- Invoices: customer, amount, paid/unpaid, Stripe link.
- Subscriptions: plan, customer, status, next renewal date.

---

### 5.14 Security

**Route:** `/security`

**Purpose:**
- Show overview of:
  - Login attempts (later).
  - API tokens.
  - Role / permission changes.

**For now:**
- Simple static page describing that full security audit logs are coming soon.
- Ensure route doesn't crash.

---

## 6. How All Pieces Talk (Summary Diagram in Text)

Think of it as interconnected flows:

1. **Client Browser → Marketing Site (srv1-web)**
   - `https://migrahosting.com/*`
   - Loads checkout, calls marketing API for Stripe.

2. **Marketing API (srv1-web) → Stripe**
   - Creates Payment Intent, confirms payment.

3. **Marketing API (srv1-web) → mPanel API (mpanel-core)**
   - On success, calls `POST /api/public/orders/stripe-completed`.

4. **mPanel API → DB (db-core)**
   - Writes customers, orders, subscriptions, provisioning tasks.

5. **Provisioning Worker (srv1-web) → mPanel API**
   - Claims tasks.
   - Reports completion.

6. **Provisioning Worker (srv1-web) → Local system**
   - Runs shell scripts to create directories, vhosts, DBs, etc.

7. **mPanel UI (mpanel-core) → mPanel API**
   - Admin logs in at `https://migrapanel.com`.
   - All sidebar modules are just React views calling the API above.

---

## 7. Rules for Copilot / Future Dev Work

1. **Never assume a module is fully implemented.**
   - Check whether API exists; if not, build it or handle the "not implemented" case gracefully.

2. **If a route crashes or shows blank page:**
   - Step 1: Ensure the React component actually returns a JSX tree (no null).
   - Step 2: Wrap page-level queries with error + loading states.
   - Step 3: Add placeholder view if backend returns error 501 or notImplemented.

3. **Prefer small vertical slices over broad stubs.**
   - Implement one module end-to-end: DB → API → UI.
   - Example: Provisioning overview + tasks list should be fully working before extending to DNS/Mail.

4. **Keep auto-provision path sacred.**
   - Do not change existing endpoints or flows (stripe-completed, worker tasks) without updating this document.
   - Add comments in code pointing back to this file (// See MPANEL_SYSTEM_BLUEPRINT.md).

5. **Log clearly.**
   - Every provisioning action should be logged with:
     - Task ID, server, domain, plan, status, and error if any.

---

## 8. Deployment Architecture

### 8.1 Frontend Deployment

**Development:**
- Run Vite dev server: `cd frontend && npm run dev` (port 3001)

**Production:**
1. Build: `cd /opt/mpanel && npm run build` (creates `dist/`)
2. Serve: PM2 runs `frontend/prod-server.js` on port 2272
3. Access: `https://migrapanel.com` → srv1 nginx → mpanel-core:2272

**Never run Vite dev server on production port 2272!**

### 8.2 Backend Deployment

**Location:** `/opt/mpanel/src/`

**PM2 Process:** `tenant-billing`

**Port:** 2271

**Start:**
```bash
cd /opt/mpanel
pm2 start src/server.js --name tenant-billing
pm2 save
```

**Restart:**
```bash
pm2 restart tenant-billing
```

---

## 9. Database Schema Guidelines

### Current Tables (as of Nov 2025)

- **users**: email, first_name, last_name, password_hash, role, created_at
- **customers**: user_id (FK), company_name, phone, address, created_at
- **products**: code (not slug!), name, type, price, billing_cycle
- **subscriptions**: customer_id, product_id, status, billing_cycle, price, next_billing_date
- **servers**: (future) name, fqdn, ip_address, role, status

### Schema Conventions

- Use `code` for product identifiers (not `slug`)
- Users and Customers are separate tables (1:1 relationship via user_id)
- All dates use `created_at`, `updated_at` timestamps
- Status fields use lowercase strings: `active`, `pending`, `failed`, `cancelled`

---

**End of Blueprint**

*This document should be updated whenever core architecture changes.*
*Last updated: November 27, 2025*
