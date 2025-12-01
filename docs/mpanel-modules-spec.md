# mPanel / MigraHosting – Modules & Connections (Spec for Copilot)

> **Goal for Copilot:**  
> Use this document as the "truth" for how modules work together.  
> When you see TODOs / placeholders, implement them following these rules, names, and flows.

---

## 0. Core Concepts (Global)

These concepts are shared by all modules:

### User

A human login (email + password or SSO).

**Fields:** `id`, `name`, `email`, `status`, `lastLoginAt`, `role`, etc.

A user can belong to:
- The platform side (MigraHosting super admins, support, billing), and/or
- One or more tenants (customer accounts).

### Tenant (Customer Account)

Represents a company or individual that buys MigraHosting services.

**Fields:** `id`, `name`, `slug`, `billingEmail`, `address`, `status`, `createdAt`.

**Has many:**
- `tenantUsers` (link table: user ↔ tenant + role)
- `subscriptions`
- `cloudPods`, `domains`, `websites`, `emails`, etc.

### Roles & Permissions

**Global platform roles:**
- `SUPER_ADMIN` – full system.
- `PLATFORM_ADMIN` – ops, billing, support.

**Tenant-level roles:**
- `TENANT_OWNER` – full control for that tenant.
- `TENANT_ADMIN` – manage resources & users.
- `TENANT_USER` – limited access (websites, email, backups, etc).

**Implement via RBAC tables:**
- `roles`, `permissions`, `rolePermissions`, `userRoles` or `tenantUserRoles`.

### Product

A sellable item (CloudPod plan, WordPress add-on, Email bundle, Backup storage, etc.).

**Fields:** `id`, `name`, `code`, `type`, `billingPeriod`, `basePrice`, `metadata` (JSON).

### Subscription

Active purchase of one or more Products by a Tenant.

**Fields:** `id`, `tenantId`, `productId`, `status`, `startedAt`, `renewsAt`, `cancelAt`, `quantity`, `price`, `billingProviderId`.

Each subscription may "own" one or more provisioned resources (CloudPods, email plans, etc).

### CloudPod

The tenant's actual hosted environment or plan instance.

**Fields:** `id`, `tenantId`, `subscriptionId`, `serverId`, `planCode`, `status`, `region`, `primaryDomain`, `stack` (WordPress, PHP, Node, etc).

Provisioned through Provisioning module.

### Server

A physical/virtual node able to run CloudPods, email, databases, etc.

**Fields:** `id`, `name`, `type` (web, db, mail, object-storage, etc.), `provider`, `region`, `ip`, `status`, `metrics`.

### Job / Task

Background operations (create CloudPod, issue SSL, backup site, restore backup, etc).

**Fields:** `id`, `type`, `payload` (JSON), `status`, `error`, `createdAt`, `startedAt`, `finishedAt`.

---

## 1. Marketing Website → mPanel Flow

> **Copilot:** Whenever you see marketing checkout code, use this flow.

1. **Visitor picks plan** on marketing site (CloudPod, WordPress, Email, Backup, etc).

2. **Marketing site calls Public API:**
   ```
   POST /api/public/checkout/session
   ```
   **Input:** `{ planCode, billingCycle, email, domain?, isWordPressPlan?, addOns[] }`
   **Output:** `{ checkoutSessionId, paymentUrl }`

3. **After payment provider confirms success:**
   - Webhook → `POST /api/public/checkout/webhook`
   - Backend will:
     1. Create or reuse **User** for that email.
     2. Create **Tenant** (if none).
     3. Create **Subscription(s)** for products.
     4. Create **CloudPod** record(s) from the subscription + plan.
     5. Enqueue a **Provisioning job** (`CREATE_CLOUDPOD`) with payload:
        - `tenantId`, `subscriptionId`, `cloudPodId`, `serverSelectionStrategy`, `requestedDomain`, etc.

4. **Tenant owner receives** "Welcome / Activate account" email with mPanel login URL.

---

## 2. Overview

### 2.1 Dashboard

**Purpose:** High-level health for platform admins.

**Widgets:**
- **Total Users** → count of platform + tenant users.
- **Total Customers** → count of active Tenants.
- **Monthly Revenue** → sum of subscriptions for current month (MRR/ARR).
- **Active Servers** → servers with `status = ACTIVE`.
- **Active CloudPods** → pods with `status = RUNNING`.
- **System Health** → aggregate of errors, job failures, monitoring checks.

**Quick Actions:**
- Create User → opens Users > Create.
- Add Product → Billing > Products > Create.
- Add Server → Servers > Add.
- Create CloudPod → CloudPods wizard (under Provisioning).
- System Settings → global platform config.

**Operations Pulse:**
- `jobsPending`, `failedJobs24h`, `workersOnline`, `avgQueueDelay`.

**Cloud Infrastructure:**
- `totalPods`, `podsRunning`, `podsErrors`, `podsAutoHealed24h`.

**Revenue & Billing:**
- MRR chart (last 30 days).

**Top Tenants by Usage:**
- Tenants sorted by resource usage (CPU, bandwidth, storage).

**Recent Activity / System Events:**
- Recent audit log + system notifications.

---

## 3. Administration Modules

### 3.1 Users

**Purpose:** Manage all human accounts.

**Data:** `users`, `tenantUsers`, `userRoles`, `loginHistory`.

**Actions:**
- Create / edit / disable user.
- Attach/detach user to Tenants with roles.
- Force password reset, lock account.

**Permissions:** Platform admins only (for global view). Tenants see only their own users.

### 3.2 Customers (Tenants)

**Purpose:** Manage customer accounts and their relationships.

**Data:** `tenants`, `tenantUsers`, `contacts`, `billingProfile`, `notes`.

**Actions:**
- Create new tenant manually (for sales/support).
- View tenant summary: subscriptions, CloudPods, domains, usage, invoices, support tickets, emails.
- Impersonate Tenant Owner into their portal (support).
- Suspend / unsuspend tenant (affects CloudPods, login, billing).

