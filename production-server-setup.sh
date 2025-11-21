#!/bin/bash

################################################################################
# mPanel Production Server Setup Script
# Description: Complete server setup for production deployment
# OS: Ubuntu 22.04/24.04 LTS or Debian 11/12
# Usage: sudo bash production-server-setup.sh
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MPANEL_USER="mpanel"
MPANEL_DIR="/opt/mpanel"
NODE_VERSION="20"
POSTGRES_VERSION="16"
REDIS_VERSION="7"

################################################################################
# Helper Functions
################################################################################

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

################################################################################
# System Updates
################################################################################

update_system() {
    print_header "Updating System Packages"
    
    apt-get update -qq
    apt-get upgrade -y -qq
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        ufw \
        fail2ban \
        htop \
        vim \
        unzip \
        jq \
        python3-pip
    
    print_success "System packages updated"
}

################################################################################
# Node.js Installation
################################################################################

install_nodejs() {
    print_header "Installing Node.js ${NODE_VERSION}.x"
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    # Install Node.js
    apt-get install -y nodejs
    
    # Verify installation
    node_version=$(node -v)
    npm_version=$(npm -v)
    
    print_success "Node.js ${node_version} installed"
    print_success "npm ${npm_version} installed"
    
    # Install PM2 globally
    npm install -g pm2
    pm2 startup systemd -u ${MPANEL_USER} --hp /home/${MPANEL_USER}
    
    print_success "PM2 process manager installed"
}

################################################################################
# PostgreSQL Installation
################################################################################

install_postgresql() {
    print_header "Installing PostgreSQL ${POSTGRES_VERSION}"
    
    # Add PostgreSQL repository
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    
    apt-get update -qq
    apt-get install -y postgresql-${POSTGRES_VERSION} postgresql-contrib-${POSTGRES_VERSION}
    
    # Enable and start PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql
    
    print_success "PostgreSQL ${POSTGRES_VERSION} installed"
}

configure_postgresql() {
    print_header "Configuring PostgreSQL"
    
    # Generate strong password
    PG_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Create database and user
    sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE mpanel;

-- Create user with strong password
CREATE USER mpanel WITH ENCRYPTED PASSWORD '${PG_PASSWORD}';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE mpanel TO mpanel;

-- Enable UUID extension
\c mpanel
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO mpanel;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO mpanel;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO mpanel;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO mpanel;
EOF
    
    # Save credentials
    echo "POSTGRES_PASSWORD=${PG_PASSWORD}" >> /root/.mpanel-credentials
    
    # Configure PostgreSQL for production
    PG_CONF="/etc/postgresql/${POSTGRES_VERSION}/main/postgresql.conf"
    
    # Backup original config
    cp ${PG_CONF} ${PG_CONF}.backup
    
    # Optimize settings for production (adjust based on server RAM)
    cat >> ${PG_CONF} <<EOF

# mPanel Production Settings
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 128MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
max_connections = 200
shared_preload_libraries = 'pg_stat_statements'
EOF
    
    # Restart PostgreSQL
    systemctl restart postgresql
    
    print_success "PostgreSQL configured with optimized settings"
    print_info "Database: mpanel"
    print_info "User: mpanel"
    print_warning "Password saved to /root/.mpanel-credentials"
}

################################################################################
# Redis Installation
################################################################################

install_redis() {
    print_header "Installing Redis ${REDIS_VERSION}"
    
    # Add Redis repository
    curl -fsSL https://packages.redis.io/gpg | gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" > /etc/apt/sources.list.d/redis.list
    
    apt-get update -qq
    apt-get install -y redis
    
    # Configure Redis for production
    REDIS_CONF="/etc/redis/redis.conf"
    cp ${REDIS_CONF} ${REDIS_CONF}.backup
    
    # Generate Redis password
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Update Redis configuration
    sed -i "s/^# requirepass foobared/requirepass ${REDIS_PASSWORD}/" ${REDIS_CONF}
    sed -i "s/^bind 127.0.0.1 ::1/bind 127.0.0.1/" ${REDIS_CONF}
    sed -i "s/^# maxmemory <bytes>/maxmemory 512mb/" ${REDIS_CONF}
    sed -i "s/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/" ${REDIS_CONF}
    
    # Save credentials
    echo "REDIS_PASSWORD=${REDIS_PASSWORD}" >> /root/.mpanel-credentials
    
    # Enable and restart Redis
    systemctl enable redis-server
    systemctl restart redis-server
    
    print_success "Redis installed and configured"
    print_warning "Password saved to /root/.mpanel-credentials"
}

################################################################################
# Nginx Installation & Configuration
################################################################################

