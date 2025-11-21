# Production Deployment Guide

## Prerequisites

### System Requirements
- Node.js 20.x or higher
- PostgreSQL 15+
- Redis 7+
- Nginx 1.24+
- Docker 24+ (optional)
- Minimum 4GB RAM, 2 CPU cores
- 50GB SSD storage

### Environment Setup
1. Production server (Ubuntu 22.04 LTS recommended)
2. Domain with SSL certificate
3. SMTP service for email
4. S3-compatible storage (MinIO/AWS S3)
5. Stripe account for billing

## Installation Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2. Database Configuration

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE mpanel_production;
CREATE USER mpanel WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE mpanel_production TO mpanel;
\q

# Configure PostgreSQL for production
sudo nano /etc/postgresql/15/main/postgresql.conf
```

Update settings:
```
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB
```

### 3. Redis Configuration

```bash
sudo nano /etc/redis/redis.conf
```

Update settings:
```
bind 127.0.0.1
requirepass your_redis_password
maxmemory 512mb
maxmemory-policy allkeys-lru
```

Restart Redis:
```bash
sudo systemctl restart redis-server
```

### 4. Application Deployment

```bash
# Clone repository
cd /var/www
sudo git clone https://github.com/your-org/mpanel.git
cd mpanel/mpanel-main/mpanel-main

# Install dependencies
npm install --production

# Create .env file
sudo nano .env
```

Environment variables:
```env
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://mpanel:your_secure_password@localhost:5432/mpanel_production
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mpanel_production
DB_USER=mpanel
DB_PASSWORD=your_secure_password
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# JWT
JWT_SECRET=your_jwt_secret_at_least_32_chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=7d

# CSRF
CSRF_SECRET=your_csrf_secret_at_least_32_chars

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com

# Storage (S3/MinIO)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=mpanel-backups
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_REGION=us-east-1

# CDN (Cloudflare)
CDN_ENABLED=true
CDN_PROVIDER=cloudflare
CDN_BASE_URL=https://cdn.yourdomain.com
CDN_ZONE_ID=your_zone_id
CDN_API_KEY=your_cloudflare_api_key
CDN_API_EMAIL=your_cloudflare_email

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_URL=http://localhost:3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Application
CORS_ORIGIN=https://yourdomain.com
UPLOAD_DIR=/var/www/mpanel/uploads
LOG_LEVEL=info

# Workers
WORKERS=4
```

### 5. Run Database Migrations

```bash
npm run migrate
```

### 6. Build Frontend (if applicable)

```bash
cd frontend
npm install
npm run build
```

### 7. Start Application with PM2

```bash
# Start with cluster mode
pm2 start src/server.js --name mpanel-api -i 4

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 8. Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/mpanel
```

Nginx configuration:
```nginx
upstream mpanel_backend {
  least_conn;
  server 127.0.0.1:3000;
  server 127.0.0.1:3001;
  server 127.0.0.1:3002;
  server 127.0.0.1:3003;
}

server {
  listen 80;
  server_name api.yourdomain.com;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;

  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;

  client_max_body_size 50M;

  location / {
    proxy_pass http://mpanel_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  location /uploads {
    alias /var/www/mpanel/uploads;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. SSL Certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 10. Firewall Configuration

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Monitoring Setup

### Prometheus

```bash
# Install Prometheus
cd /opt
sudo wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
sudo tar xvf prometheus-2.45.0.linux-amd64.tar.gz
sudo mv prometheus-2.45.0.linux-amd64 prometheus

# Configure
sudo nano /opt/prometheus/prometheus.yml
```

### Grafana

```bash
# Install Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

## Backup Configuration

### Automated Database Backups

```bash
# Create backup script
sudo nano /usr/local/bin/mpanel-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/mpanel"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Database backup
pg_dump -U mpanel mpanel_production | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Upload to S3
aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz s3://mpanel-backups/

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /usr/local/bin/mpanel-backup.sh

# Add to crontab
crontab -e
0 2 * * * /usr/local/bin/mpanel-backup.sh
```

## Health Checks

```bash
# API health
curl https://api.yourdomain.com/api/health

# Database connection
psql -U mpanel -d mpanel_production -c "SELECT 1"

# Redis connection
redis-cli -a your_redis_password PING

# PM2 status
pm2 status
```

## Rollback Procedure

```bash
# Stop current version
pm2 stop mpanel-api

# Checkout previous version
git checkout <previous_commit_hash>

# Install dependencies
npm install --production

# Run migrations (if needed)
npm run migrate

# Restart
pm2 restart mpanel-api
```

## Troubleshooting

### Application Logs
```bash
pm2 logs mpanel-api
tail -f /var/www/mpanel/logs/error.log
```

### Database Logs
```bash
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Nginx Logs
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Security Checklist
- [ ] Firewall configured
- [ ] SSL certificate installed
- [ ] Database password secure
- [ ] Redis password set
- [ ] Environment variables protected
- [ ] File permissions correct (600 for .env)
- [ ] Fail2ban installed
- [ ] Regular security updates scheduled

## Performance Optimization
- [ ] Database indexes created
- [ ] Redis caching enabled
- [ ] CDN configured
- [ ] Gzip compression enabled
- [ ] Static asset caching configured
- [ ] PM2 cluster mode enabled

## Monitoring Checklist
- [ ] Prometheus collecting metrics
- [ ] Grafana dashboards configured
- [ ] Alert rules set up
- [ ] Uptime monitoring active
- [ ] Log aggregation working
- [ ] Backup verification scheduled

---

Last Updated: 2024-11-11
