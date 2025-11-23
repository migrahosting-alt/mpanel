# MigraTeck / MigraHosting Infrastructure Map

**IMPORTANT**: This is the authoritative reference for our server architecture. Always consult this when deploying or debugging.

---

## MigraTeck Core Infrastructure (LAN 10.1.10.x)

### srv1 (10.1.10.10)
- **Role**: Main web / hosting node
- **Services**: 
  - Nginx vhosts
  - Marketing site (migrahosting.com)
  - Reverse proxy to mPanel
  - Client websites
- **Public IP**: `73.139.18.218`
- **SSH**: `ssh srv1`

### mpanel-core (10.1.10.206)
- **Role**: mPanel backend + frontend (Node/Vite)
- **Ports**: 
  - `2271` (API Backend)
  - `2272` (UI Frontend)
- **Connects to**: db-core Postgres (10.1.10.210:5432)
- **Application Path**: `/opt/mpanel`
- **SSH**: `ssh mpanel-core`

### db-core (10.1.10.210)
- **Role**: Central PostgreSQL server
- **Database**: `mpanel` (user: `mpanel_app`) for the mPanel platform
- **Port**: `5432`
- **SSH**: `ssh db-core`

### mail-core (10.1.10.101)
- **Role**: Mail stack (Postfix/Dovecot/OpenDKIM/OpenDMARC)
- **Used by**: Client domains as shared mail server
- **Hostname**: `mail.migrahosting.com`
- **Ports**: 
  - `587` (SMTP submission)
  - `993` (IMAP over TLS)
- **SSH**: `ssh mail-core`

### dns-core (10.1.10.102)
- **Role**: PowerDNS authoritative server
- **Manages DNS zones for**:
  - `migrahosting.com`
  - `migrapanel.com`
  - `elizefoundation.org`
  - `holisticgroupllc.com`
  - All client domains
- **SSH**: `ssh dns-core`

---

## Core Servers

### srv1 (WEB EDGE / PUBLIC GATEWAY)
- **Internal IP**: `10.1.10.10`
- **Public IP**: `73.139.18.218`
- **Role**: Main public web entry point - all external traffic hits here first
- **Services**:
  - **Nginx** (reverse proxy for all public domains)
  - Terminates SSL/TLS
  - Routes to backend services on internal network
- **Hosted Domains**:
  - `migrahosting.com` → Marketing site (static files)
  - `migrapanel.com` → Reverse proxy to mpanel-core
  - Other client websites
- **Key Paths**:
  - Marketing site: `/srv/web/migrahosting.com/public`
  - Nginx configs: `/etc/nginx/sites-available/*.conf`
  - Nginx enabled sites: `/etc/nginx/sites-enabled/` (symlinks)
- **SSH**: `ssh root@10.1.10.10`

### mpanel-core (mPanel Application Server)
- **Internal IP**: `10.1.10.206`
- **Public IP**: NONE (internal network only)
- **Role**: Hosts the complete mPanel control panel stack
- **Services**:
  - **mPanel Backend**: Node.js/Express on port `2271`
  - **mPanel Frontend**: Vite dev server on port `2272`
  - PM2 process manager
- **Key Paths**:
  - Application root: `/opt/mpanel`
  - Backend code: `/opt/mpanel/src`
  - Frontend code: `/opt/mpanel/frontend`
  - Environment: `/opt/mpanel/.env`
  - Logs: PM2 logs via `pm2 logs mpanel-backend`
- **Health Check**: `http://10.1.10.206:2271/api/health`
- **SSH**: `ssh root@10.1.10.206`
- **Important**: Only accessible internally or via Tailscale VPN

### dbCore (Database Server)
- **Internal IP**: `10.1.10.210`
- **Public IP**: NONE (internal network only)
- **Role**: Central PostgreSQL database server
- **Services**:
  - **PostgreSQL 16**: Port `5432`
- **mPanel Database**:
  - Host: `10.1.10.210:5432`
  - Database: `mpanel`
  - User: `mpanel_app`
  - Connection: `postgres://mpanel_app:<PASSWORD>@10.1.10.210:5432/mpanel`
- **SSH**: `ssh root@10.1.10.210`

