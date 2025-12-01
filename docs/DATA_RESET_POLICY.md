# Data Reset Policy - Dev Database Management

## Overview

This document describes the canonical workflow for resetting and reseeding the **development database** to a clean, enterprise-ready state.

**⚠️ WARNING: These scripts are DEV-ONLY and will delete all business data!**

---

## The Problem

Over time, development databases accumulate:
- **Legacy data** from old schema versions
- **Mock/test data** that doesn't match current architecture
- **Broken relationships** (missing tenantIds, orphaned records)
- **Inconsistent state** causing permission/visibility issues

This causes:
- Wrong customers showing in UI
- Operations failing with "insufficient permissions"
- Data disappearing due to improper tenant filtering
- Confusion between real vs. mock data

---

## The Solution: Clean Reset + Seed Workflow

### 1. Reset Dev Database
**Script:** `scripts/reset-dev-database.ts`  
**Command:** `npm run reset:dev`

**What it does:**
- Deletes ALL business data (customers, subscriptions, orders, invoices, etc.)
- Deletes ALL legacy tenants (except root MigraHosting tenant)
- Deletes ALL users (except admin user)
- Keeps: Products, Prices, core config

**Safety features:**
- ✅ Requires `NODE_ENV !== 'production'`
- ✅ Requires explicit `RESET_DEV_DATABASE=YES` env var
- ✅ Checks DATABASE_URL for "production" or "prod"
- ✅ Deletes in correct dependency order (respects FK constraints)

**What it keeps:**
```
✅ Root tenant: 00000000-0000-0000-0000-000000000001 (MigraHosting)
✅ Admin user: mhadmin@migrahosting.com
✅ Products/Prices: From seed:products
✅ Recent audit logs: Last 24 hours
```

### 2. Seed Products & Prices
**Script:** `prisma/seedProductsFromConfig.ts`  
**Command:** `npm run seed:products`

**What it does:**
- Reads canonical plan definitions from `src/config/plansConfig.ts`
- Creates/updates Products and Prices in database
- Handles: CloudPods, WordPress, Email, VPS, Backups, Addons

**Source of truth:** `src/config/plansConfig.ts`

### 3. Seed Clean Dev Data
**Script:** `prisma/seedDevData.ts`  
**Command:** `npm run seed:dev`

**What it does:**
- Creates root tenant (MigraHosting)
- Creates admin user with super_admin role
- Links admin to tenant with OWNER role
- Creates one clean "MH Admin" customer
- Optionally creates test subscription + CloudPod

**Dev credentials:**
```
Email: mhadmin@migrahosting.com
Password: Test1234
Role: super_admin
```

---

## Complete Reset Workflow

### Option A: Run individually
```bash
# 1. Wipe legacy data
npm run reset:dev

# 2. Seed products/prices
npm run seed:products

# 3. Seed clean dev data
npm run seed:dev
```

### Option B: Run all at once
```bash
npm run seed:dev:full
```

---

## What Gets Created

After running the full workflow, your database will contain:

### Tenants (1)
- `00000000-0000-0000-0000-000000000001` - MigraHosting (root)

### Users (1)
- `mhadmin@migrahosting.com` - MH Admin (super_admin)

### TenantUsers (1)
- Link between MH Admin and MigraHosting tenant (OWNER role)

### Customers (1)
- MH Admin Customer (linked to admin user)

### Products (~6-8)
- CloudPods plans (starter, pro, enterprise)
- WordPress plans (starter, pro, enterprise)
- Email plans (business, enterprise)
- VPS plans
- Backup addons
- Other services

### Prices (~20-30)
- Monthly/yearly pricing for each product
- Populated from `plansConfig.ts`

### Subscriptions (optional)
- Set `SEED_TEST_SUBSCRIPTION=YES` to create:
  - 1 CloudPods Starter subscription
  - 1 CloudPod instance

---

## NPM Scripts Reference

| Script | Purpose |
|--------|---------|
| `npm run reset:dev` | Wipe all business data (keeps products/admin) |
| `npm run seed:products` | Seed products/prices from plansConfig.ts |
| `npm run seed:dev` | Seed clean dev data (tenant, admin, customer) |
| `npm run seed:dev:full` | Run all 3 in sequence |

---

## Deprecated Seed Files

The following files are **DEPRECATED** and should NOT be used:

❌ `prisma/seedPlans.ts` → Use `seedProductsFromConfig.ts`  
❌ `prisma/seedCloudPodPlans.ts` → Use `seedProductsFromConfig.ts`  
❌ Any old `test-*.js` scripts  
❌ Any scripts inserting "WebDev Co", "Lisa Thompson", etc.

These files have been renamed to `.deprecated` or removed.

---

## Environment Variables

### Required for reset:dev
```bash
RESET_DEV_DATABASE=YES   # Explicit confirmation
NODE_ENV=development     # Or not set (default)
DATABASE_URL=postgres://... # Must NOT contain "production" or "prod"
```

### Optional for seed:dev
```bash
SEED_TEST_SUBSCRIPTION=YES  # Create test subscription + CloudPod
```

---

## Safety Checks

The reset script includes multiple safety checks:

1. **Production Guard**
   - Exits if `NODE_ENV === 'production'`

2. **Explicit Confirmation**
   - Requires `RESET_DEV_DATABASE=YES` env var

3. **URL Check**
   - Exits if DATABASE_URL contains "production" or "prod"

4. **Dependency Order**
   - Deletes tables in correct order to respect FK constraints

5. **Selective Deletion**
   - Preserves root tenant and admin user
   - Keeps recent audit logs (last 24h)

---

## Post-Reset Verification

After running `npm run seed:dev:full`, verify:

### 1. Database State
```sql
-- Should return 1 tenant
SELECT COUNT(*) FROM tenants;

-- Should return 1 user
SELECT COUNT(*) FROM users WHERE email = 'mhadmin@migrahosting.com';

-- Should return 1 customer
SELECT COUNT(*) FROM customers;

-- Should return products
SELECT COUNT(*) FROM products;
```

### 2. UI Verification
```bash
# Start backend
npm run dev

# Visit: http://localhost:2271/login
# Login: mhadmin@migrahosting.com / Test1234

# Check:
# - Customers page shows only 1 customer (MH Admin)
# - No fake customers (Emily Rodriguez, Lisa Thompson, etc.)
# - Guardian AI works
# - Creating new customers/subscriptions works
```

### 3. TypeScript Build
```bash
npm run build  # Should complete without errors
```

---

## Troubleshooting

### Issue: "password authentication failed"
**Cause:** Wrong DATABASE_URL credentials  
**Fix:** Check `.env` file for correct credentials

### Issue: "Cannot run in production"
**Cause:** NODE_ENV is set to "production"  
**Fix:** Unset NODE_ENV or set to "development"

### Issue: "Missing confirmation flag"
**Cause:** RESET_DEV_DATABASE is not set to "YES"  
**Fix:** Run with `RESET_DEV_DATABASE=YES npm run reset:dev`

### Issue: Foreign key constraint errors
**Cause:** Database has data dependencies not handled by script  
**Fix:** Review error message and update script to delete in correct order

### Issue: Old fake customers still showing
**Cause:** Browser cache or old frontend build  
**Fix:** 
1. Clear browser cache completely
2. Rebuild frontend: `cd frontend && npm run build`
3. Hard refresh: Ctrl+Shift+R

---

## Production Considerations

**⚠️ NEVER run these scripts in production!**

For production data management:
- Use proper migrations (`npm run migrate`)
- Use Prisma migrations (`prisma migrate deploy`)
- Backup before any destructive operations
- Use feature flags for gradual rollouts
- Test in staging environment first

---

## Next Steps After Reset

1. **Start Backend**
   ```bash
   npm run dev
   ```

2. **Login**
   - URL: http://localhost:2271/login
   - Email: mhadmin@migrahosting.com
   - Password: Test1234

3. **Create Test Data**
   - Add customers via UI
   - Create subscriptions
   - Test Guardian AI
   - Test provisioning flows

4. **Update Password**
   ```sql
   -- In production, immediately change the default password!
   UPDATE users 
   SET password_hash = <bcrypt_hash> 
   WHERE email = 'mhadmin@migrahosting.com';
   ```

---

## Schema Updates

When updating the schema:

1. Update Prisma schema (`prisma/schema.prisma`)
2. Generate migration: `prisma migrate dev`
3. Update seed scripts if needed
4. Run reset workflow to test clean state
5. Update this documentation

---

## Questions?

See also:
- `ENTERPRISE_READINESS_REPORT.md` - Architecture overview
- `MPANEL_BACKEND_SPEC.md` - Backend specification
- `src/config/plansConfig.ts` - Plan definitions
- `scripts/reset-dev-database.ts` - Reset script source
- `prisma/seedDevData.ts` - Seed script source
