# 🚀 COPILOT FIX ROADMAP (PHASE 1–2: MONEY ENGINE + PROVISIONING)

**File name:** `COPILOT-FIX-ROADMAP.md`  
**Purpose:** Fix the modules required to start generating revenue ASAP.

---

## 📌 PHASE 1 — Revenue Engine (Fix First)

These modules directly affect checkout, billing, and customer onboarding.  
**If ANY of these fail → the business cannot make money.**

### 1. PRODUCTS MODULE (HIGHEST PRIORITY) ⚠️

**Copilot Task:** Ensure product creation, loading, and syncing works.

#### Fix Requirements

- [ ] Load product list via `GET /api/products`
- [ ] Load product groups
- [ ] Load pricing tables
- [ ] Load addons
- [ ] Ability to create, update, delete products
- [ ] Ability to set:
  - [ ] billing cycles
  - [ ] provisioning type (cloudpod, dns, domain, website, email)
  - [ ] automation flags
- [ ] Product detail page must load without errors

#### Critical

- [ ] Products must link to checkout
- [ ] Products must link to subscriptions
- [ ] CloudPods products must map to templates (RAM/CPU/NVMe)

---

### 2. CHECKOUT / ORDERS MODULE

**Copilot Task:** Fix full checkout flow to create invoice → payment → subscription → provisioning.

#### Fix Requirements

- [ ] Accept product ID + billing cycle
- [ ] Create pending order
- [ ] Create invoice
- [ ] Redirect to payment
- [ ] On payment:
  - [ ] mark invoice as paid
  - [ ] mark subscription as active
  - [ ] trigger provisioning job

#### Possible Errors Copilot Must Look For

- [ ] Broken API routes
- [ ] Wrong payload shape
- [ ] Missing `await`
- [ ] Missing invoice ID return
- [ ] Zero linking between order → subscription → provisioning

---

### 3. INVOICES MODULE

**Copilot Task:** Ensure invoices fully generate and change statuses.

#### Fix Requirements

- [ ] Invoice list loads
- [ ] Invoice detail loads
- [ ] Invoice items load
- [ ] Create invoice route works
- [ ] Update invoice status route works
- [ ] Automatic status changes:
  - [ ] Unpaid → Paid
  - [ ] Unpaid → Cancelled
  - [ ] Paid → Refunded

---

### 4. PAYMENTS MODULE (STRIPE)

**Copilot Task:** Make Stripe payments functional.

#### Fix Requirements

- [ ] Stripe checkout session creation
- [ ] Webhook handling:
  - [ ] `checkout.completed` → Activate subscription
  - [ ] `payment.failed` → Mark unpaid
- [ ] Store Stripe customer ID
- [ ] Store payment method

#### Copilot must watch for:

- [ ] Invalid secret keys
- [ ] Wrong endpoint URLs
- [ ] Missing webhook routes in Express/PHP

---

### 5. SUBSCRIPTIONS MODULE

**Copilot Task:** Build the link between purchases and provisioning.

#### Fix Requirements

- [ ] Subscription creation
- [ ] Subscription scheduled renewal
- [ ] Status changes:
  - [ ] active
  - [ ] past_due
  - [ ] expired
  - [ ] cancelled
- [ ] Attach subscription to:
  - [ ] `customer_id`
  - [ ] `product_id`

#### Critical:
**Subscriptions must be visible and load instantly for the customer.**

---

### 6. CUSTOMERS MODULE

**Copilot Task:** Ensure customer accounts fully work.

#### Fix Requirements

- [ ] Create customer
- [ ] Load customer list
- [ ] Edit customer
- [ ] Link to:
  - [ ] subscriptions
  - [ ] domains
  - [ ] cloudpods
  - [ ] invoices

#### Copilot Must Fix:

- [ ] "Failed to load users"
- [ ] "Failed to load customers"
- [ ] 404 on `GET /api/customers`

---

## 📌 PHASE 2 — Provisioning Engine (Actual Service Delivery)

Once the money engine works, we fix the service output.

### 7. CLOUDPODS MODULE

**Copilot Task:** Get CloudPods creation working end-to-end.

#### Fix Requirements

