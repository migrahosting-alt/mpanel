# mPanel Production Deployment Guide

## 🚀 Quick Start - One-Command Setup

SSH into your fresh Ubuntu 22.04/24.04 server and run:

```bash
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/production-server-setup.sh -o setup.sh
sudo bash setup.sh
```

**Installation time**: ~15-20 minutes

---

## 📋 What Gets Installed

### Core Services
- ✅ **Node.js 20.x** - Latest LTS version
- ✅ **PostgreSQL 16** - Database with optimized settings
- ✅ **Redis 7** - Caching and session storage
- ✅ **Nginx** - Reverse proxy and load balancer
- ✅ **PM2** - Process manager for Node.js

### Storage & Files
- ✅ **MinIO** - S3-compatible object storage
- ✅ **File system optimization** - For uploads and backups

### Monitoring & Observability
- ✅ **Prometheus** - Metrics collection (port 9090)
- ✅ **Grafana** - Visualization dashboards (port 3000)
- ✅ **Loki** - Log aggregation (port 3100)
- ✅ **Promtail** - Log shipping

### Security
- ✅ **UFW Firewall** - Configured with secure defaults
- ✅ **Fail2Ban** - Intrusion prevention
- ✅ **SSL/TLS Ready** - Certbot installed for Let's Encrypt
- ✅ **Strong passwords** - Auto-generated for all services

### DevOps
- ✅ **Docker & Docker Compose** - For monitoring stack
- ✅ **Automated backups** - Daily PostgreSQL + app backups
- ✅ **System optimization** - Kernel tuning for high performance

---

## 🔧 Manual Installation Steps (if you prefer control)

### 1. Server Requirements

**Minimum Specs:**
- OS: Ubuntu 22.04/24.04 LTS or Debian 11/12
- RAM: 4GB (8GB recommended)
- CPU: 2 cores (4 cores recommended)
- Disk: 40GB SSD
- Network: Public IP with ports 80, 443 open

**Recommended Specs:**
- RAM: 16GB
- CPU: 8 cores
- Disk: 100GB NVMe SSD
- Network: 1Gbps uplink

### 2. Initial Server Setup

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install basic tools
sudo apt-get install -y curl wget git build-essential ufw fail2ban
```

### 3. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 4. Install PostgreSQL 16

```bash
# Add PostgreSQL repository
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

# Install
sudo apt-get update
sudo apt-get install -y postgresql-16 postgresql-contrib-16

# Create database
sudo -u postgres psql -c "CREATE DATABASE mpanel;"
sudo -u postgres psql -c "CREATE USER mpanel WITH ENCRYPTED PASSWORD 'your_strong_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE mpanel TO mpanel;"
sudo -u postgres psql -d mpanel -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### 5. Install Redis 7

```bash
# Add Redis repository
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list

# Install
sudo apt-get update
sudo apt-get install -y redis

# Secure Redis
sudo sed -i 's/^# requirepass foobared/requirepass your_redis_password/' /etc/redis/redis.conf
sudo systemctl restart redis-server
```

### 6. Install Nginx

```bash
sudo apt-get install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 7. Install MinIO

```bash
# Download MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /tmp/minio
sudo mv /tmp/minio /usr/local/bin/
sudo chmod +x /usr/local/bin/minio

# Create user and directories
sudo useradd -r -s /bin/false minio-user
sudo mkdir -p /opt/minio/data
sudo chown -R minio-user:minio-user /opt/minio

# Create systemd service (see full script for service file)
sudo systemctl enable minio
sudo systemctl start minio
```

---

## 📁 Post-Installation Setup

### 1. Deploy Application

```bash
# Create application directory
sudo mkdir -p /opt/mpanel
cd /opt/mpanel

# Clone repository
sudo git clone https://github.com/migrahosting-alt/mpanel.git .

# Install dependencies
sudo npm install --production

# Build frontend
cd frontend
sudo npm install
sudo npm run build
cd ..
```

### 2. Configure Environment

```bash
# Copy and edit .env file
sudo cp .env.example .env
sudo nano .env
```

**Required .env variables:**

```env
NODE_ENV=production
PORT=2271

# Database
DATABASE_URL=postgresql://mpanel:your_password@localhost:5432/mpanel

# Redis
REDIS_URL=redis://:your_redis_password@localhost:6379

# Security (generate with: openssl rand -base64 64)
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_encryption_key_here
SESSION_SECRET=your_session_secret_here

# S3/MinIO
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=your_minio_user
S3_SECRET_KEY=your_minio_password
S3_BUCKET=mpanel-uploads

# Stripe
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Email
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=noreply@your-domain.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=mPanel <noreply@your-domain.com>

# Application
APP_NAME=mPanel
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com
```

### 3. Run Database Migrations

```bash
cd /opt/mpanel
sudo npm run migrate
```

### 4. Create Admin User

```bash
# Run SQL to create first admin
sudo -u postgres psql -d mpanel <<EOF
-- Insert default tenant
INSERT INTO tenants (id, name, domain, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Tenant', 'localhost', 'active')
ON CONFLICT DO NOTHING;

-- Create admin user
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, email_verified)
VALUES (
  uuid_generate_v4(),
  '00000000-0000-0000-0000-000000000001',
  'admin@your-domain.com',
  '\$2b\$10\$abcdefghijklmnopqrstuvwxyz',  -- Change this! Use bcrypt to hash your password
  'Admin',
  'User',
  'super_admin',
  'active',
  true
);
EOF
```

**Generate password hash:**

```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your_password', 10, (err, hash) => console.log(hash));"
```

### 5. Start Application with PM2

```bash
cd /opt/mpanel

