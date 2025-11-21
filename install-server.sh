#!/bin/bash

################################################################################
# mPanel Complete Server Installation Script
# One-command setup for Ubuntu 22.04/24.04 or Debian 11/12
# Usage: curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/install-server.sh | sudo bash
# Or:    wget -qO- https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/install-server.sh | sudo bash
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NODE_VERSION="20"
POSTGRES_VERSION="16"
MPANEL_DIR="/opt/mpanel"
MPANEL_USER="mpanel"
CREDENTIALS_FILE="/root/.mpanel-credentials"

# Helper Functions
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; exit 1; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_header() { echo -e "\n${BLUE}═══ $1 ═══${NC}\n"; }

# Check root
[[ $EUID -ne 0 ]] && log_error "Run as root: sudo bash install-server.sh"

################################################################################
# STEP 1: System Update
################################################################################
log_header "Step 1/12: Updating System"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg lsb-release ufw fail2ban htop vim \
    unzip jq python3-pip
log_success "System updated"

################################################################################
# STEP 2: Node.js
################################################################################
log_header "Step 2/12: Installing Node.js ${NODE_VERSION}"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
log_success "Node.js $(node -v) installed"

npm install -g pm2
log_success "PM2 installed"

################################################################################
# STEP 3: PostgreSQL
################################################################################
log_header "Step 3/12: Installing PostgreSQL ${POSTGRES_VERSION}"
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
    gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y postgresql-${POSTGRES_VERSION} postgresql-contrib-${POSTGRES_VERSION}

systemctl enable postgresql
systemctl start postgresql

# Configure PostgreSQL
PG_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
sudo -u postgres psql <<EOF
CREATE DATABASE mpanel;
CREATE USER mpanel WITH ENCRYPTED PASSWORD '${PG_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE mpanel TO mpanel;
\c mpanel
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
GRANT ALL ON SCHEMA public TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mpanel;
EOF

echo "POSTGRES_PASSWORD=${PG_PASSWORD}" > ${CREDENTIALS_FILE}
log_success "PostgreSQL configured (credentials saved)"

################################################################################
# STEP 4: Redis
################################################################################
log_header "Step 4/12: Installing Redis"
curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" \
    > /etc/apt/sources.list.d/redis.list
apt-get update -qq
apt-get install -y redis

REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
sed -i "s/^# requirepass foobared/requirepass ${REDIS_PASSWORD}/" /etc/redis/redis.conf
sed -i "s/^bind 127.0.0.1 ::1/bind 127.0.0.1/" /etc/redis/redis.conf
sed -i "s/^# maxmemory <bytes>/maxmemory 512mb/" /etc/redis/redis.conf
sed -i "s/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/" /etc/redis/redis.conf

systemctl enable redis-server
systemctl restart redis-server

echo "REDIS_PASSWORD=${REDIS_PASSWORD}" >> ${CREDENTIALS_FILE}
log_success "Redis configured"

################################################################################
# STEP 5: Nginx
################################################################################
log_header "Step 5/12: Installing Nginx"
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
log_success "Nginx installed"

################################################################################
# STEP 6: Docker (for monitoring stack)
################################################################################
log_header "Step 6/12: Installing Docker"
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

systemctl enable docker
systemctl start docker
log_success "Docker installed"

################################################################################
# STEP 7: MinIO (S3-compatible storage)
################################################################################
log_header "Step 7/12: Installing MinIO"
wget -q https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
chmod +x /usr/local/bin/minio

useradd -r -s /bin/false minio-user 2>/dev/null || true
mkdir -p /opt/minio/data
chown -R minio-user:minio-user /opt/minio

MINIO_ROOT_USER="mpanel-admin"
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

cat > /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO
After=network-online.target
Wants=network-online.target

[Service]
User=minio-user
Group=minio-user
WorkingDirectory=/opt/minio
Environment="MINIO_ROOT_USER=${MINIO_ROOT_USER}"
Environment="MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}"
ExecStart=/usr/local/bin/minio server /opt/minio/data --console-address ":9001" --address ":9000"
Restart=always
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable minio
systemctl start minio

echo "MINIO_ROOT_USER=${MINIO_ROOT_USER}" >> ${CREDENTIALS_FILE}
echo "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" >> ${CREDENTIALS_FILE}
log_success "MinIO installed (ports 9000, 9001)"

################################################################################
# STEP 8: Generate Security Secrets
################################################################################
log_header "Step 8/12: Generating Security Secrets"
JWT_SECRET=$(openssl rand -base64 64 | tr -d "\n")
ENCRYPTION_KEY=$(openssl rand -hex 32)
MPANEL_API_TOKEN=$(openssl rand -base64 64 | tr -d "\n")

cat >> ${CREDENTIALS_FILE} <<EOF

# Security Secrets
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
MPANEL_API_TOKEN=${MPANEL_API_TOKEN}
EOF

chmod 600 ${CREDENTIALS_FILE}
log_success "Secrets generated"

################################################################################
# STEP 9: Create mPanel User & Directories
################################################################################
log_header "Step 9/12: Setting Up Application"
useradd -r -m -s /bin/bash ${MPANEL_USER} 2>/dev/null || log_warning "User exists"

mkdir -p ${MPANEL_DIR}/{logs,backups,uploads,ssl}
chown -R ${MPANEL_USER}:${MPANEL_USER} ${MPANEL_DIR}
log_success "Application directories created"

################################################################################
# STEP 10: Firewall Configuration
################################################################################
log_header "Step 10/12: Configuring Firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
log_success "Firewall configured (SSH, HTTP, HTTPS allowed)"

