# Frontend UI Testing - Quick Start

## 🚀 Servers Running

✅ **Backend API**: http://localhost:2271  
✅ **Frontend UI**: http://localhost:2272  
✅ **Database**: PostgreSQL (Docker - port 5433)  
✅ **Redis**: Redis (Docker - port 6380)

---

## 🔐 Test Credentials

### Admin User (Full Access)
```
Email:    admin@migrahosting.com
Password: admin123
Role:     admin
Access:   Full system access, all admin routes
```

### Client User (Limited Access)
```
Email:    info@holisticgroupllc.com
Password: [Create password via backend API or use reset]
Role:     customer
Access:   Client portal only
```

---

## 🎯 Quick Test Steps

### Step 1: Open Login Page
```bash
# Option 1: xdg-open (Linux)
xdg-open http://localhost:2272/login

# Option 2: Firefox
firefox http://localhost:2272/login &

# Option 3: Chrome
google-chrome http://localhost:2272/login &
```

### Step 2: Login with Admin Credentials
1. Navigate to: http://localhost:2272/login
2. Enter email: `admin@migrahosting.com`
3. Enter password: `admin123`
4. Click "Sign In"
5. ✅ Should redirect to `/dashboard` or `/`

### Step 3: Verify Authentication
**Open Browser Console (F12) and check**:
```javascript
// Check token is stored
localStorage.getItem('token')
// Should return: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

// Check user data
JSON.parse(localStorage.getItem('user') || '{}')
// Should show: {id: "...", email: "admin@migrahosting.com", role: "admin"}
```

### Step 4: Test Navigation
Click through these pages (check sidebar menu):
- ✅ Dashboard → `/dashboard`
- ✅ Customers → `/customers`
- ✅ Servers → `/servers`
- ✅ Products → `/products`
- ✅ Invoices → `/invoices`
- ✅ Analytics → `/analytics`

### Step 5: Check API Integration
**Open Network Tab (F12)** and verify:
- ✅ API calls to `http://localhost:2271/api/*`
- ✅ Authorization header present: `Bearer <token>`
- ✅ Responses return 200 (not 401 Unauthorized)
- ✅ Data displays on page (no errors)

---

## 🧪 Test Checklist

### Authentication Flow
- [ ] Login page loads
- [ ] Form validation works (empty fields)
- [ ] Login with admin credentials succeeds
- [ ] Token stored in localStorage
- [ ] User redirected to dashboard
- [ ] Protected routes accessible
- [ ] Logout button works
- [ ] After logout, protected routes redirect to login

### Dashboard
- [ ] Page loads without errors
- [ ] Summary cards display
- [ ] Charts render (if any)
- [ ] No console errors
- [ ] API calls successful (Network tab)

### Customer Management
- [ ] Customer list displays
- [ ] Search/filter works
- [ ] Add customer modal opens
- [ ] Create customer succeeds
- [ ] Edit customer works
- [ ] Delete customer works (with confirmation)

### Service Plans
- [ ] 4 plans display (Starter, Professional, Business, Enterprise)
- [ ] Pricing shows: $4.99, $14.99, $39.99, $99.99
- [ ] "14-day trial" badges visible
- [ ] Plan features list displays
- [ ] Select/order plan buttons work

### Invoices
- [ ] Invoice list displays
- [ ] Filter by status works
- [ ] Invoice details open on click
- [ ] Download invoice works

### Servers
- [ ] Server list displays
- [ ] Add server form works
- [ ] Server metrics show (CPU, RAM, Disk)
- [ ] Server actions work (restart, configure)

### Premium Features
- [ ] AI Features page accessible
- [ ] GraphQL playground loads
- [ ] WebSocket dashboard shows connection status
- [ ] Kubernetes page displays (if enabled)
- [ ] CDN management accessible

### RBAC (Role-Based Access)
- [ ] Admin sees all routes
- [ ] Admin menu shows admin-only items
- [ ] Client login redirects to `/client` portal
- [ ] Client cannot access admin routes (redirects or 403)

### UI/UX
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Loading spinners show during API calls
- [ ] Error messages display on failure
- [ ] Success toasts show on success actions
- [ ] Form validation messages clear

---

## 🐛 Common Issues & Fixes

### Issue 1: Cannot Login - "Login failed" error
**Symptoms**: Error toast shows "Login failed" or "Invalid credentials"

**Solutions**:
1. **Check backend is running**:
   ```bash
   curl http://localhost:2271/api/health
   # Should return: {"status":"healthy",...}
   ```

2. **Verify credentials**:
   ```bash
   docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT email, role FROM users WHERE email = 'admin@migrahosting.com';"
   ```

3. **Check backend logs**:
   ```bash
   tail -50 /tmp/mpanel-backend.log
   ```

4. **Check CORS settings** (in browser console):
   - Error: "Access to XMLHttpRequest blocked by CORS"
   - Fix: Backend should allow `http://localhost:2272` in CORS origins

### Issue 2: Token Expired or Invalid
**Symptoms**: Redirect to login after accessing page, or 401 errors in Network tab

