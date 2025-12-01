# mPanel Backend Specification (API + DB + Flows)

This document defines how the **mPanel backend** should work so that:
- All admin modules stop being placeholders.
- Marketing website → Stripe → mPanel provisioning is a clean flow.
- All servers (srv1, mpanel-core, dns-core, mail-core, db-core) talk in a predictable way.
- GitHub Copilot can safely implement missing pieces **without inventing random patterns**.

---

## 1. High-Level Backend Overview

### 1.1 Stack

- **Language**: TypeScript
- **Runtime**: Node.js (LTS)
- **Framework**: Express (or Fastify, but assume Express)
- **ORM**: Prisma
- **Database**: PostgreSQL (`db-core`)
- **Cache / Queue**: Redis
- **Auth**: JWT (access + refresh tokens)
- **Background jobs**: Queue workers (e.g. BullMQ / custom Redis queues)
- **API host**: `https://mpanel.migrahosting.com/api` (behind nginx)
- **Internal network**:
  - `srv1-web`: 10.1.10.10  (marketing site + Stripe backend)
  - `mpanel-core`: 10.1.10.206  (mPanel API + workers)
  - `dns-core`: 10.1.10.102  (PowerDNS)
  - `mail-core`: 10.1.10.101 (Postfix/Dovecot)
  - `db-core`: 10.1.10.210 (PostgreSQL, Redis, or split by service)

---

## 2. Directory Structure (Backend)

All backend code should live under `/opt/mpanel` in production and in `/apps/api` in the repo.

```text
mpanel/
  apps/
    api/
      src/
        index.ts                # app bootstrap
        config/
          env.ts                # loads env vars
          logger.ts             # shared logger
          database.ts           # Prisma client
          redis.ts              # Redis client
          auth.ts               # JWT helpers
        core/
          error-handler.ts
          request-validator.ts
          permissions.ts
          types.ts
        modules/
          auth/
            auth.router.ts
            auth.controller.ts
            auth.service.ts
            auth.types.ts
          tenants/
          users/
          products/
          plans/
          orders/
          subscriptions/
          servers/
          dns/
          hosting/
          vps/
          mail/
          backups/
          billing/
          support/
          notifications/
          audit/
        jobs/
          queue.ts              # queue setup
          workers/
            provisioning.worker.ts
            dns-sync.worker.ts
            mail-provision.worker.ts
            backup.worker.ts
        routes.ts               # mounts all module routers
      prisma/
        schema.prisma
      package.json
      tsconfig.json
      .env.example
```

**Rule for Copilot:**
Every module gets `*.router.ts`, `*.controller.ts`, `*.service.ts`, and `*.types.ts` (and optionally `*.validators.ts`).

---

## 3. Environment Configuration

### 3.1 Required env vars

`.env` (backend):

```bash
NODE_ENV=production
PORT=2271
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://mpanel:STRONG_PASSWORD@10.1.10.210:5432/mpanel

# Redis
REDIS_URL=redis://10.1.10.210:6379/0

# JWT
JWT_SECRET=super-secret-jwt-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Mail for notifications
EMAIL_FROM=no-reply@migrahosting.com
SMTP_HOST=mail.migrahosting.com
SMTP_PORT=587
SMTP_USER=notifications@migrahosting.com
SMTP_PASS=CHANGE_ME

# External services
POWERDNS_API_URL=http://10.1.10.102:8081/api/v1
POWERDNS_API_KEY=CHANGE_ME

MAILCORE_API_URL=http://10.1.10.101:8080/api
MAILCORE_API_KEY=CHANGE_ME

MARKETING_WEBHOOK_SECRET=CHANGE_ME
STRIPE_WEBHOOK_SECRET=CHANGE_ME

# Base URL for links sent in emails
APP_URL=https://mpanel.migrahosting.com
```

**Rule for Copilot:**
If a feature needs a new env var → add it to `env.ts`, `.env.example`, and use zod or simple runtime checks to validate.

---

## 4. Core Concepts

