# 🚀 mPanel Production Deployment Guide - LIVE SERVER

**Target**: Real production server with live data testing  
**Date**: November 14, 2025  
**Status**: Ready to Deploy  

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Server Requirements
- [ ] Ubuntu 22.04 LTS or similar Linux server
- [ ] 4+ CPU cores, 8GB+ RAM, 100GB+ SSD
- [ ] Root/sudo access
- [ ] Domain name pointed to server IP
- [ ] Ports 80, 443, 5432, 6379, 9000 open

### Required Credentials
- [ ] Stripe API keys (live mode)
- [ ] OpenAI API key (GPT-4 access)
- [ ] Email service credentials (SMTP)
- [ ] Domain and DNS access
- [ ] SSL certificate (Let's Encrypt recommended)

---

## 🎯 QUICK DEPLOYMENT (30 Minutes)

### Step 1: Prepare Server (5 minutes)

```bash
# SSH into your server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install docker-compose-plugin -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 for process management
npm install -g pm2
```

### Step 2: Clone and Setup (5 minutes)

```bash
# Clone the repository
cd /var/www
git clone https://github.com/migrahosting-alt/mpanel.git
cd mpanel

# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### Step 3: Configure Environment (5 minutes)

```bash
# Create production .env file
cp .env.example .env
nano .env
```

**Required .env Configuration:**

```env
# Application
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://panel.yourdomain.com
CORS_ORIGIN=https://panel.yourdomain.com

# Database
DATABASE_URL=postgresql://mpanel:YOUR_SECURE_PASSWORD@localhost:5432/mpanel_production
REDIS_URL=redis://localhost:6379

# JWT & Security
JWT_SECRET=YOUR_ULTRA_SECURE_RANDOM_STRING_MIN_64_CHARS
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=YOUR_32_BYTE_ENCRYPTION_KEY

# Stripe (LIVE keys)
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# MinIO/S3
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=YOUR_MINIO_ACCESS_KEY
MINIO_SECRET_KEY=YOUR_MINIO_SECRET_KEY
MINIO_BUCKET=mpanel-production

# OpenAI (for AI features)
OPENAI_API_KEY=sk-YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4

# Email (SMTP)
SMTP_HOST=smtp.yourmailprovider.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=YOUR_SMTP_PASSWORD
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=mPanel

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ADMIN_PASSWORD=YOUR_GRAFANA_PASSWORD

# OAuth (optional, for integrations)
OAUTH_CLIENT_ID=YOUR_OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=YOUR_OAUTH_CLIENT_SECRET

# Admin User (first user)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YOUR_SECURE_ADMIN_PASSWORD
```

### Step 4: Start Infrastructure (5 minutes)

```bash
# Start PostgreSQL, Redis, MinIO, Prometheus, Grafana
docker-compose up -d

# Wait for services to be ready
sleep 10

# Verify all services are running
docker-compose ps
```

Expected output:
```
NAME                COMMAND                  SERVICE             STATUS
mpanel-postgres     "docker-entrypoint.s…"   postgres            Up
mpanel-redis        "docker-entrypoint.s…"   redis               Up
mpanel-minio        "/usr/bin/docker-ent…"   minio               Up
mpanel-prometheus   "/bin/prometheus --c…"   prometheus          Up
mpanel-grafana      "/run.sh"                grafana             Up
mpanel-loki         "/usr/bin/loki -conf…"   loki                Up
```

### Step 5: Database Setup (3 minutes)

```bash
# Run Prisma migrations to create all 130 tables
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed initial data (optional)
npm run seed

# Create admin user
node scripts/create-admin.js
```

### Step 6: Build Frontend (3 minutes)

```bash
cd frontend

# Build production bundle
npm run build

# Verify build
ls -lh dist/
```

### Step 7: Start Backend (2 minutes)

```bash
cd /var/www/mpanel

# Start with PM2
pm2 start src/server.js --name mpanel-backend

# Enable auto-restart on reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs mpanel-backend --lines 50
```

### Step 8: Configure Nginx (5 minutes)

```bash
# Install Nginx
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx configuration
nano /etc/nginx/sites-available/mpanel
```

**Nginx Configuration:**

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name panel.yourdomain.com;

    root /var/www/mpanel/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Grafana (monitoring)
server {
    listen 80;
    server_name monitoring.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**Enable site and get SSL:**

```bash
# Enable site
ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificates (automatic)
certbot --nginx -d api.yourdomain.com -d panel.yourdomain.com -d monitoring.yourdomain.com

# Verify SSL renewal
certbot renew --dry-run
```

### Step 9: Configure Firewall (2 minutes)

```bash
# Install UFW
apt install -y ufw

# Allow required ports
ufw allow ssh
ufw allow http
ufw allow https

# Enable firewall
ufw --force enable
ufw status
```

---

## ✅ VERIFICATION CHECKLIST

### Infrastructure Check
```bash
# Check all Docker containers
docker-compose ps

# Check PostgreSQL
docker exec -it mpanel-postgres psql -U mpanel -d mpanel_production -c "SELECT version();"

# Check Redis
docker exec -it mpanel-redis redis-cli ping

# Check MinIO
curl http://localhost:9000/minio/health/live
```

### Backend Check
```bash
# Check PM2 process
pm2 status

# View logs
pm2 logs mpanel-backend --lines 100

# Test API health
curl https://api.yourdomain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-14T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "minio": "connected"
  }
}
```

### Frontend Check
```bash
# Check Nginx
systemctl status nginx

