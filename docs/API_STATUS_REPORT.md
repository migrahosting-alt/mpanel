# mPanel Backend API Status Report

**Generated:** November 28, 2025  
**Environment:** mpanel-core (10.1.10.206:2271)  
**Status:** ✅ OPERATIONAL - TypeScript Backend Live

---

## System Health

✅ **Server:** Node v22.21.0  
✅ **Database:** PostgreSQL 14 (41 tables)  
✅ **Redis:** 127.0.0.1:6380  
✅ **API Health:** `/api/health` responding  
✅ **Authentication:** JWT working  

---

## API Endpoint Status

### ✅ WORKING ENDPOINTS

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/api/auth/login` | POST | ✅ Working | Returns access + refresh tokens |
| `/api/auth/me` | GET | ✅ Working | Returns current user |
| `/api/customers` | GET | ✅ Working | Ready for auto-provision |
| `/api/subscriptions` | GET | ✅ Working | Ready for auto-provision |
| `/api/websites` | GET | ✅ Working | **Critical** for provisioning |
| `/api/provisioning/tasks` | GET | ✅ Working | **Critical** for task monitoring |
| `/api/servers` | GET | ✅ Working | Server management ready |
| `/api/invoices` | GET | ✅ Working | Billing ready |
| `/api/dashboard/summary` | GET | ✅ Working | Dashboard metrics |
| `/api/admin/users` | GET | ✅ Working | User management |

### ⚠️ NEEDS FIXING

| Endpoint | Method | Status | Issue |
|----------|--------|--------|-------|
| `/api/products` | GET | ❌ Error 500 | Backend error - check logs |

### ❓ UNTESTED

| Endpoint | Priority | Required For |
|----------|----------|--------------|
| `POST /api/provisioning/webhooks/order-created` | **CRITICAL** | Auto-provisioning from MigraHosting.com |
| `POST /api/customers` | HIGH | Customer creation |
| `POST /api/subscriptions` | HIGH | Subscription creation |
| `POST /api/websites` | **CRITICAL** | Website provisioning |
| `GET /api/customers/:id` | HIGH | Customer details |
| `GET /api/customers/:id/subscriptions` | HIGH | Customer subscriptions |
| `GET /api/customers/:id/websites` | HIGH | Customer websites |

---

## Frontend Module Status

### ✅ WORKING
- ✅ Login page
- ✅ Dashboard (loads but may show empty data)

### ❌ BLANK PAGES (Need Frontend Work)
- ❌ `/admin/users` - API exists but frontend not wired
- ❌ `/admin/customers` - API exists but frontend not wired  
- ❌ `/products` - Backend error needs fix
- ❌ `/subscriptions` - API exists but frontend not wired
- ❌ `/websites` - API exists but frontend not wired
- ❌ `/provisioning` - API exists but frontend not wired

### 🔧 STUBS (Intentional)
- 🔧 DNS management (PowerDNS - Phase 2)
- 🔧 Email management (mail-core - Phase 2)
- 🔧 File Manager (Phase 2)
- 🔧 Databases (Phase 2)

---

## Critical Auto-Provisioning Flow

### Current Status: ⚠️ 80% Ready

**What Works:**
1. ✅ Customer API endpoint exists
2. ✅ Subscription API endpoint exists
3. ✅ Website API endpoint exists
4. ✅ Provisioning tasks API exists
5. ✅ Authentication working

**What's Missing:**
1. ❌ Webhook endpoint (`POST /api/provisioning/webhooks/order-created`)
2. ❌ Frontend pages to display created resources
3. ❌ Products endpoint bug fix

**Expected Flow:**
```
MigraHosting.com Checkout
           ↓
POST /api/provisioning/webhooks/order-created
           ↓
Create Customer + Subscriptions
           ↓
Create Provisioning Tasks
           ↓
Worker processes tasks
           ↓
Website created on srv1
           ↓
