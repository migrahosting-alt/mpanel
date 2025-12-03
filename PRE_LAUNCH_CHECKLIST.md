# Pre-Launch Enterprise Checklist
**Date:** December 3, 2025  
**System:** mPanel Control Plane v1.0  
**Status:** 🟡 IN PROGRESS

---

## 📋 Phase 1: Database & Schema (CRITICAL)

### Prisma Schema Finalization

- [ ] **Copy schema additions** from `prisma/schema-additions.prisma` to main `prisma/schema.prisma`
- [ ] **Add all 18 new models**:
  - [ ] Product, PriceOverride
  - [ ] Subscription, UsageRecord
  - [ ] Invoice, InvoiceLine, Payment, CreditNote
  - [ ] UserSecurityProfile, Session, ApiToken, SecurityEvent, TenantSecurityPolicy
  - [ ] CloudPod
  - [ ] ProvisioningJob, CoreNode
  - [ ] ShieldEvent, ShieldPolicy, GuardianFinding
  - [ ] Backup
  - [ ] IdempotencyKey

### Constraints & Safety

- [ ] **Uniqueness constraints enforced**:
  - [ ] `@@unique([tenantId, code])` on Product
  - [ ] `@@unique([tenantId, slug])` on CloudPod
  - [ ] `@@unique([tenantId, invoiceNumber])` on Invoice
  - [ ] `@unique` on Session.sessionToken
  - [ ] `@unique` on ApiToken.tokenHash
  - [ ] `@unique` on IdempotencyKey.key

- [ ] **Foreign keys defined** for all relationships
- [ ] **Soft deletes** added (`deletedAt` field) on:
  - [ ] Product
  - [ ] Subscription
  - [ ] CloudPod

### Performance Indexes

- [ ] **Hot path indexes created**:
  - [ ] `@@index([tenantId, status])` on most tenant-scoped tables
  - [ ] `@@index([queueName, status, priority])` on ProvisioningJob
  - [ ] `@@index([status, scheduledFor])` on ProvisioningJob
  - [ ] `@@index([customerId, status])` on Subscription
  - [ ] `@@index([status, dueDate])` on Invoice (overdue detection)
  - [ ] `@@index([expiresAt])` on Session, IdempotencyKey (cleanup)

### Migration Execution

- [ ] **Staging migrations**:
  - [ ] Run: `npx prisma migrate dev --name add_final_modules`
  - [ ] Verify all tables created
  - [ ] Check foreign keys working
  - [ ] Test soft delete queries (WHERE deletedAt IS NULL)

- [ ] **Production migrations**:
  - [ ] Backup database: `pg_dump mpanel_prod > mpanel_backup_$(date +%Y%m%d_%H%M%S).sql`
  - [ ] Run: `npx prisma migrate deploy`
  - [ ] Verify: `npx prisma db pull` matches schema
  - [ ] Rollback plan documented

---

## 📋 Phase 2: Reliability & Error Handling

### Job Queue & Dead Letter

- [ ] **Job retry logic** implemented:
  - [ ] `maxAttempts` = 3 for all job types
  - [ ] Exponential backoff: 1min → 5min → 15min
  - [ ] `status = DEAD_LETTER` after max attempts
  - [ ] `failureReason` captured for diagnostics

- [ ] **Dead-letter monitoring**:
  - [ ] Ops Overview shows dead-lettered jobs count
  - [ ] Admin alert if >10 dead-lettered jobs in 24h
  - [ ] Manual retry endpoint: `POST /ops/jobs/:id/retry`

### Idempotency Infrastructure

- [ ] **Idempotency middleware** deployed:
  - [ ] Applied to Stripe webhook: `POST /billing/webhooks/stripe`
  - [ ] Applied to CloudPod creation: `POST /cloudpods`
  - [ ] Applied to subscription activation: `POST /billing/subscriptions/:id/activate`
  - [ ] Applied to payment recording: `POST /billing/invoices/:id/pay`

- [ ] **Cleanup job** scheduled:
  - [ ] Cron: daily at 3am
  - [ ] Deletes IdempotencyKey where `expiresAt < NOW()`

### Partial Failure Handling

- [ ] **CloudPod provisioning rollback** defined:
  - [ ] If Proxmox fails → clean up DNS + DB records
  - [ ] If DNS fails → deallocate Proxmox VM + DB records
  - [ ] Status set to `FAILED` with clear error message

- [ ] **Subscription activation failure**:
  - [ ] Job fails → subscription stays `PENDING`
  - [ ] Customer notified via email
  - [ ] Admin sees in Ops Overview