**Solution**:
1. Clear localStorage and login again:
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload();
   ```

2. Generate new token manually:
   ```bash
   curl -X POST http://localhost:2271/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@migrahosting.com","password":"admin123"}'
   ```

### Issue 3: Page Loads But No Data
**Symptoms**: Tables/lists empty, API calls return 200 but no data

**Solution**:
1. **Seed test data**:
   ```bash
   cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
   node test-enhanced-features.js
   # This creates test customers, plans, etc.
   ```

2. **Check database has data**:
   ```bash
   docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) FROM service_plans;"
   # Should return: 4 (or more)
   ```

### Issue 4: 404 on Routes
**Symptoms**: Page refresh gives 404 error

**Solution**: Vite dev server should handle this, but if not:
1. **Check Vite config** has history fallback:
   ```javascript
   // vite.config.js should have:
   server: {
     historyApiFallback: true
   }
   ```

2. **Use `/#/` hash routing** (if BrowserRouter fails):
   - Change from `BrowserRouter` to `HashRouter` in `main.jsx`

### Issue 5: API Calls Fail with CORS Error
**Symptoms**: Console shows "blocked by CORS policy"

**Solution**:
1. **Update backend CORS config** (`src/server.js`):
   ```javascript
   app.use(cors({
     origin: ['http://localhost:2272', 'http://localhost:5173'],
     credentials: true
   }));
   ```

2. **Restart backend**:
   ```bash
   pkill -f "node.*server.js"
   npm run dev > /tmp/mpanel-backend.log 2>&1 &
   ```

---

## 📝 Test Data Quick Reference

### Service Plans in Database
```bash
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, price: .price_monthly, trial: .trial_enabled}'
```

**Expected Output**:
```json
{"name": "Starter", "price": "4.99", "trial": true}
{"name": "Professional", "price": "14.99", "trial": true}
{"name": "Business", "price": "39.99", "trial": true}
{"name": "Enterprise", "price": "99.99", "trial": true}
```

### Customers in Database
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT email, company, status FROM customers LIMIT 5;"
```

### Create Test Customer via API
```bash
curl -X POST http://localhost:2271/api/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "email": "testcustomer@example.com",
    "company": "Test Company",
    "first_name": "Test",
    "last_name": "Customer",
    "phone": "555-0100"
  }'
```

---

## 🎨 UI Pages to Test

### Core Admin Pages
1. **Dashboard** - http://localhost:2272/dashboard
2. **Customers** - http://localhost:2272/customers
3. **Users** - http://localhost:2272/admin/users
4. **Servers** - http://localhost:2272/servers
5. **Products** - http://localhost:2272/products
6. **Invoices** - http://localhost:2272/invoices
7. **Subscriptions** - http://localhost:2272/subscriptions
8. **Analytics** - http://localhost:2272/analytics
9. **Monitoring** - http://localhost:2272/monitoring

### Hosting Features
10. **Websites** - http://localhost:2272/websites
11. **DNS** - http://localhost:2272/dns
12. **Email** - http://localhost:2272/email
13. **Databases** - http://localhost:2272/databases
14. **Domains** - http://localhost:2272/domains
15. **SSL Certificates** - http://localhost:2272/ssl-certificates
16. **Backups** - http://localhost:2272/backups
17. **File Manager** - http://localhost:2272/file-manager

### Premium Features
18. **AI Features** - http://localhost:2272/ai
19. **GraphQL** - http://localhost:2272/graphql
20. **WebSocket** - http://localhost:2272/websocket
21. **Kubernetes** - http://localhost:2272/kubernetes
22. **CDN** - http://localhost:2272/cdn
23. **White Label** - http://localhost:2272/white-label
24. **API Marketplace** - http://localhost:2272/api-marketplace

### Client Portal (login as client)
25. **Client Dashboard** - http://localhost:2272/client
26. **My Services** - http://localhost:2272/client/services
27. **My Invoices** - http://localhost:2272/client/invoices
28. **My Domains** - http://localhost:2272/client/domains
29. **Billing Settings** - http://localhost:2272/client/billing
30. **Support** - http://localhost:2272/client/support

---

## ✅ Success Criteria

**Frontend is ready when**:
- [x] Login works with test credentials
- [ ] All pages load without errors
- [ ] API integration working (data displays)
- [ ] RBAC enforced (admin sees all, client sees limited)
- [ ] Forms submit successfully
- [ ] CRUD operations work (Create, Read, Update, Delete)
- [ ] Responsive on mobile/tablet/desktop
- [ ] No console errors on any page
- [ ] Loading states show during API calls
- [ ] Error handling works (friendly messages)

---

## 🚀 Start Testing Now!

```bash
# 1. Ensure backend is running
curl http://localhost:2271/api/health

# 2. Ensure frontend is running
curl http://localhost:2272

# 3. Open login page
xdg-open http://localhost:2272/login

# 4. Login with admin credentials
# Email: admin@migrahosting.com
# Password: admin123

# 5. Start clicking through pages!
```

---

**Last Updated**: November 18, 2025  
**Backend**: Running on http://localhost:2271  
**Frontend**: Running on http://localhost:2272  
**Status**: ✅ Ready for UI testing
