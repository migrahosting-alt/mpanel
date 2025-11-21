# mPanel - Quick Access Links & Credentials

**Last Updated**: November 17, 2025  
**Status**: ✅ All Systems Operational

---

## 🔗 Local Development URLs

### Backend API (Port 2271)
- **Main API**: http://127.0.0.1:2271
- **Health Check**: http://127.0.0.1:2271/api/health
- **Readiness Check**: http://127.0.0.1:2271/api/ready
- **Liveness Check**: http://127.0.0.1:2271/api/live
- **GraphQL Playground**: http://127.0.0.1:2271/graphql
- **Prometheus Metrics**: http://127.0.0.1:2271/metrics
- **WebSocket**: ws://127.0.0.1:2271/ws

### Frontend (Port 2272)
- **Admin Dashboard**: http://127.0.0.1:2272
- **Admin Login**: http://127.0.0.1:2272/admin/login
- **Client Portal**: http://127.0.0.1:2272/client/login

### Infrastructure Services
- **PostgreSQL**: localhost:5433
  - Database: `mpanel`
  - User: `mpanel`
  - Password: `mpanel`
  
- **Redis**: localhost:6380
  - No password (development)

- **MinIO (S3)**: http://localhost:9000
  - Console: http://localhost:9001
  - Access Key: `minioadmin`
  - Secret Key: `minioadmin`

- **Prometheus**: http://localhost:2273
  - Metrics collection and monitoring

- **Grafana**: http://localhost:2274
  - Username: `admin`
  - Password: `admin`

- **Loki**: http://localhost:2275
  - Log aggregation (no UI, query via Grafana)

---

## 👤 Test Credentials

### Super Admin Account
```
Email: admin@mpanel.local
Password: Admin123!@#
Role: super_admin (level 0)
Tenant: System Admin
```

### Test Admin Account
```
Email: test@migrahosting.com
Password: Test123!@#
Role: admin (level 1)
Tenant: Demo Tenant
```

### Test Client Account
```
Email: client@example.com
Password: Client123!@#
Role: client (level 7)
Tenant: Demo Tenant
```

---

## 🔑 API Access

### Admin API (JWT Authentication)
```bash
# Login to get JWT token
curl -X POST http://localhost:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mpanel.local",
    "password": "Admin123!@#"
  }'

# Use token in subsequent requests
curl http://localhost:2271/api/customers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### Marketing API (API Key Authentication)
```bash
# First create an API key via admin panel or SQL
# INSERT INTO api_keys (name, key_hash, scope, tenant_id) VALUES...

# Then use it
curl -X GET http://localhost:2271/api/marketing-api/products/catalog \
  -H "X-API-Key: YOUR_MARKETING_API_KEY"
```

**Note**: Marketing API keys must be created first. See "Creating Marketing API Key" section below.

---

## 📋 API Endpoints Reference

### Core API Endpoints (272+ total)

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

#### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

#### Hosting Services
- `GET /api/services` - List hosting services
- `POST /api/services` - Create service
- `GET /api/services/:id` - Get service details
- `POST /api/services/:id/suspend` - Suspend service
- `POST /api/services/:id/unsuspend` - Unsuspend service
- `POST /api/services/:id/terminate` - Terminate service

#### Billing
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/invoices/:id` - Get invoice details
- `POST /api/invoices/:id/send` - Send invoice email
- `POST /api/invoices/:id/pay` - Record payment

#### DNS Management
- `GET /api/dns/zones` - List DNS zones
- `POST /api/dns/zones` - Create DNS zone
- `GET /api/dns/zones/:id/records` - List DNS records
- `POST /api/dns/zones/:id/records` - Create DNS record
- `DELETE /api/dns/records/:id` - Delete DNS record

#### Email Services
- `GET /api/email/accounts` - List email accounts
- `POST /api/email/accounts` - Create email account
- `GET /api/email/forwarders` - List email forwarders
- `POST /api/email/forwarders` - Create forwarder

#### Databases
- `GET /api/databases` - List databases
- `POST /api/databases` - Create database
- `GET /api/databases/:id` - Get database details
- `DELETE /api/databases/:id` - Delete database

#### Servers
- `GET /api/servers` - List servers
- `POST /api/servers` - Add server
- `GET /api/servers/:id` - Get server details
- `GET /api/servers/:id/metrics` - Get server metrics

#### AI Features
- `POST /api/ai/generate-code` - Generate code
- `POST /api/ai/debug-code` - Debug code
- `POST /api/ai/explain-code` - Explain code
- `POST /api/ai/optimize-query` - Optimize SQL query
- `POST /api/ai/forecast-resources` - Resource forecasting
- `POST /api/ai/predict-churn` - Churn prediction

