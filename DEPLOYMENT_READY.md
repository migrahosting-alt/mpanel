# 🎯 mPanel Production Deployment - Ready to Deploy!

**Status**: ✅ All deployment files prepared  
**Date**: November 14, 2025  
**Deployment Method**: Automated + Manual options  

---

## 📦 What's Been Prepared

### 1. Production Environment Template
- **File**: `.env.production.template`
- **Purpose**: Complete production environment configuration
- **Includes**: All 50+ environment variables with descriptions
- **Action Required**: Copy and fill in your actual values

### 2. Automated Deployment Script
- **File**: `deploy-production.sh`
- **Purpose**: One-command full deployment automation
- **Features**:
  - Installs all dependencies (Docker, Node.js, Nginx, Certbot)
  - Clones repository
  - Sets up infrastructure (PostgreSQL, Redis, MinIO)
  - Runs database migrations (130 tables)
  - Builds frontend
  - Starts backend with PM2
  - Configures Nginx + SSL
  - Sets up firewall
- **Runtime**: ~15-20 minutes
- **Difficulty**: Beginner-friendly

### 3. Security Secret Generator
- **File**: `generate-secrets.sh`
- **Purpose**: Generate cryptographically secure random values
- **Generates**:
  - JWT Secret (64 chars)
  - Encryption Key (32 chars)
  - API Token (64 chars hex)
  - Session Secret (64 chars)
  - Grafana Password (24 chars)
  - MinIO Access/Secret Keys
  - Database Password (24 chars)

### 4. Quick Start Guide
- **File**: `QUICKSTART_PRODUCTION.md`
- **Purpose**: Step-by-step deployment instructions
- **Includes**:
  - Automated deployment walkthrough
  - Manual deployment steps
  - Post-deployment configuration
  - Troubleshooting guide
  - Monitoring & maintenance tips

### 5. Detailed Deployment Guide
- **File**: `PRODUCTION_DEPLOY_NOW.md`
- **Purpose**: Comprehensive deployment reference
- **Includes**:
  - Detailed explanation of each step
  - Server requirements
  - All configuration examples
  - Testing scenarios
  - Health checks

### 6. Health Check Script
- **File**: `health-check.sh`
- **Purpose**: Verify production system health
- **Checks**:
  - Docker containers status
  - PM2 backend process
  - Nginx web server
  - API health endpoint
  - Disk space & memory
  - SSL certificates
  - Database & Redis connections
  - Recent error logs

---

## 🚀 Deployment Options

### Option A: Automated (Recommended)
**Perfect for**: Quick deployment, production servers

```bash
# 1. SSH into server
ssh root@your-server-ip

# 2. Download and run
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh
chmod +x deploy.sh
sudo bash deploy.sh

# 3. Configure .env when prompted
nano /var/www/mpanel/.env

# 4. Wait for completion (~15-20 min)
```

### Option B: Manual
**Perfect for**: Custom setups, learning the system

```bash
# Follow step-by-step guide
cat QUICKSTART_PRODUCTION.md
```

---

## ⚙️ Pre-Deployment Checklist

### Server Requirements
- [ ] Ubuntu 22.04 LTS (or compatible Linux)
- [ ] 4+ CPU cores
- [ ] 8GB+ RAM
- [ ] 100GB+ SSD storage
- [ ] Root/sudo access
- [ ] Ports 80, 443 open

### Domain & DNS
- [ ] Domain purchased (e.g., yourdomain.com)
- [ ] DNS A records configured:
  - `panel.yourdomain.com` → Server IP
  - `api.yourdomain.com` → Server IP
  - `monitoring.yourdomain.com` → Server IP (optional)
- [ ] DNS propagation complete (check with `dig`)

### Required Credentials

#### Stripe (Required for payments)
- [ ] Stripe account created
- [ ] Live API keys obtained:
  - Secret Key: `sk_live_...`
  - Publishable Key: `pk_live_...`
- [ ] Test mode working before going live

#### Email SMTP (Required for notifications)
- [ ] SMTP provider chosen (Gmail, SendGrid, AWS SES, Mailgun)
- [ ] SMTP credentials ready:
  - Host
  - Port
  - Username
  - Password