### mail-core (Email Server)
- **Internal IP**: `10.1.10.101`
- **Legacy VPS Mail IP**: `154.38.180.61` (mail.migrahosting.com - still in use)
- **Role**: Central mail server for all client domains
- **Services**:
  - **Postfix** (SMTP)
  - **Dovecot** (IMAP/POP)
  - **OpenDKIM**, **OpenDMARC**
  - **Webmail** (SnappyMail/RainLoop)
- **Ports**:
  - 587 (SMTP submission, STARTTLS)
  - 993 (IMAP over TLS)
- **Maildir**: `/home/vmail/%d/%n`
- **DNS Pattern**:
  - MX for client domains → `mail.migrahosting.com`
  - A record for `mail.migrahosting.com` → mail-core public IP
  - SPF/DKIM/DMARC aligned with `mail.migrahosting.com`
- **SSH**: `ssh root@10.1.10.101` or `ssh mail-core`

### dns-core (DNS Server - PowerDNS)
- **Internal IP**: `10.1.10.102`
- **Role**: Authoritative DNS server for all domains
- **Services**:
  - **PowerDNS** (authoritative DNS server)
  - **PowerDNS-Admin** (web UI for zone management)
- **Managed Domains**:
  - `migrahosting.com`
  - `migrapanel.com`
  - `elizefoundation.org`
  - `holisticgroupllc.com`
  - All client domains
- **SSH**: `ssh root@10.1.10.102` or `ssh dns-core`
- **Notes**: All A/MX/SPF/DKIM/DMARC records managed here

### cloud-core (Cloud Storage - Future)
- **Internal IP**: `TBD (not yet deployed)`
- **Role**: S3-like object storage and backup cloud (future deployment)
- **Services**:
  - Client backups
  - Static assets storage
  - S3-compatible API (MinIO planned)
- **SSH**: `ssh cloud-core` (when deployed)

### migraguard-quantum (Security & Monitoring)
- **Internal IP**: `TBD (not yet deployed)`
- **Role**: Security, monitoring, log aggregation, and automation
- **Services**:
  - IDS/IPS
  - Central logging (Loki/Promtail, ELK)
  - Backup/orchestration scripts
- **SSH**: `ssh migraguard-quantum` (when deployed)

### Proxmox Host (pve)
- **Role**: Hypervisor running all VMs
- **Storage**:
  - `clients-main` (ZFS) - primary VM storage
  - `clients-backup` (ZFS) - backup storage
  - External USB/NVMe drives for long-term backups
- **Backup Strategy**:
  - Full system backups every 2 hours
  - Keep last 10 per server
  - Shared mount: `/mnt/windows-backup/srv1/`, `/mnt/windows-backup/srv2/`

### Legacy VPS (Contabo)
- **Public IP**: `31.220.98.95`
- **Status**: Legacy - being phased out
- **Notes**: Some sites may still be live during migration. Prefer srv1 + Proxmox VMs for new services.

---

## Traffic Flow & Routing

### migrahosting.com (Marketing Website)

**DNS**: `migrahosting.com` → `73.139.18.218` (srv1 public IP)

**Request Flow**:
```
User Browser
  ↓ HTTPS
srv1 (10.1.10.10) - Nginx
  ↓ serve static files
/srv/web/migrahosting.com/public/dist
```

**Nginx Config** (on srv1):
```nginx
server {
    listen 443 ssl;
    server_name migrahosting.com www.migrahosting.com;
    
    root /srv/web/migrahosting.com/public/dist;
    
    ssl_certificate /etc/letsencrypt/live/migrahosting.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/migrahosting.com/privkey.pem;
}
```

**Marketing Backend** (if enabled):
- Port: `4242` on srv1
- Proxies to mPanel API for account creation: `http://10.1.10.206:2271/api`

---

### migrapanel.com (mPanel Control Panel)

**DNS**: `migrapanel.com` → `73.139.18.218` (srv1 public IP)

**Request Flow**:
```
User Browser
  ↓ HTTPS (443)
srv1 (10.1.10.10) - Nginx SSL termination
  ↓ HTTP reverse proxy
mpanel-core (10.1.10.206)
  ├─ /api/* → Backend (port 2271)
  ├─ /graphql → Backend (port 2271)
  └─ /* → Frontend (port 2272)
```

