# mPanel Modules Specification

> **For GitHub Copilot & AI Assistants**  
> This document defines the module architecture, namespaces, and responsibilities for mPanel.

---

## Module Namespaces & API Routes

When creating new code in this repo, always respect these module definitions:

| Module | API Namespace | Responsibilities |
|--------|---------------|------------------|
| **Customers** | `/api/admin/customers/*` | Customer CRUD, profile management, customer search |
| **Hosting / CloudPods** | `/api/admin/hosting/cloudpods/*` | CloudPod lifecycle, VM management, scaling |
| **Billing / Subscriptions** | `/api/admin/billing/subscriptions/*` | Subscription CRUD, billing sync, payment methods |
| **Provisioning** | `/api/admin/provisioning/*` | Job queue, worker dispatch, provisioning status |
| **Domains** | `/api/admin/domains/*` | Domain registration, DNS records, transfers |
| **SSL** | `/api/admin/ssl/*` | Certificate provisioning, renewal, status |
| **Users** | `/api/admin/users/*` | User accounts, authentication, roles |
| **Tenants** | `/api/admin/tenants/*` | Multi-tenant management, tenant settings |
| **Audit** | `/api/admin/audit/*` | Audit logs, activity tracking |

---

## RBAC Enforcement

Always enforce RBAC using helpers:

```javascript
// Example: Checking permission before action
requirePermission(user, 'cloudpods:read', tenantId);
requirePermission(user, 'subscriptions:write', tenantId);
requirePermission(user, 'billing:manage', tenantId);
```

---

## Cross-Module Flows

### When a Subscription is Created/Updated/Cancelled:

1. **Sync with billing provider** (Stripe/WHMCS)
2. **Create/update a CloudPod** (for hosting products)
3. **Enqueue provisioning jobs** through the Provisioning module
4. **Emit audit events**: `SUBSCRIPTION_CREATED`, `SUBSCRIPTION_UPDATED`, `SUBSCRIPTION_CANCELLED`

### When a Domain is Connected or Changed:

1. **Update domains & DNS records**
2. **Trigger SSL provisioning jobs**
3. **Emit audit events**: `DOMAIN_UPDATED`, `SSL_ISSUE_REQUESTED`

---

## Module Responsibilities

### Subscriptions Module
- Subscription lifecycle (create, update, cancel, renew)
- Billing provider sync (Stripe, WHMCS)
- Plan assignment and upgrades/downgrades
- Grace periods and suspension logic

### CloudPods Module
- VM/Container lifecycle (provision, start, stop, destroy)
- Resource allocation (CPU, RAM, disk)
- IP management (IPAM integration)
- Quota enforcement per tenant

### Provisioning Module
- Job queue management
- Worker dispatch to Proxmox nodes
- Job status tracking and retries
- Provisioning state machine

### Domains Module
- Domain CRUD operations
- DNS record management
- Nameserver configuration
- Domain transfer handling

### SSL Module
- Certificate issuance (Let's Encrypt)
- Certificate renewal automation
- Certificate status monitoring
- ACME challenge handling

---

## Architecture Rules

1. **Never hard-code server IPs or secrets** – read from config/environment
2. **For any cross-module operation**, update all relevant entities:
   - Subscription + CloudPod + Jobs + AuditLog
3. **Keep read models** (dashboards, stats) **in sync** with write operations
4. **Use the queue** for long-running operations (provisioning, backups)
5. **Emit audit events** for all state changes

---

## File Structure Convention

```
src/
  routes/
    adminCustomers.js       # /api/admin/customers/*
    adminSubscriptions.js   # /api/admin/billing/subscriptions/*
    cloudPods.js            # /api/admin/hosting/cloudpods/*
    provisioningRoutes.js   # /api/admin/provisioning/*
    domainRoutes.js         # /api/admin/domains/*
    sslRoutes.js            # /api/admin/ssl/*
  services/
    BillingService.js       # Stripe/WHMCS integration
    cloudPodService.js      # CloudPod business logic
    cloudPodQueues.js       # CloudPod job queue
    cloudPodQuotas.js       # Quota enforcement
    provisioningService.js  # Provisioning orchestration
    domainService.js        # Domain operations
    sslService.js           # SSL/TLS certificate ops
  middleware/
    auth.js                 # Authentication
    rbac.js                 # Role-based access control
```

---

## TODO Handling

When you see TODOs or placeholder components in sidebar modules:
1. Fill them using the responsibilities defined above
2. Follow the cross-module flow patterns
3. Always emit appropriate audit events
4. Respect tenant isolation and RBAC

---

## Data Model References

- See `docs/CLOUDPODS_MASTER_SPEC.md` for CloudPods schema
- See `docs/migra-cloudpods-enterprise-spec.md` for infrastructure details
- Canonical tables: `cloud_pods`, `cloud_pod_queue`, `subscriptions`, `domains`, `ssl_certificates`
