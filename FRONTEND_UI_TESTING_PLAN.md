# Frontend UI Testing Plan

**Frontend Server**: ✅ Running on http://localhost:2272  
**Backend API**: ✅ Running on http://localhost:2271  
**Status**: Ready for UI testing  
**Date**: November 18, 2025

---

## 🎯 Testing Overview

The frontend has **60+ pages** organized into:
- **Admin Portal**: 20+ admin pages (customers, servers, provisioning, analytics)
- **Client Portal**: 6 client-facing pages (dashboard, services, invoices, domains, billing, support)
- **Premium Features**: 12 enterprise pages (AI, GraphQL, WebSocket, Kubernetes, CDN, etc.)
- **Core Features**: Billing, hosting, DNS, email, databases, SSL, backups

---

## 📝 Quick Access URLs

### Main Application
```
http://localhost:2272/                    - Home/Dashboard
http://localhost:2272/login               - Login page
http://localhost:2272/welcome             - Welcome page
```

### Admin Portal Routes
```
http://localhost:2272/admin               - Admin Dashboard
http://localhost:2272/admin/users         - User Management
http://localhost:2272/customers           - Customer Management
http://localhost:2272/servers             - Server Management
http://localhost:2272/provisioning        - Auto Provisioning
http://localhost:2272/analytics           - Analytics Dashboard
http://localhost:2272/monitoring          - System Monitoring
http://localhost:2272/roles               - Role Management (RBAC)
```

### Client Portal Routes
```
http://localhost:2272/client              - Client Dashboard
http://localhost:2272/client/services     - My Services
http://localhost:2272/client/invoices     - My Invoices
http://localhost:2272/client/domains      - My Domains
http://localhost:2272/client/billing      - Billing Settings
http://localhost:2272/client/support      - Support Tickets
```

### Premium Features
```
http://localhost:2272/ai                  - AI Features (GPT-4 integration)
http://localhost:2272/graphql             - GraphQL Playground
http://localhost:2272/websocket           - WebSocket Dashboard
http://localhost:2272/kubernetes          - Kubernetes Management
http://localhost:2272/cdn                 - CDN Management
http://localhost:2272/white-label         - White Label Settings
http://localhost:2272/api-marketplace     - API Marketplace
```

### Core Features
```
http://localhost:2272/dashboard           - Main Dashboard
http://localhost:2272/products            - Product Catalog
http://localhost:2272/invoices            - Invoice Management
http://localhost:2272/subscriptions       - Subscription Management
http://localhost:2272/websites            - Website Management
http://localhost:2272/dns                 - DNS Management
http://localhost:2272/email               - Email Accounts
http://localhost:2272/databases           - Database Management
http://localhost:2272/domains             - Domain Management
http://localhost:2272/ssl-certificates    - SSL Certificates
http://localhost:2272/backups             - Backup Management
http://localhost:2272/app-installer       - App Installer (WordPress, etc.)
http://localhost:2272/file-manager        - File Manager
http://localhost:2272/security            - Security Settings
```

---

## 🧪 Section 1: Login & Authentication

### Test 1.1: Access Login Page
```bash
# Open in browser
firefox http://localhost:2272/login 2>/dev/null &
# or
google-chrome http://localhost:2272/login 2>/dev/null &
# or
xdg-open http://localhost:2272/login
```

**Manual Test**:
1. ✅ Page loads without errors
2. ✅ Login form displays (email + password fields)
3. ✅ "Login" button visible
4. ✅ No console errors (F12)

### Test 1.2: Login with Test Credentials

**Test Admin User** (created in earlier tests):
- **Email**: `admin@example.com`
- **Password**: `Admin123!`

**Alternative Test User**:
- **Email**: `test@example.com`
- **Password**: `password123`

**Steps**:
1. Enter email and password
2. Click "Login" button
3. ✅ Should redirect to `/dashboard`
4. ✅ Should see user name/avatar in header
5. ✅ Navigation sidebar should appear

**Check in Browser Console** (F12):
```javascript
// Check if user is authenticated
localStorage.getItem('token')  // Should show JWT token
localStorage.getItem('user')   // Should show user data
```

### Test 1.3: Logout Flow
1. Click user menu (top right)
2. Click "Logout" button
3. ✅ Should redirect to `/login`
4. ✅ Token should be cleared from localStorage

