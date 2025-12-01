# 🚀 Quick Start Guide - mPanel TypeScript Backend

## Prerequisites Check

Before starting, verify you have:
- ✅ PostgreSQL running on 10.1.10.210
- ✅ Redis running on 10.1.10.206  
- ✅ PowerDNS API at 10.1.10.102:8081
- ✅ SSH access to srv1-web (10.1.10.10)
- ✅ Node.js v18+ installed

---

## Local Development Setup

### 1. Environment Configuration

Create `.env` file in `/migra-panel/`:

```bash
# Database
DATABASE_URL="postgresql://mpanel_user:your_password@10.1.10.210:5432/mpanel"
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_URL="redis://10.1.10.206:6379"

# JWT (generate secure random string)
JWT_SECRET="$(openssl rand -base64 48)"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# API Keys
MARKETING_WEBHOOK_SECRET="$(openssl rand -base64 32)"
POWERDNS_API_URL="http://10.1.10.102:8081/api/v1"
POWERDNS_API_KEY="your-powerdns-api-key"

# Server
HOST="0.0.0.0"
PORT=2271
NODE_ENV="development"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Install Dependencies

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
npm install
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Run Database Migrations

```bash
# Development (creates migration)
npx prisma migrate dev --name init

# OR Production (applies existing migrations)
npx prisma migrate deploy
```

### 5. Verify TypeScript Compilation

```bash
npx tsc --noEmit
# Expected: No errors ✅
```

### 6. Start Development Server

```bash
npm run dev
```

You should see:
```
✓ Server listening on http://0.0.0.0:2271
✓ WebSocket ready at ws://0.0.0.0:2271/ws
✓ GraphQL API at http://0.0.0.0:2271/graphql
✓ Prometheus metrics at http://0.0.0.0:2271/metrics
✓ Health checks: /api/health, /api/ready, /api/live
✓ NEW TypeScript APIs: /api/auth, /api/products, /api/orders
✓ Provisioning worker processing jobs...
```

---

## Testing the Backend

### 1. Health Check

```bash
curl http://localhost:2271/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "database": {
    "healthy": true,
    "latencyMs": 5
  }
}
```

### 2. List Products (Public Endpoint)

```bash
curl http://localhost:2271/api/public/products
```

Expected: Array of active products with prices

### 3. Create Test User (via Prisma Studio)

```bash
npx prisma studio
```

In Prisma Studio (http://localhost:5555):
1. Go to `User` model
2. Click "Add record"
3. Fill in:
   - email: `admin@migrahosting.com`
   - passwordHash: (use bcrypt hash - see below)
   - displayName: `Admin User`
   - role: `SUPER_ADMIN`
   - tenantId: (your tenant ID)
   - isActive: `true`

Generate password hash:
```bash
node -e "console.log(require('bcrypt').hashSync('your-password', 12))"
```

### 4. Test Login

```bash
curl -X POST http://localhost:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@migrahosting.com",
    "password": "your-password"
  }'
```

Expected response:
```json
{
  "token": "eyJhbGc...",
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "admin@migrahosting.com",
    "displayName": "Admin User",
    "role": "SUPER_ADMIN",
    "tenantId": "...",
    "isActive": true
  }
}
```

Save the `accessToken` for next steps!

### 5. Get Current User Info

```bash
curl http://localhost:2271/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 6. Create Test Product (Admin)

```bash
curl -X POST http://localhost:2271/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "tenantId": "YOUR_TENANT_ID",
    "name": "Starter Hosting",
    "slug": "starter-hosting",
    "description": "Perfect for small websites",
    "type": "HOSTING",
    "isActive": true,
    "prices": [
      {
        "interval": "MONTHLY",
        "amount": 999,
        "currency": "USD",
        "isActive": true,
        "limitsJson": {
          "storage": 10,
          "bandwidth": 100,
          "emails": 5
        }
      }
    ]
  }'
```

### 7. Test Order Creation (Marketing Webhook)

```bash
curl -X POST http://localhost:2271/api/orders \
  -H "Content-Type: application/json" \
  -H "x-internal-key: YOUR_MARKETING_WEBHOOK_SECRET" \
  -d '{
    "tenantSlug": "migrahosting",
    "priceId": "PRICE_ID_FROM_STEP_6",
    "customerEmail": "test@example.com",
    "customerName": "Test Customer",
    "stripePaymentIntentId": "pi_test_123456",
    "totalAmount": 999,
    "domain": "testsite.com"
  }'
```

Expected response:
```json
{
  "success": true,
  "order": {
    "id": "...",
    "status": "PAID",
    "totalAmount": 999,
    ...
  },
  "subscription": {
    "id": "...",
    "status": "INACTIVE",
    ...
  },
  "jobs": [
    { "id": "...", "type": "PROVISION_DNS", "status": "PENDING" },
    { "id": "...", "type": "PROVISION_HOSTING", "status": "PENDING" },
    { "id": "...", "type": "PROVISION_MAIL", "status": "PENDING" }
  ]
}
```

### 8. Monitor Job Processing

Check server logs:
```bash
# In another terminal
tail -f logs/app.log  # or wherever your logs go

# Or watch PM2 logs in production
pm2 logs tenant-billing --lines 100
```

