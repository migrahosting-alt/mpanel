# mPanel Dashboard Testing Plan

## Testing Environment
- **Backend:** http://10.1.10.206:2271 (mpanel-core)
- **Frontend:** http://10.1.10.206:2272 (if running) or https://mpanel.migrahosting.com
- **Database:** PostgreSQL on 10.1.10.210:5432
- **Admin User:** admin@migrahosting.com / Admin@2025!

---

## Phase 1: Authentication & Access Control (15-20 min)

### 1.1 Login System
- [ ] Login with admin credentials
- [ ] Verify JWT token generated
- [ ] Check session persistence
- [ ] Test logout functionality
- [ ] Test "Remember Me" feature
- [ ] Verify password reset flow

### 1.2 RBAC (Role-Based Access Control)
- [ ] Verify admin has full access (level 0)
- [ ] Create test user with 'client' role (level 7)
- [ ] Test permission restrictions
- [ ] Verify resource-level permissions
- [ ] Check role hierarchy enforcement

**Test Commands:**
```bash
# Login and get token
TOKEN=$(curl -s -X POST http://10.1.10.206:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@migrahosting.com","password":"Admin@2025!"}' | jq -r '.token')

echo "Admin Token: $TOKEN"

# Verify permissions
curl -s http://10.1.10.206:2271/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Phase 2: User & Customer Management (20-30 min)

### 2.1 User CRUD Operations
- [ ] List all users (`GET /api/users`)
- [ ] Create new user (`POST /api/users`)
- [ ] Update user details (`PUT /api/users/:id`)
- [ ] Delete/deactivate user (`DELETE /api/users/:id`)
- [ ] Search/filter users
- [ ] Export user list

### 2.2 Customer Management
- [ ] View customer list (`GET /api/customers`)
- [ ] Create customer profile
- [ ] Link customer to user account
- [ ] Update customer billing info
- [ ] View customer subscriptions
- [ ] Customer usage statistics

**Test Scenarios:**
```bash
# Create test customer
curl -X POST http://10.1.10.206:2271/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "currency": "USD"
  }'
```

---

## Phase 3: Billing & Revenue (30-40 min)

### 3.1 Subscription Management
- [ ] View all subscriptions (`GET /api/subscriptions`)
- [ ] Create subscription
- [ ] Update subscription (upgrade/downgrade)
- [ ] Cancel subscription
- [ ] Pause/resume subscription
- [ ] View subscription history
- [ ] Promo code tracking

### 3.2 Invoice Generation
- [ ] Generate invoice manually
- [ ] Auto-invoice on subscription renewal
- [ ] Send invoice via email
- [ ] Mark invoice as paid
- [ ] Void/refund invoice
- [ ] PDF invoice generation
- [ ] Tax calculation

### 3.3 Payment Processing
- [ ] Record manual payment
- [ ] Stripe webhook processing
- [ ] Payment method management
- [ ] Failed payment handling
- [ ] Refund processing

**Test with Recent Orders:**
```bash
# Check subscriptions created from marketing checkout
curl -s http://10.1.10.206:2271/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'

# View subscription details
curl -s http://10.1.10.206:2271/api/subscriptions \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0]'
```

---

## Phase 4: Hosting & Server Management (40-50 min)

### 4.1 Server Management
- [ ] List servers (`GET /api/servers`)
- [ ] Add new server
- [ ] Update server details
- [ ] Monitor server resources (CPU, RAM, disk)
- [ ] Server health checks
- [ ] Server assignments

### 4.2 Website/Hosting Management
- [ ] View all websites (`GET /api/websites`)
- [ ] Create hosting account
- [ ] cPanel integration test
- [ ] Suspend/unsuspend account
- [ ] Terminate account
- [ ] Resource usage tracking
- [ ] Backup management

### 4.3 Auto-Provisioning
- [ ] Test automatic account creation
- [ ] Domain setup automation
- [ ] DNS zone creation
- [ ] SSL certificate installation
- [ ] Email account setup

**Check Provisioning Status:**
```bash
# Check recent provisioning attempts
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 50 --nostream' | grep -i provision
```

---

## Phase 5: Domain Management (20-30 min)

### 5.1 Domain CRUD
- [ ] List domains (`GET /api/domains`)
- [ ] Register new domain (NameSilo API)
- [ ] Transfer domain
- [ ] Update domain contacts
- [ ] Renew domain
- [ ] Domain locking

### 5.2 DNS Management
- [ ] View DNS zones
- [ ] Create DNS record (A, CNAME, MX, TXT)
- [ ] Update DNS record
- [ ] Delete DNS record
- [ ] Import zone file
- [ ] Export zone file

**Test DNS Operations:**
```bash
# List domains
curl -s http://10.1.10.206:2271/api/domains \
  -H "Authorization: Bearer $TOKEN" | jq '.data | map({domain: .domain_name, status})'
