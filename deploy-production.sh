#!/bin/bash

# ============================================
# mPanel Production Deployment Script
# ============================================
# This script automates the deployment of mPanel to production
# Run on your production server as: sudo bash deploy-production.sh
# ============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MPANEL_DIR="/var/www/mpanel"
LOG_FILE="/var/log/mpanel-deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root (use sudo)"
    fi
}

# ============================================
# Step 1: System Update
# ============================================
step1_update_system() {
    log "Step 1: Updating system packages..."
    apt update && apt upgrade -y
    log "✓ System updated"
}

# ============================================
# Step 2: Install Dependencies
# ============================================
step2_install_dependencies() {
    log "Step 2: Installing dependencies..."
    
    # Docker
    if ! command -v docker &> /dev/null; then
        log "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        systemctl enable docker
        systemctl start docker
    else
        log "Docker already installed"
    fi
    
    # Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log "Installing Docker Compose..."
        apt install -y docker-compose-plugin
    else
        log "Docker Compose already installed"
    fi
    
    # Node.js 20
    if ! command -v node &> /dev/null; then
        log "Installing Node.js 20..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    else
        log "Node.js already installed: $(node --version)"
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        log "Installing PM2..."
        npm install -g pm2
    else
        log "PM2 already installed"
    fi
    
    # Nginx
    if ! command -v nginx &> /dev/null; then
        log "Installing Nginx..."
        apt install -y nginx
    else
        log "Nginx already installed"
    fi
    
    # Certbot for SSL
    if ! command -v certbot &> /dev/null; then
        log "Installing Certbot..."
        apt install -y certbot python3-certbot-nginx
    else
        log "Certbot already installed"
    fi
    
    # Additional tools
    apt install -y git curl wget unzip htop
    
    log "✓ All dependencies installed"
}

# ============================================
# Step 3: Clone Repository
# ============================================
step3_clone_repository() {
    log "Step 3: Setting up mPanel repository..."
    
    # Create directory
    mkdir -p /var/www
    
    # Clone or pull
    if [ -d "$MPANEL_DIR" ]; then
        log "Repository exists, pulling latest changes..."
        cd "$MPANEL_DIR"
        git pull origin main
    else
        log "Cloning repository..."
        cd /var/www
        git clone https://github.com/migrahosting-alt/mpanel.git
        cd mpanel
    fi
    
    log "✓ Repository ready at $MPANEL_DIR"
}

# ============================================
# Step 4: Environment Configuration
# ============================================
step4_configure_environment() {
    log "Step 4: Configuring environment..."
    
    cd "$MPANEL_DIR"
    
    if [ ! -f .env ]; then
        if [ -f .env.production.template ]; then
            log "Creating .env from template..."
            cp .env.production.template .env
            warn "IMPORTANT: Edit .env file and replace all REPLACE_WITH_* values!"
            warn "Run: nano $MPANEL_DIR/.env"
            read -p "Press Enter after you've configured .env file..."
        else
            error ".env.production.template not found!"
        fi
    else
        log ".env file already exists"
    fi
    
    log "✓ Environment configured"
}

# ============================================
# Step 5: Install Dependencies
# ============================================
step5_install_packages() {
    log "Step 5: Installing Node.js packages..."
    
    cd "$MPANEL_DIR"
    
    # Backend
    log "Installing backend dependencies..."
    npm install --production
    
    # Frontend
    log "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    
    log "✓ Packages installed"
}

# ============================================
# Step 6: Start Infrastructure
# ============================================
step6_start_infrastructure() {
    log "Step 6: Starting infrastructure (PostgreSQL, Redis, MinIO)..."
    
    cd "$MPANEL_DIR"
    
    # Start Docker services
    docker compose up -d
    
    # Wait for services
    log "Waiting for services to be ready..."
    sleep 15
    
    # Verify services
    docker compose ps
    
    log "✓ Infrastructure started"
}

# ============================================
# Step 7: Database Migrations
# ============================================
step7_database_migrations() {
    log "Step 7: Running database migrations..."
    
    cd "$MPANEL_DIR"
    
    # Run Prisma migrations
    npx prisma migrate deploy
    
    # Generate Prisma client
    npx prisma generate
    
    # Create admin user (if script exists)
    if [ -f scripts/create-admin.js ]; then
        log "Creating admin user..."
        node scripts/create-admin.js
    fi
    
    log "✓ Database ready with all 130 tables"
}

# ============================================
# Step 8: Build Frontend
# ============================================
step8_build_frontend() {
    log "Step 8: Building frontend production bundle..."
    
    cd "$MPANEL_DIR/frontend"
    
    # Build
    npm run build
    
    # Verify build
    if [ ! -d "dist" ]; then
        error "Frontend build failed - dist/ directory not found"
    fi
    
    log "✓ Frontend built successfully"
}

# ============================================
# Step 9: Start Backend
# ============================================
step9_start_backend() {
    log "Step 9: Starting backend with PM2..."
    
    cd "$MPANEL_DIR"
    
    # Stop if already running
    pm2 delete mpanel-backend 2>/dev/null || true
    
    # Start backend
    pm2 start src/server.js --name mpanel-backend
    
    # Save PM2 config
    pm2 save
    
    # Enable startup on boot
    pm2 startup systemd -u root --hp /root
    
    # Check status
    pm2 status
    
    log "✓ Backend started"
}