---

## 🧪 Section 2: Dashboard Pages

### Test 2.1: Main Dashboard
**URL**: http://localhost:2272/dashboard

**Check**:
- ✅ Page loads without errors
- ✅ Summary cards display (total customers, revenue, active services, etc.)
- ✅ Charts render (if using Chart.js/Recharts)
- ✅ Recent activity list shows
- ✅ No API errors in Network tab (F12)

**API Calls to Verify** (Network tab):
```
GET /api/dashboard/stats
GET /api/dashboard/recent-activity
GET /api/dashboard/revenue-chart
```

### Test 2.2: Admin Dashboard
**URL**: http://localhost:2272/admin

**Check**:
- ✅ Admin-only metrics visible
- ✅ System health indicators
- ✅ User activity logs
- ✅ Server status overview

---

## 🧪 Section 3: Customer & User Management

### Test 3.1: Customers Page
**URL**: http://localhost:2272/customers

**Check**:
- ✅ Customer list table displays
- ✅ Search/filter functionality works
- ✅ Pagination controls visible
- ✅ "Add Customer" button present
- ✅ Customer rows clickable

**Test Actions**:
1. Click "Add Customer" → Modal/form opens
2. Fill in customer details:
   - Name: `Test Customer`
   - Email: `testcustomer@example.com`
   - Company: `Test Corp`
3. Submit form
4. ✅ New customer appears in list
5. ✅ Success notification shows

**API Call**:
```
POST /api/customers
GET /api/customers
```

### Test 3.2: Users Page
**URL**: http://localhost:2272/admin/users

**Check**:
- ✅ User list displays
- ✅ Role badges show (admin, manager, client, etc.)
- ✅ Status indicators (active/inactive)
- ✅ Actions menu (edit, disable, delete)

---

## 🧪 Section 4: Service Plans & Pricing

### Test 4.1: Product Catalog
**URL**: http://localhost:2272/products

**Check**:
- ✅ 4 service plans display (Starter, Professional, Business, Enterprise)
- ✅ Pricing shows correctly ($4.99, $14.99, $39.99, $99.99)
- ✅ "Trial Available" badge shows (14 days)
- ✅ Feature lists display
- ✅ "Select Plan" or "Order Now" buttons work

**Test API Response**:
```bash
# Backend should return this data
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, price: .price_monthly, trial_enabled}'
```

### Test 4.2: Shopping Cart (if implemented)
**URL**: http://localhost:2272/cart

**Test Flow**:
1. Select "Professional" plan from catalog
2. ✅ Plan added to cart
3. View cart
4. ✅ Plan details show in cart
5. ✅ Subtotal calculated correctly
6. Proceed to checkout
7. ✅ Checkout form loads

---

## 🧪 Section 5: Billing & Invoices

### Test 5.1: Invoices Page
**URL**: http://localhost:2272/invoices

**Check**:
- ✅ Invoice list displays
- ✅ Filters work (status: paid/unpaid/overdue)
- ✅ Date range picker functional
- ✅ Invoice totals show
- ✅ Download/view invoice buttons work

**Test Actions**:
1. Click on an invoice → Opens detail view
2. ✅ Line items display
3. ✅ Payment status shows
4. ✅ Download PDF button works (if implemented)

### Test 5.2: Subscriptions Page
**URL**: http://localhost:2272/subscriptions

**Check**:
- ✅ Active subscriptions list
- ✅ Plan details visible
- ✅ Next billing date shows
- ✅ "Upgrade/Downgrade" buttons work
- ✅ "Cancel" subscription option available

---

## 🧪 Section 6: Hosting Management

### Test 6.1: Servers Page
**URL**: http://localhost:2272/servers

**Check**:
- ✅ Server list displays
- ✅ Server status indicators (online/offline)
- ✅ Resource usage meters (CPU, RAM, Disk)
- ✅ "Add Server" button works
- ✅ Server actions menu (restart, configure, delete)

**Test Add Server**:
1. Click "Add Server"
2. Fill form:
   - Hostname: `test-server-01`
   - IP Address: `192.168.1.100`
   - Type: `web_server`
   - Status: `active`
3. Submit
4. ✅ Server appears in list
5. ✅ Success notification

