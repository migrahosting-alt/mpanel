# 🚨 Emergency Rollback & Disaster Recovery
**System:** mPanel Control Plane  
**Last Updated:** December 3, 2025

---

## ⚡ Quick Reference

| Scenario | Action | Time | Risk |
|----------|--------|------|------|
| **Bad deployment** | Code rollback | 5 min | LOW |
| **Schema broken** | DB + Code rollback | 15 min | MEDIUM |
| **Data corruption** | Point-in-time restore | 30 min | HIGH |
| **Complete failure** | Full disaster recovery | 2 hours | CRITICAL |

---

## 🔥 Scenario 1: Bad Deployment (Code Only)

**Symptoms:**
- Application crashes on startup
- 500 errors on all endpoints
- TypeScript/runtime errors in logs
- No database schema changes

**Solution:** Code rollback

### Step 1: Stop Traffic
```bash
# SSH to production server
ssh mhadmin@10.1.10.206

# Stop PM2 processes
pm2 stop mpanel-backend
pm2 list  # Verify stopped
```

### Step 2: Restore Previous Code
```bash
cd /opt/mpanel

# Find latest backup
ls -lht /backups/mpanel_code_*.tgz | head -5

# Extract backup (this will overwrite current code)
tar -xzf /backups/mpanel_code_pre_v1_YYYYMMDD_HHMMSS.tgz

# Verify extraction
git status  # Should show files restored
```

### Step 3: Reinstall Dependencies
```bash
# In case package.json changed
npm install --production

# Verify critical packages
npm ls prisma express
```

### Step 4: Restart Services
```bash
pm2 restart mpanel-backend
pm2 logs mpanel-backend --lines 50

# Wait 30 seconds for initialization
sleep 30

# Health check
curl http://localhost:3010/api/v1/__debug
# Expected: {"status":"ok","timestamp":"..."}
```

### Step 5: Verify External Access
```bash
# From another machine
curl https://mpanel.migrahosting.com/api/v1/__debug

# Run smoke tests
npm run smoke-test -- --env=production
```

**✅ Done:** ~5 minutes  
**Rollback complete:** System restored to previous version

---

## 💾 Scenario 2: Schema Migration Failed

**Symptoms:**
- "relation does not exist" errors
- "column XYZ of relation ABC does not exist"
- Migrations partially applied
- Some tables missing/corrupted

**Solution:** Database + Code rollback

### Step 1: IMMEDIATELY Stop All Services
```bash
ssh mhadmin@10.1.10.206

# Stop backend (prevents more writes)
pm2 stop mpanel-backend

# Pause all job queues
# (manual SQL if API unavailable)
psql mpanel_prod -c "UPDATE settings SET value='true' WHERE key='queues_paused';"
```

### Step 2: Assess Database State
```bash
# Connect to database
psql mpanel_prod

# Check migration history
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;

# Check for failed migrations
SELECT * FROM _prisma_migrations WHERE failed_at IS NOT NULL;

# Exit psql
\q
```

### Step 3: Restore Database from Backup
```bash
# CRITICAL: This will DROP and RECREATE the database
# Make sure you have the RIGHT backup

# Find latest pre-migration backup
ls -lht /backups/mpanel_prod_*.sql.gz | head -5

# Create new backup of current (broken) state (just in case)
pg_dump mpanel_prod | gzip > /backups/mpanel_prod_broken_$(date +%Y%m%d_%H%M%S).sql.gz

# Drop current database
dropdb mpanel_prod

# Recreate database
createdb mpanel_prod

# Restore from backup
gunzip -c /backups/mpanel_prod_pre_v1_YYYYMMDD_HHMMSS.sql.gz | psql mpanel_prod

# Verify restoration
psql mpanel_prod -c "SELECT COUNT(*) FROM \"Tenant\";"
psql mpanel_prod -c "SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;"
```

### Step 4: Restore Code (to match schema)
```bash
cd /opt/mpanel

# Same as Scenario 1
tar -xzf /backups/mpanel_code_pre_v1_YYYYMMDD_HHMMSS.tgz
npm install --production
```

### Step 5: Restart and Verify
```bash
pm2 restart mpanel-backend
pm2 logs mpanel-backend --lines 100

# Verify database connection
npm run db:test  # Custom script to test DB connection

# Resume queues
psql mpanel_prod -c "UPDATE settings SET value='false' WHERE key='queues_paused';"

# Health check
curl http://localhost:3010/api/v1/__debug
```

**✅ Done:** ~15 minutes  
**Rollback complete:** Database and code restored

---

## 🔴 Scenario 3: Data Corruption Detected

**Symptoms:**
- Customer reports missing data
- Invoices showing wrong amounts
- Subscriptions in impossible states
- Foreign key violations

**Solution:** Point-in-time recovery

### Step 1: Identify Corruption Timeframe
```bash
# SSH to database server
ssh mhadmin@10.1.10.206

# Find when corruption started
psql mpanel_prod

-- Check recent invoice changes
SELECT id, invoice_number, total, updated_at 
FROM "Invoice" 
WHERE updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC;

-- Check subscription states
SELECT id, status, updated_at 
FROM "Subscription" 
WHERE status IN ('CORRUPTED', 'INVALID')  -- or whatever bad state
ORDER BY updated_at DESC;

\q
```

### Step 2: Find Backup Before Corruption
```bash
# List backups with timestamps
ls -lht /backups/ | grep mpanel_prod

# Example: Corruption happened at 14:30, find backup from 14:00
# /backups/mpanel_prod_20251203_140000.sql.gz
```