**Nginx Config** (on srv1 at `/etc/nginx/sites-available/migrapanel.com.conf`):
```nginx
server {
    listen 443 ssl http2;
    server_name migrapanel.com www.migrapanel.com;

    ssl_certificate /etc/letsencrypt/live/migrapanel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/migrapanel.com/privkey.pem;

    # mPanel backend API → mpanel-core:2271
    location /api/ {
        proxy_pass http://10.1.10.206:2271;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # GraphQL endpoint
    location /graphql {
        proxy_pass http://10.1.10.206:2271;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # mPanel frontend → mpanel-core:2272
    location / {
        proxy_pass http://10.1.10.206:2272;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    access_log /var/log/nginx/migrapanel.com.access.log;
    error_log /var/log/nginx/migrapanel.com.error.log;
}

server {
    listen 80;
    server_name migrapanel.com www.migrapanel.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$host$request_uri;
    }
}
```

**To enable/reload Nginx config on srv1**:
```bash
ssh root@10.1.10.10
ln -sf /etc/nginx/sites-available/migrapanel.com.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## mPanel Application Configuration

**Location**: `/opt/mpanel/.env` on mpanel-core (10.1.10.206)

**Key Environment Variables**:
```env
# Server
PORT=2271
HOST=0.0.0.0
NODE_ENV=production
APP_URL=https://migrapanel.com

# Database (dbCore)
DATABASE_URL=postgres://mpanel_app:<PASSWORD>@10.1.10.210:5432/mpanel
PGHOST=10.1.10.210
PGPORT=5432
PGUSER=mpanel_app
PGPASSWORD=<PASSWORD>
PGDATABASE=mpanel

# JWT Authentication
JWT_SECRET=<strong_random_secret>

# Redis (if using)
REDIS_URL=redis://mpanel-redis:6379

# Stripe Integration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Marketing Integration
MARKETING_TEST_MODE=true
MARKETING_OVERRIDE_CODE=OVERRIDE100
MARKETING_AUTO_PROVISION=true
MARKETING_TEST_REDIRECT_URL=https://migrahosting.com/thank-you

# CORS
CORS_ORIGIN=https://migrahosting.com,https://migrapanel.com,https://mpanel.migrahosting.com
```

---

## Deployment Workflows

### Deploying mPanel Code Updates

**From local machine**:
```bash
# 1. Commit changes
git add .
git commit -m "feat: your change description"
git push origin master

# 2. SSH to mpanel-core and pull latest
ssh root@10.1.10.206
cd /opt/mpanel
git pull origin master

# 3. Install dependencies (if package.json changed)
npm install

# 4. Restart backend
pm2 restart mpanel-backend

# 5. Rebuild frontend (if frontend changed)
cd frontend
npm install
npm run build
pm2 restart mpanel-frontend  # or restart dev server
```

**Quick update script**:
```bash
ssh root@10.1.10.206 "cd /opt/mpanel && git pull origin master && pm2 restart mpanel-backend"
```

### Deploying Marketing Site

**From local machine**:
```bash
# 1. Build locally
cd /path/to/migrahosting-marketing-site
npm run build

# 2. Deploy to srv1
rsync -avz dist/ root@10.1.10.10:/srv/web/migrahosting.com/public/dist/

# OR use deploy script if available
./deploy.sh
```

### Database Migrations

**Run on dbCore or from mpanel-core**:
```bash
# From mpanel-core (has DATABASE_URL configured)
ssh root@10.1.10.206
cd /opt/mpanel
npm run migrate

# OR directly on dbCore
ssh root@10.1.10.210
psql -U mpanel_app -d mpanel -f /path/to/migration.sql
```

---

## Troubleshooting Guide

### mPanel Login 502 Error

**Symptom**: `https://migrapanel.com/login` shows 502 Bad Gateway

**Root Cause**: Traffic not reaching mpanel-core backend

**Check List**:
1. **Is backend running on mpanel-core?**
   ```bash
   ssh root@10.1.10.206 "pm2 list"
   # Should show mpanel-backend online
   
   ssh root@10.1.10.206 "curl http://127.0.0.1:2271/api/health"
   # Should return JSON with status:healthy
   ```

2. **Is srv1 Nginx proxying correctly?**
   ```bash
   ssh root@10.1.10.10 "curl -I http://10.1.10.206:2271/api/health"
   # Should return 200 OK
   
   ssh root@10.1.10.10 "tail -f /var/log/nginx/migrapanel.com.error.log"
   # Check for proxy errors
   ```