**API Calls**:
```
GET /api/servers
POST /api/servers
GET /api/servers/:id/metrics
```

### Test 6.2: Websites Page
**URL**: http://localhost:2272/websites

**Check**:
- ✅ Website list displays
- ✅ Domain names show
- ✅ SSL status indicators
- ✅ Quick actions (visit site, manage DNS, SSL)
- ✅ "Add Website" form works

### Test 6.3: DNS Management
**URL**: http://localhost:2272/dns

**Check**:
- ✅ DNS zones list
- ✅ Record types display (A, AAAA, CNAME, MX, TXT)
- ✅ "Add Record" button works
- ✅ Edit/delete record actions functional

**Test Add DNS Record**:
1. Click "Add Record"
2. Fill form:
   - Type: `A`
   - Name: `test`
   - Value: `192.168.1.1`
   - TTL: `3600`
3. Submit
4. ✅ Record appears in list

---

## 🧪 Section 7: Premium Features

### Test 7.1: AI Features Page
**URL**: http://localhost:2272/ai

**Check**:
- ✅ AI dashboard loads
- ✅ GPT-4 integration status shows
- ✅ Available AI tools listed:
  - Code generation
  - Debugging assistance
  - Plan recommendations
  - Churn prediction
  - Resource forecasting

**Test AI Code Generation**:
1. Navigate to AI Code Generator
2. Enter prompt: `"Create a function to validate email addresses"`
3. Click "Generate"
4. ✅ AI response displays
5. ✅ Code is properly formatted

**API Call**:
```
POST /api/ai/generate-code
POST /api/ai/recommendations
POST /api/ai/debug-assistance
```

### Test 7.2: GraphQL Playground
**URL**: http://localhost:2272/graphql

**Check**:
- ✅ GraphQL playground loads
- ✅ Schema explorer shows
- ✅ Query editor functional
- ✅ Variables panel works

**Test Query**:
```graphql
query GetPlans {
  products {
    id
    name
    price
  }
}
```

**Expected**: List of service plans returned

### Test 7.3: WebSocket Dashboard
**URL**: http://localhost:2272/websocket

**Check**:
- ✅ WebSocket connection status (connected/disconnected)
- ✅ Active connections count
- ✅ Real-time events display
- ✅ Send test message functionality

**Test WebSocket**:
1. Open WebSocket page
2. ✅ Connection establishes automatically
3. Send test message: `{"type":"ping"}`
4. ✅ Response received: `{"type":"pong"}`

### Test 7.4: Kubernetes Management
**URL**: http://localhost:2272/kubernetes

**Check**:
- ✅ Cluster list displays
- ✅ Pods/deployments overview
- ✅ Namespace selector works
- ✅ Resource usage charts

### Test 7.5: CDN Management
**URL**: http://localhost:2272/cdn

**Check**:
- ✅ CDN zones list
- ✅ Cache statistics show
- ✅ Purge cache button works
- ✅ Bandwidth usage charts

### Test 7.6: White Label Settings
**URL**: http://localhost:2272/white-label

**Check**:
- ✅ Branding settings form
- ✅ Logo upload area
- ✅ Color picker for theme
- ✅ Custom domain settings
- ✅ Email template customization

---

## 🧪 Section 8: Enhanced Plan Features (UI)

### Test 8.1: Trial Period Indicator
**Location**: Product catalog, subscription cards

**Check**:
- ✅ "14-day free trial" badge displays
- ✅ Trial countdown shows for active trials
- ✅ Trial expiry warning appears when < 3 days left

### Test 8.2: Referral Program UI
**URL**: http://localhost:2272/client/referrals (or similar)

**Check**:
- ✅ Unique referral code displays
- ✅ Referral link copy button works
- ✅ Referral statistics show (total referrals, rewards earned)
- ✅ Referral history table displays

**Test Actions**:
1. Click "Copy Referral Link"
2. ✅ Link copied to clipboard
3. ✅ Success notification shows

### Test 8.3: Loyalty Program Dashboard
**URL**: http://localhost:2272/client/loyalty (or in profile)

**Check**:
- ✅ Current loyalty tier displays (Bronze/Silver/Gold/Platinum)
- ✅ Progress bar to next tier
- ✅ Months as customer count
- ✅ Current discount percentage
- ✅ Available rewards list