Frontend shows in Customers/Websites/Provisioning pages
```

---

## Immediate Action Items

### Priority 1: Fix Products Endpoint
```bash
# Check backend logs for products error
ssh mhadmin@10.1.10.206 "pm2 logs tenant-billing --lines 50 | grep -A10 products"
```

### Priority 2: Implement Webhook Endpoint
Create: `/opt/mpanel/dist-backend-temp/modules/provisioning/webhooks.controller.js`

Expected payload:
```json
{
  "source": "migrahosting.com",
  "stripeCustomerId": "cus_123",
  "customerEmail": "client@example.com",
  "items": [
    { "code": "wp_growth", "type": "hosting" },
    { "code": "daily_backups_30d", "type": "addon" }
  ]
}
```

### Priority 3: Wire Frontend Pages
Update these components to call existing APIs:
- `/admin/users` → calls `/api/admin/users` ✅
- `/admin/customers` → calls `/api/customers` ✅
- `/products` → calls `/api/products` (after fix)
- `/websites` → calls `/api/websites` ✅
- `/provisioning` → calls `/api/provisioning/tasks` ✅

---

## Database Schema Status

**Tables:** 41 tables exist in PostgreSQL

**Key Tables Confirmed:**
- ✅ `users` - has admin@migrahosting.com (SUPER_ADMIN)
- ✅ `tenants` - has MigraHosting tenant
- ✅ `products` - (check if populated)
- ✅ `subscriptions`
- ✅ `customers`

**TODO: Verify Products Table**
```sql
SELECT id, name, code, price_cents FROM products LIMIT 5;
```

If empty, need to seed:
- Starter ($19.99/mo)
- WP Growth ($49.99/mo)
- Add-ons (backups, firewall, etc.)

---

## Next Steps

### Tonight (Immediate):
1. ✅ ~~Login working~~ DONE
2. ✅ ~~API endpoints verified~~ DONE
3. ✅ ~~Frontend spec created~~ DONE
4. ⏳ Fix products endpoint error
5. ⏳ Wire frontend pages to APIs
6. ⏳ Create webhook endpoint
7. ⏳ Test end-to-end checkout → provisioning

### Tomorrow:
1. Seed products table
2. Test full auto-provision flow
3. Create test customer via API
4. Verify website shows in frontend
5. Polish empty states

---

## Testing Credentials

**Admin Login:**
- URL: https://migrapanel.com
- Email: admin@migrahosting.com
- Password: Admin123!
- Role: SUPER_ADMIN

**API Base:** https://migrapanel.com/api (or http://10.1.10.206:2271/api)

**Test Token:**
```bash
curl -X POST https://migrapanel.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@migrahosting.com","password":"Admin123!"}'
```

---

## Success Metrics

**Phase 1 Complete When:**
- ✅ Login works
- ✅ Dashboard shows
- ✅ All sidebar items load (not blank)
- ✅ Products endpoint fixed
- ✅ Customers page shows table
- ✅ Websites page shows table
- ✅ Provisioning page shows tasks

**Auto-Provision Ready When:**
- ✅ Webhook endpoint responds
- ✅ Customer creation works
- ✅ Subscription creation works
- ✅ Website creation works
- ✅ Frontend displays all resources
- ✅ MigraHosting.com can complete checkout

---

## Documentation Links

- Frontend Spec: `/opt/mpanel/docs/MPANEL_FRONTEND_SPEC.md`
- Backend Spec: `/opt/mpanel/docs/MPANEL_BACKEND_SPEC.md` (if exists)
- Deployment: `/opt/mpanel/DEPLOYMENT_GUIDE.md`

**PM2 Commands:**
```bash
pm2 status                           # Check all processes
pm2 logs tenant-billing --lines 50   # Backend logs
pm2 restart tenant-billing           # Restart API
pm2 restart mpanel-frontend          # Restart UI
```

**Database:**
```bash
node -e "import pool from './src/config/database.js'; pool.query('SELECT...').then(console.log)"
```

---

**Status:** 🟢 System operational, ready for frontend wiring and webhook implementation