3. **Is Nginx config correct on srv1?**
   ```bash
   ssh root@10.1.10.10 "cat /etc/nginx/sites-enabled/migrapanel.com.conf"
   # Verify proxy_pass points to http://10.1.10.206:2271 and :2272
   ```

4. **Restart services**:
   ```bash
   # Restart mPanel backend
   ssh root@10.1.10.206 "pm2 restart mpanel-backend"
   
   # Reload Nginx on srv1
   ssh root@10.1.10.10 "nginx -t && systemctl reload nginx"
   ```

### Marketing Checkout Not Working

**Symptom**: Checkout form submits but gets 404 or CORS error

**Check**:
1. **Is CORS configured correctly?**
   ```bash
   ssh root@10.1.10.206 "grep CORS_ORIGIN /opt/mpanel/.env"
   # Should include: https://migrahosting.com
   ```

2. **Is marketing API route mounted?**
   ```bash
   ssh root@10.1.10.206 "grep -r 'marketing' /opt/mpanel/src/routes/index.js"
   # Should show: router.use('/marketing', marketingApiRoutes)
   ```

3. **Test API directly**:
   ```bash
   curl -X POST https://migrapanel.com/api/marketing/checkout-intent \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_API_KEY" \
     -d '{"planSlug":"shared_student","billingCycle":"monthly","email":"test@example.com"}'
   ```

### Database Connection Issues

**Symptom**: Backend logs show "ECONNREFUSED" or "authentication failed"

**Check**:
1. **Can mpanel-core reach dbCore?**
   ```bash
   ssh root@10.1.10.206 "nc -zv 10.1.10.210 5432"
   # Should show: Connection to 10.1.10.210 5432 port [tcp/postgresql] succeeded!
   ```

2. **Verify DATABASE_URL**:
   ```bash
   ssh root@10.1.10.206 "grep DATABASE_URL /opt/mpanel/.env"
   # Should be: postgres://mpanel_app:<PASSWORD>@10.1.10.210:5432/mpanel
   ```

3. **Test PostgreSQL connection**:
   ```bash
   ssh root@10.1.10.206 "psql postgres://mpanel_app:<PASSWORD>@10.1.10.210:5432/mpanel -c 'SELECT 1'"
   ```

---

## SSH Access Configuration

All servers are accessible via SSH shortcuts configured in `~/.ssh/config`:

```ssh-config
Host srv1
    HostName 10.1.10.10
    User root

Host mpanel-core
    HostName 10.1.10.206
    User root

Host db-core
    HostName 10.1.10.210
    User root

Host mail-core
    HostName 10.1.10.101
    User root

Host dns-core
    HostName 10.1.10.102
    User root
```

**Access from VS Code Terminal (WSL)**:
```bash
# Direct SSH using shortcuts
ssh srv1
ssh mpanel-core
ssh db-core
ssh mail-core
ssh dns-core

# Run commands directly
ssh mpanel-core "pm2 list"
ssh srv1 "nginx -t && systemctl reload nginx"
ssh db-core "psql -U mpanel_app -d mpanel -c 'SELECT COUNT(*) FROM users'"
```

**Running scripts from local VS Code terminal**:
```bash
# Execute local script on remote server
ssh mpanel-core 'bash -s' < local-script.sh

# Deploy and run
cat deploy.sh | ssh mpanel-core 'bash -s'
```

---

## Quick Reference Commands

### Check Service Status

```bash
# mPanel backend (on mpanel-core) - use SSH shortcut
ssh mpanel-core "pm2 status"
ssh mpanel-core "pm2 logs mpanel-backend --lines 50"

# Nginx (on srv1) - use SSH shortcut
ssh srv1 "systemctl status nginx"
ssh srv1 "nginx -t"

# PostgreSQL (on db-core) - use SSH shortcut
ssh db-core "systemctl status postgresql"

# Mail server (on mail-core)
ssh mail-core "systemctl status postfix"
ssh mail-core "systemctl status dovecot"

# DNS server (on dns-core)
ssh dns-core "systemctl status pdns"
```

### View Logs