Look for:
```
[INFO] Processing job: PROVISION_DNS for domain testsite.com
[INFO] DNS zone created successfully: testsite.com
[INFO] Processing job: PROVISION_HOSTING for domain testsite.com
[INFO] Hosting account created successfully: testsite.com
[INFO] Subscription activated: subscription-id
```

### 9. Verify Provisioning

**DNS:**
```bash
curl -X GET http://10.1.10.102:8081/api/v1/servers/localhost/zones/testsite.com. \
  -H "X-API-Key: YOUR_POWERDNS_API_KEY"
```

**Hosting:**
```bash
ssh mhadmin@10.1.10.10 \
  "ls -la /srv/web/clients/testsite.com/public/"
```

**Database:**
```bash
# In Prisma Studio or via SQL
SELECT * FROM "Subscription" WHERE "status" = 'ACTIVE';
```

---

## Production Deployment

### 1. Pre-Deployment Checklist

- [ ] All TypeScript compiles: `npx tsc --noEmit`
- [ ] Environment variables configured on production
- [ ] Database backup created
- [ ] PM2 installed on production server

### 2. Deploy

```bash
./deploy-backend-ts.sh
```

The script will:
1. Generate Prisma client locally
2. Type-check TypeScript
3. rsync files to production
4. Install dependencies on production
5. Generate Prisma client on production
6. Run database migrations
7. Restart PM2 process
8. Show logs

### 3. Verify Production Deployment

```bash
# Health check
curl http://10.1.10.206:2271/api/health

# Products endpoint
curl http://10.1.10.206:2271/api/public/products

# Check logs
ssh mhadmin@10.1.10.206 'pm2 logs tenant-billing --lines 50'
```

---

## Troubleshooting

### TypeScript Compilation Errors

```bash
# Clear generated files
rm -rf node_modules dist
npm install
npx prisma generate
npx tsc --noEmit
```

### Prisma Client Issues

```bash
# Regenerate client
npx prisma generate

# Reset database (CAUTION: deletes all data)
npx prisma migrate reset
```

### Worker Not Processing Jobs

Check Redis connection:
```bash
redis-cli -h 10.1.10.206 ping
# Expected: PONG
```

Check queue depth:
```bash
redis-cli -h 10.1.10.206
> LLEN queue:provisioning
```

### PowerDNS API Errors

Test API directly:
```bash
curl http://10.1.10.102:8081/api/v1/servers/localhost \
  -H "X-API-Key: YOUR_API_KEY"
```

### SSH Provisioning Fails

Test SSH connection:
```bash
ssh mhadmin@10.1.10.10 'echo "SSH working"'
```

Check directory permissions:
```bash
ssh mhadmin@10.1.10.10 \
  'ls -ld /srv/web/clients'
```

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server (watch mode)
npm run start:ts         # Start server with tsx
npx prisma studio        # Open database GUI

# Database
npx prisma migrate dev   # Create new migration
npx prisma migrate deploy # Apply migrations
npx prisma generate      # Generate client
npx prisma db push       # Push schema (skip migrations)

# Production
./deploy-backend-ts.sh   # Full deployment
ssh mhadmin@10.1.10.206 'pm2 logs tenant-billing'
ssh mhadmin@10.1.10.206 'pm2 restart tenant-billing'
ssh mhadmin@10.1.10.206 'pm2 monit'

# Redis
redis-cli -h 10.1.10.206
> KEYS *
> LLEN queue:provisioning
> LRANGE queue:provisioning 0 -1
> FLUSHALL  # CAUTION: Deletes all data

# Database
psql -h 10.1.10.210 -U mpanel_user -d mpanel
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ Yes | - | PostgreSQL connection string |
| `DATABASE_POOL_MIN` | No | 5 | Min pool connections |
| `DATABASE_POOL_MAX` | No | 20 | Max pool connections |
| `REDIS_URL` | ✅ Yes | - | Redis connection string |
| `JWT_SECRET` | ✅ Yes | - | JWT signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRY` | No | 15m | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | No | 7d | Refresh token lifetime |
| `MARKETING_WEBHOOK_SECRET` | ✅ Yes | - | Marketing site webhook auth |
| `POWERDNS_API_URL` | ✅ Yes | - | PowerDNS API base URL |
| `POWERDNS_API_KEY` | ✅ Yes | - | PowerDNS API key |
| `HOST` | No | 0.0.0.0 | Server bind address |
| `PORT` | No | 2271 | Server port |
| `NODE_ENV` | No | development | Environment (development/production) |

---

## Next Steps

1. ✅ **Backend Complete** - All modules implemented
2. ⏳ **Deploy to Production** - Run `./deploy-backend-ts.sh`
3. ⏳ **Integrate Marketing Site** - Connect to `/api/orders`
4. ⏳ **Write Tests** - Unit + integration tests
5. ⏳ **Monitor Production** - Watch logs, metrics, errors

---

**Need Help?**
- Check `BACKEND_COMPLETE.md` for full documentation
- Review `BACKEND_IMPLEMENTATION_STATUS.md` for implementation details
- Inspect logs: `pm2 logs tenant-billing`
- Open Prisma Studio: `npx prisma studio`

🎉 **Happy Coding!**
