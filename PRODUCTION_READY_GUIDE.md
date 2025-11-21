# 🚀 mPanel Production Deployment Guide

## Overview

This guide will get mPanel running on your live server in **production mode**, exactly as it should run in production.

## Quick Start Options

### Option 1: Full Production Setup (Recommended)
**Includes**: PostgreSQL, Redis, MinIO, Monitoring (Grafana, Prometheus)

```bash
# Run the automated setup
bash setup-production-ready.sh

# Start all services
bash start-all.sh
```

### Option 2: Quick Test (No Docker)
**For testing only** - Limited features without database

```bash
bash quick-start.sh
```

---

## Prerequisites

### Required
- **Node.js 20+** ✓ (You have v22.21.1)
- **npm** ✓ (You have v10.9.4)
- **10GB+ disk space** ✓ (You have 936GB)
- **4GB+ RAM** ✓ (You have 31GB)

### Optional (but recommended for production)
- **Docker Desktop** (for PostgreSQL, Redis, MinIO, monitoring)
  - **WSL2 Users**: Enable WSL2 integration in Docker Desktop settings

---

## Step-by-Step Production Deployment

### Step 1: Enable Docker (WSL2 Users)

If you're on Windows with WSL2:

1. **Open Docker Desktop**
2. Go to **Settings** → **Resources** → **WSL Integration**
3. **Enable integration** for your Ubuntu/WSL distro
4. Click **Apply & Restart**
5. Verify: `docker ps` should work without errors

### Step 2: Run Complete Setup

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

# This does everything automatically:
# ✓ Fixes file permissions
# ✓ Installs dependencies
# ✓ Starts Docker services
# ✓ Runs database migrations  
# ✓ Builds frontend
# ✓ Creates startup scripts
bash setup-production-ready.sh
```

### Step 3: Start the System

```bash
# Start everything (backend + frontend + Docker services)
bash start-all.sh
```

Access:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

### Step 4: Verify Everything Works

```bash
# Run health check
curl http://localhost:3000/api/health

# Should return:
# {"status":"ok","features":[...]}
```

---

## Production Configuration

### For Live Server Deployment

1. **Generate Production Secrets**:
```bash
bash generate-secrets.sh > production-secrets.txt
```

2. **Update .env with production values**:
```bash
# Copy template
cp .env.production.template .env

# Edit .env and replace all REPLACE_WITH_* values
nano .env
```

**Critical values to update**:
- `NODE_ENV=production`
- `JWT_SECRET` (64+ characters)
- `ENCRYPTION_KEY` (32 characters)
- `STRIPE_SECRET_KEY` (use `sk_live_*` for production)
- `STRIPE_WEBHOOK_SECRET`
- `DATABASE_URL` (production database)
- `SMTP_*` (production email server)
- `CORS_ORIGIN` (your production domain)

3. **Deploy to Server**:
```bash
# Automated deployment script
sudo bash deploy-production.sh
```

---

## Troubleshooting

### Docker not working in WSL2?

**Solution**:
1. Open Docker Desktop
2. Settings → Resources → WSL Integration
3. Enable for your distro
4. Apply & Restart

Verify: `docker info` should work

### Port already in use?

```bash
# Check what's using the port
sudo lsof -i :3000
sudo lsof -i :5433

# Kill the process
sudo kill -9 <PID>
```

### Backend won't start?

```bash
# Check logs
cat logs/mpanel.log

# Test syntax
node -c src/server.js
```

### Frontend build fails?

```bash
cd frontend

# Clean and rebuild
rm -rf dist node_modules/.vite
npm install --legacy-peer-deps
npx vite build
```

### Database connection fails?

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart Docker services
docker compose down
docker compose up -d

# Wait 15 seconds for PostgreSQL to initialize
sleep 15

# Test connection
docker exec mpanel-postgres pg_isready -U mpanel
```

---

## Production Checklist

Before going live, ensure:

### Security
- [ ] `.env` file permissions: `600` (owner-only)
- [ ] `.env` not tracked in git
- [ ] JWT_SECRET is 64+ random characters
- [ ] Production Stripe keys (`sk_live_*`)
- [ ] Strong database password
- [ ] HTTPS/SSL enabled (Let's Encrypt)

### Configuration  
- [ ] NODE_ENV=production
- [ ] CORS_ORIGIN set to production domain
- [ ] Email SMTP configured and tested
- [ ] OpenAI API key added (for AI features)
- [ ] Monitoring credentials changed

### Infrastructure
- [ ] Docker services running
- [ ] Database migrations applied
- [ ] Frontend built successfully
- [ ] Health endpoint returns 200 OK
- [ ] Backups configured

### Testing
- [ ] API endpoints work
- [ ] Authentication works
- [ ] Stripe payments work (test mode first)
- [ ] Email sending works
- [ ] Frontend loads correctly

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    mPanel System                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend (React + Vite)     Port: 3001                │
│  Backend (Node.js/Express)   Port: 3000                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  PostgreSQL Database         Port: 5433                │
│  Redis Cache                 Port: 6380                │
│  MinIO Object Storage        Port: 9000/9001           │
├─────────────────────────────────────────────────────────┤
│  Prometheus Monitoring       Port: 9090                │
│  Grafana Dashboards         Port: 3002                │
│  Loki Logs                   Port: 3100                │
└─────────────────────────────────────────────────────────┘
```

---

## Features Available

### ✅ Core Features (20/20 Complete)

1. **AI-Powered Features** - GPT-4 code generation, debugging, forecasting
2. **Real-time WebSocket** - Live notifications, collaboration
3. **Advanced Analytics** - RFM segmentation, cohort analysis, LTV
4. **Security** - 2FA, audit logs, IP whitelisting
5. **GraphQL API** - 40+ types, real-time subscriptions
6. **Serverless Functions** - Docker-based execution
7. **Advanced Billing** - Usage-based, tiered pricing, installments
8. **Container Registry** - Image scanning, vulnerability detection
9. **Email Marketing** - Campaigns, drip sequences, A/B testing
10. **Multi-Database** - MySQL, PostgreSQL, MongoDB, Redis, MariaDB
11. **Compliance** - SOC2, ISO27001, GDPR, HIPAA, PCI DSS
12. **Advanced Support** - AI triage, SLA tracking, live chat
13. **Performance** - Redis caching, CDN, query optimization
14. **Kubernetes** - Auto-scaling, multi-region failover
15. **Monitoring** - APM, distributed tracing, anomaly detection
16. **API Marketplace** - Webhooks, OAuth 2.0, integrations
17. **White-Label** - Multi-tier reseller, custom branding
18. **Multi-Region CDN** - Cloudflare, CloudFront, Fastly, BunnyCDN
19. **Advanced DNS** - DNSSEC, GeoDNS, health checks
20. **Enhanced Backup** - PITR, cross-region replication

---

## Support & Documentation

- **Architecture**: See `ARCHITECTURE.md`
- **API Examples**: See `API_EXAMPLES.md`
- **Complete Features**: See `100_PERCENT_COMPLETE.md`
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md`

---

## Quick Commands Reference

```bash
# Start everything
bash start-all.sh

# Start backend only
bash start-backend.sh

# Start frontend only
bash start-frontend.sh

# Run migrations
bash run-migrations.sh

# Generate secrets
bash generate-secrets.sh

# Health check
curl http://localhost:3000/api/health

# View logs
tail -f logs/mpanel.log

# Docker services status
docker compose ps

# Stop everything
docker compose down
```

---

## Next Steps After Setup

1. **Test the system locally** - Verify all features work
2. **Configure production secrets** - Use `generate-secrets.sh`
3. **Set up production database** - PostgreSQL on production server
4. **Configure domain & SSL** - Let's Encrypt certificates
5. **Deploy to live server** - Run `deploy-production.sh`
6. **Set up monitoring** - Configure Grafana alerts
7. **Configure backups** - Automated daily backups
8. **Load testing** - Test with expected traffic

---

## Production Deployment to Live Server

When ready to deploy to your actual live server:

```bash
# On your live server (Ubuntu/Debian)
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh
chmod +x deploy.sh
sudo bash deploy.sh
```

This will:
- Install all dependencies (Node.js, Docker, Nginx, PM2)
- Set up the database
- Configure SSL certificates
- Set up systemd services
- Configure Nginx as reverse proxy
- Start all services automatically

---

**🎉 You're ready to launch the most advanced hosting control panel!**