```bash
# mPanel backend logs - use SSH shortcut
ssh mpanel-core "pm2 logs mpanel-backend --lines 100"

# Nginx access logs (srv1)
ssh srv1 "tail -f /var/log/nginx/migrapanel.com.access.log"

# Nginx error logs (srv1)
ssh srv1 "tail -f /var/log/nginx/migrapanel.com.error.log"

# PostgreSQL logs (db-core)
ssh db-core "tail -f /var/log/postgresql/postgresql-16-main.log"

# Mail logs (mail-core)
ssh mail-core "tail -f /var/log/mail.log"
```

### Restart Services

```bash
# mPanel backend - use SSH shortcut
ssh mpanel-core "pm2 restart mpanel-backend"

# Nginx - use SSH shortcut
ssh srv1 "systemctl reload nginx"

# PostgreSQL - use SSH shortcut
ssh db-core "systemctl restart postgresql"

# Mail services
ssh mail-core "systemctl restart postfix"
ssh mail-core "systemctl restart dovecot"
```

---

## Network Topology Diagram

```
                    ┌───────────────────────────┐
                    │  Proxmox Host (pve)       │
                    │  - Hypervisor             │
                    │  - ZFS Storage Pools      │
                    └───────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ↓                      ↓                      ↓

Internet (73.139.18.218)    Internal Services      Security/Backup
         ↓                         ↓                      ↓
    ┌────────────────┐      ┌────────────────┐    ┌────────────────┐
    │  srv1          │      │ dbCore         │    │ migraguard     │
    │  10.1.10.10    │      │ 10.1.10.210    │    │ - IDS/IPS      │
    │  - Nginx       │      │ - PostgreSQL   │    │ - Logging      │
    │  - SSL Term    │      └────────────────┘    │ - Monitoring   │
    └────────────────┘                            └────────────────┘
         ↓ HTTP                   ↓
    ┌────────────────┐      ┌────────────────┐
    │ mpanel-core    │      │ mail-core      │
    │ 10.1.10.206    │      │ (mail.migra    │
    │ - Backend:2271 │      │  hosting.com)  │
    │ - Frontend:2272│      │ - Postfix      │
    └────────────────┘      │ - Dovecot      │
                            │ - OpenDKIM     │
                            └────────────────┘

                            ┌────────────────┐
                            │ dns-core       │
                            │ - PowerDNS     │
                            │ - Zone Mgmt    │
                            └────────────────┘

                            ┌────────────────┐
                            │ cloud-core     │
                            │ (Future)       │
                            │ - MinIO/S3     │
                            └────────────────┘

Legacy Infrastructure:
┌────────────────┐
│ Contabo VPS    │
│ 31.220.98.95   │
│ (Being phased  │
│  out)          │
└────────────────┘
```

---

## Important Notes

1. **ALWAYS deploy mPanel to 10.1.10.206** (mpanel-core), NOT 10.1.10.10
2. **ALWAYS configure Nginx proxies on 10.1.10.10** (srv1) for public domains
3. **NEVER expose mpanel-core or dbCore directly to the internet**
4. **Use internal IPs** for inter-server communication (10.1.10.x)
5. **Test locally** on mpanel-core before debugging Nginx issues
6. **Check PM2 logs first** when debugging backend issues
7. **Check Nginx logs on srv1** when debugging routing/proxy issues
8. **DNS Management**: All DNS records managed in dns-core (PowerDNS)
9. **Email Routing**: All client domains use MX → mail.migrahosting.com
10. **Database Centralization**: No databases on app VMs - use dbCore
11. **Backup Strategy**: Full system backups every 2 hours, keep last 10
12. **Legacy Migration**: Phase out Contabo VPS (31.220.98.95), prefer Proxmox VMs

---

## Standard Patterns for New Services

### Web Applications
```
User → srv1 (nginx HTTPS) → Internal App Server (HTTP)
```

### Database Connections
```
App Server → dbCore:5432 (PostgreSQL)
```

### Email Setup
```
Domain MX → mail.migrahosting.com → mail-core
```

### DNS Records
```
Manage in dns-core (PowerDNS/PowerDNS-Admin)
```

---

**Last Updated**: November 23, 2025  
**Document Owner**: MigraTeck Infrastructure Team  
**Based on**: Official INFRASTRUCTURE_OVERVIEW.md and COPILOT_INSTRUCTIONS.md