#### OpenAI (Optional - for AI features)
- [ ] OpenAI account created
- [ ] API key obtained: `sk-...`
- [ ] GPT-4 access confirmed

#### Twilio (Optional - for 2FA SMS)
- [ ] Twilio account created
- [ ] Account SID and Auth Token obtained
- [ ] Phone number purchased

---

## 🔐 Security Setup

### Generate Secure Secrets
```bash
# Run secret generator
bash generate-secrets.sh > production-secrets.txt

# Review generated values
cat production-secrets.txt

# Keep this file SECURE and delete after adding to .env
```

### Required Secrets
- [ ] `JWT_SECRET` - 64+ random characters
- [ ] `ENCRYPTION_KEY` - Exactly 32 characters
- [ ] `MPANEL_API_TOKEN` - 64 characters hex
- [ ] `SESSION_SECRET` - 64+ random characters
- [ ] Database password (strong, 24+ chars)
- [ ] MinIO access/secret keys
- [ ] Grafana admin password

---

## 📋 Deployment Steps

### Phase 1: Server Preparation (5 min)
```bash
# SSH into server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y
```

### Phase 2: Run Deployment Script (15 min)
```bash
# Download script
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh

# Make executable
chmod +x deploy.sh

# Run deployment
sudo bash deploy.sh
```

**The script will pause** to let you edit `.env` file:
```bash
cd /var/www/mpanel
nano .env
```

**Update these critical values:**
```env
# Stripe (LIVE keys)
STRIPE_SECRET_KEY=sk_live_YOUR_ACTUAL_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY

# Security
JWT_SECRET=YOUR_64_CHAR_SECRET_FROM_GENERATOR
ENCRYPTION_KEY=YOUR_32_CHAR_KEY_FROM_GENERATOR

# Database
DATABASE_URL=postgresql://mpanel_prod:SECURE_PASSWORD@localhost:5432/mpanel_production

# Email
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Admin
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=YOUR_SECURE_PASSWORD

# Domains
DOMAIN_PANEL=panel.yourdomain.com
DOMAIN_API=api.yourdomain.com

# OpenAI (optional)
OPENAI_API_KEY=sk-YOUR_OPENAI_KEY
```

Press `Ctrl+X`, then `Y`, then `Enter` to save.

Type `exit` or press Enter to continue deployment.

### Phase 3: Post-Deployment (5 min)

#### Verify Installation
```bash
# Check all services
docker compose ps
pm2 status
systemctl status nginx

# Run health check
bash health-check.sh
```

#### Configure Stripe Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://api.yourdomain.com/api/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy "Signing secret" (starts with `whsec_`)
6. Add to `.env`:
   ```bash
   nano /var/www/mpanel/.env
   # Update: STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
   ```
7. Restart backend:
   ```bash
   pm2 restart mpanel-backend
   ```

#### Test Installation
```bash
# API health
curl https://api.yourdomain.com/api/health

# Frontend
curl -I https://panel.yourdomain.com

# Expected: HTTP/2 200 OK
```

---

## ✅ Post-Deployment Testing

### 1. User Registration Flow
- [ ] Go to `https://panel.yourdomain.com`
- [ ] Click "Sign Up"
- [ ] Enter email, password, name
- [ ] Submit registration
- [ ] Check email for verification (check SMTP logs if not received)
- [ ] Verify email link works
- [ ] Login with credentials

### 2. 2FA Setup
- [ ] Login to dashboard
- [ ] Go to Settings → Security
- [ ] Enable 2FA
- [ ] Scan QR code with Google Authenticator
- [ ] Enter verification code
- [ ] Download backup codes

### 3. Stripe Integration
- [ ] Go to Billing → Payment Methods
- [ ] Add test card: `4242 4242 4242 4242`
- [ ] Expiry: Any future date
- [ ] CVC: Any 3 digits
- [ ] Submit payment method
- [ ] Verify it appears in dashboard
- [ ] Check Stripe dashboard for customer creation

### 4. Subscription Creation
- [ ] Go to Billing → Subscriptions
- [ ] Select a plan (Starter, Professional, Business)
- [ ] Confirm subscription
- [ ] Verify success message
- [ ] Check Stripe dashboard for subscription
- [ ] Verify webhook received (check backend logs)

