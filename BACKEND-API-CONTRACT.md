# BACKEND-API-CONTRACT.md
**mPanel Backend – API Contract (v1)**

This file defines the primary HTTP APIs exposed by the mPanel backend.

**Written for:**
- Backend developers
- mPanel UI developers
- GitHub Copilot (as system reference)

**Last Updated:** December 3, 2025  
**Version:** 1.0.0

---

## 0. Conventions

- **Base URL (public)**: `https://api.migrahosting.com/api`
- **Base URL (internal)**: `http://127.0.0.1:2271/api`
- **Auth**: JWT Bearer tokens in `Authorization: Bearer <token>`
- **Tenant scoping**: All tenant-scoped endpoints infer `tenantId` from JWT unless explicitly overridden.
- **Content-Type**: `application/json` unless stated otherwise.
- **ID fields**: `id` (UUID), `tenantId`, `customerId`, `subscriptionId` etc.
- **Timestamps**: ISO8601 strings, UTC (e.g., `2025-12-03T02:45:00.000Z`)

### Standard Error Format

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

---

## 1. Auth & Session

### 1.1 Login

**POST** `/auth/login`

Authenticate a user and issue JWT.

**Body**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response 200**
```json
{
  "token": "JWT_HERE",
  "refreshToken": "REFRESH_JWT",
  "user": {
    "id": "uuid",
    "name": "Admin User",
    "email": "user@example.com",
    "roles": ["admin"],
    "tenantId": "tenant-uuid"
  }
}
```

### 1.2 Refresh Token

**POST** `/auth/refresh`

```json
{
  "refreshToken": "REFRESH_JWT"
}
```

**Response 200**
```json
{ "token": "NEW_ACCESS_TOKEN" }
```

### 1.3 Me (Current User)

**GET** `/auth/me`

**Response 200**
```json
{
  "id": "uuid",
  "name": "Admin User",
  "email": "user@example.com",
  "roles": ["admin"],
  "tenantId": "tenant-uuid",
  "permissions": ["*"]
}
```

---

## 2. Health & Status

### 2.1 API Health

**GET** `/health`

Returns quick OK for load balancers.

**Response 200**
```json
{ "status": "ok", "service": "mpanel-api" }
```

### 2.2 System Status

**GET** `/status`

Higher-level status for UI.

**Response 200**
```json
{
  "service": "mpanel-api",
  "version": "1.0.0",
  "uptimeSeconds": 123456,
  "dependencies": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok",
    "proxmox": "ok"
  }
}
```

---

## 3. Tenants

Generally admin-only.

### 3.1 List Tenants

**GET** `/tenants`

**Query params:** `page`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "id": "tenant-uuid",
      "name": "MigraHosting",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### 3.2 Get Tenant

**GET** `/tenants/:id`

### 3.3 Create Tenant

**POST** `/tenants`

```json
{
  "name": "Example Tenant",
  "status": "active"
}
```

---

## 4. Users & Customers

### 4.1 Users (internal operators)

- **GET** `/users`
- **GET** `/users/:id`
- **POST** `/users`
- **PUT** `/users/:id`
- **DELETE** `/users/:id`

**User object:**
```json
{
  "id": "uuid",
  "tenantId": "tenant-uuid",
  "name": "Admin",
  "email": "admin@example.com",
  "roles": ["admin"],
  "status": "active"
}
```

### 4.2 Customers (paying clients)

#### 4.2.1 List Customers

**GET** `/customers`

**Query:** `search`, `page`, `pageSize`

**Response 200**
```json
{
  "items": [
    {
      "id": "cust-uuid",
      "tenantId": "tenant-uuid",
      "name": "John Doe",
      "email": "john@example.com",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

#### 4.2.2 Get Customer

**GET** `/customers/:id`

#### 4.2.3 Create Customer

**POST** `/customers`

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1-555-1234",
  "address": {
    "line1": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "postalCode": "33101",
    "country": "US"
  }
}
```

#### 4.2.4 Update Customer

**PUT** `/customers/:id`

---

## 5. Products

### 5.1 List Products

**GET** `/products`

**Query:** `type` (cloudpod|domain|email|backup|addon), `activeOnly`

**Response 200**
```json
{
  "items": [
    {
      "id": "prod-uuid",
      "tenantId": "tenant-uuid",
      "name": "CloudPod Mini",
      "type": "cloudpod",
      "sku": "CPOD-MINI",
      "billingCycles": [
        { "cycle": "monthly", "price": 9.99, "currency": "USD" },
        { "cycle": "yearly", "price": 99.0, "currency": "USD" }
      ],
      "metadata": {
        "cpu": 2,
        "ramMb": 2048,
        "diskGb": 40
      },
      "status": "active"
    }
  ],
  "total": 1
}
```

### 5.2 Get Product

**GET** `/products/:id`

### 5.3 Create Product

**POST** `/products`

```json
{
  "name": "CloudPod Pro",
  "type": "cloudpod",
  "sku": "CPOD-PRO",
  "billingCycles": [
    { "cycle": "monthly", "price": 19.99, "currency": "USD" }
  ],
  "metadata": {
    "cpu": 4,
    "ramMb": 4096,
    "diskGb": 80
  },
  "status": "active"
}
```

