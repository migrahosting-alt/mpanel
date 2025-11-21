# ✅ mPanel Production Deployment Checklist

Use this checklist to ensure everything is ready before going live.

---

## 🔧 Pre-Deployment Setup

### Local Development Environment

- [x] Node.js 20+ installed (v22.21.1 ✓)
- [x] npm installed (v10.9.4 ✓)
- [x] Dependencies installed (1,332 packages ✓)
- [x] `.env` file created and secured
- [x] Scripts made executable
- [ ] **Docker Desktop WSL2 integration enabled** ⚠️

**Action Required**: Enable Docker WSL2 integration
```bash
# 1. Open Docker Desktop
# 2. Settings → Resources → WSL Integration
# 3. Enable for your Ubuntu distro
# 4. Apply & Restart
# 5. Verify: docker ps
```

---

## 🏃 Quick Start (Choose One)

### Option A: Full Production Mode (Recommended)
```bash
bash setup-production-ready.sh  # Automated complete setup
bash start-all.sh               # Start everything
```

### Option B: Quick Test Mode
```bash
bash quick-start.sh  # Start without Docker
```

---

## 🌐 Production Server Deployment

### Before Deployment

- [ ] Production server provisioned (Ubuntu 20.04+ or Debian 11+)
- [ ] Domain name configured and pointing to server IP
- [ ] SSH access to server
- [ ] Root/sudo access available

### Environment Configuration

- [ ] Copy `.env.production.template` to `.env`
- [ ] Generate production secrets: `bash generate-secrets.sh`
- [ ] Update all `REPLACE_WITH_*` values in `.env`:
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_SECRET` (64+ characters)
  - [ ] `ENCRYPTION_KEY` (32 characters)
  - [ ] `MPANEL_API_TOKEN` (secure token)
  - [ ] `DATABASE_URL` (production database)
  - [ ] `REDIS_URL` (production Redis)
  - [ ] `STRIPE_SECRET_KEY` (use `sk_live_*`)
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `SMTP_*` credentials (production email)
  - [ ] `CORS_ORIGIN` (production domain)
  - [ ] `OPENAI_API_KEY` (for AI features)

### Security Checklist

- [ ] `.env` file has `600` permissions (owner-only)
- [ ] `.env` file is in `.gitignore`
- [ ] JWT secret is 64+ random characters
- [ ] Database password is strong (20+ characters)
- [ ] Encryption key is exactly 32 characters
- [ ] All API keys are production keys (not test)
- [ ] SSH key-based authentication enabled
- [ ] Firewall configured (UFW or iptables)
- [ ] Fail2ban installed and configured

### Database Setup

- [ ] PostgreSQL 16+ installed
- [ ] Database created: `mpanel_production`
- [ ] Database user created with strong password
- [ ] All migrations applied: `bash run-migrations.sh`
- [ ] Initial admin user created
- [ ] Database backups configured

### Infrastructure

- [ ] Docker installed and running
- [ ] Docker Compose installed
- [ ] Redis installed and running
- [ ] MinIO/S3 configured
- [ ] Nginx installed as reverse proxy
- [ ] PM2 installed for process management

### SSL/TLS

- [ ] Let's Encrypt installed
- [ ] SSL certificates generated
- [ ] Auto-renewal configured
- [ ] HTTPS redirect configured
- [ ] SSL grade A or higher (test with SSL Labs)

### Monitoring

- [ ] Prometheus running (port 9090)
- [ ] Grafana running (port 3002)
- [ ] Loki running (port 3100)
- [ ] Custom dashboards imported
- [ ] Alert rules configured
- [ ] Email notifications set up

### Email Configuration

- [ ] SMTP server configured
- [ ] Test email sent successfully
- [ ] SPF record added to DNS
- [ ] DKIM configured
- [ ] DMARC policy set

### Payment Integration

- [ ] Stripe account in production mode
- [ ] Live API keys configured
- [ ] Webhook endpoint configured
- [ ] Webhook signature verified
- [ ] Test payment completed successfully
- [ ] Refund process tested

### Domain & DNS

- [ ] A record points to server IP
- [ ] AAAA record configured (if IPv6)
- [ ] CNAME records for subdomains
- [ ] MX records for email
- [ ] TXT records (SPF, DKIM, DMARC)
- [ ] CAA records for SSL

---

## 🧪 Testing Checklist

### Backend API Tests

- [ ] Health endpoint: `curl http://localhost:3000/api/health`
- [ ] User registration works
- [ ] User login returns JWT token
- [ ] Protected routes require authentication
- [ ] RBAC permissions work correctly
- [ ] Database queries execute successfully
- [ ] Redis caching works
- [ ] File uploads work (MinIO/S3)