### Test 8.4: Promotional Codes
**Location**: Checkout page or billing settings

**Check**:
- ✅ Promo code input field visible
- ✅ "Apply Code" button works
- ✅ Valid code applies discount (e.g., "WELCOME10" → 10% off)
- ✅ Invalid code shows error message
- ✅ Discount amount displays in order summary

**Test**:
1. Enter promo code: `WELCOME10`
2. Click "Apply"
3. ✅ Discount applied to total
4. ✅ "Promo code applied: WELCOME10 (-10%)" message shows

### Test 8.5: Usage-Based Billing Display
**Location**: Subscription details or billing page

**Check**:
- ✅ Current resource usage shows (disk space, bandwidth)
- ✅ Plan limits displayed
- ✅ Overage charges preview (if over limits)
- ✅ Usage meters/progress bars
- ✅ Overage rate information visible

**Example Display**:
```
Disk Space: 12 GB / 10 GB (2 GB overage)
Bandwidth: 150 GB / 100 GB (50 GB overage)

Overage Charges This Month: $4.88
- Disk Space: 2 GB × $0.15 = $0.30
- Bandwidth: 50 GB × $0.05 = $2.50
```

### Test 8.6: Client Success Metrics Dashboard
**URL**: http://localhost:2272/client/success-metrics

**Check**:
- ✅ Success score displays (0-100)
- ✅ Metrics cards show:
  - Uptime percentage (99.9%)
  - Security score
  - Backup count
  - CDN savings
- ✅ Value delivered chart
- ✅ Milestone achievements list

---

## 🧪 Section 9: Role-Based Access Control (RBAC)

### Test 9.1: Admin Role Test
**Login as**: `admin@example.com`

**Check Access**:
- ✅ Can view `/admin` routes
- ✅ Can view `/customers`
- ✅ Can view `/servers`
- ✅ Can view `/analytics`
- ✅ Can manage users (`/admin/users`)
- ✅ Can manage roles (`/roles`)

### Test 9.2: Manager Role Test
**Login as**: Manager user (create if needed)

**Check Access**:
- ✅ Can view customers
- ✅ Can view invoices
- ✅ Cannot access `/admin` routes
- ✅ Cannot manage roles
- ✅ Can create/edit services

### Test 9.3: Client Role Test
**Login as**: Client user

**Check Access**:
- ✅ Can only access `/client/*` routes
- ✅ Cannot access `/admin`
- ✅ Cannot access `/customers`
- ✅ Can view own invoices only
- ✅ Can view own services only

### Test 9.4: Permission Checks in UI
**Check**:
- ✅ Unauthorized menu items hidden
- ✅ Unauthorized buttons disabled/hidden
- ✅ Clicking unauthorized route → Redirects to 403 or dashboard
- ✅ Permission-based UI rendering works

---

## 🧪 Section 10: File Manager & Backups

### Test 10.1: File Manager
**URL**: http://localhost:2272/file-manager

**Check**:
- ✅ Directory tree displays
- ✅ File list shows with icons
- ✅ Navigation (breadcrumb) works
- ✅ Upload file button functional
- ✅ Download file works
- ✅ Delete file confirmation modal

**Test Actions**:
1. Upload test file (e.g., `test.txt`)
2. ✅ File appears in list
3. Click download
4. ✅ File downloads
5. Delete file
6. ✅ Confirmation modal shows
7. Confirm delete
8. ✅ File removed from list

### Test 10.2: Backups Page
**URL**: http://localhost:2272/backups

**Check**:
- ✅ Backup list displays
- ✅ Backup status (completed, failed, in progress)
- ✅ Backup size shows
- ✅ "Create Backup" button works
- ✅ Restore backup option available
- ✅ Download backup button functional

---

## 🧪 Section 11: SSL Certificates

### Test 11.1: SSL Certificates Page
**URL**: http://localhost:2272/ssl-certificates

**Check**:
- ✅ Certificate list displays
- ✅ Domain names show
- ✅ Expiry dates visible
- ✅ Status indicators (valid, expiring soon, expired)
- ✅ "Request Certificate" button works
- ✅ Auto-renewal toggle functional