---

## 📋 Phase 3: Security & Secrets

### Secrets Management

- [ ] **All secrets in environment variables**:
  - [ ] `DATABASE_URL`
  - [ ] `JWT_SECRET`
  - [ ] `JWT_REFRESH_SECRET`
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `SMTP_PASSWORD`
  - [ ] `REDIS_URL`
  - [ ] `TAILSCALE_AUTH_KEY`

- [ ] **No secrets in logs** verified:
  - [ ] Grep check: `grep -r "JWT_SECRET\|STRIPE_SECRET" src/` returns 0
  - [ ] Logger sanitizes password fields
  - [ ] Error messages don't leak tokens

### Rate Limiting

- [ ] **Rate limiting middleware** applied:
  - [ ] Auth routes: 5 attempts / 15min per IP
  - [ ] Password reset: 3 attempts / 1hr per IP
  - [ ] API routes: 100 req/min per IP+tenant
  - [ ] Admin routes: 60 req/min per user
  - [ ] Webhooks: 500 req/min per IP

- [ ] **Rate limit headers** returned:
  - [ ] `X-RateLimit-Limit`
  - [ ] `X-RateLimit-Remaining`
  - [ ] `X-RateLimit-Reset`

### Security Event Logging

- [ ] **All critical events logged**:
  - [ ] Login failures (3+ failures = HIGH severity)
  - [ ] Permission denials (ADMIN routes)
  - [ ] MFA enabled/disabled
  - [ ] API token created/revoked
  - [ ] Session revoked
  - [ ] Role changes (OWNER actions)

- [ ] **Security events visible** in:
  - [ ] Admin dashboard: `/security/events`
  - [ ] Per-user: `/security/me/profile`

---

## 📋 Phase 4: Testing & Validation

### TypeScript Compilation

- [ ] **Clean build** achieved:
  - [ ] Run: `npm run build:backend`
  - [ ] Zero errors (only forward-compatible warnings OK)
  - [ ] Output: `dist/` directory created

### Golden Path E2E Tests

- [ ] **Test 1: Customer → Tenant → CloudPod**:
  - [ ] Create customer via API
  - [ ] Create tenant for customer
  - [ ] Create CloudPod subscription
  - [ ] Verify CloudPod provisioned
  - [ ] Verify invoice generated

- [ ] **Test 2: Plan change**:
  - [ ] Change CloudPod from STARTER → PRO
  - [ ] Verify limits updated (vCPU, RAM, disk)
  - [ ] Verify prorated invoice created
  - [ ] Verify job completed

- [ ] **Test 3: Failed job recovery**:
  - [ ] Simulate Proxmox failure
  - [ ] Verify job marked FAILED
  - [ ] Verify appears in Ops Overview
  - [ ] Retry job manually
  - [ ] Verify success on retry

### Smoke Tests

- [ ] **Smoke test script** created: `scripts/smoke-test.ts`
- [ ] **Smoke tests pass** in all environments:
  - [ ] Local: `npm run smoke-test -- --env=local`
  - [ ] Staging: `npm run smoke-test -- --env=staging`
  - [ ] Production: `npm run smoke-test -- --env=production`

### Data Integrity Checks

- [ ] **Query performance** verified:
  - [ ] Customers list loads <500ms
  - [ ] CloudPods list loads <500ms
  - [ ] Ops Overview loads <1s
  - [ ] Invoice generation <2s

- [ ] **Soft delete** queries working:
  - [ ] `WHERE deletedAt IS NULL` in all list queries
  - [ ] Deleted records not shown in UI
  - [ ] Admin can view deleted records if needed

---

## 📋 Phase 5: Deployment Strategy

### Pre-Deployment Backup

- [ ] **Database backup** created:
  ```bash
  pg_dump mpanel_prod > /backups/mpanel_prod_pre_v1_$(date +%Y%m%d_%H%M%S).sql
  gzip /backups/mpanel_prod_pre_v1_*.sql
  ```

- [ ] **Code backup** created:
  ```bash
  cd /opt/mpanel
  tar -czf /backups/mpanel_code_pre_v1_$(date +%Y%m%d_%H%M%S).tgz .
  ```

- [ ] **Verify backups** readable:
  ```bash
  gunzip -t /backups/mpanel_prod_pre_v1_*.sql.gz
  tar -tzf /backups/mpanel_code_pre_v1_*.tgz | head
  ```

### Canary Deployment

- [ ] **Test tenant created**:
  - [ ] Email: `test@migrahosting.internal`
  - [ ] Tagged: `canary-v1.0`