- [ ] Load pod templates (Mini, Pro, Business, Enterprise)
- [ ] Create Pod request
- [ ] Push job to queue
- [ ] Provisioning job executes on Proxmox
- [ ] Update status in UI:
  - [ ] Pending
  - [ ] Deploying
  - [ ] Active
  - [ ] Error

#### Critical:
**DNS + SSL must be attached automatically.**

---

### 8. PROVISIONING ENGINE

**Copilot Task:** Validate server agents and job execution.

#### Fix Requirements

- [ ] API call from mPanel → mpanel-core → Proxmox API
- [ ] VM/LXC creation
- [ ] Set hostname
- [ ] Set IP
- [ ] Install agent
- [ ] Report back to mpanel-core
- [ ] Handle errors gracefully

#### Critical:
**If provisioning fails → subscription must NOT activate.**

---

### 9. DOMAINS MODULE

**Copilot Task:** Make domain selling work.

#### Fix Tasks

- [ ] Domain search
- [ ] Register
- [ ] Renew
- [ ] Transfer
- [ ] Namesilo API
- [ ] Sync domain list
- [ ] Auto-create DNS zone
- [ ] Auto-create NS, A, MX records

---

### 10. DNS MODULE

**Copilot Task:** Make DNS editing work for customers.

#### Fix Tasks

- [ ] Load DNS records
- [ ] Create/edit/delete records
- [ ] Auto-provision:
  - [ ] A for pod
  - [ ] MX for mail
  - [ ] SPF/DKIM/DMARC
  - [ ] CNAME for panel

---

### 11. EMAIL MODULE

**Copilot Task:** Enable mailbox management.

#### Fix Tasks

- [ ] Create mailbox
- [ ] Edit mailbox
- [ ] Delete mailbox
- [ ] Assign storage quota
- [ ] Attach email domain to customer
- [ ] Run provisioning script on mail-core

---

### 12. SSL MODULE

**Copilot Task:** Auto-SSL for CloudPods + domains.

#### Fix Tasks

- [ ] Trigger Let's Encrypt request
- [ ] Install certificate
- [ ] Renew automatically

---

## 📌 PHASE 3 — Quality Modules (Do After Launch)

- Backups
- File Manager
- Databases
- Websites installer
- Server Metrics

**These don't block revenue.**

---

## 📌 PHASE 4 — Enterprise Add-ons (Later)

- Guardian AI
- SOC
- Monitoring
- BI Analytics
- Kubernetes
- CDN
- Websocket
- GraphQL
- API Marketplace
- White-Label

---

## 🎯 Execution Instructions

**To Copilot:**

```
"Copilot, start with Phase 1 → Products Module. Fix everything referenced in this section."
```

Copilot will follow instructions step-by-step like an engineer following JIRA tickets.

---

## 📊 Progress Tracking

| Phase | Module | Status | Blocker | ETA |
|-------|--------|--------|---------|-----|
| 1 | Products | 🔴 Not Started | - | - |
| 1 | Checkout | 🔴 Not Started | - | - |
| 1 | Invoices | 🔴 Not Started | - | - |
| 1 | Payments | 🔴 Not Started | - | - |
| 1 | Subscriptions | 🔴 Not Started | - | - |
| 1 | Customers | 🔴 Not Started | - | - |
| 2 | CloudPods | 🔴 Not Started | - | - |
| 2 | Provisioning | 🔴 Not Started | - | - |
| 2 | Domains | 🔴 Not Started | - | - |
| 2 | DNS | 🔴 Not Started | - | - |
| 2 | Email | 🔴 Not Started | - | - |
| 2 | SSL | 🔴 Not Started | - | - |

---

## 🚨 Critical Rules

1. **NO MOCK DATA** - All data must come from real database
2. **NO PLACEHOLDERS** - If API doesn't exist, create it
3. **NO FAKE RESPONSES** - Show real errors if backend fails
4. **FOLLOW SPECS** - Use `docs/mpanel-modules-spec.md` as truth
5. **TEST EACH FIX** - Verify in browser before marking complete

---

**Last Updated:** December 3, 2025  
**Current Phase:** Phase 1 - Products Module