**Test Request SSL**:
1. Click "Request Certificate"
2. Enter domain: `test.example.com`
3. Select provider: `Let's Encrypt`
4. Submit
5. ✅ Certificate request initiated
6. ✅ Status shows as "pending"

---

## 🧪 Section 12: Email Management

### Test 12.1: Email Accounts Page
**URL**: http://localhost:2272/email

**Check**:
- ✅ Email accounts list
- ✅ Mailbox quota usage shows
- ✅ "Add Email" button works
- ✅ Password reset option
- ✅ Forwarding rules visible

**Test Add Email**:
1. Click "Add Email Account"
2. Fill form:
   - Email: `test@example.com`
   - Password: `SecurePass123!`
   - Quota: `1024` MB
3. Submit
4. ✅ Email account created
5. ✅ Appears in list

---

## 🧪 Section 13: Monitoring & Analytics

### Test 13.1: Monitoring Page
**URL**: http://localhost:2272/monitoring

**Check**:
- ✅ System metrics charts (CPU, RAM, Disk)
- ✅ Real-time updates (graphs update automatically)
- ✅ Alert notifications display
- ✅ Service health status
- ✅ Prometheus/Grafana links work

### Test 13.2: Analytics Page
**URL**: http://localhost:2272/analytics

**Check**:
- ✅ Revenue charts display
- ✅ Customer growth graph
- ✅ Top products/services list
- ✅ Date range picker works
- ✅ Export data button functional

---

## 🧪 Section 14: Client Portal

### Test 14.1: Client Dashboard
**URL**: http://localhost:2272/client

**Login as**: Client role user

**Check**:
- ✅ Service summary cards
- ✅ Recent invoices list
- ✅ Support ticket summary
- ✅ Domain expiry warnings
- ✅ Quick actions (renew, upgrade, support)

### Test 14.2: Client Services
**URL**: http://localhost:2272/client/services

**Check**:
- ✅ Active services list
- ✅ Service status (active, suspended, cancelled)
- ✅ Next billing date
- ✅ "Upgrade Plan" button
- ✅ Service details expandable

### Test 14.3: Client Billing
**URL**: http://localhost:2272/client/billing

**Check**:
- ✅ Current balance shows
- ✅ Payment methods list (credit cards, PayPal)
- ✅ "Add Payment Method" works
- ✅ Auto-pay settings toggle
- ✅ Billing history table

---

## 🧪 Section 15: Responsive Design

### Test 15.1: Mobile View
**Browser DevTools** (F12):
1. Toggle device toolbar (Ctrl+Shift+M)
2. Select device: iPhone 12 Pro (390×844)

**Check**:
- ✅ Navigation collapses to hamburger menu
- ✅ Tables scroll horizontally or stack
- ✅ Forms are usable on mobile
- ✅ Buttons are tap-friendly (min 44×44px)
- ✅ No horizontal overflow

### Test 15.2: Tablet View
**Device**: iPad Pro (1024×1366)

**Check**:
- ✅ Sidebar adapts (may collapse or resize)
- ✅ Charts remain readable
- ✅ Multi-column layouts adjust
- ✅ Touch-friendly interactions

### Test 15.3: Desktop View
**Resolution**: 1920×1080

**Check**:
- ✅ Full sidebar visible
- ✅ Wide tables use available space
- ✅ Multi-column grids display properly
- ✅ No wasted whitespace

---

## 🧪 Section 16: Performance & UX

### Test 16.1: Page Load Times
**Use Browser DevTools** (Network tab):

**Check**:
- ✅ Initial page load < 2 seconds
- ✅ Route transitions < 500ms
- ✅ API responses < 1 second
- ✅ No render-blocking resources

### Test 16.2: Error Handling
**Test Scenarios**:

1. **Network Error**:
   - Disconnect network
   - Navigate to any page
   - ✅ Friendly error message shows
   - ✅ Retry button available

2. **404 Not Found**:
   - Visit: `http://localhost:2272/nonexistent-page`
   - ✅ 404 page displays
   - ✅ "Back to Dashboard" link works

3. **API Error**:
   - Stop backend server
   - Try to load data
   - ✅ Error toast/notification shows
   - ✅ Page doesn't crash