### 5.4 Update / Delete

- **PUT** `/products/:id`
- **DELETE** `/products/:id`

---

## 6. Orders & Checkout

### 6.1 Create Order (Start Checkout)

**POST** `/orders`

Creates a pending order and associated invoice.

```json
{
  "customerId": "cust-uuid",
  "items": [
    {
      "productId": "prod-uuid",
      "billingCycle": "monthly",
      "quantity": 1,
      "addons": [
        { "productId": "addon-uuid", "quantity": 1 }
      ]
    }
  ],
  "couponCode": "WELCOME10"
}
```

**Response 201**
```json
{
  "order": {
    "id": "order-uuid",
    "status": "pending",
    "total": 19.99,
    "currency": "USD"
  },
  "invoice": {
    "id": "inv-uuid",
    "status": "unpaid",
    "amount": 19.99
  }
}
```

### 6.2 Get Order

**GET** `/orders/:id`

---

## 7. Invoices

### 7.1 List Invoices

**GET** `/invoices`

**Query:** `customerId`, `status`, `page`, `pageSize`

### 7.2 Get Invoice

**GET** `/invoices/:id`

**Response 200**
```json
{
  "id": "inv-uuid",
  "tenantId": "tenant-uuid",
  "customerId": "cust-uuid",
  "status": "unpaid",
  "currency": "USD",
  "items": [
    {
      "description": "CloudPod Mini - monthly",
      "quantity": 1,
      "unitPrice": 9.99,
      "total": 9.99
    }
  ],
  "subtotal": 9.99,
  "tax": 0.00,
  "total": 9.99,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### 7.3 Update Invoice Status

**PATCH** `/invoices/:id/status`

```json
{ "status": "paid" }
```

**Status values:** `unpaid` | `paid` | `cancelled` | `refunded`

---

## 8. Payments (Stripe)

### 8.1 Create Payment Session

**POST** `/payments/session`

```json
{
  "invoiceId": "inv-uuid",
  "successUrl": "https://mpanel.migrahosting.com/billing/success",
  "cancelUrl": "https://mpanel.migrahosting.com/billing/cancel"
}
```

**Response 200**
```json
{
  "provider": "stripe",
  "sessionId": "cs_test_123",
  "checkoutUrl": "https://checkout.stripe.com/pay/cs_test_123"
}
```

### 8.2 Webhook Handler (Stripe)

**POST** `/payments/stripe/webhook`

Consumes raw body + signature header.

Updates invoice + subscription on successful events.

**Response:** Usually 200 with empty body.

---

## 9. Subscriptions

### 9.1 List Subscriptions

**GET** `/subscriptions`

**Query:** `customerId`, `status`, `productType`

**Response 200**
```json
{
  "items": [
    {
      "id": "sub-uuid",
      "tenantId": "tenant-uuid",
      "customerId": "cust-uuid",
      "productId": "prod-uuid",
      "status": "active",
      "billingCycle": "monthly",
      "startsAt": "2025-01-01T00:00:00Z",
      "renewsAt": "2025-02-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### 9.2 Get Subscription

**GET** `/subscriptions/:id`

### 9.3 Cancel Subscription

**POST** `/subscriptions/:id/cancel`

```json
{
  "cancelAtPeriodEnd": true
}
```

---

## 10. CloudPods

### 10.1 List CloudPods

**GET** `/cloudpods`

**Query:** `customerId`, `status`

**Response 200**
```json
{
  "items": [
    {
      "id": "cpod-uuid",
      "tenantId": "tenant-uuid",
      "customerId": "cust-uuid",
      "subscriptionId": "sub-uuid",
      "name": "john-site-1",
      "status": "active",
      "template": "CPOD-MINI",
      "hostname": "john1.migrapods.com",
      "ipv4": "10.1.10.50",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 10.2 Get CloudPod

**GET** `/cloudpods/:id`

### 10.3 Request CloudPod Provisioning

Usually triggered automatically from subscription, but API exists for admin/manual:

**POST** `/cloudpods`

```json
{
  "customerId": "cust-uuid",
  "subscriptionId": "sub-uuid",
  "productId": "prod-uuid",
  "name": "customer-site-1",
  "template": "CPOD-MINI"
}
```

**Response 201**
```json
{
  "cloudPod": { "id": "cpod-uuid", "status": "pending" },
  "job": { "id": "job-uuid", "type": "cloudpod_provision" }
}
```

### 10.4 Delete / Suspend CloudPod

- **POST** `/cloudpods/:id/suspend`
- **DELETE** `/cloudpods/:id`

---

## 11. Provisioning Jobs

### 11.1 List Jobs

**GET** `/jobs`

**Query:** `status`, `type`, `targetId`

**Response 200**
```json
{
  "items": [
    {
      "id": "job-uuid",
      "tenantId": "tenant-uuid",
      "type": "cloudpod_provision",
      "status": "running",
      "targetId": "cpod-uuid",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-01T00:01:00Z"
    }
  ]
}
```

### 11.2 Get Job

**GET** `/jobs/:id`

### 11.3 Retry Job

**POST** `/jobs/:id/retry`

---

## 12. Servers & Agents

### 12.1 List Servers

**GET** `/servers`

**Response 200**
```json
{
  "items": [
    {
      "id": "srv-uuid",
      "name": "mpanel-core",
      "role": "control",
      "ip": "10.1.10.206",
      "status": "online",
      "lastHeartbeatAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### 12.2 Get Server

**GET** `/servers/:id`

---

## 13. Domains

### 13.1 List Domains

**GET** `/domains`

**Query:** `customerId`, `status`

### 13.2 Get Domain

**GET** `/domains/:id`

### 13.3 Search Domain Availability

**GET** `/domains/search`

**Query:** `q` (domain name), `tld`

**Response 200**
```json
{
  "query": "example.com",
  "available": true,
  "price": {
    "register": 9.99,
    "renew": 10.99,
    "transfer": 8.99,
    "currency": "USD"
  }
}
```

### 13.4 Register Domain

**POST** `/domains/register`

```json
{
  "customerId": "cust-uuid",
  "domain": "example.com",
  "years": 1,
  "contact": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### 13.5 Renew Domain

**POST** `/domains/:id/renew`

```json
{ "years": 1 }
```

---

## 14. DNS

### 14.1 List Zones

**GET** `/dns/zones`

**Query:** `customerId`, `domainId`

**Response 200**
```json
{
  "items": [
    {
      "id": "zone-uuid",
      "domain": "example.com",
      "provider": "powerdns",
      "status": "active"
    }
  ]
}
```

### 14.2 Get Zone Records

**GET** `/dns/zones/:id/records`

### 14.3 Create / Update / Delete Record

**POST** `/dns/zones/:id/records`

```json
{
  "type": "A",
  "name": "www",
  "content": "10.1.10.50",
  "ttl": 300,
  "priority": null
}
```

- **PUT** `/dns/zones/:id/records/:recordId`
- **DELETE** `/dns/zones/:id/records/:recordId`

---

## 15. Email

### 15.1 List Email Domains

**GET** `/email/domains`

### 15.2 Attach Email to Domain

**POST** `/email/domains`

```json
{
  "domainId": "dom-uuid",
  "planProductId": "prod-email-uuid"
}
```

### 15.3 List Mailboxes

**GET** `/email/mailboxes`

**Query:** `domainId`, `customerId`

### 15.4 Create Mailbox

**POST** `/email/mailboxes`

```json
{
  "domainId": "dom-uuid",
  "localPart": "support",
  "password": "SecurePass123!",
  "quotaMb": 2048
}
```

### 15.5 Update / Delete Mailbox

- **PUT** `/email/mailboxes/:id`
- **DELETE** `/email/mailboxes/:id`

---

## 16. SSL

### 16.1 List Certificates

**GET** `/ssl/certificates`

### 16.2 Request Certificate

**POST** `/ssl/certificates`

```json
{
  "domain": "example.com",
  "type": "letsencrypt",
  "targetId": "cpod-uuid"
}
```

### 16.3 Renew Certificate

**POST** `/ssl/certificates/:id/renew`

---

## 17. Billing Products / Add-ons (Optional Detailed Layer)

Separate from core "product" if you want WHMCS-style config.

- **GET** `/billing/plans`
- **GET** `/billing/addons`

---

## 18. Guardian AI (Security)

Existing Guardian router endpoints:

- **GET** `/guardian/summary`
- **GET** `/guardian/instance`
- **POST** `/guardian/instance`
- **POST** `/guardian/scan`
- **GET** `/guardian/scans`
- **GET** `/guardian/findings`
- **GET** `/guardian/remediations`
- **POST** `/guardian/remediations/request`
- **POST** `/guardian/remediations/:id/approve-tenant`
- **POST** `/guardian/remediations/:id/approve-platform`
- **GET** `/guardian/audit-events`

Each endpoint is tenant-scoped and returns security posture, scans, findings and remediation tasks.

---

## 19. Audit Log

**GET** `/audit`

**Query:** `actorId`, `type`, `resourceType`, `resourceId`, `since`

**Response 200**
```json
{
  "items": [
    {
      "id": "audit-uuid",
      "tenantId": "tenant-uuid",
      "actorId": "user-uuid",
      "action": "subscription.created",
      "resourceType": "subscription",
      "resourceId": "sub-uuid",
      "metadata": {},
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ]
}
```

---

## 20. System Events & Metrics (Skeleton)

- **GET** `/system/health` – aggregated host metrics
- **GET** `/system/events` – queue & provisioning events

---

## 📝 Notes

1. **This contract is authoritative for mPanel v1.**
2. **When adding or changing endpoints, update this file** so Copilot & all developers always have a single source of truth.
3. **All endpoints require authentication** unless explicitly marked as public.
4. **Rate limiting:** Apply standard rate limits per tenant/IP.
5. **Versioning:** Future API versions should use `/api/v2/` prefix.

---

**Maintained By:** MigraHosting Engineering  
**For Questions:** Refer to `docs/mpanel-modules-spec.md`