# Test frontend
curl -I https://panel.yourdomain.com
```

Expected: `HTTP/2 200`

### Full System Test
```bash
# Test user registration endpoint
curl -X POST https://api.yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "name": "Test User"
  }'

# Test GraphQL endpoint
curl -X POST https://api.yourdomain.com/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "{ __schema { types { name } } }"
  }'
```

---

## 🔥 CRITICAL POST-DEPLOYMENT

### 1. Test Stripe Integration

```bash
# Test Stripe webhook endpoint
curl -X POST https://api.yourdomain.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"type": "payment_intent.succeeded"}'
```

### 2. Configure Stripe Webhook in Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://api.yourdomain.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `customer.subscription.created`, etc.
4. Copy webhook secret to `.env` as `STRIPE_WEBHOOK_SECRET`

### 3. Test 2FA Setup

```bash
# Login via frontend: https://panel.yourdomain.com
# Go to Settings > Security > Enable 2FA
# Scan QR code with Google Authenticator
# Verify TOTP code works
```

### 4. Monitor System

```bash
# Access Grafana
# https://monitoring.yourdomain.com
# Login: admin / YOUR_GRAFANA_PASSWORD

# Check Prometheus targets
# https://monitoring.yourdomain.com:9090/targets
```

### 5. Create First Real User

```bash
# Via frontend
1. Go to https://panel.yourdomain.com
2. Click "Sign Up"
3. Enter email, password, name
4. Verify email (check SMTP logs)
5. Login and explore dashboard
```

---

## 🎯 REAL DATA TESTING SCENARIOS

### Test 1: Complete User Onboarding Flow
- [ ] Register new user
- [ ] Verify email confirmation
- [ ] Login with credentials
- [ ] Enable 2FA
- [ ] Update profile

### Test 2: Billing & Stripe Integration
- [ ] Add payment method (test card: 4242 4242 4242 4242)
- [ ] Create subscription (select plan)
- [ ] Verify Stripe webhook received
- [ ] Check invoice generation
- [ ] Test usage metering

### Test 3: Hosting Features
- [ ] Create website
- [ ] Add domain
- [ ] Configure DNS records
- [ ] Upload files to MinIO
- [ ] Create database (PostgreSQL/MySQL)
- [ ] Set up email mailbox

### Test 4: Advanced Features
- [ ] Test AI code generation endpoint
- [ ] Create serverless function
- [ ] Set up webhook integration
- [ ] Configure white-label branding
- [ ] Test GraphQL playground
- [ ] WebSocket real-time notifications

### Test 5: Monitoring & Performance
- [ ] Check Grafana dashboards
- [ ] Verify Prometheus metrics
- [ ] Review Loki logs
- [ ] Test API response times (<100ms)
- [ ] Monitor resource usage

---

## 🐛 TROUBLESHOOTING

### Backend Won't Start

```bash
# Check logs
pm2 logs mpanel-backend