# Start application (cluster mode with all CPU cores)
pm2 start src/server.js --name mpanel -i max

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd
# Run the command it outputs
```

### 6. Configure Nginx

Create `/etc/nginx/sites-available/mpanel`:

```nginx
upstream mpanel_backend {
    least_conn;
    server 127.0.0.1:2271;
    keepalive 64;
}

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;
    
    # API
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
    }
    
    # GraphQL
    location /graphql {
        proxy_pass http://mpanel_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://mpanel_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Frontend
    location / {
        root /opt/mpanel/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is configured automatically by Certbot
```

---

## 🔒 Security Hardening

### Firewall Configuration

```bash
# Reset firewall
sudo ufw --force reset

# Set defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (CHANGE PORT if you use custom SSH port)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable
```

### Fail2Ban Configuration

```bash
# Configure SSH protection
sudo cat > /etc/fail2ban/jail.d/sshd.conf <<EOF
[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

# Configure Nginx protection
sudo cat > /etc/fail2ban/jail.d/nginx.conf <<EOF
[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600
EOF

sudo systemctl restart fail2ban
```

### SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Recommended changes:
# PermitRootLogin no
# PasswordAuthentication no  # After setting up SSH keys
# PubkeyAuthentication yes
# Port 2222  # Change default port (optional)

sudo systemctl restart sshd
```

---

## 📊 Monitoring Setup

### Access Monitoring Services

- **Grafana**: http://your-server-ip:3000 (admin/admin)
- **Prometheus**: http://your-server-ip:9090
- **MinIO Console**: http://your-server-ip:9001

### Import Grafana Dashboards

1. Login to Grafana (http://your-server-ip:3000)
2. Go to Dashboards → Import
3. Import these dashboard IDs:
   - **1860** - Node Exporter Full
   - **14282** - PostgreSQL Database
   - **11835** - Redis Dashboard
   - **15489** - Nginx Metrics

---

## 🔄 Maintenance & Operations

### Application Management

```bash
# View logs
pm2 logs mpanel

# Restart application
pm2 restart mpanel

# Stop application
pm2 stop mpanel

# Monitor resources
pm2 monit

# Application status
pm2 status
```

### Database Backups

```bash
# Manual backup
sudo -u postgres pg_dump mpanel > /opt/mpanel/backups/mpanel_$(date +%Y%m%d).sql

# Automated backups (already configured in script)
# Run daily at 2 AM via cron
```

### Restore Database

```bash
# From backup
sudo -u postgres psql mpanel < /opt/mpanel/backups/mpanel_20231118.sql
```

### Update Application

```bash
cd /opt/mpanel

# Pull latest code
sudo git pull origin main

# Install dependencies
sudo npm install --production

# Rebuild frontend
cd frontend
sudo npm install
sudo npm run build
cd ..

# Run migrations
sudo npm run migrate

# Restart application
pm2 restart mpanel
```

### SSL Certificate Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Force renewal
sudo certbot renew --force-renewal
```

---

## 🚨 Troubleshooting

### Application won't start

```bash
# Check logs
pm2 logs mpanel --lines 100

# Check if port is already in use
sudo netstat -tulpn | grep 2271

# Check environment variables
sudo cat /opt/mpanel/.env
```

### Database connection issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if database exists
sudo -u postgres psql -l | grep mpanel

# Test connection
sudo -u postgres psql -d mpanel -c "SELECT version();"
```

### Redis connection issues

```bash
# Check Redis status
sudo systemctl status redis-server

# Test Redis
redis-cli -a your_redis_password ping
```

### Nginx errors

```bash
# Check Nginx status
sudo systemctl status nginx

# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### High memory usage

```bash
# Check processes
pm2 monit
htop

# Restart with specific memory limit
pm2 delete mpanel
pm2 start src/server.js --name mpanel -i max --max-memory-restart 1G
pm2 save
```

---

## 📈 Performance Tuning

### PostgreSQL Optimization

Edit `/etc/postgresql/16/main/postgresql.conf`:

```ini
# For 8GB RAM server
shared_buffers = 2GB
effective_cache_size = 6GB
maintenance_work_mem = 512MB
work_mem = 10MB
max_connections = 200
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

### Node.js Optimization

```bash
# Use cluster mode (already configured with PM2)
pm2 start src/server.js --name mpanel -i max

# Set specific instance count
pm2 start src/server.js --name mpanel -i 4
```

### Nginx Optimization

Edit `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 4096;

# Add these to http block
keepalive_timeout 65;
keepalive_requests 100;
client_body_buffer_size 128k;
client_max_body_size 50m;
```

---

## 📞 Support & Resources

- **Documentation**: Check `/opt/mpanel/README.md`
- **Logs Location**: `/opt/mpanel/logs/`
- **Credentials**: `/root/.mpanel-credentials` (keep secure!)
- **Configuration**: `/opt/mpanel/.env`

---

## ✅ Post-Deployment Checklist

- [ ] Change all default passwords
- [ ] Configure SMTP for email
- [ ] Add Stripe API keys
- [ ] Setup SSL certificate
- [ ] Configure firewall rules
- [ ] Test application functionality
- [ ] Setup monitoring alerts
- [ ] Configure automated backups
- [ ] Create admin user
- [ ] Test payment flows
- [ ] Configure domain DNS
- [ ] Test email delivery
- [ ] Setup log rotation
- [ ] Document server access
- [ ] Create disaster recovery plan

---

**🎉 Your mPanel installation is complete!**

Visit `https://your-domain.com` to access your application.