**Connections:**
- **Billing** → show subscriptions, invoices.
- **Hosting** → CloudPods, domains, websites, email accounts.
- **Security** → login activity, security events.
- **Backups / Monitoring** → usage charts.

### 3.3 Guardian AI

**Purpose:** Internal AI assistant for support/ops.

**Data:** `guardianSessions`, `logs`, `feedback`.

**Actions:**
- Allow admins to ask infra/billing questions.
- Log AI suggestions used for actions.

**Connections:** Can call back-end helper APIs (status, logs, etc.) but read-only.

### 3.4 Server Management

**Purpose:** Manage physical/virtual servers.

**Data:** `servers`, `serverCapabilities`, `serverTags`.

**Actions:**
- Register server (srv1-web, mail-core, db-core, dns-core, etc.).
- Mark capabilities: `canHostPods`, `isMailServer`, `isDbServer`, `regions[]`.
- View metrics, utilization, drain / put back into service.

**Connections:**
- **Provisioning** → chooses where to deploy CloudPods.
- **Monitoring** → pulls metrics for dashboards.
- **Backups** → determines backup destinations / sources.

### 3.5 Provisioning

**Purpose:** Orchestrate all "make/change/destroy" actions for pods & resources.

**Data:** `jobs`, `jobEvents`, `provisioningProfiles`, `blueprints`.

**Job Types:**
- `CREATE_CLOUDPOD`, `SCALE_CLOUDPOD`, `MIGRATE_CLOUDPOD`, `DELETE_CLOUDPOD`.
- `ISSUE_SSL`, `RENEW_SSL`, `PROVISION_EMAIL_DOMAIN`, `CREATE_DB`, `RESTORE_BACKUP`, etc.

**Behavior:**
- Always run async via queue workers (Redis / Bull / etc).
- Update status for: CloudPod, Domain / SSL, Backup record.
- Emit audit events for Security / Logs.

**Connections:**
- Called by Billing (new subscription), Customers UI, CloudPods wizard, CLI.

### 3.6 Role Management

**Purpose:** Central RBAC rules.

**Data:** `roles`, `permissions`, `rolePermissions`, `tenantRoleTemplates`.

**Actions:**
- Define global roles (platform side).
- Define tenant role templates (Owner, Admin, Developer, Billing).
- Assign/remove permissions from roles.

**Usage Notes for Copilot:**
- APIs should always check permissions via a central helper, e.g. `checkPermission(user, 'domains:read', tenantId?)`.

---

## 4. Hosting Modules

### 4.1 Servers

(covered above under Server Management but shown to ops under Hosting)

List of all web/db/mail servers with status, region, capacity, maintenance flags.

### 4.2 Server Metrics

**Purpose:** Per-server performance.

**Data:** time-series metrics `cpu`, `ram`, `disk`, `network`.

**Actions:** graphs, alert thresholds, open in Monitoring.

### 4.3 Websites

**Purpose:** Web applications / sites owned by tenants.

**Data:** `websites`, `cloudPodId`, `domains`, `stack`, `runtime`, `status`.

**Actions:**
- Create site within a CloudPod.
- Attach domain / subdomain.
- Choose runtime (WordPress, PHP app, Node app, static).
- Manage deployment keys or git hooks.

**Connections:**
- **DNS** → A/AAAA/CNAME records.
- **SSL** → certificates.
- **Backups** → site-level backups.
- **Monitoring** → uptime, response time.

### 4.4 Domains

**Purpose:** Tenant-visible domain management.

**Data:** `domains`, `records`, `nameservers`, `dnsTemplates`.

**Actions:**
- Connect external domain or register via registrar API.
- Apply DNS templates for CloudPods (A, MX, SPF, DKIM, CNAME for app).

**Connections:**
- **Hosting** → Websites.
- **Email** → MX, SPF, DKIM, DMARC records.
- **SSL** → Auto-generate certs based on domains.

### 4.5 DNS

More advanced / admin side of Domains:
- Show raw records, TTLs, propagate zones, PowerDNS configs.
- Only for admins + power users.

### 4.6 Email

**Purpose:** Tenant email service.

**Data:** `mailDomains`, `mailboxes`, `aliases`, `mailPlans`, `mailUsage`.

**Actions:**
- Enable email for a domain (creates MX/SPF/DKIM/DMARC through DNS).
- Create / suspend mailboxes.
- Show connection settings (IMAP/SMTP, host, ports, TLS).

**Connections:**
- **Billing** → email plans as products.
- **DNS** → records.
- **Monitoring** → mail queue health.

### 4.7 File Manager

Limited browser for a site's root or pod storage, through secure API.

**Operations:** list, upload, download, delete, edit small text files.

### 4.8 Databases

**Purpose:** DB provisioning per tenant or per pod.

**Data:** `databases`, `dbUsers`, `connectionInfo`, `dbServerId`.

**Actions:**
- Create database on db-core or cluster.
- Create users with permissions.
- Rotate passwords.

**Connections:**
- **Websites** → connection strings.
- **Backups** → DB dumps.

---

## 5. Enterprise Features

Each of these is mostly config + integration:

### 5.1 Premium Tools

Feature flags & add-ons (e.g., staging environments, performance tools).
Linked to Products/Subscriptions.

### 5.2 SSL Certificates

- Track all certs per domain.
- Renew via ACME / Let's Encrypt.
- Show expiry warnings and auto-renew jobs.

### 5.3 App Installer

- One-click installs (WordPress, Laravel boilerplate, Next.js, etc).
- Ties into Provisioning jobs inside a CloudPod.

### 5.4 API Keys

- Issue per-tenant & per-user API keys.
- Scopes: `billing`, `domains`, `cloudpods`, `metrics`, etc.

### 5.5 Backups

**Data:** `backupJobs`, `backupSnapshots`, `retentionPolicies`.

**Actions:**
- Configure backup frequency and retention per pod/site/db.
- Manual backup & restore.

**Connections:**
- Storage / MinIO / Windows backup mount paths.
- Security / Audit logs.

### 5.6 AI Features

GPT-4/AI tools available inside tenant (logs assistant, query builder, etc).