### 4.1 Tenants

Even if you start with single-tenant (MigraHosting), the system is multi-tenant ready.

- **Tenant** = organization (MigraHosting, or future white-label clients).
- **User** belongs to 1 tenant.
- All main business objects reference a tenant: domains, servers, products, plans, subscriptions, orders.

### 4.2 Products, Plans, Subscriptions

- **Product**: general offering (Shared Hosting, VPS, Email Only, DNS Only).
- **Plan**: specific pricing/limits of a product (Starter / Pro / Business).
- **Subscription**: customer's active plan (for a domain or account).
- **Order**: the purchase event (via Stripe, etc.).

### 4.3 Provisioning Jobs

When an order is paid, mPanel creates a job:

- Example: `create_hosting_account`, `create_dns_zone`, `create_mailbox`, `create_vps`.
- Worker picks up job from Redis, calls appropriate core service:
  - PowerDNS API
  - Mail-core API
  - Server via SSH or internal agent
- Result is logged in `JobLog` & `AuditLog`.

---

## 5. Database Schema (Prisma-style)

This is the canonical Prisma shape for Copilot to use.

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Tenant {
  id          String      @id @default(cuid())
  name        String
  slug        String      @unique
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  users           User[]
  products        Product[]
  plans           Plan[]
  customers       Customer[]
  servers         Server[]
  domains         Domain[]
  subscriptions   Subscription[]
  orders          Order[]
  dnsZones        DnsZone[]
  mailAccounts    MailAccount[]
  hostingAccounts HostingAccount[]
  vpsInstances    VpsInstance[]
  backupJobs      BackupJob[]
  auditLogs       AuditLog[]
}

model User {
  id                String   @id @default(cuid())
  tenantId          String
  email             String   @unique
  passwordHash      String
  displayName       String
  role              UserRole @default(ADMIN)
  isActive          Boolean  @default(true)
  lastLoginAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  auditLogs         AuditLog[]
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  SUPPORT
  BILLING
  READ_ONLY
}

model Server {
  id          String        @id @default(cuid())
  tenantId    String
  name        String
  role        ServerRole
  ipAddress   String
  internalIp  String?
  location    String?       // "home-lab", "vps", etc.
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  hostingAccounts HostingAccount[]
  vpsInstances VpsInstance[]
}

enum ServerRole {
  WEB
  MAIL
  DNS
  PANEL
  DB
  STORAGE
}

model Product {
  id          String      @id @default(cuid())
  tenantId    String
  name        String
  slug        String      @unique
  type        ProductType
  description String?
  isActive    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  plans       Plan[]
}

enum ProductType {
  SHARED_HOSTING
  VPS
  EMAIL
  DNS
  STORAGE
}

model Plan {
  id               String      @id @default(cuid())
  tenantId         String
  productId        String
  name             String
  slug             String
  priceMonthlyCents Int
  priceYearlyCents  Int
  currency         String      @default("usd")
  isPopular        Boolean     @default(false)
  isActive         Boolean     @default(true)
  limitsJson       Json?       // { diskGb, bandwidthGb, sites, emails }
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  tenant           Tenant      @relation(fields: [tenantId], references: [id])
  product          Product     @relation(fields: [productId], references: [id])
  orders           Order[]
  subscriptions    Subscription[]
}

model Customer {
  id              String         @id @default(cuid())
  tenantId        String
  email           String
  fullName        String?
  phone           String?
  stripeCustomerId String?
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  tenant          Tenant         @relation(fields: [tenantId], references: [id])
  subscriptions   Subscription[]
  orders          Order[]
}

model Order {
  id               String          @id @default(cuid())
  tenantId         String
  customerId       String
  planId           String
  status           OrderStatus     @default(PENDING)
  totalAmountCents Int
  currency         String          @default("usd")
  stripePaymentIntentId String?
  externalOrderId  String?         // from marketing API if needed
  notes            String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  tenant           Tenant          @relation(fields: [tenantId], references: [id])
  customer         Customer        @relation(fields: [customerId], references: [id])
  plan             Plan            @relation(fields: [planId], references: [id])
  subscription     Subscription?
  jobs             Job[]
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  CANCELLED
  REFUNDED
}