```

---

## Phase 6: Email Management (15-20 min)

### 6.1 Email Accounts
- [ ] Create email account
- [ ] Update email quota
- [ ] Change email password
- [ ] Delete email account
- [ ] Email forwarding setup
- [ ] Auto-responder configuration

### 6.2 Email Services
- [ ] Mailbox usage stats
- [ ] Spam filter settings
- [ ] Email logs/tracking
- [ ] Webmail access

---

## Phase 7: Database Management (15-20 min)

### 7.1 Database Operations
- [ ] Create MySQL database
- [ ] Create database user
- [ ] Grant permissions
- [ ] Import database
- [ ] Backup database
- [ ] Delete database

**Test Database Creation:**
```bash
# Create test database
curl -X POST http://10.1.10.206:2271/api/databases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "websiteId": 1,
    "databaseName": "test_db",
    "username": "test_user"
  }'
```

---

## Phase 8: SSL Certificate Management (10-15 min)

### 8.1 SSL Operations
- [ ] List SSL certificates
- [ ] Issue Let's Encrypt certificate
- [ ] Upload custom certificate
- [ ] Auto-renewal verification
- [ ] Certificate expiry alerts

**Check SSL Status:**
```bash
# Check SSL certificates
curl -s http://10.1.10.206:2271/api/ssl/certificates \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Phase 9: Analytics & Reporting (20-25 min)

### 9.1 Dashboard Analytics
- [ ] Revenue statistics
- [ ] Customer growth metrics
- [ ] Active subscriptions count
- [ ] MRR (Monthly Recurring Revenue)
- [ ] Churn rate
- [ ] Resource usage graphs

### 9.2 Reports
- [ ] Generate revenue report
- [ ] Customer activity report
- [ ] Product performance report
- [ ] Export reports (CSV, PDF)

**Check Analytics:**
```bash
# Get dashboard stats
curl -s http://10.1.10.206:2271/api/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Phase 10: Support & Communication (15-20 min)

### 10.1 Support Tickets
- [ ] Create support ticket
- [ ] Reply to ticket
- [ ] Assign ticket to agent
- [ ] Close ticket
- [ ] Ticket priority management
- [ ] Internal notes

### 10.2 Email Templates
- [ ] View email templates
- [ ] Edit template
- [ ] Test template rendering
- [ ] Send test email

---

## Phase 11: AI Features (10-15 min)

### 11.1 AI Code Assistant
- [ ] Generate code snippet
- [ ] Fix code errors
- [ ] Explain code
- [ ] Code optimization suggestions

### 11.2 AI Analytics
- [ ] Revenue forecasting
- [ ] Churn prediction
- [ ] Customer insights
- [ ] Resource optimization

**Test AI Features:**
```bash
# Test AI code generation
curl -X POST http://10.1.10.206:2271/api/ai/code-gen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a React component for user profile",
    "language": "javascript"
  }'
```

---

## Phase 12: GraphQL API (10-15 min)

### 12.1 GraphQL Queries
- [ ] Query customers
- [ ] Query subscriptions
- [ ] Query invoices
- [ ] Nested queries

### 12.2 GraphQL Mutations
- [ ] Create customer
- [ ] Update subscription
- [ ] Process payment

**GraphQL Endpoint:**
```bash
# Test GraphQL query
curl -X POST http://10.1.10.206:2271/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ customers { id email } }"
  }'
