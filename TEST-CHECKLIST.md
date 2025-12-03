# mPanel – Money Engine Test Checklist

**Goal:**
Verify that all money-making + provisioning modules work end-to-end:
Customer → Product → Checkout → Payment → Subscription → Provisioning → Active Service.

**Last Updated:** December 3, 2025  
**Status:** Testing in Progress

---

## 0. GLOBAL SANITY CHECKS

- [ ] Backend is running (health/heartbeat endpoint OK)  
- [ ] Frontend builds and loads dashboard without JS errors in console  
- [ ] Auth works: login, logout, session refresh  
- [ ] Tenant context loads correctly (no "tenant_id undefined" errors)

---

## 1. PRODUCTS MODULE

### 1.1 API Checks
- [ ] GET /api/products returns 200 and non-empty list  
- [ ] GET /api/products/:id returns correct product  
- [ ] POST /api/products creates new product  
- [ ] PUT /api/products/:id updates product fields  
- [ ] DELETE /api/products/:id soft/hard deletes product as expected  
- [ ] Products are grouped by type (CloudPods, Domains, Email, Backups, etc.)

### 1.2 UI Checks
- [ ] Products page loads without error or infinite spinner  
- [ ] New product appears in list immediately after creation  
- [ ] Editing a product updates UI without page refresh  
- [ ] Pagination / filtering works (if present)

### 1.3 Data Integrity
- [ ] CloudPods products have correct template mapping (cpu, ram, disk, network profile)  
- [ ] Domain products have register/renew/transfer prices filled  
- [ ] Billing cycles (monthly/yearly/other) saved and visible

---

## 2. CHECKOUT / ORDER FLOW

### 2.1 Basic Happy Path
- [ ] Select product → click "Order" opens checkout  
- [ ] Checkout displays correct product name, price, billing cycle  
- [ ] Creating order generates:
    - [ ] Order row
    - [ ] Invoice row (Unpaid)
- [ ] Redirect to payment page works

### 2.2 Edge Cases
- [ ] Try checkout with missing/invalid product → proper error, no orphan invoices  
- [ ] Try checkout while not logged in → redirected to login and then back to checkout  
- [ ] Quantity / addons (if supported) adjust price correctly

---

## 3. INVOICES

### 3.1 API
- [ ] GET /api/invoices returns list scoped to tenant/customer  
- [ ] GET /api/invoices/:id returns correct invoice items  
- [ ] POST /api/invoices creates a valid invoice with items  
- [ ] PATCH /api/invoices/:id can update status (unpaid/paid/cancelled/refunded)

### 3.2 UI
- [ ] Invoices list loads for admin  
- [ ] Invoices list loads in customer portal (only their invoices)  
- [ ] Invoice detail page shows line items, totals, taxes, status

### 3.3 Status Transitions
- [ ] Unpaid → Paid when payment succeeds  
- [ ] Unpaid → Cancelled when cancelled manually  
- [ ] Paid → Refunded when refund processed  
- [ ] Overdue invoices are flagged correctly (if logic exists)

---

## 4. PAYMENTS (STRIPE)

### 4.1 Config
- [ ] Correct Stripe keys set in env (test mode first)  
- [ ] Webhook endpoint registered in Stripe dashboard

### 4.2 Flow
- [ ] Click "Pay" on invoice opens Stripe checkout or payment UI  
- [ ] Test card payment (4242… in test mode) completes  
- [ ] Webhook receives `checkout.session.completed` or `payment_intent.succeeded`

### 4.3 Side Effects
- [ ] Invoice status changes to Paid  
- [ ] Subscription created or activated  
- [ ] Any related jobs (provisioning) kicked off successfully

### 4.4 Failure Paths
- [ ] Declined payment shows clear error & invoice stays Unpaid  
- [ ] Duplicate webhooks don't create duplicate subscriptions/invoices

---

## 5. SUBSCRIPTIONS

### 5.1 API
- [ ] GET /api/subscriptions returns list scoped to tenant/customer  
- [ ] GET /api/subscriptions/:id returns correct product + customer link  
- [ ] Subscriptions created automatically after successful payment  
- [ ] Status field updates correctly: active / cancelled / expired / past_due