model Subscription {
  id                 String        @id @default(cuid())
  tenantId           String
  customerId         String
  planId             String
  orderId            String?       @unique
  status             SubscriptionStatus @default(ACTIVE)
  startedAt          DateTime      @default(now())
  currentPeriodStart DateTime      @default(now())
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean       @default(false)
  cancelledAt        DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  tenant             Tenant        @relation(fields: [tenantId], references: [id])
  customer           Customer      @relation(fields: [customerId], references: [id])
  plan               Plan          @relation(fields: [planId], references: [id])
  order              Order?        @relation(fields: [orderId], references: [id])
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
  INACTIVE
}

model Domain {
  id          String      @id @default(cuid())
  tenantId    String
  name        String      @unique // example.com
  status      DomainStatus @default(ACTIVE)
  autoDns     Boolean     @default(true)
  autoMail    Boolean     @default(true)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  dnsZones    DnsZone[]
  hosting     HostingAccount?
  vps         VpsInstance?
  mailAccounts MailAccount[]
}

enum DomainStatus {
  ACTIVE
  SUSPENDED
  PENDING_SETUP
  PENDING_TRANSFER
}

model DnsZone {
  id          String      @id @default(cuid())
  tenantId    String
  domainId    String
  pdnsId      Int?        // id in PowerDNS DB if needed
  soaSerial   Int?
  isSynced    Boolean     @default(false)
  lastSyncAt  DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  domain      Domain      @relation(fields: [domainId], references: [id])
}

model HostingAccount {
  id           String      @id @default(cuid())
  tenantId     String
  domainId     String      @unique
  serverId     String
  systemUser   String
  homeDir      String
  phpVersion   String?
  status       HostingStatus @default(ACTIVE)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  tenant       Tenant      @relation(fields: [tenantId], references: [id])
  domain       Domain      @relation(fields: [domainId], references: [id])
  server       Server      @relation(fields: [serverId], references: [id])
}

enum HostingStatus {
  ACTIVE
  SUSPENDED
  TERMINATED
  PENDING
}

model VpsInstance {
  id          String      @id @default(cuid())
  tenantId    String
  domainId    String?     @unique
  serverId    String
  name        String
  ipv4        String?
  status      VpsStatus   @default(PENDING)
  cpuCores    Int?
  memoryMb    Int?
  diskGb      Int?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  domain      Domain?     @relation(fields: [domainId], references: [id])
  server      Server      @relation(fields: [serverId], references: [id])
}

enum VpsStatus {
  PENDING
  RUNNING
  STOPPED
  SUSPENDED
  TERMINATED
}