#### WebSockets
- `GET /api/websocket/presence` - Get online users
- `POST /api/websocket/broadcast` - Broadcast message

#### RBAC
- `GET /api/rbac/roles` - List roles
- `POST /api/rbac/roles` - Create role
- `GET /api/rbac/permissions` - List permissions
- `POST /api/rbac/roles/:id/permissions` - Assign permissions

---

## 🚀 Marketing API Endpoints (18 total)

### Account Management
- `POST /api/marketing-api/accounts/create` - Create customer account
- `POST /api/marketing-api/services/provision` - Provision hosting service

### Reporting
- `GET /api/marketing-api/reports/revenue` - Revenue metrics
- `GET /api/marketing-api/reports/customers` - Customer acquisition metrics
- `GET /api/marketing-api/reports/usage` - Usage statistics

### Product Catalog
- `GET /api/marketing-api/products/catalog` - Get product catalog
- `GET /api/marketing-api/products/:id/availability` - Check stock

### Customer Services
- `GET /api/marketing-api/customers/:id/services` - List customer services
- `POST /api/marketing-api/services/:id/upgrade` - Upgrade service plan

### System Status
- `GET /api/marketing-api/status/system` - System health status

### Webhooks
- `POST /api/marketing-api/webhooks/register` - Register webhook
- `GET /api/marketing-api/webhooks` - List webhooks
- `DELETE /api/marketing-api/webhooks/:id` - Delete webhook

### Admin (API Key Management)
- `POST /api/marketing-api/admin/api-keys` - Create API key
- `GET /api/marketing-api/admin/api-keys` - List API keys
- `DELETE /api/marketing-api/admin/api-keys/:id` - Revoke API key

---

## 🛠️ Quick Commands

### Start Backend Server
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
npm run dev
```

### Start Frontend
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel/frontend
npm run dev
```

### Start All Infrastructure
```bash
docker compose up -d
```

### Check Service Status
```bash
# Backend health
curl http://localhost:2271/api/health | jq

# Check all ports
lsof -i :2271 -i :2272 -i :5433 -i :6380 -i :9000 | grep LISTEN
```

### Run Database Migrations
```bash
npm run migrate
```

### Create Admin User
```bash
# Using SQL script
psql -U mpanel -d mpanel -h localhost -p 5433 -f create-admin-user.sql

# Or manually
npm run create-admin
```

---

## 🔐 Creating Marketing API Key

### Via SQL (Quick Method)
```sql
-- Connect to database
psql -U mpanel -d mpanel -h localhost -p 5433

-- Create API key
INSERT INTO api_keys (
  name, 
  key_hash, 
  scope, 
  tenant_id,
  created_at,
  expires_at
) VALUES (
  'Marketing Website',
  -- SHA-256 hash of 'mk_test_key_12345' (use this key in your requests)
  encode(digest('mk_test_key_12345', 'sha256'), 'hex'),
  'marketing',
  (SELECT id FROM tenants LIMIT 1),
  NOW(),
  NOW() + INTERVAL '1 year'
);

-- Get the ID
SELECT id, name, scope, created_at FROM api_keys WHERE name = 'Marketing Website';
```

**Test API Key**: `mk_test_key_12345` (hash stored in database)

### Via Admin Panel (Recommended for Production)
1. Login to admin panel: http://127.0.0.1:2272/admin/login
2. Navigate to Settings → API Keys
3. Click "Create API Key"
4. Enter name: "Marketing Website"
5. Select scope: "Marketing"
6. Copy the generated key (shown only once!)

---

## 📊 Test the System

### Health Check
```bash
curl http://localhost:2271/api/health | jq
```

**Expected Response**:
```json
{
  "status": "healthy",
  "version": "v1",
  "uptime": 300,
  "uptimeHuman": "5m 0s",
  "features": ["billing", "hosting", "dns", "email", ...]
}
```

### Test Marketing API
```bash
# Test authentication (should fail without key)
curl http://localhost:2271/api/marketing-api/status/system

# Expected: {"error":"API key required"}

# Test with API key (after creating one)
curl -H "X-API-Key: mk_test_key_12345" \
  http://localhost:2271/api/marketing-api/products/catalog | jq
```

### Test Admin Login
```bash
curl -X POST http://localhost:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@mpanel.local",
    "password": "Admin123!@#"
  }' | jq
```