### 5.2 UI
- [ ] Customer portal shows active subscriptions  
- [ ] Admin portal shows all subscriptions with filters (by status, product, etc.)  
- [ ] Clicking a subscription shows:
    - [ ] Linked product  
    - [ ] Linked customer  
    - [ ] Linked invoices/payments  
    - [ ] Provisioning status (for CloudPods/domains/etc.)

### 5.3 Lifecycle
- [ ] Manual cancel works and prevents further renewals  
- [ ] Renewal job (if configured) can generate a new invoice correctly

---

## 6. CUSTOMERS

### 6.1 API
- [ ] GET /api/customers returns list  
- [ ] GET /api/customers/:id returns details  
- [ ] POST /api/customers creates customer from:
    - [ ] Manual admin form  
    - [ ] Self-signup/checkout
- [ ] PUT /api/customers/:id updates profile

### 6.2 UI
- [ ] Admin Customers list loads without "failed to load" errors  
- [ ] Search/filter by name/email works  
- [ ] Customer detail page shows:
    - [ ] Subscriptions  
    - [ ] Invoices  
    - [ ] Domains  
    - [ ] CloudPods

---

## 7. CLOUDPODS

### 7.1 Templates
- [ ] CloudPod templates load in UI (Mini / Pro / Business / Enterprise)  
- [ ] Templates show accurate CPU/RAM/Disk

### 7.2 Provision Flow (Happy Path)
- [ ] From paid subscription, "Provision CloudPod" job is created  
- [ ] Job enqueued in queue/Redis (or equivalent)  
- [ ] Worker on mpanel-core picks up job  
- [ ] Proxmox API call is made with correct template and settings  
- [ ] VM/LXC gets created on target node  
- [ ] Pod status changes:
    - [ ] pending → provisioning → active  
- [ ] UI shows pod reachable address (hostname or IP)

### 7.3 Failure / Retry
- [ ] If Proxmox fails, job status → error and UI shows readable message  
- [ ] Retrying a failed job works and does not create duplicate VMs  
- [ ] Cancelling a pod deprovisions resources or at least marks as inactive

---

## 8. PROVISIONING ENGINE (JOBS + AGENTS)

### 8.1 Jobs
- [ ] Job queue service is running (Redis/BullMQ/queue system)  
- [ ] Creating a new CloudPod/domain/email generates a job in DB/queue  
- [ ] Jobs have clear status: queued, running, failed, completed

### 8.2 Agents
- [ ] Agent on mpanel-core can:
    - [ ] Connect to Proxmox  
    - [ ] Run provisioning scripts  
    - [ ] Report success/failure back to API

### 8.3 Observability
- [ ] Logs written for each job (success/failure)  
- [ ] Admin page shows recent provisioning jobs & statuses

---

## 9. DOMAINS

### 9.1 Namesilo / Registrar Sync
- [ ] Test domain search returns accurate availability  
- [ ] Register domain triggers Namesilo API (or other registrar)  
- [ ] Registered domain appears in:
    - [ ] Registrar panel  
    - [ ] mPanel Domains list

### 9.2 UI
- [ ] Domains list shows domains for each customer  
- [ ] Domain detail page shows:
    - [ ] Expiry date  
    - [ ] Registrar  
    - [ ] Nameservers  
    - [ ] Linked DNS zone

### 9.3 Renew / Transfer
- [ ] Renew operation creates invoice & payment flow  
- [ ] On successful payment, registrar renew call succeeds  
- [ ] Transfer-in/updating EPP code handled properly (if implemented)

---

## 10. DNS

### 10.1 Zones
- [ ] Creating a CloudPod/domain auto-creates DNS zone in PowerDNS  
- [ ] Zone appears on DNS module list  
- [ ] NS records are correct

### 10.2 Records
- [ ] UI loads existing records (A, CNAME, MX, TXT, etc.)  
- [ ] Add record → reflected in PowerDNS backend  
- [ ] Edit/delete record works  
- [ ] Record changes propagate (dig +nslookup resolve new values)