################################################################################
# STEP 11: Fail2Ban
################################################################################
log_header "Step 11/12: Configuring Fail2Ban"
cat > /etc/fail2ban/jail.d/nginx.conf <<'EOF'
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
findtime = 300
bantime = 3600
EOF

cat > /etc/fail2ban/jail.d/sshd.conf <<'EOF'
[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log_success "Fail2Ban configured"

################################################################################
# STEP 12: SSL/TLS Setup (Certbot)
################################################################################
log_header "Step 12/12: Installing Certbot"
apt-get install -y certbot python3-certbot-nginx
log_success "Certbot installed"

################################################################################
# FINAL: Create .env Template
################################################################################
log_header "Creating Production .env Template"

source ${CREDENTIALS_FILE}

cat > ${MPANEL_DIR}/.env.production <<EOF
# mPanel Production Environment
# Generated: $(date)

# Environment
NODE_ENV=production
PORT=2271
API_VERSION=v1

# Database
DATABASE_URL=postgresql://mpanel:${POSTGRES_PASSWORD}@localhost:5432/mpanel
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_SESSION_TTL=86400

# MinIO/S3
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=${MINIO_ROOT_USER}
MINIO_SECRET_KEY=${MINIO_ROOT_PASSWORD}
MINIO_BUCKET=mpanel-assets

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# API Token
MPANEL_API_TOKEN=${MPANEL_API_TOKEN}

# Encryption
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Stripe (REPLACE WITH YOUR KEYS)
STRIPE_SECRET_KEY=sk_live_REPLACE_ME
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_ME

# Tax
TAX_ENABLED=true
DEFAULT_TAX_RATE=0.10

# NameSilo (REPLACE WITH YOUR KEY)
NAMESILO_API_KEY=REPLACE_ME
NAMESILO_SANDBOX=false
NAMESILO_API_URL=https://www.namesilo.com/api

# Email (REPLACE WITH YOUR SMTP)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=REPLACE_ME
SMTP_FROM=mPanel <noreply@yourdomain.com>

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=2273
LOKI_URL=http://localhost:2275

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS (UPDATE WITH YOUR DOMAIN)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=${MPANEL_DIR}/logs/mpanel.log

# OpenAI (OPTIONAL)
OPENAI_API_KEY=sk-proj-REPLACE_ME

# Application URL
APP_URL=https://yourdomain.com
EOF

chown ${MPANEL_USER}:${MPANEL_USER} ${MPANEL_DIR}/.env.production
chmod 600 ${MPANEL_DIR}/.env.production

################################################################################
# COMPLETION SUMMARY
################################################################################
clear
cat <<EOF

${GREEN}╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✓ mPanel Server Installation Complete!                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝${NC}

${BLUE}Installed Components:${NC}
  ✓ Node.js $(node -v)
  ✓ PostgreSQL ${POSTGRES_VERSION}
  ✓ Redis 7
  ✓ Nginx
  ✓ Docker & Docker Compose
  ✓ MinIO (S3 storage)
  ✓ PM2 Process Manager
  ✓ Certbot (SSL)
  ✓ UFW Firewall
  ✓ Fail2Ban

${YELLOW}Next Steps:${NC}

1. ${BLUE}Deploy mPanel Application:${NC}
   cd ${MPANEL_DIR}
   git clone https://github.com/migrahosting-alt/mpanel.git .
   npm install --production

2. ${BLUE}Configure Environment:${NC}
   cp .env.production .env
   nano .env
   ${YELLOW}# Update: STRIPE_SECRET_KEY, SMTP_*, NAMESILO_API_KEY, CORS_ORIGIN${NC}

3. ${BLUE}Run Database Migrations:${NC}
   npm run migrate

4. ${BLUE}Build Frontend:${NC}
   cd frontend
   npm install
   npm run build
   cd ..

5. ${BLUE}Start Application:${NC}
   pm2 start src/server.js --name mpanel-backend -i max
   pm2 save
   pm2 startup

6. ${BLUE}Configure Nginx:${NC}
   nano /etc/nginx/sites-available/mpanel
   ${YELLOW}# See: https://github.com/migrahosting-alt/mpanel/blob/main/nginx-loadbalancer.conf${NC}
   ln -s /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
   nginx -t
   systemctl reload nginx

7. ${BLUE}Setup SSL Certificate:${NC}
   certbot --nginx -d yourdomain.com -d www.yourdomain.com

${YELLOW}Important Files:${NC}
  📄 Credentials: ${CREDENTIALS_FILE}
  📄 Environment: ${MPANEL_DIR}/.env.production
  📄 App Directory: ${MPANEL_DIR}
  📄 Logs: ${MPANEL_DIR}/logs

${YELLOW}Service Access:${NC}
  🌐 API: http://localhost:2271
  🗄️  MinIO Console: http://localhost:9001
  📊 Grafana: http://localhost:3000 (after docker-compose up)
  📈 Prometheus: http://localhost:9090 (after docker-compose up)

${YELLOW}Useful Commands:${NC}
  pm2 status              ${BLUE}# Check app status${NC}
  pm2 logs mpanel-backend ${BLUE}# View logs${NC}
  pm2 restart all         ${BLUE}# Restart app${NC}
  systemctl status nginx  ${BLUE}# Check Nginx${NC}
  docker ps               ${BLUE}# Check containers${NC}

${RED}⚠️  Security Reminders:${NC}
  - Change all REPLACE_ME values in .env
  - Keep ${CREDENTIALS_FILE} secure (already chmod 600)
  - Configure SSL/TLS before going live
  - Update firewall rules for your specific needs
  - Set up regular backups

${GREEN}Documentation:${NC} https://github.com/migrahosting-alt/mpanel

EOF

log_success "Installation script complete!"
log_info "Review credentials in: ${CREDENTIALS_FILE}"