### 5. API & GraphQL
- [ ] Access API docs: `https://api.yourdomain.com/api-docs`
- [ ] Test an endpoint (e.g., GET /api/products)
- [ ] Access GraphQL playground: `https://api.yourdomain.com/graphql`
- [ ] Run test query:
   ```graphql
   query {
     products {
       id
       name
       price
     }
   }
   ```

### 6. WebSocket Real-time
- [ ] Open browser console
- [ ] Check for WebSocket connection
- [ ] Create a test action (e.g., add product)
- [ ] Verify real-time notification appears

### 7. Monitoring
- [ ] Access Grafana: `https://monitoring.yourdomain.com`
- [ ] Login with admin credentials from .env
- [ ] Verify dashboards load
- [ ] Check metrics are being collected

---

## 🔧 Maintenance Commands

### View Logs
```bash
# Backend logs
pm2 logs mpanel-backend

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# Docker container logs
docker logs mpanel-postgres
docker logs mpanel-redis
docker logs mpanel-minio
```

### Restart Services
```bash
# Backend
pm2 restart mpanel-backend

# Nginx
systemctl restart nginx

# All Docker services
docker compose restart

# Specific service
docker restart mpanel-postgres
```

### Update mPanel
```bash
cd /var/www/mpanel
git pull origin main
npm install
cd frontend && npm install && npm run build && cd ..
pm2 restart mpanel-backend
```

### Database Backup
```bash
# Manual backup
docker exec mpanel-postgres pg_dump -U mpanel mpanel_production > backup_$(date +%Y%m%d).sql

# Compress
gzip backup_$(date +%Y%m%d).sql

# Restore from backup
gunzip backup_20251114.sql.gz
docker exec -i mpanel-postgres psql -U mpanel mpanel_production < backup_20251114.sql
```

---

## 🎯 Success Criteria

Your deployment is successful when:

✅ All Docker containers running (PostgreSQL, Redis, MinIO, Prometheus, Grafana)  
✅ Backend process online in PM2  
✅ Nginx serving frontend and proxying API  
✅ SSL certificates active (https:// working)  
✅ Users can register and login  
✅ 2FA working with Google Authenticator  
✅ Stripe payments processing  
✅ Webhooks receiving events  
✅ WebSocket connections active  
✅ GraphQL playground accessible  
✅ Monitoring dashboards showing data  
✅ API response time <100ms  
✅ Zero critical errors in logs  

---

## 🆘 Troubleshooting

### Common Issues

**Issue**: Backend won't start
```bash
# Check logs
pm2 logs mpanel-backend --lines 100

# Common causes:
# - Database URL incorrect
# - Redis not running
# - Port 3000 already in use
```

**Issue**: Frontend shows blank page
```bash
# Check build
ls -lh /var/www/mpanel/frontend/dist/

# Rebuild if needed
cd /var/www/mpanel/frontend
npm run build

# Check Nginx config
nginx -t
```

**Issue**: SSL not working
```bash
# Check certificates
certbot certificates

# Renew if needed
certbot renew --force-renewal
```

**Issue**: Stripe webhooks not received
```bash
# Check webhook logs
pm2 logs mpanel-backend | grep webhook

# Verify in Stripe dashboard
# Ensure STRIPE_WEBHOOK_SECRET matches
# Check firewall allows incoming webhooks
```

---

## 📞 Next Steps After Deployment

1. **Configure DNS**: Ensure all domains point to server
2. **Test thoroughly**: Go through all testing scenarios
3. **Set up backups**: Configure automated daily backups
4. **Monitor metrics**: Watch Grafana dashboards
5. **Invite users**: Start with beta testers
6. **Collect feedback**: Iterate based on real usage
7. **Scale infrastructure**: Add resources as needed

---

## 🎉 You're Ready to Deploy!

**Everything is prepared:**
- ✅ Deployment scripts ready
- ✅ Environment templates created
- ✅ Security secrets generator available
- ✅ Documentation complete
- ✅ Health check tools ready
- ✅ All 20 features production-ready

**To start deployment, run:**
```bash
ssh root@your-server-ip
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh
chmod +x deploy.sh
sudo bash deploy.sh
```

**Total time from start to live: ~30 minutes**

🚀 **Let's deploy mPanel and start testing with real data!**