```

---

## Phase 13: WebSocket Real-time Features (10 min)

### 13.1 Real-time Notifications
- [ ] Connect to WebSocket
- [ ] Receive notifications
- [ ] Presence indicators
- [ ] Live updates

**WebSocket Connection:**
```javascript
// In browser console or test script
const socket = io('http://10.1.10.206:2271', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('notification', (data) => {
  console.log('Notification:', data);
});
```

---

## Phase 14: White-Label & Branding (10 min)

### 14.1 Branding Settings
- [ ] Update company logo
- [ ] Change theme colors
- [ ] Custom domain setup
- [ ] Email sender customization
- [ ] Footer text

---

## Phase 15: API Key Management (5-10 min)

### 15.1 API Keys
- [ ] Create API key
- [ ] View API keys
- [ ] Revoke API key
- [ ] Test API key authentication

---

## Critical Issues to Check

### Known Issues to Verify:
1. **Provisioning Error:** "FOR UPDATE cannot be applied to the nullable side of an outer join"
   - Check: `src/services/provisioning/hosting.js`
   
2. **Missing Roles Table:** Some auth routes fail with "relation roles does not exist"
   - Check: Database migration status

3. **Coupon Usage Tracking:** Verify promo codes increment usage counter

---

## Testing Tools & Commands

### Quick Health Checks:
```bash
# Backend health
curl http://10.1.10.206:2271/api/health

# Database connection
ssh root@10.1.10.210 "sudo -u postgres psql -d mpanel -c 'SELECT COUNT(*) FROM users;'"

# PM2 status
ssh root@10.1.10.206 'pm2 status'

# Check logs for errors
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 100 --nostream' | grep -i error
```

### Database Queries:
```bash
# Check recent subscriptions
ssh root@10.1.10.210 "sudo -u postgres psql -d mpanel -c \"SELECT id, status, price, created_at FROM subscriptions ORDER BY created_at DESC LIMIT 5;\""

# Check promo code usage
ssh root@10.1.10.210 "sudo -u postgres psql -d mpanel -c \"SELECT code, current_uses, max_uses FROM promo_codes;\""

# Check domains
ssh root@10.1.10.210 "sudo -u postgres psql -d mpanel -c \"SELECT domain_name, status FROM domains ORDER BY created_at DESC LIMIT 5;\""
```

---

## Test Data Created

Keep track of test data:
- **Test Customers:** 
  - statustest@test.com
  - coupontest@example.com
  - finaltest@example.com
  
- **Test Subscriptions:** Multiple with coupons applied

- **Test Domains:** temp-*.migrahosting.com domains

---

## Success Criteria

### Must Work:
- ✅ Login/Authentication
- ✅ User/Customer CRUD
- ✅ Subscription creation
- ✅ Invoice generation
- ✅ Basic hosting operations
- ✅ Domain management
- ✅ API endpoints respond

### Should Work:
- ⚠️ Auto-provisioning (has known issue)
- ⚠️ Email notifications
- ⚠️ Webhooks
- ⚠️ Real-time features

### Nice to Have:
- 🔵 AI features
- 🔵 GraphQL
- 🔵 Advanced analytics
- 🔵 White-label features

---

## Issue Tracking Template

For each issue found, document:
```markdown
### Issue: [Short Description]
- **Module:** [Module name]
- **Endpoint/Page:** [API route or frontend page]
- **Steps to Reproduce:**
  1. Step 1
  2. Step 2
  3. Error occurs
- **Expected Behavior:** What should happen
- **Actual Behavior:** What actually happens
- **Error Message:** [Copy error from logs]
- **Priority:** Critical / High / Medium / Low
- **Status:** Open / In Progress / Fixed / Wontfix
```

---

## Estimated Time: 4-6 hours

**Recommended Approach:**
1. Start with Phase 1 (Authentication) - Critical foundation
2. Do Phase 2-3 (Users, Billing) - Core functionality
3. Test Phase 4-5 (Hosting, Domains) - Main features
4. Quick checks on remaining phases
5. Document all issues found
6. Prioritize fixes

---

*Ready to start testing? Begin with Phase 1: Authentication & Access Control*
