# mPanel Fix Guide - Step by Step

**Priority Order:** Fix in this sequence for fastest path to working system.

---

## 🔥 PRIORITY 1: Fix Public Endpoint Auth (30 minutes)

**Problem:** `/api/products/public` returns 401 "Access token required"  
**Impact:** Public product catalog not accessible  
**Root Cause:** `shieldMiddleware` applied globally to all `/api/*` routes in `src/server.js:359`

### Solution A: Whitelist Public Routes in Shield (Recommended)

**File:** `src/middleware/shield.js`

**Add whitelist at top:**
```javascript
const PUBLIC_ROUTES = [
  '/api/products/public',
  '/api/products/pricing',
  '/api/health',
  '/api/status',
  '/api/__debug'
];

export default function shieldMiddleware(req, res, next) {
  // Skip shield for public routes
  if (PUBLIC_ROUTES.some(route => req.path.startsWith(route))) {
    return next();
  }
  
  // ... rest of shield logic
}
```

### Solution B: Reorder Middleware in server.js

**File:** `src/server.js` around line 359

**Change from:**
```javascript
app.use('/api', shieldMiddleware, tsApiRouter);
```

**To:**
```javascript
// Mount public routes first WITHOUT shield
app.use('/api/products/public', tsApiRouter);
app.use('/api/products/pricing', tsApiRouter);

// Then mount protected routes WITH shield
app.use('/api', shieldMiddleware, tsApiRouter);
```

### Test Command:
```bash
curl http://100.97.213.11:2271/api/products/public
# Should return: {"success":true,"data":[...products...]}
```

---

## 🔧 PRIORITY 2: Fix TypeScript Compilation (1-2 hours)

**Problem:** 150+ TypeScript errors blocking rebuilds  
**Impact:** Can't compile new changes to TypeScript modules  
**Root Cause:** Controllers return `Promise<void>` but use `return res.json()`

### Quick Fix: Remove Return Keywords

**Run this script:**
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

# Create fix script
cat > fix-controllers.sh << 'EOF'
#!/bin/bash
for file in src/modules/**/*.controller.ts; do
  # Change: return res.json( -> res.json(
  sed -i 's/return res\.json(/res.json(/g' "$file"
  
  # Change: return res.status(...).json( -> res.status(...).json(
  sed -i 's/return res\.status(\([^)]*\))\.json(/res.status(\1).json(/g' "$file"
  
  # Change: return next(error); -> next(error); return;
  sed -i 's/return next(error);/next(error);\n    return;/g' "$file"
  
  echo "Fixed: $file"
done
EOF

chmod +x fix-controllers.sh
./fix-controllers.sh
```

### Better Fix: Change Return Types

**For each controller file, change:**
```typescript
// FROM:
async handleSomething(req: Request, res: Response, next: NextFunction): Promise<void> {
  return res.json({ data });
}

// TO:
async handleSomething(req: Request, res: Response, next: NextFunction): Promise<Response | void> {
  return res.json({ data });
}
```

### Test Compilation:
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
npm run build

# Should output:
# > tsc && npm run build:mpanel
# [no errors]
# ✓ Build complete
```

---

## 🧪 PRIORITY 3: Run Money Engine Tests (2-3 hours)

**Follow:** `TEST-CHECKLIST.md`

### Get Auth Token First:
```bash
# Create test admin user (if not exists)
curl -X POST http://100.97.213.11:2271/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!",
    "name": "Test Admin"
  }'

# Login to get token
TOKEN=$(curl -s -X POST http://100.97.213.11:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!"
  }' | jq -r '.token')

echo "Token: $TOKEN"
```

### Run Tests Systematically:

**Section 0: Global Sanity**
```bash
# 0.1 Health check
curl http://100.97.213.11:2271/api/health

# 0.2 Frontend loads
curl https://migrapanel.com | grep -o '<title>[^<]*</title>'

# 0.3 Backend process
ssh mhadmin@10.1.10.206 "pm2 status | grep mpanel"

# 0.4 Database connection
ssh mhadmin@10.1.10.206 "psql -U mpanel_user -d mpanel -c 'SELECT COUNT(*) FROM products;'"
```

**Section 1: Products Module**
```bash
# 1.1 List products (authenticated)
curl -H "Authorization: Bearer $TOKEN" \
  http://100.97.213.11:2271/api/products

# 1.2 Get product details
curl -H "Authorization: Bearer $TOKEN" \
  http://100.97.213.11:2271/api/products/CPOD-MINI

# 1.3 Public products (should work without auth after fix #1)
curl http://100.97.213.11:2271/api/products/public
```

**Section 2: Checkout Module**
```bash
# 2.1 Create order
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://100.97.213.11:2271/api/orders \
  -d '{
    "customerId": "customer-uuid",
    "items": [{
      "productId": "prod-uuid",
      "billingCycle": "monthly",
      "quantity": 1
    }]
  }'
```

Continue through all 13 sections, documenting each result in the checklist.

---

## 📊 TRACKING PROGRESS

### Update TEST-CHECKLIST.md as you go:
```markdown
## Section 0: Global Sanity Checks

- [x] 0.1 Health endpoint responds ✅
- [x] 0.2 Frontend loads ✅
- [x] 0.3 Backend process running ✅
- [x] 0.4 Database connection works ✅

## Section 1: Products Module

- [x] 1.1 API: GET /api/products returns 29 products ✅
- [ ] 1.2 API: GET /api/products/:id works ⏳
- [ ] 1.3 API: GET /api/products/public works ❌ (needs fix #1)
```

---

## 🎯 SUCCESS CRITERIA

**System is READY TO MAKE MONEY when:**

✅ All public endpoints accessible without auth  
✅ TypeScript compiles without errors  
✅ All 13 checklist sections pass  
✅ Full E2E test: Register → Browse → Purchase → Provision → Receive CloudPod  

---

## 🚨 BLOCKERS LOG

Track issues as you find them:

| Issue | Module | Status | Fix Required |
|-------|--------|--------|--------------|
| Public endpoints require auth | Products | 🔴 Blocking | Priority 1 |
| TypeScript won't compile | All | 🟡 Non-blocking | Priority 2 |
| CloudPods API 404 | CloudPods | ⏳ Untested | TBD |

---

## 💡 QUICK WINS

These give immediate visible progress:

1. **Fix public endpoints** (30 min) → Catalog becomes accessible ✅
2. **Test health checks** (5 min) → Confirm system stability ✅
3. **Test database queries** (10 min) → Verify data integrity ✅
4. **Fix TypeScript** (1 hr) → Enable future development ✅

---

## 📞 HELP COMMANDS

**Check backend logs:**
```bash
ssh mhadmin@10.1.10.206 "pm2 logs mpanel-api --lines 50"
```

**Restart backend:**
```bash
ssh mhadmin@10.1.10.206 "pm2 restart mpanel-api"
```

**Check database:**
```bash
ssh mhadmin@10.1.10.206 "psql -U mpanel_user -d mpanel"
```

**Deploy frontend changes:**
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel/frontend
npm run build
rsync -avz --delete dist/ mhadmin@10.1.10.206:/var/www/migrapanel.com/public/
```

**Rebuild TypeScript:**
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
npm run build
rsync -avz dist/ mhadmin@10.1.10.206:/opt/mpanel/dist/
ssh mhadmin@10.1.10.206 "pm2 restart mpanel-api"
```

---

**START HERE:** Priority 1 → Get public endpoints working  
**THEN:** Priority 2 → Fix TypeScript compilation  
**FINALLY:** Priority 3 → Run full test checklist

You'll have a fully operational money-making system in 4-6 hours of focused work.
