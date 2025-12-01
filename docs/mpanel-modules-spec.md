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