model MailAccount {
  id          String      @id @default(cuid())
  tenantId    String
  domainId    String
  email       String      // user@example.com
  mailbox     String?     // vmail path
  status      MailStatus  @default(ACTIVE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  domain      Domain      @relation(fields: [domainId], references: [id])
}

enum MailStatus {
  ACTIVE
  DISABLED
  PENDING
}

model BackupJob {
  id          String      @id @default(cuid())
  tenantId    String
  type        BackupType
  targetId    String      // domainId, serverId, etc.
  status      BackupStatus @default(PENDING)
  lastRunAt   DateTime?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
}

enum BackupType {
  SYSTEM
  CLIENT_SITE
  DATABASE
}

enum BackupStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

model Job {
  id          String      @id @default(cuid())
  tenantId    String
  orderId     String?
  type        JobType
  payload     Json
  status      JobStatus   @default(PENDING)
  attempts    Int         @default(0)
  lastError   String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  order       Order?      @relation(fields: [orderId], references: [id])
}

enum JobType {
  PROVISION_HOSTING
  PROVISION_DNS
  PROVISION_MAIL
  PROVISION_VPS
  SUSPEND_ACCOUNT
  UNSUSPEND_ACCOUNT
  TERMINATE_ACCOUNT
}

enum JobStatus {
  PENDING
  RUNNING
  SUCCESS
  FAILED
}

model AuditLog {
  id          String      @id @default(cuid())
  tenantId    String
  userId      String?
  action      String
  ipAddress   String?
  userAgent   String?
  details     Json?
  createdAt   DateTime    @default(now())

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  user        User?       @relation(fields: [userId], references: [id])
}
```

---

## 6. API Design (Routes & Responsibilities)

All API routes should live under `/api`.

**Global structure:**

```typescript
// src/routes.ts
import { Router } from 'express';
import authRouter from './modules/auth/auth.router';
import tenantsRouter from './modules/tenants/tenants.router';
import productsRouter from './modules/products/products.router';
import plansRouter from './modules/plans/plans.router';
import ordersRouter from './modules/orders/orders.router';
import subscriptionsRouter from './modules/subscriptions/subscriptions.router';
import serversRouter from './modules/servers/servers.router';
import dnsRouter from './modules/dns/dns.router';
import hostingRouter from './modules/hosting/hosting.router';
import vpsRouter from './modules/vps/vps.router';
import mailRouter from './modules/mail/mail.router';

const router = Router();

router.use('/auth', authRouter);
router.use('/tenants', tenantsRouter);
router.use('/products', productsRouter);
router.use('/plans', plansRouter);
router.use('/orders', ordersRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/servers', serversRouter);
router.use('/dns', dnsRouter);
router.use('/hosting', hostingRouter);
router.use('/vps', vpsRouter);
router.use('/mail', mailRouter);

export default router;
```

### 6.1 Auth

**Base path:** `/api/auth`

**Endpoints:**

- `POST /login`
- `POST /refresh`
- `GET /me`
- `POST /logout` (optional / token blacklist if needed)

**Example:**

```typescript
// POST /api/auth/login
// body: { email, password }
{
  "token": "<JWT_ACCESS>",
  "refreshToken": "<JWT_REFRESH>",
  "user": {
    "id": "...",
    "email": "admin@migrahosting.com",
    "displayName": "Admin",
    "role": "SUPER_ADMIN",
    "tenantId": "..."
  }
}
```

### 6.2 Products & Plans

**Base paths:**

- `/api/products`
- `/api/plans`

**Used by:**

- Marketing site (read-only public API)
- mPanel admin (create/edit)

**Important endpoints:**

- `GET /api/products/public` → returns public product list for marketing site
- `GET /api/plans/public` → same

### 6.3 Orders & Subscriptions

**Base paths:**

- `/api/orders`
- `/api/subscriptions`

**Key endpoints:**

#### `POST /api/orders`

Used by marketing backend (srv1) after successful Stripe payment.

```json
{
  "tenantSlug": "migrahosting",
  "customer": {
    "email": "client@example.com",
    "fullName": "Client Name"
  },
  "planSlug": "starter-monthly",
  "totalAmountCents": 149,
  "currency": "usd",
  "stripePaymentIntentId": "pi_123",
  "metadata": {
    "domain": "example.com",
    "notes": "Marketing site order"
  }
}
```

**mPanel backend must:**

1. Create `Customer` if not exists.
2. Create `Order` with status `PAID`.
3. Create `Subscription`.
4. Create provisioning jobs:
   - `PROVISION_DNS`
   - `PROVISION_HOSTING`
   - `PROVISION_MAIL` (if email included)
5. Return order + subscription:

```json
{
  "orderId": "...",
  "subscriptionId": "...",
  "jobs": [
    { "id": "...", "type": "PROVISION_DNS" },
    { "id": "...", "type": "PROVISION_HOSTING" }
  ]
}
```

---

## 7. Provisioning Flow (End-to-End)

### 7.1 Marketing → Stripe → mPanel

1. Client chooses plan on `migrahosting.com`.
2. Marketing frontend calls `https://migrahosting.com/api/checkout/payment-intent`.
3. Stripe Payment Element completes payment.
4. Marketing backend (srv1) receives Stripe webhook:
   - `payment_intent.succeeded`
5. Marketing backend calls:

```bash
POST https://mpanel.migrahosting.com/api/orders
Authorization: Bearer <internal-api-token>
Content-Type: application/json
```

with body as in 6.3.

6. mPanel:
   - Creates `Order` / `Customer` / `Subscription`.
   - Enqueues jobs into Redis queue.

### 7.2 Jobs Worker

Worker process runs on `mpanel-core`:

```typescript
// src/jobs/workers/provisioning.worker.ts
queue.process('provisioning', async (job) => {
  const { type, payload } = job.data;

  switch (type) {
    case 'PROVISION_DNS':
      return await dnsProvisioningService.provision(payload);
    case 'PROVISION_HOSTING':
      return await hostingProvisioningService.provision(payload);
    case 'PROVISION_MAIL':
      return await mailProvisioningService.provision(payload);
    // etc.
  }
});
```

Each service:

1. Reads relevant DB rows.
2. Calls external services:
   - PowerDNS API on `dns-core`
   - `mail-core` HTTP API
   - ssh into `srv1` or web server to create vhost/home dir.
3. Updates `Job.status` + logs into `AuditLog`.

---

## 8. Module Responsibilities (Backend)

This is the map that matches your mPanel UI sections.

### 8.1 Servers Module

**Purpose:**
List all core servers and their roles (srv1, dns-core, mail-core, mpanel-core, db-core).

**API:**

- `GET /api/servers` → list
- `POST /api/servers` → add new server
- `GET /api/servers/:id` → detail
- `PATCH /api/servers/:id` → update
- `DELETE /api/servers/:id` → soft delete or mark inactive

**Used by UI:**

- "Infrastructure" / "Servers" section.
- Might later integrate health checks (Ping, API health).

### 8.2 DNS Module

**Purpose:**
Manage DNS zones via PowerDNS.

**API:**

- `GET /api/dns/zones` → list mPanel `DnsZone` rows.
- `POST /api/dns/zones` → create new zone for `Domain`.
  - Also calls PowerDNS API to create zone.
- `GET /api/dns/zones/:id` → zone detail.
- `POST /api/dns/zones/:id/sync` → re-sync from PDNS or push to PDNS.

**Example call to PowerDNS (for Copilot):**

```typescript
await axios.post(
  `${POWERDNS_API_URL}/servers/localhost/zones`,
  {
    name: `${domain.name}.`,
    kind: 'Native',
    nameservers: ['ns1.migrahosting.com.', 'ns2.migrahosting.com.'],
  },
  { headers: { 'X-API-Key': process.env.POWERDNS_API_KEY! } }
);
```

### 8.3 Hosting Module

**Purpose:**
Manage shared hosting accounts on srv1 or future web servers.

**API:**

- `GET /api/hosting/accounts` → list `HostingAccount` rows.
- `POST /api/hosting/accounts` → create manual hosting account.
- `POST /api/hosting/accounts/:id/suspend`
- `POST /api/hosting/accounts/:id/unsuspend`
- `POST /api/hosting/accounts/:id/terminate`

**Provisioning service might call:**

```typescript
ssh srv1 "bash /root/create_client_site.sh ...",
```

or a local agent HTTP API.

### 8.4 VPS Module

**Purpose:**
Handle future VPS provisioning.

**API skeleton:**

- `GET /api/vps`
- `POST /api/vps` → manual create / test.
- `POST /api/vps/:id/start`, `/stop`, `/reboot`, `/destroy`.

Right now can return "Not yet implemented" but follow models.

### 8.5 Mail Module

**Purpose:**
Manage central mail server accounts (mail-core).

**API:**

- `GET /api/mail/accounts`
- `POST /api/mail/accounts` → create email
- `POST /api/mail/accounts/:id/disable`
- `POST /api/mail/accounts/:id/reset-password`

**Implementation:**

Call `MAILCORE_API_URL` internal REST:

- `/domains`
- `/accounts`

Or call MariaDB/Postfix tables directly if you expose it.

### 8.6 Backups Module

**Purpose:**
Track backup jobs & status from your backup scripts.

**API:**

- `GET /api/backups/jobs`
- `GET /api/backups/jobs/:id`
- (Optional) `POST /api/backups/jobs/:id/rerun` → enqueue re-run

Your cron / backup scripts can call back:

```bash
curl -X POST https://mpanel.migrahosting.com/api/backups/report \
  -H "Authorization: Bearer <internal>" \
  -d '{"jobId":"...","status":"SUCCESS","details":{...}}'
```

---

## 9. Internal vs Public APIs

### 9.1 Public API

Used by marketing site (read-only):

- `GET /api/public/health`
- `GET /api/public/products`
- `GET /api/public/plans`

These must NOT expose internal configuration.

### 9.2 Internal API

Used by:

- Marketing backend (srv1) to create orders after payment.
- Cron jobs / backup scripts.
- Future agents.

**Secure with:**

- Dedicated internal token in `MARKETING_WEBHOOK_SECRET`, etc.
- Or JWT with special internal role.

**Example:**

```typescript
// src/middleware/internal-auth.ts
export function internalAuth(req, res, next) {
  const token = req.headers['x-internal-key'];
  if (token !== process.env.MARKETING_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
```

---

## 10. Logging & Audit

Use `logger.ts` with winston/pino.

**Every major action:**

- Auth login, new order, provisioning result, server changes.

**Write both:**

- To log file (JSON).
- To `AuditLog` table.

**Example log:**

```typescript
logger.info('Provisioning hosting account', {
  orderId,
  domain: domain.name,
  server: server.name,
  jobId,
});
```

---

## 11. Security Rules (Backend)

- All `/api/admin/*` routes require JWT auth.
- **Role-based checks:**
  - `SUPER_ADMIN` → everything.
  - `ADMIN` → everything except dangerous system-level actions.
  - `SUPPORT` → read + limited write (no deletion/termination).
  - `BILLING` → orders, subscriptions, invoices.
  - `READ_ONLY` → view only.
- **Validation:**
  - Use zod or Joi for input validation in each module.
- **Never return secrets:**
  - Don't expose `POWERDNS_API_KEY`, SMTP creds, etc.
- **Protect internal endpoints:**
  - All `/api/internal/*` routes must require `x-internal-key` header.

---

## 12. How Copilot Should Use This File

When Copilot is asked to "fix mPanel backend" or "implement DNS module":

1. Use Prisma models **exactly as defined here**.
2. Use the folder pattern:
   - `modules/<name>/<name>.router.ts`
   - `modules/<name>/<name>.controller.ts`
   - `modules/<name>/<name>.service.ts`
3. Use the APIs and flows described above.
4. Use `Job` + Redis queue for provisioning actions, don't call external services directly from controllers.
5. Always log to `AuditLog` when doing critical changes.
6. Respect the internal vs public API separation.

---

## 13. Minimal TODO List (Backend)

For backend to be "production usable" for auto-provisioning while we keep polishing UI:

✅ **Ensure basic Auth module works:**
- `/api/auth/login`
- `/api/auth/me`

✅ **Ensure Products & Plans public endpoints work:**
- `/api/public/products`
- `/api/public/plans`

✅ **Implement Orders endpoint for marketing:**
- `POST /api/orders` (internal token protected).
- Creates `Customer` + `Order` + `Subscription` + `Jobs`.

✅ **Implement basic queue worker:**
- Reads `Job` rows from Redis queue.
- At least handle: `PROVISION_DNS` + `PROVISION_HOSTING`.

✅ **Implement DNS provisioning:**
- Create PowerDNS zone for purchased domain.

✅ **Implement Hosting provisioning:**
- Call script/agent on srv1-web to create client directory & basic vhost.
- Update `HostingAccount` row.

**Once these are done,** marketing website can sell hosting from end to end, even if many admin screens are still "coming soon".