**Expected Response**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@mpanel.local",
    "role": "super_admin"
  }
}
```

### Test GraphQL
```bash
curl -X POST http://localhost:2271/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ __schema { types { name } } }"
  }' | jq
```

### Test WebSocket
```javascript
// In browser console
const ws = new WebSocket('ws://127.0.0.1:2271/ws');
ws.onopen = () => console.log('Connected');
ws.onmessage = (msg) => console.log('Message:', msg.data);
```

---

## 📝 Database Access

### PostgreSQL Connection String
```
postgresql://mpanel:mpanel@localhost:5433/mpanel
```

### Connect via psql
```bash
psql -U mpanel -d mpanel -h localhost -p 5433
```

### Common Queries
```sql
-- List all customers
SELECT id, email, first_name, last_name, created_at FROM customers LIMIT 10;

-- List all services
SELECT id, customer_id, type, status, created_at FROM services LIMIT 10;

-- Check API keys
SELECT id, name, scope, created_at, expires_at FROM api_keys;

-- List all tenants
SELECT id, name, status, created_at FROM tenants;

-- Check user roles
SELECT u.email, r.name as role, r.level 
FROM users u 
JOIN roles r ON u.role_id = r.id
LIMIT 10;
```

---

## 🎯 Complete Feature List (27 Features)

### Core Features (12)
1. ✅ Billing & Invoicing
2. ✅ Hosting Management
3. ✅ DNS Management
4. ✅ Email Services
5. ✅ Database Management
6. ✅ SMS Notifications
7. ✅ Webhook System
8. ✅ AI Integration (OpenAI GPT-4)
9. ✅ GraphQL API
10. ✅ WebSocket Real-time
11. ✅ White-Label Branding
12. ✅ RBAC (Role-Based Access Control)

### Advanced Features (15)
13. ✅ Multi-Tenancy
14. ✅ Connection Pooling
15. ✅ Redis Caching
16. ✅ Queue System (Bull)
17. ✅ Rate Limiting
18. ✅ API Versioning
19. ✅ Prometheus Metrics
20. ✅ Grafana Dashboards
21. ✅ Loki Log Aggregation
22. ✅ Health Monitoring
23. ✅ Worker Pool (15 workers)
24. ✅ Memory Leak Detection
25. ✅ Database Health Checks
26. ✅ Graceful Shutdown
27. ✅ Marketing API Integration

---

## 🔗 Documentation Files

- **Main README**: `README.md`
- **Architecture**: `ARCHITECTURE.md`
- **API Examples**: `API_EXAMPLES.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **Quick Start**: `QUICKSTART.md`
- **Marketing API**: `MARKETING_API_INTEGRATION.md`
- **Marketing Website Copilot**: `MARKETING_WEBSITE_COPILOT_INSTRUCTIONS.md`
- **Pre-Deployment Audit**: `PRE_DEPLOYMENT_AUDIT_CHECKLIST.md`
- **Completion Summary**: `100_PERCENT_COMPLETE.md`

---

## 🚨 Troubleshooting

### Backend won't start
```bash
# Check if port is in use
lsof -i :2271

# Kill existing process
lsof -ti :2271 | xargs kill -9

# Restart
npm run dev
```

### Database connection issues
```bash
# Check PostgreSQL is running
docker compose ps

# Restart PostgreSQL
docker compose restart postgres

# Check logs
docker compose logs postgres
```

### Redis connection issues
```bash
# Check Redis is running
docker compose ps

# Test Redis connection
redis-cli -p 6380 ping

# Should respond: PONG
```

### Can't login to admin panel
```bash
# Reset admin password
psql -U mpanel -d mpanel -h localhost -p 5433 -f reset-admin.sql
```

---

## 📞 Support

- **GitHub Repository**: https://github.com/migrahosting-alt/mpanel
- **Documentation**: See `docs/` folder
- **Issue Tracker**: GitHub Issues
- **Local Development**: This file!

---

**🎉 Everything is ready for local development and testing!**

**Quick Test Checklist**:
- ✅ Backend API: http://127.0.0.1:2271/api/health
- ✅ Frontend: http://127.0.0.1:2272
- ✅ GraphQL: http://127.0.0.1:2271/graphql
- ✅ Prometheus: http://localhost:2273
- ✅ Grafana: http://localhost:2274
- ✅ Marketing API: Requires API key creation first

**Next Steps**:
1. Create marketing API key (see "Creating Marketing API Key" section)
2. Test all endpoints using the examples above
3. Deploy to production when ready: `sudo bash deploy-production.sh`