### Test 16.3: Loading States
**Check**:
- ✅ Skeleton loaders or spinners during data fetch
- ✅ Button loading states (spinner on submit)
- ✅ Disabled state while processing
- ✅ No "flash of unstyled content"

---

## 🧪 Section 17: Accessibility (A11y)

### Test 17.1: Keyboard Navigation
**Test**:
1. Use `Tab` key to navigate
2. ✅ Focus visible on all interactive elements
3. ✅ Modals can be closed with `Esc`
4. ✅ Forms can be submitted with `Enter`
5. ✅ Dropdowns work with arrow keys

### Test 17.2: Screen Reader
**Tool**: NVDA (Windows) or VoiceOver (Mac)

**Check**:
- ✅ Headings properly structured (h1, h2, h3)
- ✅ Form labels associated with inputs
- ✅ Alt text on images
- ✅ ARIA labels on icon buttons

### Test 17.3: Color Contrast
**Tool**: Browser extension (WAVE, axe DevTools)

**Check**:
- ✅ Text contrast ratio ≥ 4.5:1
- ✅ Interactive elements clearly visible
- ✅ Error states use more than color (icons, text)

---

## 📊 Testing Checklist Summary

### Core Functionality (Must Test)
- [ ] Login/logout flow
- [ ] Dashboard displays data
- [ ] Customer management (CRUD)
- [ ] Service plans display correctly
- [ ] Invoice generation and viewing
- [ ] Server management
- [ ] Website hosting features
- [ ] DNS management
- [ ] Email accounts
- [ ] Database management
- [ ] SSL certificates
- [ ] Backup management

### Enhanced Features (Must Test)
- [ ] Trial period indicators
- [ ] Referral program UI
- [ ] Loyalty program dashboard
- [ ] Promo code application
- [ ] Usage-based billing display
- [ ] Success metrics dashboard
- [ ] AI features integration
- [ ] GraphQL playground
- [ ] WebSocket dashboard

### Premium Features (Nice to Test)
- [ ] Kubernetes management
- [ ] CDN management
- [ ] White label settings
- [ ] API marketplace
- [ ] Monitoring/analytics

### RBAC (Must Test)
- [ ] Admin role permissions
- [ ] Manager role permissions
- [ ] Client role permissions
- [ ] Permission-based UI hiding

### UX/Polish (Should Test)
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Loading states
- [ ] Error handling
- [ ] Performance (page load times)
- [ ] Accessibility (keyboard, screen reader)

---

## 🚀 Quick Start Testing

### Option 1: Browser Testing
```bash
# Open frontend in browser
xdg-open http://localhost:2272/login
# or
firefox http://localhost:2272/login &
```

### Option 2: Automated E2E Testing (if implemented)
```bash
cd frontend
npm run test:e2e
```

### Option 3: Component Testing (if implemented)
```bash
cd frontend
npm run test
```

---

## 📝 Test Credentials

**Admin User**:
- Email: `admin@example.com`
- Password: `Admin123!`
- Role: `super_admin`

**Test Customer**:
- Email: `test@example.com`
- Password: `password123`
- Role: `client`

**Create New Test User** (via backend):
```bash
curl -X POST http://localhost:2271/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "TestPass123!",
    "name": "Test User",
    "role": "client"
  }'
```

---

## 🐛 Bug Reporting Template

When you find issues, document them:

```markdown
### Bug: [Short description]

**URL**: http://localhost:2272/page-name
**User Role**: admin/manager/client
**Steps to Reproduce**:
1. Navigate to X
2. Click Y
3. See error Z

**Expected**: What should happen
**Actual**: What actually happened
**Console Errors**: [Copy any errors from F12 console]
**Screenshot**: [If applicable]
**Priority**: High/Medium/Low
```

---

## ✅ Success Criteria

**Frontend is production-ready when**:
- [ ] All core features accessible and functional
- [ ] No console errors on any page
- [ ] All forms validate and submit correctly
- [ ] API integration works (no 500 errors)
- [ ] RBAC permissions enforced in UI
- [ ] Responsive on mobile/tablet/desktop
- [ ] Loading states and error handling work
- [ ] Accessibility score > 90 (Lighthouse)
- [ ] Performance score > 85 (Lighthouse)

---

**Ready to start testing! Open http://localhost:2272 in your browser.**
