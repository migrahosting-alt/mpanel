# mPanel Live Deployment Guide
**Server: 10.1.10.206 (mpanel-core)**  
**Date: November 21, 2025**

## Quick Start - One Command Installation

```bash
# SSH to your server
ssh mhadmin@10.1.10.206

# Run automated installation (installs Node.js, PostgreSQL, Redis, Nginx, etc.)
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/master/install-server.sh | sudo bash
```

## Step-by-Step Manual Installation

### 1. Prepare Server

```bash
# SSH to server
ssh mhadmin@10.1.10.206

# Switch to root
sudo -i

# Update system
apt update && apt upgrade -y
```

### 2. Install Dependencies (if not using install-server.sh)

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PostgreSQL 16
apt install -y postgresql postgresql-contrib

# Redis
apt install -y redis-server

# Nginx
apt install -y nginx

# PM2
npm install -g pm2

# Additional tools
apt install -y git curl wget unzip build-essential
```

### 3. Configure Database

```bash
# Create database and user
sudo -u postgres psql

-- In PostgreSQL:
CREATE DATABASE mpanel;
CREATE USER mpanel WITH ENCRYPTED PASSWORD 'YOUR_SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE mpanel TO mpanel;
\c mpanel
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
GRANT ALL ON SCHEMA public TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mpanel;
\q
```

### 4. Configure Redis

```bash
# Edit Redis config
nano /etc/redis/redis.conf

# Add/Update these lines:
requirepass YOUR_REDIS_PASSWORD
bind 127.0.0.1
maxmemory 512mb
maxmemory-policy allkeys-lru

# Restart Redis
systemctl restart redis-server
```

### 5. Clone and Setup mPanel

```bash
# Create directory
mkdir -p /opt/mpanel
cd /opt/mpanel

# Clone repository
git clone https://github.com/migrahosting-alt/mpanel.git .

# Install backend dependencies
npm install --production

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 6. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment file
nano .env
```

**Required .env configuration:**

```env
# Environment
NODE_ENV=production
PORT=2271

# Database (use the password you created)
DATABASE_URL=postgresql://mpanel:YOUR_SECURE_PASSWORD@localhost:5432/mpanel

# Redis (use the password you set)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@localhost:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# JWT (generate with: openssl rand -base64 64)
JWT_SECRET=YOUR_GENERATED_JWT_SECRET
JWT_EXPIRES_IN=7d

# Encryption (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=YOUR_GENERATED_ENCRYPTION_KEY

# API Token (generate with: openssl rand -base64 64)
MPANEL_API_TOKEN=YOUR_GENERATED_API_TOKEN

# MinIO/S3 (optional - can use local for testing)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=mpanel-assets

# Stripe (use test keys for now)
STRIPE_SECRET_KEY=sk_test_YOUR_TEST_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Email (configure your SMTP)
SMTP_HOST=mail.migrahosting.com
SMTP_PORT=587
SMTP_USER=support@migrahosting.com
SMTP_PASS=YOUR_SMTP_PASSWORD
SMTP_FROM=MigraHosting <noreply@migrahosting.com>

# Application URLs
APP_URL=https://migrapanel.com
CORS_ORIGIN=https://migrapanel.com,http://localhost:2272

# NameSilo (optional for testing)
NAMESILO_API_KEY=YOUR_NAMESILO_KEY
NAMESILO_SANDBOX=true

# OpenAI (optional)
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY

# Logging
LOG_LEVEL=info
LOG_FILE=/opt/mpanel/logs/mpanel.log
```

### 7. Generate Security Secrets

```bash
# Generate JWT Secret
openssl rand -base64 64

# Generate Encryption Key
openssl rand -hex 32

# Generate API Token
openssl rand -base64 64
```

### 8. Run Database Migrations

```bash
cd /opt/mpanel

# Run migrations
npm run migrate

# Verify tables were created
sudo -u postgres psql mpanel -c "\dt"
```

### 9. Build Frontend

```bash
cd /opt/mpanel/frontend

# Build production bundle
npm run build