# Common issues:
# 1. Database connection - verify DATABASE_URL
# 2. Redis connection - check REDIS_URL
# 3. Port already in use - netstat -tlnp | grep 3000
```

### Frontend Shows Blank Page

```bash
# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Verify build exists
ls -lh /var/www/mpanel/frontend/dist/

# Check Nginx config
nginx -t
```

### Database Connection Failed

```bash
# Check PostgreSQL
docker logs mpanel-postgres

# Test connection
docker exec -it mpanel-postgres psql -U mpanel -d mpanel_production

# Reset if needed
docker-compose down -v
docker-compose up -d
npx prisma migrate deploy
```

### Stripe Webhooks Not Working

```bash
# Check webhook logs
pm2 logs mpanel-backend | grep stripe

# Verify endpoint in Stripe dashboard
# Verify STRIPE_WEBHOOK_SECRET is correct
# Check firewall allows incoming webhooks
```

---

## 📊 MONITORING & MAINTENANCE

### Daily Checks

```bash
# System health
pm2 status
docker-compose ps
df -h  # Disk space
free -h  # Memory

# Application logs
pm2 logs mpanel-backend --lines 100

# Error rate
curl https://api.yourdomain.com/api/metrics | grep error_rate
```

### Weekly Backups

```bash
# Database backup
docker exec mpanel-postgres pg_dump -U mpanel mpanel_production > backup_$(date +%Y%m%d).sql

# Upload to S3/MinIO
aws s3 cp backup_$(date +%Y%m%d).sql s3://mpanel-backups/

# Retention: Keep 7 daily, 4 weekly, 12 monthly
```

### Performance Monitoring

```bash
# API response time
curl -w "@-" -o /dev/null -s https://api.yourdomain.com/api/health << EOF
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

---

## 🎉 SUCCESS CRITERIA

**Your mPanel deployment is successful when:**

✅ All services running (PostgreSQL, Redis, MinIO, Backend, Frontend)  
✅ SSL certificates active (https://)  
✅ Users can register and login  
✅ 2FA working (TOTP)  
✅ Stripe payments processing  
✅ Webhooks receiving events  
✅ WebSocket connections active  
✅ GraphQL playground accessible  
✅ Monitoring dashboards live  
✅ API response time <100ms  
✅ Zero error logs  

---

## 🚀 PRODUCTION ROLLOUT

### Soft Launch (Week 1)
- [ ] Invite 10 beta users
- [ ] Monitor error rates
- [ ] Collect feedback
- [ ] Fix critical bugs

### Public Launch (Week 2)
- [ ] Product Hunt launch
- [ ] Social media announcement
- [ ] Enable public registrations
- [ ] Monitor scaling

### Post-Launch (Week 3+)
- [ ] Scale infrastructure as needed
- [ ] Add more monitoring
- [ ] Implement feature requests
- [ ] Optimize performance

---

## 📞 SUPPORT & RESOURCES

- **Documentation**: https://github.com/migrahosting-alt/mpanel
- **API Docs**: https://api.yourdomain.com/api-docs
- **GraphQL Playground**: https://api.yourdomain.com/graphql
- **Monitoring**: https://monitoring.yourdomain.com
- **Status Page**: Consider setting up status.yourdomain.com

---

**🎊 Ready to Deploy!**

Execute these commands in order, test thoroughly, and mPanel will be live with real production data!

**Estimated Total Time**: 30-45 minutes  
**Difficulty**: Intermediate  
**Result**: Production-ready mPanel installation  

🚀 **Let's go live!**
