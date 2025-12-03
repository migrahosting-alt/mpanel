# mPanel Enterprise - Quick Reference Guide

## 🎯 Enterprise Status
- ✅ **397 Indexes** (100% FK coverage)
- ✅ **CloudPods Ready** (idempotency_key added)
- ✅ **Multi-Tenant Optimized**
- ✅ **Guardian Security Ready**
- ✅ **Zero Downtime Deployment**

---

## 📊 Verification

### Quick Health Check
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
PGPASSWORD='Sikse222' psql -h 10.1.10.210 -U mpanel_user -d mpanel -f verify-enterprise-setup.sql
```

Expected Output:
- Total Indexes: **397** ✓
- FK Constraints: **143** ✓
- Missing FK Indexes: **0** ✓
- idempotency_key: **✓ Present**
- CloudPod tables: **24/24 indexed**

---

## 🔧 Common Commands

### Prisma
```bash
# Regenerate client
npx prisma generate

# Validate schema
npx prisma validate

# View database
npx prisma studio
```

### Database Connection
```bash
# From dev machine
PGPASSWORD='Sikse222' psql -h 10.1.10.210 -U mpanel_user -d mpanel

# From db-core as superuser
ssh root@10.1.10.210
sudo -u postgres psql -d mpanel
```

---

## 📈 Performance Monitoring

### Index Usage
```sql
SELECT 
    relname,
    idx_scan,
    seq_scan,
    ROUND(100.0 * idx_scan / NULLIF(idx_scan + seq_scan, 0), 1) as index_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public' AND n_live_tup > 100
ORDER BY seq_scan DESC
LIMIT 10;
```

### CloudPod Idempotency Check
```sql
SELECT 
    idempotency_key, 
    COUNT(*) as duplicate_attempts
FROM cloud_pod_jobs
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

### Table Sizes
```sql
SELECT 
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.'||tablename) DESC
LIMIT 10;
```

---

## 🔍 Key Indexes Created

### Multi-Tenant Performance
- `subscriptions_tenant_id_status_idx`
- `subscriptions_tenant_id_customer_id_idx`
- `websites_tenant_id_status_idx`
- `deployments_tenant_id_status_idx`
- `mailboxes_tenant_id_status_idx`
- `backups_tenant_id_status_idx`

### CloudPods
- `cloud_pod_jobs_idempotency_key_idx`
- All 24 CloudPod tables fully indexed

### Billing
- `invoices_tenant_id`
- `payments_customer_id`
- `payments_tenant_id`

---

## 📁 Key Files

- **Setup Doc**: `ENTERPRISE_MIGRATION_COMPLETE.md`
- **Verification**: `verify-enterprise-setup.sql`
- **Schema**: `prisma/schema.prisma`
- **Config**: `prisma.config.ts`

---

## 🚨 Emergency Commands

### Check Active Connections
```sql
SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'mpanel';
```

### Kill Long Query
```sql
-- Find PID
SELECT pid, query FROM pg_stat_activity 
WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%';

-- Kill it
SELECT pg_terminate_backend(12345);
```

### Vacuum & Analyze
```sql
VACUUM ANALYZE;
```

---

## 📞 Quick Reference

- **DB Server**: 10.1.10.210
- **Database**: mpanel
- **User**: mpanel_user / Sikse222
- **Superuser**: postgres
- **Size**: 14 MB
- **Tables**: 97
- **Indexes**: 397

---

**Status**: 🟢 PRODUCTION READY  
**Last Verified**: December 3, 2025