---

## 11. EMAIL

### 11.1 Domains
- [ ] Assigning mail service to a domain creates:
    - [ ] MX record pointing to mail server  
    - [ ] Basic SPF record  
- [ ] Domain appears in mail-core config (or database)

### 11.2 Mailboxes
- [ ] Create mailbox user@domain works  
- [ ] Deleting mailbox removes from mail-core backend  
- [ ] Changing password works

### 11.3 Basic Functional Test
- [ ] Can log in to mailbox via IMAP/webmail  
- [ ] Can send email to external address (e.g., Gmail test)  
- [ ] Can receive email from external address

---

## 12. SSL

### 12.1 AutoSSL
- [ ] Creating CloudPod/domain triggers SSL request (LE)  
- [ ] Certificate issued successfully  
- [ ] HTTP → HTTPS redirect working

### 12.2 Renewal
- [ ] Renew job exists and runs without errors (cron/systemd timer)  
- [ ] Expiry dates make sense (≈ 90 days from issue)

---

## 13. FULL E2E MONEY TEST

- [ ] 1. New customer signs up  
- [ ] 2. Orders CloudPod product  
- [ ] 3. Checkout creates order + invoice  
- [ ] 4. Payment via Stripe test card succeeds  
- [ ] 5. Invoice marked Paid  
- [ ] 6. Subscription status Active  
- [ ] 7. Provision job enqueued  
- [ ] 8. CloudPod created on Proxmox  
- [ ] 9. DNS + SSL configured  
- [ ] 10. Customer can log into mPanel and see:
     - [ ] Active CloudPod  
     - [ ] Their invoice history  
     - [ ] Their subscription

---

## 14. PHASE 3 DEEP INTEGRATION TESTS

### 14.1 CloudPods Provisioning Engine
- [ ] POST /api/cloudpods creates CloudPod row + pending job
- [ ] BullMQ job picked up by cloudpods worker
- [ ] Proxmox API called, CT/VM created, IP assigned
- [ ] CloudPod status updated to 'running'
- [ ] cloud_pod_jobs.status = 'completed'
- [ ] cloud_pod_allocations updated with resource usage

### 14.2 Guardian Deep Scanning
- [ ] POST /api/guardian/scan enqueues scan job
- [ ] guardian-scan worker picks up pending scan
- [ ] Collectors run (mail/web/dns logs)
- [ ] Analyzers emit findings
- [ ] guardian_findings table populated
- [ ] Remediation task created if high severity
- [ ] guardian_scans.status = 'completed'

### 14.3 Monitoring Telemetry
- [ ] Telemetry worker polls node health endpoints
- [ ] monitoring_service_status rows inserted
- [ ] GET /api/monitoring/overview returns live data
- [ ] Slow queries detected and inserted to monitoring_slow_queries
- [ ] GET /api/monitoring/slow-queries returns data

---

## ✅ SUCCESS CRITERIA

**If ALL boxes above are ✅ → mPanel is READY TO MAKE MONEY.**

---

## 🚨 BLOCKERS LOG

| Date | Module | Issue | Resolution | Status |
|------|--------|-------|------------|--------|
| 2025-12-03 | TypeScript | Compilation errors preventing dist/ build | Need to fix TS errors | 🔴 Blocking |
| 2025-12-03 | CloudPods | API endpoint returns 404 | TypeScript routes not compiled | 🔴 Blocking |
| 2025-12-03 | All Modules | Mock data in UI | Removed from 3 modules so far | 🟡 In Progress |

---

## 📋 TESTING NOTES

**Environment:**
- Backend: Node 22.21.0 on mpanel-core (100.97.213.11)
- Database: PostgreSQL on db-core (100.98.54.45)
- Frontend: Vite build deployed to /var/www/migrapanel.com/public/

**Test Credentials:**
- Admin: (see LOGIN_CREDENTIALS.md)
- Stripe: Test mode keys required

**Next Steps:**
1. Fix TypeScript compilation errors
2. Compile modules to dist/
3. Restart backend with TypeScript support
4. Begin systematic testing from section 0