# Verify dist folder was created
ls -la dist/
```

### 10. Configure Nginx

```bash
# Create Nginx configuration
nano /etc/nginx/sites-available/mpanel
```

**Nginx configuration:**

```nginx
# Backend API
upstream mpanel_backend {
    least_conn;
    server 127.0.0.1:2271;
    keepalive 64;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=mpanel_limit:10m rate=20r/s;
limit_conn_zone $binary_remote_addr zone=mpanel_conn:10m;

# HTTPS redirect
server {
    listen 80;
    server_name migrapanel.com www.migrapanel.com;
    return 301 https://migrapanel.com$request_uri;
}

# Main application
server {
    listen 443 ssl http2;
    server_name migrapanel.com;

    # SSL Configuration (after getting certificates)
    ssl_certificate /etc/letsencrypt/live/migrapanel.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/migrapanel.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req zone=mpanel_limit burst=40 nodelay;
    limit_conn mpanel_conn 20;

    client_max_body_size 100M;

    # API endpoints
    location /api/ {
        proxy_pass http://mpanel_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://mpanel_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # GraphQL
    location /graphql {
        proxy_pass http://mpanel_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Frontend (React SPA)
    location / {
        root /opt/mpanel/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /opt/mpanel/frontend/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 11. Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d migrapanel.com -d www.migrapanel.com --non-interactive --agree-tos --email admin@migrahosting.com

# Test auto-renewal
certbot renew --dry-run
```

### 12. Start Application with PM2

```bash
cd /opt/mpanel

# Create logs directory
mkdir -p logs

# Start application in cluster mode (4 instances)
pm2 start src/server.js --name mpanel-backend -i 4

# View logs
pm2 logs mpanel-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Follow the command output to complete setup
```

### 13. Configure Firewall

```bash
# Configure UFW
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable

# Check status
ufw status
```

### 14. Test the Installation

```bash
# Check backend health
curl http://localhost:2271/api/health

# Check PM2 status
pm2 status

# Check Nginx
systemctl status nginx

# Check PostgreSQL
systemctl status postgresql

# Check Redis
systemctl status redis-server

# View application logs
pm2 logs mpanel-backend --lines 50
```

### 15. Access Your Application

Open your browser and navigate to:
- **Frontend**: https://migrapanel.com
- **API Health**: https://migrapanel.com/api/health
- **API Docs**: https://migrapanel.com/api/docs (if enabled)

## Post-Deployment Configuration

### Create Admin User

```bash
cd /opt/mpanel

# Create admin user (if script exists)
node scripts/create-admin-user.js

# Or manually via psql
sudo -u postgres psql mpanel
```

### Setup Stripe Webhook

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://migrapanel.com/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy webhook secret to `.env` → `STRIPE_WEBHOOK_SECRET`
5. Restart application: `pm2 restart mpanel-backend`

### Configure Monitoring (Optional)

```bash
cd /opt/mpanel

# Start monitoring stack
docker-compose up -d

# Access Grafana: http://10.1.10.206:3000
# Default credentials: admin/admin
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs mpanel-backend

# Check environment
cat /opt/mpanel/.env

# Test database connection
sudo -u postgres psql mpanel -c "SELECT 1"

# Test Redis connection
redis-cli -a YOUR_REDIS_PASSWORD PING
```

### Frontend not loading
```bash
# Check if files exist
ls -la /opt/mpanel/frontend/dist/

# Rebuild frontend
cd /opt/mpanel/frontend
npm run build

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

### Database connection issues
```bash
# Check PostgreSQL is running
systemctl status postgresql

# Test connection
psql -U mpanel -d mpanel -h localhost

# Check pg_hba.conf
cat /etc/postgresql/*/main/pg_hba.conf | grep mpanel
```

### Permission issues
```bash
# Fix file permissions
chown -R www-data:www-data /opt/mpanel/frontend/dist
chmod -R 755 /opt/mpanel/frontend/dist

# Fix log permissions
mkdir -p /opt/mpanel/logs
chown -R $(whoami):$(whoami) /opt/mpanel/logs
```

## Useful Commands

```bash
# Restart backend
pm2 restart mpanel-backend

# View real-time logs
pm2 logs mpanel-backend

# Stop backend
pm2 stop mpanel-backend

# Reload Nginx
systemctl reload nginx

# Check system resources
htop

# Monitor database
sudo -u postgres psql mpanel -c "SELECT * FROM pg_stat_activity"

# Clear Redis cache
redis-cli -a YOUR_REDIS_PASSWORD FLUSHALL
```

## Backup & Recovery

### Create Backup
```bash
# Database backup
sudo -u postgres pg_dump mpanel | gzip > /opt/mpanel/backups/db_$(date +%Y%m%d).sql.gz

# Application files
tar -czf /opt/mpanel/backups/app_$(date +%Y%m%d).tar.gz -C /opt/mpanel \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='backups' .
```

### Restore Backup
```bash
# Restore database
gunzip < /opt/mpanel/backups/db_20251121.sql.gz | sudo -u postgres psql mpanel
```

## Maintenance

### Update Application
```bash
cd /opt/mpanel

# Pull latest changes
git pull origin master

# Install dependencies
npm install --production

# Update frontend
cd frontend
npm install
npm run build
cd ..

# Run migrations
npm run migrate

# Restart
pm2 restart mpanel-backend
```

### Monitor Logs
```bash
# PM2 logs
pm2 logs mpanel-backend

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# Application logs
tail -f /opt/mpanel/logs/mpanel.log
```

## Support

- **Documentation**: https://github.com/migrahosting-alt/mpanel
- **Issues**: https://github.com/migrahosting-alt/mpanel/issues
- **Email**: support@migrahosting.com

---

**Last Updated**: November 21, 2025  
**Version**: 1.0.0