### Step 3: Selective Restore (If Possible)
```bash
# Option A: Restore specific tables only
# Extract table dump
gunzip -c /backups/mpanel_prod_20251203_140000.sql.gz > /tmp/restore.sql

# Edit /tmp/restore.sql to only include affected table(s)
# Then:
psql mpanel_prod < /tmp/restore.sql

# Option B: Full restore (if corruption widespread)
# Same as Scenario 2
```

### Step 4: Replay Transactions (If Needed)
```bash
# If you need to replay some transactions after restore point:
# 1. Export transactions from logs
# 2. Manually replay critical ones

# Example: Re-create invoice that was lost
psql mpanel_prod -c "
  INSERT INTO \"Invoice\" (id, tenant_id, customer_id, invoice_number, status, total, created_at)
  VALUES ('...', '...', '...', 'INV-2024-001234', 'PAID', 99.99, NOW());
"
```

**✅ Done:** ~30 minutes  
**Partial recovery:** Lost data between backup and corruption identified

---

## ☢️ Scenario 4: Complete System Failure

**Symptoms:**
- Server unreachable
- Database server crashed
- All services down
- Hardware failure

**Solution:** Full disaster recovery

### Step 1: Provision New Infrastructure
```bash
# If primary server (10.1.10.206) is down:
# 1. Spin up new VM or use backup server
# 2. Install PostgreSQL, Node.js, PM2, Redis

# On new server:
apt update && apt upgrade -y
apt install postgresql-14 nodejs npm redis-server -y
npm install -g pm2
```

### Step 2: Restore Database
```bash
# Transfer latest backup to new server
scp mhadmin@backup-server:/backups/mpanel_prod_latest.sql.gz /tmp/

# Create database
sudo -u postgres createdb mpanel_prod

# Restore
gunzip -c /tmp/mpanel_prod_latest.sql.gz | sudo -u postgres psql mpanel_prod
```

### Step 3: Deploy Application Code
```bash
# Clone from Git
cd /opt
git clone https://github.com/migrahosting-alt/mpanel.git
cd mpanel

# Or restore from backup
scp mhadmin@backup-server:/backups/mpanel_code_latest.tgz /tmp/
tar -xzf /tmp/mpanel_code_latest.tgz -C /opt/mpanel

# Install dependencies
npm install --production
npm run build
```

### Step 4: Configure Environment
```bash
# Copy environment variables
nano /opt/mpanel/.env

# Minimum required:
DATABASE_URL="postgresql://user:pass@localhost:5432/mpanel_prod"
JWT_SECRET="..." # From backup or 1Password
JWT_REFRESH_SECRET="..."
STRIPE_SECRET_KEY="..."
STRIPE_WEBHOOK_SECRET="..."
NODE_ENV="production"
PORT="3010"
```

### Step 5: Start Services
```bash
# Start PM2
pm2 start dist/server.js --name mpanel-backend

# Verify
pm2 logs mpanel-backend
curl http://localhost:3010/api/v1/__debug
```

### Step 6: Update DNS / Load Balancer
```bash
# Point mpanel.migrahosting.com to new server IP
# Update DNS A record or load balancer config

# Wait for DNS propagation (5-30 minutes)
dig mpanel.migrahosting.com
```

### Step 7: Run Full Smoke Tests
```bash
npm run smoke-test -- --env=production --verbose
```

**✅ Done:** ~2 hours  
**Full recovery:** System rebuilt from backups

---

## 📋 Post-Incident Checklist

After any rollback/recovery:

- [ ] **Incident report** created with timeline
- [ ] **Root cause** identified
- [ ] **Monitoring** improved to detect similar issues
- [ ] **Backup procedures** validated
- [ ] **Runbook** updated with lessons learned
- [ ] **Team** notified of resolution
- [ ] **Customers** notified (if affected)

---

## 🛡️ Prevention (Best Practices)

### Automated Backups

```bash
# Cron job (daily at 2am)
0 2 * * * /opt/mpanel/scripts/backup.sh

# /opt/mpanel/scripts/backup.sh:
#!/bin/bash
TIMESTAMP=$(date +\%Y\%m\%d_\%H\%M\%S)

# Database backup
pg_dump mpanel_prod | gzip > /backups/mpanel_prod_$TIMESTAMP.sql.gz

# Code backup
cd /opt/mpanel
tar -czf /backups/mpanel_code_$TIMESTAMP.tgz .

# Keep only last 14 days
find /backups -name "mpanel_*" -mtime +14 -delete

# Upload to S3/offsite (if configured)
# aws s3 cp /backups/mpanel_prod_$TIMESTAMP.sql.gz s3://migrahosting-backups/
```

### Health Monitoring

```bash
# Add to PM2 ecosystem.config.js:
module.exports = {
  apps: [{
    name: 'mpanel-backend',
    script: 'dist/server.js',
    instances: 2,
    exec_mode: 'cluster',
    max_memory_restart: '500M',
    error_file: '/var/log/pm2/mpanel-error.log',
    out_file: '/var/log/pm2/mpanel-out.log',
    merge_logs: true,
    // Auto-restart on crash
    autorestart: true,
    // Max 10 restarts in 1 minute (prevent crash loop)
    max_restarts: 10,
    min_uptime: '10s',
  }]
};
```

### Staged Deployments

Never deploy directly to production:

1. **Local** → Test locally
2. **Staging** → Deploy to staging, run smoke tests
3. **Canary** → Deploy to 10% of production traffic
4. **Production** → Full rollout

---

## 📞 Emergency Contacts

- **On-Call Engineer**: [Phone/Pager]
- **Database Admin**: [Phone/Email]
- **Infrastructure Lead**: [Phone/Email]
- **Stripe Support**: https://support.stripe.com
- **Hetzner Support**: support@hetzner.com

---

**Remember:** Stay calm, follow the runbook, and document everything. Every incident is a learning opportunity.

🚨 **Test this runbook quarterly** to ensure all procedures still work!