### Frontend Tests

- [ ] Frontend loads at http://localhost:3001
- [ ] Login page renders correctly
- [ ] Dashboard loads after login
- [ ] All menu items accessible
- [ ] Forms submit correctly
- [ ] Tables load data
- [ ] No console errors
- [ ] Mobile responsive

### Integration Tests

- [ ] Create new customer account
- [ ] Create new product
- [ ] Create new invoice
- [ ] Process Stripe payment
- [ ] Provision new website
- [ ] Create DNS zone
- [ ] Issue SSL certificate
- [ ] Create database
- [ ] Create email account
- [ ] Send test email
- [ ] Webhook receives event
- [ ] Real-time notification works

### Performance Tests

- [ ] API response time < 200ms
- [ ] Frontend load time < 2 seconds
- [ ] Database query time < 50ms
- [ ] Memory usage stable under load
- [ ] No memory leaks detected
- [ ] Handles 100+ concurrent users

### Security Tests

- [ ] SQL injection prevented
- [ ] XSS attacks prevented
- [ ] CSRF protection enabled
- [ ] Rate limiting works
- [ ] JWT expiration works
- [ ] Password hashing verified
- [ ] 2FA works correctly
- [ ] Audit logs captured

---

## 🚀 Deployment Steps

### 1. Deploy to Server

```bash
# On your production server
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh
chmod +x deploy.sh
sudo bash deploy.sh
```

### 2. Verify Deployment

- [ ] Backend running: `curl https://yourdomain.com/api/health`
- [ ] Frontend accessible: `https://yourdomain.com`
- [ ] HTTPS working (green padlock)
- [ ] Database connected
- [ ] Redis connected
- [ ] MinIO accessible

### 3. Configure Monitoring

- [ ] Access Grafana: `https://monitoring.yourdomain.com`
- [ ] Import mPanel dashboards
- [ ] Configure alert channels (email, Slack)
- [ ] Test alerts

### 4. Set Up Backups

- [ ] Database backup script configured
- [ ] S3 backup destination configured
- [ ] Backup schedule set (daily 2 AM)
- [ ] Backup retention policy (30 days)
- [ ] Test backup restoration

### 5. Configure CDN (Optional)

- [ ] Cloudflare configured
- [ ] DNS pointed to Cloudflare
- [ ] SSL mode: Full (strict)
- [ ] Caching rules configured
- [ ] DDoS protection enabled

---

## 📊 Post-Deployment

### Monitoring

- [ ] Check Grafana dashboards daily
- [ ] Review error logs weekly
- [ ] Monitor disk space
- [ ] Monitor memory usage
- [ ] Monitor API response times
- [ ] Check SSL expiration

### Maintenance

- [ ] Database backups verified weekly
- [ ] Security updates applied monthly
- [ ] Dependencies updated quarterly
- [ ] Performance optimization ongoing
- [ ] User feedback collected

### Documentation

- [ ] Admin documentation complete
- [ ] User guides created
- [ ] API documentation published
- [ ] Support articles written
- [ ] Troubleshooting guide available

---

## 🆘 Emergency Procedures

### Rollback Plan

```bash
# If deployment fails, rollback:
pm2 stop all
git checkout previous-version
npm install
pm2 start all
```

### Database Restore

```bash
# Restore from backup:
pg_restore -U mpanel -d mpanel_production latest_backup.dump
```

### Contact Information

- **System Admin**: [Your email]
- **Database Admin**: [Email]
- **Hosting Provider**: [Provider support]
- **CDN Support**: [Cloudflare support]

---

## ✅ Final Checklist

Before announcing launch:

- [ ] All tests passed
- [ ] All features work
- [ ] Security audit completed
- [ ] Performance acceptable
- [ ] Monitoring configured
- [ ] Backups tested
- [ ] Documentation complete
- [ ] Support team trained
- [ ] Emergency procedures documented
- [ ] Rollback plan tested

---

## 🎉 Launch!

Once all items are checked:

1. Announce to users
2. Monitor closely for 24 hours
3. Gather feedback
4. Iterate and improve

**Congratulations! mPanel is LIVE! 🚀**

---

*Keep this checklist updated as your deployment evolves.*