### 5.7 WebSocket

Real-time channels (jobs status, logs tail, notifications).

### 5.8 GraphQL API

Public/tenant GraphQL endpoint for automation.

### 5.9 Analytics

Tenant-facing analytics (traffic, bandwidth, errors).
Internally uses metrics & logs.

### 5.10 Kubernetes

For future advanced CloudPods backed by K8s clusters.

### 5.11 CDN Management

Per-domain CDN configuration, purge cache, rules.

### 5.12 Monitoring

Uptime checks, latency, error rate dashboards, alerts.

### 5.13 API Marketplace

Catalog of 3rd-party integrations (emails, SMS, logs, etc).

### 5.14 White-Label

Tenant-reseller theme/branding (logo, domain, colors) for their customers.

---

## 6. Billing Modules

### 6.1 Products

Create & manage sellable products:
- CloudPods plans
- WordPress add-ons
- Email bundles
- Backup storage tiers
- Other add-ons

**Fields:** `code`, `name`, `description`, `type`, `billingInterval`, `price`, `features[]`.

### 6.2 Invoices

Generated from subscriptions & usage.

**Fields:** `tenantId`, `amount`, `status`, `lineItems[]`, `currency`, `dueDate`.

Sync with payment provider (Stripe, etc).

### 6.3 Subscriptions

Link between Tenant & Products (covered above).

**Actions:**
- Upgrade / downgrade plan.
- Change billing period.
- Cancel at period end.
- Trigger provisioning jobs on status change.

---

## 7. Security Module

**Purpose:** Platform-wide security & audit.

**Data:** `auditEvents`, `loginAttempts`, `apiKeyUsage`, `securityIncidents`.

**Actions:**
- View activity log: who did what, where, and when (tenant + platform).
- Manage security policies (2FA required, IP allowlist for admins, etc).
- Alerts for suspicious behavior (too many failed logins, unusual countries, config changes).

**Connections:**
Every module must emit audit events for sensitive changes:
- `USER_CREATED`, `TENANT_SUSPENDED`, `DNS_CHANGED`, `CLOUDPOD_PROVISIONED`, `BACKUP_RESTORED`, etc.

---

## 8. Infrastructure & SSH Access

> **IMPORTANT:** Always use Tailscale for SSH to push things through to servers.

When provisioning or managing infrastructure:
- Use Tailscale network for secure SSH connections
- Never expose SSH directly to public internet
- All provisioning scripts execute over Tailscale tunnels

---

## 9. API Namespaces Summary

| Module | API Namespace | Description |
|--------|---------------|-------------|
| **Public Checkout** | `/api/public/checkout/*` | Marketing site integration |
| **Users** | `/api/admin/users/*` | User management |
| **Customers** | `/api/admin/customers/*` | Tenant management |
| **Billing** | `/api/admin/billing/*` | Products, subscriptions, invoices |
| **Hosting** | `/api/admin/hosting/*` | CloudPods, websites, domains |
| **CloudPods** | `/api/admin/hosting/cloudpods/*` | Pod lifecycle |
| **Domains** | `/api/admin/domains/*` | Domain & DNS |
| **Email** | `/api/admin/email/*` | Mail domains & boxes |
| **SSL** | `/api/admin/ssl/*` | Certificates |
| **Provisioning** | `/api/admin/provisioning/*` | Jobs & workers |
| **Servers** | `/api/admin/servers/*` | Infrastructure |
| **Security** | `/api/admin/security/*` | Audit & access |
| **Backups** | `/api/admin/backups/*` | Backup management |

---

## 10. RBAC Enforcement Pattern

Always enforce RBAC using helpers:

```javascript
// Check permission before any action
import { checkPermission, requirePermission } from '../middleware/rbac.js';

// In route handlers:
requirePermission(user, 'cloudpods:read', tenantId);
requirePermission(user, 'subscriptions:write', tenantId);
requirePermission(user, 'billing:manage', tenantId);
requirePermission(user, 'domains:delete', tenantId);

// Permission format: 'resource:action'
// Actions: read, write, delete, manage, admin
```

---

## 11. Cross-Module Flow Patterns

### When a Subscription is Created/Updated/Cancelled:

1. **Sync with billing provider** (Stripe/WHMCS)
2. **Create/update a CloudPod** (for hosting products)
3. **Enqueue provisioning jobs** through the Provisioning module
4. **Emit audit events**: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_CANCELLED`

### When a Domain is Connected or Changed:

1. **Update domains & DNS records**
2. **Trigger SSL provisioning jobs**
3. **Emit audit events**: `DOMAIN_UPDATED`, `SSL_ISSUE_REQUESTED`

### When a CloudPod is Provisioned:

1. **Select target server** based on capacity/region
2. **Execute provisioning** via Tailscale SSH
3. **Update CloudPod status** in database
4. **Configure DNS** if domain attached
5. **Issue SSL certificate** if needed
6. **Emit audit event**: `CLOUDPOD_PROVISIONED`

---

## 12. Architecture Rules

1. **Never hard-code server IPs or secrets** – read from config/environment
2. **For any cross-module operation**, update all relevant entities:
   - Subscription + CloudPod + Jobs + AuditLog
3. **Keep read models** (dashboards, stats) **in sync** with write operations
4. **Use the queue** for long-running operations (provisioning, backups)
5. **Emit audit events** for all state changes
6. **Use Tailscale** for all SSH operations to infrastructure

---

## 13. Data Model References

- See `docs/CLOUDPODS_MASTER_SPEC.md` for CloudPods schema
- See `docs/migra-cloudpods-enterprise-spec.md` for infrastructure details

**Canonical tables:**
- `users`, `tenants`, `tenantUsers`
- `roles`, `permissions`, `rolePermissions`
- `products`, `subscriptions`, `invoices`
- `cloud_pods`, `cloud_pod_queue`, `cloud_pod_quotas`
- `servers`, `serverCapabilities`
- `domains`, `dnsRecords`, `sslCertificates`
- `mailDomains`, `mailboxes`
- `databases`, `dbUsers`
- `backupJobs`, `backupSnapshots`
- `auditEvents`, `jobs`

---

## 14. Copilot Implementation Rules

> **CRITICAL:** Use these rules any time you create / modify code in this repo.

### 14.1 Multi-Tenant Safety

Every API that touches tenant data **must**:

1. **Accept `tenantId` explicitly** (route param, query, or from auth context).

2. **Verify access with the RBAC helper:**
   ```javascript
   requirePermission(user, '<module>:<action>', tenantId)
   ```

3. **Filter queries by `tenantId`** (never return cross-tenant rows).

**NEVER:**
- Trust client-supplied `tenantId` without verifying it belongs to the current user.
- Use "global" queries that aren't filtered by tenant in tenant-facing endpoints.

### 14.2 Environment & Secrets

**Never hard-code:**
- IPs, hostnames, ports, or credentials.

**Always read from config / env:**
- `APP_URL`, `API_URL`, `MAIL_HOST`, `REDIS_URL`, DB URLs, etc.

**Infrastructure communication:**
- All code that talks to infrastructure must go over Tailscale SSH or internal network.
- Use hostnames like `srv1-web`, `mail-core`, `db-core`, `dns-core` (not raw IPs).

### 14.3 Jobs & Idempotency

For anything that changes infrastructure (CloudPods, DNS, SSL, email, backups):

1. **Always run via a Job** (queue worker), not in the HTTP request:
   - E.g. `CREATE_CLOUDPOD`, `PROVISION_EMAIL_DOMAIN`, `ISSUE_SSL`.

2. **Jobs must be idempotent:**
   - Safe to retry if a worker crashes.
   - Check if resource already exists (domain, pod, mailbox), then update instead of duplicating.

3. **Every job must:**
   - Log start/end + status.
   - Emit at least one audit event (see Security Module).
   - Update related models (`cloudPods`, `domains`, `subscriptions`, etc.).

### 14.4 Logging, Errors, and Audit

**For every API handler:**
- Return structured errors: `{ error: string, code?: string, details?: any }`.
- Never leak secrets or full stack traces in responses.

**For sensitive actions:**
- Always emit an audit event:
  - `USER_*`, `TENANT_*`, `SUBSCRIPTION_*`, `DOMAIN_*`, `CLOUDPOD_*`, `BACKUP_*`, `SECURITY_*`.
- Internal logs can include more detail, but still no raw secrets.

### 14.5 HTTP & API Design

Use clear, module-based namespaces:

```
GET  /api/admin/customers/:tenantId/summary
POST /api/admin/hosting/cloudpods
POST /api/admin/hosting/domains/:domainId/dns/apply-template
POST /api/admin/billing/subscriptions/:id/upgrade
```

**HTTP method rules:**
- `GET` for read
- `POST` for actions/create
- `PUT`/`PATCH` for updates
- `DELETE` for delete

**Response shape rules:**
- Wrap lists as `{ items: [...], total: number }`.
- For dashboard tiles, create dedicated endpoints that return only what's needed.

### 14.6 Frontend Patterns (React / UI)

Use a consistent pattern:
```
/src/modules/<module>/api.ts        – functions calling backend endpoints
/src/modules/<module>/hooks.ts      – React hooks (useCustomers, useCloudPods)
/src/modules/<module>/components/*  – UI components
```

**For data fetching:**
- Prefer a single client (e.g. `apiClient.ts`) with auth headers & error handling.
- Surface backend validation errors nicely in forms.

**For dashboards:**
- Don't call 20 endpoints from one component; create a backend summary endpoint where needed.

### 14.7 Testing & Safety Checks

**For new APIs, add tests covering:**
- Permission denied (no role).
- Happy path (correct role & tenant).
- Incorrect tenant (should be blocked).

**For anything provisioning:**
- Use "dry-run" or "validate" code paths where possible before calling real infrastructure.

### 14.8 Feature Flags & Future Modules

Where you see modules marked "future" (Kubernetes, CDN, Marketplace, etc.):
- Implement behind a simple feature flag: `features.kafka`, `features.k8s`, `features.cdn`.
- UI components should hide these if the flag is off.

### 14.9 Anti-Patterns to Avoid

**Copilot must NOT:**

| ❌ Anti-Pattern | ✅ Correct Approach |
|----------------|---------------------|
| Couple Marketing site code directly to internal infra | Only via public API |
| Talk directly to Docker, PowerDNS, mail, DB from frontend | Backend API → Job → Infrastructure |
| Skip RBAC on any admin/tenant endpoint | Always `requirePermission()` |
| Do cross-tenant queries without explicit admin permission | Filter by `tenantId` always |
| Hard-code IPs, ports, credentials | Use environment variables |
| Run infra changes in HTTP request handler | Use Job queue |
| Return raw stack traces to client | Structured error responses |
| Trust client-supplied `tenantId` blindly | Verify against user's accessible tenants |

---

## 15. Quick Reference: Code Examples

### RBAC Check in Route Handler

```javascript
import { requirePermission } from '../middleware/rbac.js';

router.get('/api/admin/customers/:tenantId/cloudpods', async (req, res) => {
  const { tenantId } = req.params;
  const user = req.user;
  
  // Always verify permission first
  requirePermission(user, 'cloudpods:read', tenantId);
  
  // Query filtered by tenantId
  const pods = await db('cloud_pods')
    .where({ tenant_id: tenantId, deleted_at: null })
    .select('*');
  
  res.json({ items: pods, total: pods.length });
});
```

### Enqueueing a Provisioning Job

```javascript
import { enqueueJob } from '../services/queueService.js';
import { emitAuditEvent } from '../services/auditService.js';

async function createCloudPod(tenantId, subscriptionId, planCode, user) {
  // Create the CloudPod record first
  const cloudPod = await db('cloud_pods').insert({
    tenant_id: tenantId,
    subscription_id: subscriptionId,
    plan_code: planCode,
    status: 'pending',
    created_at: new Date()
  }).returning('*');
  
  // Enqueue the provisioning job
  await enqueueJob('CREATE_CLOUDPOD', {
    cloudPodId: cloudPod.id,
    tenantId,
    subscriptionId,
    planCode,
    requestedBy: user.id
  });
  
  // Emit audit event
  await emitAuditEvent('CLOUDPOD_CREATE_REQUESTED', {
    tenantId,
    cloudPodId: cloudPod.id,
    userId: user.id
  });
  
  return cloudPod;
}
```

### Idempotent Job Handler

```javascript
async function handleCreateCloudPod(job) {
  const { cloudPodId, tenantId, planCode } = job.payload;
  
  // Check if already provisioned (idempotency)
  const existing = await db('cloud_pods').where({ id: cloudPodId }).first();
  if (existing?.status === 'active') {
    logger.info(`CloudPod ${cloudPodId} already active, skipping`);
    return { success: true, skipped: true };
  }
  
  try {
    // Update status to provisioning
    await db('cloud_pods').where({ id: cloudPodId }).update({ status: 'provisioning' });
    
    // Execute provisioning via Tailscale SSH
    const result = await sshExec(config.PROXMOX_HOST, [
      'sudo', '/usr/local/sbin/cloudpod-create.sh',
      '--vmid', cloudPodId,
      '--tenant', tenantId,
      '--auto-ip'
    ]);
    
    // Update to active
    await db('cloud_pods').where({ id: cloudPodId }).update({
      status: 'active',
      ip_address: result.ip,
      vmid: result.vmid
    });
    
    // Emit success audit event
    await emitAuditEvent('CLOUDPOD_PROVISIONED', { cloudPodId, tenantId });
    
    return { success: true };
  } catch (error) {
    await db('cloud_pods').where({ id: cloudPodId }).update({
      status: 'error',
      error_message: error.message
    });
    
    await emitAuditEvent('CLOUDPOD_PROVISION_FAILED', {
      cloudPodId,
      tenantId,
      error: error.message
    });
    
    throw error; // Allow retry
  }
}
```

### Structured Error Response

```javascript
// Error handler middleware
function errorHandler(err, req, res, next) {
  // Log full error internally
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    userId: req.user?.id
  });
  
  // Return structured response (no stack trace)
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    details: err.details || undefined
  });
}
```

---

## 16. Enterprise Guardrails

> **IMPORTANT:** Any new code in this repo must follow these rules.  
> When in doubt, copy existing patterns from this file instead of inventing new ones.

### 16.1 Authentication & Authorization

#### Auth Source of Truth

All API requests must be authenticated via:
- JWT access tokens, or
- Session cookies (depending on current implementation).

**Copilot must never bypass the existing auth middleware.**

#### RBAC Enforcement

Use central helpers only (no inline permission logic):

```javascript
requirePlatformPermission(user, 'admin:*')
requireTenantPermission(user, tenantId, 'cloudpods:manage')
```

Every handler that touches tenant data must:
1. Resolve `tenantId` from path/params/body.
2. Verify tenant membership & permissions.
3. Filter DB queries by `tenantId`.

#### Multi-Tenant Safety

**NEVER:**
- Query across tenants in tenant-facing endpoints.
- Expose a record without checking its `tenantId` against the current context.

**For admin/platform endpoints that do cross tenants:**
- Require `SUPER_ADMIN` or explicit `platform:*` permissions.

#### Password & 2FA

**Password rules:**
- At least 10 chars, reasonable complexity requirements.

**2FA support hooks:**
- Tables/fields for TOTP secret, recovery codes, 2FA status.
- API stubs: `POST /api/auth/2fa/enable`, `/verify`, `/disable`.

### 16.2 API Standards & Versioning

#### Versioned Namespaces

Expose all APIs under versioned prefixes:
```
/api/v1/admin/...
/api/v1/tenant/...
/api/v1/public/...
```

Internally, Copilot should organize controllers by module + version.

#### Consistent Response Shape

**Success (single resource):**
```json
{ "data": { ... }, "meta": { "requestId": "..." } }
```

**Success (list):**
```json
{
  "data": [ ... ],
  "meta": { "total": 123, "page": 1, "pageSize": 25, "requestId": "..." }
}
```

**Error:**
```json
{
  "error": {
    "code": "SUBSCRIPTION_NOT_FOUND",
    "message": "Subscription not found",
    "details": { "subscriptionId": "..." }
  },
  "meta": { "requestId": "..." }
}
```

#### Pagination, Sorting, Filtering

Lists must support:
- `?page`, `?pageSize`, `?sortBy`, `?sortDir`, `?filter[...]`

**Never return unbounded lists for tenant or admin data.**

#### Idempotency

For webhooks and unsafe POSTs that can be retried:
- Use idempotency keys (`externalSubscriptionId`, `idempotencyKey` header).
- Check for existing records before creating new ones.

### 16.3 Data Integrity & Deletion

#### Soft Deletes

Use soft deletes (`deletedAt` timestamp) for:
- Users, Tenants, Subscriptions, CloudPods, Domains, Mailboxes.

Tenant-facing APIs must exclude soft-deleted records by default.

#### Referential Integrity

DB must enforce FKs:
- `tenantId` on all tenant-bound tables.
- `subscriptionId` → `subscriptions`, `cloudPodId` → `cloudPods`, etc.

#### Archival

Add room for archive tables or `archivedAt` fields for:
- Old audit logs, system events, metrics rollups.

### 16.4 Observability: Logging, Metrics, Tracing

#### Structured Logging

Use a single logger (`logger`) everywhere with JSON/structured logs:

```javascript
logger.info('CLOUDPOD_CREATED', {
  tenantId,
  cloudPodId,
  serverId,
  requestId,
});
```

**No `console.log` in production code.**

#### Correlation / Request IDs

Middleware must:
1. Generate `requestId` for each HTTP request (or reuse if provided).
2. Attach it to `req.context` and logs.
3. All responses include `meta.requestId`.

#### Metrics

Standard metrics:
- **HTTP:** request count, latency, error rate per route.
- **Jobs:** queue depth, processing time, failures per job type.
- **Infra:** server CPU/RAM/disk, DB connection utilization.

Copilot should reuse existing metrics client (`prom-client` or whatever is used).

#### Tracing

Where tracing is available, wrap:
- Incoming HTTP requests.
- Outgoing calls to infra (PowerDNS, mail, DB, orchestrator).

### 16.5 Background Jobs & Reliability

#### Queue Rules

All heavy or infra-changing operations must be jobs:
- Provisioning, DNS updates, SSL, backups, restores, migrations.

Each job type:
- Has a clear payload interface.
- Is idempotent.
- Has configured attempts and exponential backoff.

#### Timeouts & Circuit Breakers

No external call (PowerDNS, mail, orchestrator, Stripe, etc.) should:
- Run without a timeout.

Use per-service clients with:
- Timeout
- Retry settings
- Basic circuit breaker where possible

#### Dead Letter Handling

On repeated job failure:
1. Move job to a dead-letter queue or mark as `FAILED`.
2. Write an audit event `JOB_FAILED`.
3. Expose these in "System Events" + Monitoring UI.

### 16.6 Security: Data, Secrets, Network

#### Secrets Management

- Read secrets only from environment variables or secure config.
- Never commit credentials, tokens, private keys.

#### Tailscale / Network Boundary

Any call to servers (`srv1-web`, `mail-core`, `db-core`, `dns-core`, etc.) must assume:
- Access occurs over Tailscale or internal network.

Copilot must:
- Use hostnames from env/config.
- Never embed IPs in code.

#### Least Privilege

DB users and infra tokens should be scoped to:
- Only the operations that service/module needs.

Copilot should assume there may be separate DB users per service later.

#### Input Validation & Sanitization

All external inputs (body, params, query):
- Validated via a central validation library (e.g., `zod` / `yup` / `class-validator`).

**NEVER:**
- Build SQL strings via string concatenation from user inputs.

### 16.7 Frontend & UX Rules

#### Folder Pattern

Use per-module structure:
```
/src/modules/<module>/api.ts
/src/modules/<module>/hooks.ts
/src/modules/<module>/components/...
/src/modules/<module>/pages/...
```

#### Data Fetching

Use one central API client with:
- Base URL
- Auth headers
- `requestId` propagation (if supported)
- Global error handling

#### State & UI Behavior

For every view that calls API:
1. Show loading state.
2. Show error state with actionable message.
3. Use toasts/snackbars for successful actions: "CloudPod created", "Domain connected", etc.

#### Multi-Tenant Isolation in UI

- UI must not assume a single tenant.
- Every tenant selection should clearly show which tenant is active.

### 16.8 Config, Environments, and Feature Flags

#### Environment Separation

Environment-specific configs:
- `development`, `staging`, `production`.

Copilot must not:
- Mix test URLs into production code.

#### Configuration

All important settings come from config:
- `TAILSCALE_ORCHESTRATOR_URL`
- `POWERDNS_API_URL`
- `MAIL_CORE_API_URL`
- `MINIO_ENDPOINT`
- `BILLING_PROVIDER_PUBLIC_KEY`, etc.

#### Feature Flags

Use simple flags for future modules:
- `features.k8s`, `features.cdn`, `features.marketplace`.

UI and backend must respect these flags and hide/disable unsupported features.

### 16.9 Testing & QA

#### Unit/Integration Tests

For any new non-trivial module or API, add tests for:
- Happy path
- Permission denied
- Invalid input
- Multi-tenant isolation

#### Fixtures

Prefer using fixtures/factories for:
- Tenants, Users, Subscriptions, CloudPods.

#### Smoke / Health Checks

Maintain `/health` and `/status` endpoints that:
- Verify DB connection
- Queue connectivity
- Core dependencies reachable

### 16.10 Naming, Style, and Anti-Patterns

#### Naming

Use consistent names across backend, frontend, and DB:
- `tenantId`, `subscriptionId`, `cloudPodId`, `serverId` – not random variants.
- Modules must follow the same naming used in this spec.

#### Style

- Use existing lint/format rules (`eslint`, `prettier`).
- No `any` unless absolutely necessary and justified.

#### Anti-Patterns to Avoid

| ❌ Anti-Pattern | Why It's Bad |
|----------------|--------------|
| Direct DB calls in React components | Breaks separation of concerns |
| Infra scripts from frontend | Security risk, breaks architecture |
| Mixing platform-admin and tenant logic in same handler | Multi-tenant bugs |
| "Magic" cross-module behavior without audit + logs | Debugging nightmare |
| `console.log` in production | Use structured logger |
| Unbounded list queries | Performance & security |
| SQL string concatenation | SQL injection risk |

---

## 17. Reference Implementation: End-to-End Flow

> **Example Flow:**
> Stripe webhook → Create/link User & Tenant → Create Subscription & CloudPod → Enqueue `CREATE_CLOUDPOD` job → Worker provisions pod + DNS + SSL → Audit events at each step

Drop these into `src/modules/...` and adjust names. Copilot will clone the structure for other flows.

### 17.1 Billing Webhook – New Subscription Activated

**File:** `src/modules/billing/webhooks.ts`

```typescript
import { Request, Response } from 'express';
import { getOrCreateUserForEmail } from '../users/userService';
import { getOrCreateTenantForUser } from '../tenants/tenantService';
import { createSubscriptionFromProviderEvent } from './subscriptionService';
import { enqueueCreateCloudPodJob } from '../provisioning/queue';
import { writeAuditEvent } from '../security/auditService';
import logger from '../../config/logger';

export async function handleBillingWebhook(req: Request, res: Response) {
  try {
    const { eventType, payload } = req.body as {
      eventType: string;
      payload: any;
    };

    // TODO: validate provider signature here
    // const signature = req.headers['stripe-signature'] as string;

    if (eventType !== 'subscription_activated') {
      return res.status(200).json({ received: true });
    }

    const {
      customerEmail,
      planCode,
      billingCycle,
      externalSubscriptionId,
      domain,
      addOns,
    } = payload;

    // 1) User & Tenant
    const user = await getOrCreateUserForEmail(customerEmail);
    const tenant = await getOrCreateTenantForUser(user);

    // 2) Subscription
    const subscription = await createSubscriptionFromProviderEvent({
      tenantId: tenant.id,
      planCode,
      billingCycle,
      externalSubscriptionId,
      addOns,
    });

    // 3) CloudPod record + job
    const job = await enqueueCreateCloudPodJob({
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      requestedDomain: domain,
      planCode,
      addOns,
      triggeredByUserId: user.id,
      source: 'billing_webhook',
    });

    await writeAuditEvent({
      actorUserId: user.id,
      tenantId: tenant.id,
      type: 'SUBSCRIPTION_CREATED',
      metadata: {
        subscriptionId: subscription.id,
        externalSubscriptionId,
        planCode,
        jobId: job.id,
        source: 'billing_webhook',
      },
    });

    logger.info('Billing webhook processed successfully', {
      tenantId: tenant.id,
      subscriptionId: subscription.id,
      jobId: job.id,
    });

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    logger.error('Error handling billing webhook', {
      error: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ error: 'webhook_processing_failed' });
  }
}
```

### 17.2 Subscription Service – Create Subscription + CloudPod Record

**File:** `src/modules/billing/subscriptionService.ts`

```typescript
import db from '../../config/db';
import { writeAuditEvent } from '../security/auditService';

interface CreateSubscriptionFromProviderInput {
  tenantId: string;
  planCode: string;
  billingCycle: 'monthly' | 'yearly';
  externalSubscriptionId: string;
  addOns?: string[];
}

export async function createSubscriptionFromProviderEvent(
  input: CreateSubscriptionFromProviderInput
) {
  const { tenantId, planCode, billingCycle, externalSubscriptionId, addOns } =
    input;

  // Idempotency: avoid duplicates if webhook retries
  const existing = await db.subscription.findFirst({
    where: { externalSubscriptionId },
  });
  if (existing) {
    return existing;
  }

  const product = await db.product.findFirst({
    where: { code: planCode },
  });

  if (!product) {
    throw new Error(`Unknown planCode: ${planCode}`);
  }

  const subscription = await db.subscription.create({
    data: {
      tenantId,
      productId: product.id,
      planCode,
      billingCycle,
      status: 'ACTIVE',
      externalSubscriptionId,
      addOns,
    },
  });

  await writeAuditEvent({
    actorUserId: null, // system
    tenantId,
    type: 'SUBSCRIPTION_SYNCED_FROM_PROVIDER',
    metadata: {
      subscriptionId: subscription.id,
      externalSubscriptionId,
      planCode,
      billingCycle,
    },
  });

  return subscription;
}
```

### 17.3 Provisioning Queue – Enqueue CREATE_CLOUDPOD Job

**File:** `src/modules/provisioning/queue.ts`

```typescript
import { queue } from '../../config/queue'; // e.g. BullMQ, BeeQueue, etc.

export interface CreateCloudPodJobPayload {
  tenantId: string;
  subscriptionId: string;
  planCode: string;
  requestedDomain?: string;
  addOns?: string[];
  triggeredByUserId: string;
  source: 'billing_webhook' | 'admin_panel' | 'tenant_portal';
}

export async function enqueueCreateCloudPodJob(
  payload: CreateCloudPodJobPayload
) {
  const job = await queue.add('CREATE_CLOUDPOD', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: true,
    removeOnFail: false,
  });

  return { id: job.id, name: job.name };
}
```

### 17.4 Worker – Process CREATE_CLOUDPOD Job (Pod + DNS + SSL)

**File:** `src/modules/provisioning/workers/createCloudPodWorker.ts`

```typescript
import db from '../../../config/db';
import logger from '../../../config/logger';
import { writeAuditEvent } from '../../security/auditService';
import { selectBestServerForPlan } from '../serverSelectionService';
import { applyDnsTemplateForCloudPod } from '../../dns/dnsService';
import { enqueueIssueSslJob } from './issueSslWorker';
import { CreateCloudPodJobPayload } from '../queue';

export async function processCreateCloudPodJob(job: {
  id: string | number;
  data: CreateCloudPodJobPayload;
}) {
  const payload = job.data;

  logger.info('CREATE_CLOUDPOD job started', {
    jobId: job.id,
    payload,
  });

  const { tenantId, subscriptionId, planCode, requestedDomain, addOns } =
    payload;

  // idempotency: check if we already created a pod for this subscription
  const existingPod = await db.cloudPod.findFirst({
    where: { subscriptionId },
  });

  if (existingPod) {
    logger.info('CloudPod already exists for subscription, skipping create', {
      jobId: job.id,
      cloudPodId: existingPod.id,
    });
    return;
  }

  // 1) Choose server
  const server = await selectBestServerForPlan({ planCode });
  if (!server) {
    throw new Error('No suitable server available for plan');
  }

  // 2) Create CloudPod record (DB)
  const cloudPod = await db.cloudPod.create({
    data: {
      tenantId,
      subscriptionId,
      serverId: server.id,
      planCode,
      status: 'PROVISIONING',
      primaryDomain: requestedDomain ?? null,
      addOns,
    },
  });

  await writeAuditEvent({
    actorUserId: payload.triggeredByUserId ?? null,
    tenantId,
    type: 'CLOUDPOD_PROVISIONING_STARTED',
    metadata: {
      cloudPodId: cloudPod.id,
      subscriptionId,
      serverId: server.id,
      planCode,
    },
  });

  // 3) Call underlying infra (over Tailscale / internal network)
  // NOTE: Copilot: always use env/config for hostnames, never hard-code IPs.
  await provisionCloudPodOnServer({
    serverHostname: server.hostname,
    podId: cloudPod.id,
    planCode,
  });

  // 4) DNS – only if we have a primary domain
  if (requestedDomain) {
    await applyDnsTemplateForCloudPod({
      tenantId,
      cloudPodId: cloudPod.id,
      domain: requestedDomain,
      server,
    });

    await writeAuditEvent({
      actorUserId: payload.triggeredByUserId ?? null,
      tenantId,
      type: 'DOMAIN_DNS_TEMPLATE_APPLIED',
      metadata: {
        cloudPodId: cloudPod.id,
        domain: requestedDomain,
        serverId: server.id,
      },
    });

    // 5) SSL job
    await enqueueIssueSslJob({
      tenantId,
      cloudPodId: cloudPod.id,
      domain: requestedDomain,
    });
  }

  // 6) Mark pod as running
  await db.cloudPod.update({
    where: { id: cloudPod.id },
    data: { status: 'RUNNING' },
  });

  await writeAuditEvent({
    actorUserId: payload.triggeredByUserId ?? null,
    tenantId,
    type: 'CLOUDPOD_PROVISIONED',
    metadata: {
      cloudPodId: cloudPod.id,
      subscriptionId,
      serverId: server.id,
      planCode,
    },
  });

  logger.info('CREATE_CLOUDPOD job completed', {
    jobId: job.id,
    cloudPodId: cloudPod.id,
  });
}

// Example stub: Copilot should flesh this out with real Ansible / SSH / API calls
async function provisionCloudPodOnServer(input: {
  serverHostname: string;
  podId: string;
  planCode: string;
}) {
  // Call internal orchestration API over Tailscale or local network
  // Example: POST http://orchestrator.internal/api/pods
  // For now just log.
  return;
}
```

### 17.5 DNS Service – Apply Template for CloudPod

**File:** `src/modules/dns/dnsService.ts`

```typescript
import db from '../../config/db';
import { powerDnsClient } from '../../config/powerdns';
import logger from '../../config/logger';

interface ApplyDnsTemplateInput {
  tenantId: string;
  cloudPodId: string;
  domain: string;
  server: { hostname: string; ipv4?: string | null; ipv6?: string | null };
}

export async function applyDnsTemplateForCloudPod(
  input: ApplyDnsTemplateInput
) {
  const { domain, server, tenantId, cloudPodId } = input;

  // Ensure domain row exists
  let dnsDomain = await db.domain.findFirst({ where: { name: domain } });
  if (!dnsDomain) {
    dnsDomain = await db.domain.create({
      data: {
        name: domain,
        tenantId,
        type: 'CLOUDPOD',
        cloudPodId,
      },
    });
  }

  // Build records from template
  const records = [
    {
      name: domain,
      type: 'A',
      content: server.ipv4,
      ttl: 300,
    },
    // Add AAAA, CNAME "www", etc.
  ].filter((r) => !!r.content);

  // Push to PowerDNS via API client
  await powerDnsClient.applyZoneRecords({
    zoneName: domain,
    records,
  });

  logger.info('DNS template applied for CloudPod', {
    domain,
    tenantId,
    cloudPodId,
  });
}
```

### 17.6 SSL Worker – Issue Certificate

**File:** `src/modules/provisioning/workers/issueSslWorker.ts`

```typescript
import db from '../../../config/db';
import logger from '../../../config/logger';
import { writeAuditEvent } from '../../security/auditService';

interface IssueSslJobPayload {
  tenantId: string;
  cloudPodId: string;
  domain: string;
}

export async function enqueueIssueSslJob(payload: IssueSslJobPayload) {
  const { queue } = await import('../../../config/queue');
  const job = await queue.add('ISSUE_SSL', payload, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: true,
    removeOnFail: false,
  });
  return job;
}

export async function processIssueSslJob(job: {
  id: string | number;
  data: IssueSslJobPayload;
}) {
  const { tenantId, cloudPodId, domain } = job.data;

  logger.info('ISSUE_SSL job started', { jobId: job.id, domain });

  // TODO: Call ACME/LE client
  // const cert = await acmeClient.issueCertificate(domain);

  // For now just mark as "ACTIVE" in DB
  const ssl = await db.sslCertificate.upsert({
    where: { domain },
    create: {
      tenantId,
      cloudPodId,
      domain,
      status: 'ACTIVE',
    },
    update: {
      status: 'ACTIVE',
    },
  });

  await writeAuditEvent({
    actorUserId: null,
    tenantId,
    type: 'SSL_ISSUED',
    metadata: {
      cloudPodId,
      domain,
      sslId: ssl.id,
    },
  });

  logger.info('ISSUE_SSL job completed', { jobId: job.id, domain });
}
```

### 17.7 Audit Service – Central Helper

**File:** `src/modules/security/auditService.ts`

```typescript
import db from '../../config/db';

interface AuditEventInput {
  actorUserId: string | null;
  tenantId: string | null;
  type:
    | 'SUBSCRIPTION_CREATED'
    | 'SUBSCRIPTION_SYNCED_FROM_PROVIDER'
    | 'CLOUDPOD_PROVISIONING_STARTED'
    | 'CLOUDPOD_PROVISIONED'
    | 'DOMAIN_DNS_TEMPLATE_APPLIED'
    | 'SSL_ISSUED'
    | string; // extend as needed
  metadata?: Record<string, any>;
}

export async function writeAuditEvent(input: AuditEventInput) {
  const { actorUserId, tenantId, type, metadata } = input;

  await db.auditEvent.create({
    data: {
      actorUserId,
      tenantId,
      type,
      metadata: metadata ?? {},
    },
  });
}
```

---

## 18. Summary Checklist for Copilot

Before submitting any code change, verify:

- [ ] **RBAC:** All tenant endpoints use `requireTenantPermission()`
- [ ] **Multi-Tenant:** All queries filtered by `tenantId`
- [ ] **No Hardcoding:** IPs, secrets, URLs from env/config only
- [ ] **Jobs:** Infra changes go through queue, not HTTP handlers
- [ ] **Idempotent:** Jobs check for existing resources before creating
- [ ] **Audit Events:** Sensitive actions emit audit events
- [ ] **Structured Errors:** No stack traces in responses
- [ ] **Structured Logs:** Using `logger`, not `console.log`
- [ ] **Request ID:** Responses include `meta.requestId`
- [ ] **Soft Deletes:** Using `deletedAt` for user-facing data
- [ ] **Validation:** Input validated with zod/yup
- [ ] **Tests:** Added for permission denied + happy path + wrong tenant