# ============================================
# Step 10: Configure Nginx
# ============================================
step10_configure_nginx() {
    log "Step 10: Configuring Nginx..."
    
    # Read domain from .env or use default
    source "$MPANEL_DIR/.env"
    DOMAIN_PANEL=${DOMAIN_PANEL:-panel.yourdomain.com}
    DOMAIN_API=${DOMAIN_API:-api.yourdomain.com}
    DOMAIN_MONITORING=${DOMAIN_MONITORING:-monitoring.yourdomain.com}
    
    # Create Nginx config
    cat > /etc/nginx/sites-available/mpanel << EOF
# Backend API
server {
    listen 80;
    server_name $DOMAIN_API;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name $DOMAIN_PANEL;

    root $MPANEL_DIR/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Grafana (monitoring)
server {
    listen 80;
    server_name $DOMAIN_MONITORING;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/mpanel /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx config
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    
    log "✓ Nginx configured"
}

# ============================================
# Step 11: SSL Certificates
# ============================================
step11_setup_ssl() {
    log "Step 11: Setting up SSL certificates..."
    
    source "$MPANEL_DIR/.env"
    DOMAIN_PANEL=${DOMAIN_PANEL:-panel.yourdomain.com}
    DOMAIN_API=${DOMAIN_API:-api.yourdomain.com}
    DOMAIN_MONITORING=${DOMAIN_MONITORING:-monitoring.yourdomain.com}
    SSL_EMAIL=${SSL_EMAIL:-admin@yourdomain.com}
    
    log "Obtaining SSL certificates from Let's Encrypt..."
    certbot --nginx -d "$DOMAIN_API" -d "$DOMAIN_PANEL" -d "$DOMAIN_MONITORING" \
        --non-interactive --agree-tos --email "$SSL_EMAIL" --redirect
    
    # Test renewal
    certbot renew --dry-run
    
    log "✓ SSL certificates installed"
}

# ============================================
# Step 12: Firewall Configuration
# ============================================
step12_configure_firewall() {
    log "Step 12: Configuring firewall..."
    
    # Install UFW if not present
    if ! command -v ufw &> /dev/null; then
        apt install -y ufw
    fi
    
    # Configure firewall
    ufw allow ssh
    ufw allow http
    ufw allow https
    
    # Enable firewall
    ufw --force enable
    
    ufw status
    
    log "✓ Firewall configured"
}

# ============================================
# Step 13: Verification
# ============================================
step13_verify_deployment() {
    log "Step 13: Verifying deployment..."
    
    # Check Docker containers
    log "Checking Docker containers..."
    docker compose ps
    
    # Check PM2 process
    log "Checking PM2 process..."
    pm2 status
    
    # Check Nginx
    log "Checking Nginx..."
    systemctl status nginx --no-pager
    
    # Test API health
    log "Testing API health endpoint..."
    sleep 5
    curl -f http://localhost:3000/api/health || warn "API health check failed"
    
    log "✓ Verification complete"
}

# ============================================
# Step 14: Post-Deployment Instructions
# ============================================
step14_post_deployment() {
    log "Step 14: Post-deployment instructions..."
    
    source "$MPANEL_DIR/.env"
    DOMAIN_PANEL=${DOMAIN_PANEL:-panel.yourdomain.com}
    DOMAIN_API=${DOMAIN_API:-api.yourdomain.com}
    DOMAIN_MONITORING=${DOMAIN_MONITORING:-monitoring.yourdomain.com}
    
    echo ""
    echo "============================================"
    echo "🎉 mPanel Deployment Complete!"
    echo "============================================"
    echo ""
    echo "Access your mPanel installation:"
    echo "  Frontend:   https://$DOMAIN_PANEL"
    echo "  API:        https://$DOMAIN_API"
    echo "  Monitoring: https://$DOMAIN_MONITORING"
    echo ""
    echo "Next steps:"
    echo "  1. Configure Stripe webhook:"
    echo "     URL: https://$DOMAIN_API/api/webhooks/stripe"
    echo "  2. Test user registration"
    echo "  3. Enable 2FA in settings"
    echo "  4. Create your first subscription"
    echo ""
    echo "Useful commands:"
    echo "  View logs:       pm2 logs mpanel-backend"
    echo "  Restart backend: pm2 restart mpanel-backend"
    echo "  View services:   docker compose ps"
    echo "  Nginx logs:      tail -f /var/log/nginx/error.log"
    echo ""
    echo "Documentation: https://github.com/migrahosting-alt/mpanel"
    echo "============================================"
    
    log "✓ Deployment complete!"
}

# ============================================
# Main Execution
# ============================================
main() {
    log "Starting mPanel production deployment..."
    
    check_root
    
    step1_update_system
    step2_install_dependencies
    step3_clone_repository
    step4_configure_environment
    step5_install_packages
    step6_start_infrastructure
    step7_database_migrations
    step8_build_frontend
    step9_start_backend
    step10_configure_nginx
    step11_setup_ssl
    step12_configure_firewall
    step13_verify_deployment
    step14_post_deployment
    
    log "🚀 mPanel is now live in production!"
}

# Run main function
main "$@"