install_nginx() {
    print_header "Installing Nginx"
    
    apt-get install -y nginx
    
    # Enable and start Nginx
    systemctl enable nginx
    systemctl start nginx
    
    print_success "Nginx installed"
}

configure_nginx() {
    print_header "Configuring Nginx for mPanel"
    
    # Create Nginx configuration for mPanel
    cat > /etc/nginx/sites-available/mpanel <<'EOF'
# mPanel Backend API
upstream mpanel_backend {
    least_conn;
    server 127.0.0.1:2271;
    keepalive 64;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=mpanel_limit:10m rate=10r/s;
limit_conn_zone $binary_remote_addr zone=mpanel_conn:10m;

server {
    listen 80;
    server_name _;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Rate limiting
    limit_req zone=mpanel_limit burst=20 nodelay;
    limit_conn mpanel_conn 10;
    
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
    
    # GraphQL endpoint
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
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Metrics (restrict access)
    location /metrics {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://mpanel_backend;
    }
    
    # Frontend (if built)
    location / {
        root /opt/mpanel/frontend/dist;
        try_files $uri $uri/ /index.html;
        expires 1h;
        add_header Cache-Control "public, immutable";
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    nginx -t
    
    # Reload Nginx
    systemctl reload nginx
    
    print_success "Nginx configured for mPanel"
}

################################################################################
# MinIO Installation (S3-compatible storage)
################################################################################

install_minio() {
    print_header "Installing MinIO"
    
    # Download MinIO
    wget https://dl.min.io/server/minio/release/linux-amd64/minio -O /usr/local/bin/minio
    chmod +x /usr/local/bin/minio
    
    # Create MinIO user and directories
    useradd -r -s /bin/false minio-user 2>/dev/null || true
    mkdir -p /opt/minio/data
    chown -R minio-user:minio-user /opt/minio
    
    # Generate MinIO credentials
    MINIO_ROOT_USER="mpanel-admin"
    MINIO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Save credentials
    echo "MINIO_ROOT_USER=${MINIO_ROOT_USER}" >> /root/.mpanel-credentials
    echo "MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD}" >> /root/.mpanel-credentials
    
    # Create systemd service
    cat > /etc/systemd/system/minio.service <<EOF
[Unit]
Description=MinIO
Documentation=https://docs.min.io
Wants=network-online.target
After=network-online.target

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
    
    # Enable and start MinIO
    systemctl daemon-reload
    systemctl enable minio
    systemctl start minio
    
    print_success "MinIO installed on port 9000 (API) and 9001 (Console)"
    print_warning "Credentials saved to /root/.mpanel-credentials"
}

################################################################################
# Monitoring Stack (Prometheus, Grafana, Loki)
################################################################################

install_monitoring() {
    print_header "Installing Monitoring Stack"
    
    # Install Docker (required for monitoring stack)
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Create monitoring directory
    mkdir -p /opt/monitoring
    
    # Create docker-compose.yml for monitoring
    cat > /opt/monitoring/docker-compose.yml <<'EOF'
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"
    networks:
      - monitoring
    depends_on:
      - prometheus

  loki:
    image: grafana/loki:latest
    container_name: loki
    restart: unless-stopped
    ports:
      - "3100:3100"
    volumes:
      - loki-data:/loki
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    restart: unless-stopped
    volumes:
      - /var/log:/var/log:ro
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring
    depends_on:
      - loki

volumes:
  prometheus-data:
  grafana-data:
  loki-data:

networks:
  monitoring:
    driver: bridge
EOF
    
    # Create Prometheus config
    cat > /opt/monitoring/prometheus.yml <<'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'mpanel'
    static_configs:
      - targets: ['host.docker.internal:2271']
    metrics_path: '/metrics'
  
  - job_name: 'node'
    static_configs:
      - targets: ['host.docker.internal:9100']
EOF
    
    # Create Promtail config
    cat > /opt/monitoring/promtail-config.yml <<'EOF'
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: mpanel
    static_configs:
      - targets:
          - localhost
        labels:
          job: mpanel
          __path__: /var/log/mpanel/*.log
EOF
    
    # Start monitoring stack
    cd /opt/monitoring
    docker-compose up -d
    
    print_success "Monitoring stack installed"
    print_info "Prometheus: http://localhost:9090"
    print_info "Grafana: http://localhost:3000 (admin/admin)"
    print_info "Loki: http://localhost:3100"
}

################################################################################
# Security Configuration
################################################################################

configure_firewall() {
    print_header "Configuring Firewall (UFW)"
    
    # Reset UFW
    ufw --force reset
    
    # Set defaults
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (IMPORTANT!)
    ufw allow 22/tcp
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Allow monitoring (restrict to local only)
    ufw allow from 127.0.0.1 to any port 9090  # Prometheus
    ufw allow from 127.0.0.1 to any port 3000  # Grafana
    
    # Enable firewall
    ufw --force enable
    
    print_success "Firewall configured"
}

configure_fail2ban() {
    print_header "Configuring Fail2Ban"
    
    # Create Nginx jail
    cat > /etc/fail2ban/jail.d/nginx.conf <<EOF
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
    
    # Create SSH jail
    cat > /etc/fail2ban/jail.d/sshd.conf <<EOF
[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
EOF
    
    # Restart Fail2Ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    print_success "Fail2Ban configured"
}

################################################################################
# Application Setup
################################################################################

create_mpanel_user() {
    print_header "Creating mPanel System User"
    
    # Create user if doesn't exist
    if ! id "${MPANEL_USER}" &>/dev/null; then
        useradd -r -m -s /bin/bash ${MPANEL_USER}
        print_success "User '${MPANEL_USER}' created"
    else
        print_warning "User '${MPANEL_USER}' already exists"
    fi
}

setup_mpanel_directory() {
    print_header "Setting Up Application Directory"
    
    # Create directories
    mkdir -p ${MPANEL_DIR}
    mkdir -p ${MPANEL_DIR}/logs
    mkdir -p ${MPANEL_DIR}/backups
    mkdir -p ${MPANEL_DIR}/uploads
    mkdir -p ${MPANEL_DIR}/ssl
    
    # Set permissions
    chown -R ${MPANEL_USER}:${MPANEL_USER} ${MPANEL_DIR}
    chmod 755 ${MPANEL_DIR}
    
    print_success "Application directory created at ${MPANEL_DIR}"
}

generate_secrets() {
    print_header "Generating Security Secrets"
    
    JWT_SECRET=$(openssl rand -base64 64 | tr -d "\n")
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # Save to credentials file
    cat >> /root/.mpanel-credentials <<EOF

# Application Secrets
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
EOF
    
    chmod 600 /root/.mpanel-credentials
    
    print_success "Security secrets generated"
    print_warning "All credentials saved to /root/.mpanel-credentials"
}

create_env_file() {
    print_header "Creating Production .env File"
    
    # Source credentials
    source /root/.mpanel-credentials
    
    cat > ${MPANEL_DIR}/.env <<EOF
# Environment
NODE_ENV=production
PORT=2271

# Database
DATABASE_URL=postgresql://mpanel:${POSTGRES_PASSWORD}@localhost:5432/mpanel

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}

# MinIO / S3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=${MINIO_ROOT_USER}
S3_SECRET_KEY=${MINIO_ROOT_PASSWORD}
S3_BUCKET=mpanel-uploads

# Email (configure with your SMTP settings)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your_smtp_password
SMTP_FROM=mPanel <noreply@example.com>

# Stripe (add your keys)
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# OpenAI (optional)
OPENAI_API_KEY=sk-your_openai_key_here

# Application
APP_NAME=mPanel
APP_URL=https://your-domain.com
FRONTEND_URL=https://your-domain.com

# Monitoring
SENTRY_DSN=
ENABLE_SENTRY=false

# Logging
LOG_LEVEL=info
LOG_DIR=${MPANEL_DIR}/logs
EOF
    
    chown ${MPANEL_USER}:${MPANEL_USER} ${MPANEL_DIR}/.env
    chmod 600 ${MPANEL_DIR}/.env
    
    print_success ".env file created"
}

################################################################################
# SSL/TLS Setup
################################################################################

install_certbot() {
    print_header "Installing Certbot (Let's Encrypt)"
    
    apt-get install -y certbot python3-certbot-nginx
    
    print_success "Certbot installed"
    print_info "To obtain SSL certificate, run:"
    print_info "  certbot --nginx -d your-domain.com -d www.your-domain.com"
}

################################################################################
# System Optimization
################################################################################

optimize_system() {
    print_header "Optimizing System for Production"
    
    # Increase file limits
    cat >> /etc/security/limits.conf <<EOF

# mPanel optimizations
${MPANEL_USER} soft nofile 65536
${MPANEL_USER} hard nofile 65536
${MPANEL_USER} soft nproc 32768
${MPANEL_USER} hard nproc 32768
EOF
    
    # Kernel optimizations
    cat >> /etc/sysctl.conf <<EOF

# mPanel network optimizations
net.core.somaxconn=65536
net.ipv4.tcp_max_syn_backlog=8192
net.ipv4.ip_local_port_range=1024 65535
net.ipv4.tcp_tw_reuse=1
net.ipv4.tcp_fin_timeout=30
vm.swappiness=10
EOF
    
    sysctl -p
    
    print_success "System optimized"
}

################################################################################
# Backup Configuration
################################################################################

setup_backups() {
    print_header "Setting Up Automated Backups"
    
    # Create backup script
    cat > /usr/local/bin/mpanel-backup <<'EOF'
#!/bin/bash
BACKUP_DIR="/opt/mpanel/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_BACKUP="${BACKUP_DIR}/db_${TIMESTAMP}.sql"
APP_BACKUP="${BACKUP_DIR}/app_${TIMESTAMP}.tar.gz"

# Database backup
sudo -u postgres pg_dump mpanel > ${DB_BACKUP}
gzip ${DB_BACKUP}

# Application files backup
tar -czf ${APP_BACKUP} -C /opt/mpanel --exclude='node_modules' --exclude='backups' .

# Keep only last 7 days of backups
find ${BACKUP_DIR} -name "*.gz" -mtime +7 -delete

echo "Backup completed: ${TIMESTAMP}"
EOF
    
    chmod +x /usr/local/bin/mpanel-backup
    
    # Add to crontab (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/mpanel-backup >> /var/log/mpanel-backup.log 2>&1") | crontab -
    
    print_success "Automated backups configured (daily at 2 AM)"
}

################################################################################
# Final Steps
################################################################################

print_summary() {
    print_header "Installation Complete!"
    
    echo -e "${GREEN}✓ Node.js ${NODE_VERSION} installed${NC}"
    echo -e "${GREEN}✓ PostgreSQL ${POSTGRES_VERSION} configured${NC}"
    echo -e "${GREEN}✓ Redis configured${NC}"
    echo -e "${GREEN}✓ Nginx configured${NC}"
    echo -e "${GREEN}✓ MinIO installed${NC}"
    echo -e "${GREEN}✓ Monitoring stack ready${NC}"
    echo -e "${GREEN}✓ Firewall configured${NC}"
    echo -e "${GREEN}✓ Fail2Ban enabled${NC}"
    echo -e "${GREEN}✓ System optimized${NC}"
    echo -e "${GREEN}✓ Automated backups configured${NC}"
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Next Steps:${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo "1. Deploy your application:"
    echo "   cd ${MPANEL_DIR}"
    echo "   git clone <your-repo-url> ."
    echo "   npm install --production"
    echo ""
    echo "2. Run database migrations:"
    echo "   npm run migrate"
    echo ""
    echo "3. Start application with PM2:"
    echo "   pm2 start src/server.js --name mpanel -i max"
    echo "   pm2 save"
    echo ""
    echo "4. Configure SSL certificate:"
    echo "   certbot --nginx -d your-domain.com"
    echo ""
    echo "5. Update .env file with your settings:"
    echo "   nano ${MPANEL_DIR}/.env"
    echo ""
    echo -e "${YELLOW}Important Files:${NC}"
    echo "   - Credentials: /root/.mpanel-credentials"
    echo "   - Environment: ${MPANEL_DIR}/.env"
    echo "   - Nginx config: /etc/nginx/sites-available/mpanel"
    echo "   - Logs: ${MPANEL_DIR}/logs"
    echo ""
    echo -e "${YELLOW}Services:${NC}"
    echo "   - API: http://localhost:2271"
    echo "   - Grafana: http://localhost:3000"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - MinIO Console: http://localhost:9001"
    echo ""
    echo -e "${RED}⚠ SECURITY:${NC}"
    echo "   - Change default passwords in /root/.mpanel-credentials"
    echo "   - Configure firewall rules for your use case"
    echo "   - Set up SSL/TLS certificates"
    echo "   - Update SMTP and Stripe credentials in .env"
    echo ""
}

################################################################################
# Main Installation Flow
################################################################################

main() {
    print_header "mPanel Production Server Setup"
    
    check_root
    
    # System setup
    update_system
    
    # Core services
    install_nodejs
    install_postgresql
    configure_postgresql
    install_redis
    
    # Web server
    install_nginx
    configure_nginx
    
    # Storage
    install_minio
    
    # Monitoring
    install_monitoring
    
    # Security
    configure_firewall
    configure_fail2ban
    
    # Application
    create_mpanel_user
    setup_mpanel_directory
    generate_secrets
    create_env_file
    
    # SSL/TLS
    install_certbot
    
    # Optimization
    optimize_system
    
    # Backups
    setup_backups
    
    # Summary
    print_summary
}

# Run installation
main