- [ ] **Canary validation**:
  - [ ] Create 3 CloudPods (MINI, PRO, BUSINESS)
  - [ ] Create 2 subscriptions
  - [ ] Generate 1 invoice
  - [ ] Test payment recording
  - [ ] Monitor logs for errors
  - [ ] Check Ops Overview for anomalies

- [ ] **Canary soak time**: 2 hours minimum

### Production Deployment

- [ ] **Queues paused**:
  ```bash
  # Pause all provisioning queues
  curl -X POST https://mpanel.migrahosting.com/api/v1/ops/queues/pause-all \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  ```

- [ ] **Deploy backend**:
  ```bash
  cd /opt/mpanel
  git pull origin master
  npm install --production
  npm run build
  pm2 restart mpanel-backend
  pm2 status
  ```

- [ ] **Run migrations**:
  ```bash
  npx prisma migrate deploy
  npx prisma generate
  ```

- [ ] **Resume queues**:
  ```bash
  curl -X POST https://mpanel.migrahosting.com/api/v1/ops/queues/resume-all \
    -H "Authorization: Bearer $ADMIN_TOKEN"
  ```

- [ ] **Smoke tests pass**:
  ```bash
  npm run smoke-test -- --env=production
  ```

### Rollback Plan (If Needed)

- [ ] **Emergency rollback procedure** documented:
  1. **Stop queues**: Prevent new jobs
  2. **Restore code**: `tar -xzf /backups/mpanel_code_pre_v1_*.tgz`
  3. **Restore database** (if schema broken):
     ```bash
     gunzip -c /backups/mpanel_prod_pre_v1_*.sql.gz | psql mpanel_prod
     ```
  4. **Restart services**: `pm2 restart all`
  5. **Verify health**: `curl https://mpanel.migrahosting.com/api/v1/__debug`

- [ ] **Rollback tested** in staging: ✅ / ❌

---

## 📋 Phase 6: Post-Deployment Monitoring

### Health Checks (First 24h)

- [ ] **Hour 1**: Check every 15 minutes
  - [ ] `/api/v1/__debug` returns 200
  - [ ] Ops Overview loads
  - [ ] No dead-lettered jobs
  - [ ] No spike in error logs

- [ ] **Hour 2-6**: Check hourly
  - [ ] Customer creation working
  - [ ] CloudPod provisioning working
  - [ ] Billing subscriptions working
  - [ ] Invoice generation working

- [ ] **Hour 6-24**: Check every 4 hours
  - [ ] Queue processing normal
  - [ ] Database queries performant
  - [ ] No memory leaks (PM2 memory usage)

### Metrics to Watch

- [ ] **API response times**:
  - [ ] p50 < 200ms
  - [ ] p95 < 1s
  - [ ] p99 < 3s

- [ ] **Job queue health**:
  - [ ] 95%+ jobs complete within 5min
  - [ ] <1% dead-lettered jobs
  - [ ] No stuck jobs >15min

- [ ] **Database connections**:
  - [ ] <50 connections used
  - [ ] No connection pool exhaustion
  - [ ] Query times <100ms average

### Customer Communication

- [ ] **Release notes** published:
  - [ ] New CloudPods module
  - [ ] New Billing system
  - [ ] Enhanced Security Center
  - [ ] Improved Ops Dashboard

- [ ] **Known issues** documented (if any)
- [ ] **Support team** briefed on new features

---

## ✅ Launch Approval

### Checklist Summary

Total items: **85**

- [ ] Phase 1: Database & Schema (18 items)
- [ ] Phase 2: Reliability & Error Handling (14 items)
- [ ] Phase 3: Security & Secrets (13 items)
- [ ] Phase 4: Testing & Validation (15 items)
- [ ] Phase 5: Deployment Strategy (15 items)
- [ ] Phase 6: Post-Deployment Monitoring (10 items)

### Sign-Off

- [ ] **Technical Lead** approved: _________________ Date: _______
- [ ] **Database migrations** verified: _________________ Date: _______
- [ ] **Security audit** passed: _________________ Date: _______
- [ ] **Smoke tests** passing: _________________ Date: _______
- [ ] **Rollback plan** tested: _________________ Date: _______

---

## 🚀 Status: READY FOR LAUNCH

Once all checkboxes above are ✅, you have an **enterprise-grade control plane** ready for production.

**NOT JUST "IT WORKS"** — but:
- Resilient to failures
- Protected from abuse
- Auditable for compliance
- Performant at scale
- Recoverable from disasters

🎉 **This is v1.0 — production-ready, enterprise-grade mPanel.**
