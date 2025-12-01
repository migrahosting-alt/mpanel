#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# MigraHosting Complete System Deployment
# 
# This script:
# 1. Builds and deploys mPanel frontend (production)
# 2. Activates auto-provisioning worker on srv1
# 3. Configures Apache for SPA routing
# 4. Tests the complete end-to-end flow
#
# Run from: MigraTeck-Main (local dev box)
###############################################################################

echo "════════════════════════════════════════════════════════════════════"
echo "  MigraHosting Complete System Deployment"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MPANEL_SERVER="mhadmin@10.1.10.206"
SRV1_SERVER="mhadmin@10.1.10.10"
DB_URL="postgres://mpanel_app:mpanel_Sikse7171222!@10.1.10.210:5432/mpanel"
PROVISIONING_TOKEN="28d19eed0835d57514fdca894d1a6a869d174af34b18dfbf5346fdaf6aff1680"

LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

step_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

###############################################################################
# STEP 1: Build and Deploy mPanel Frontend (Production)
###############################################################################

step_header "Step 1: Building mPanel Frontend (Production)"

log_info "Building frontend on mpanel-core..."
ssh $MPANEL_SERVER << 'ENDSSH'
set -e
cd /opt/mpanel/frontend
log_info() { echo -e "\033[0;34mℹ\033[0m $1"; }
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

log_info "Installing dependencies..."
npm install --legacy-peer-deps

log_info "Building production bundle..."
NODE_ENV=production npm run build

log_success "Frontend built successfully"
ls -lh dist/ | head -5
ENDSSH

if [ $? -eq 0 ]; then
    log_success "Frontend build completed"
else
    log_error "Frontend build failed"
    exit 1
fi

log_info "Deploying frontend to Apache document root..."
ssh $MPANEL_SERVER << 'ENDSSH'
set -e
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

# Create Apache document root
sudo mkdir -p /var/www/migrapanel.com/public

# Deploy built files
sudo rm -rf /var/www/migrapanel.com/public/*
sudo cp -r /opt/mpanel/frontend/dist/* /var/www/migrapanel.com/public/

# Set permissions
sudo chown -R www-data:www-data /var/www/migrapanel.com/public
sudo chmod -R 755 /var/www/migrapanel.com/public

log_success "Frontend deployed to /var/www/migrapanel.com/public"
ENDSSH

log_success "Step 1 completed"

###############################################################################
# STEP 2: Configure Apache for SPA Routing + API Proxy
###############################################################################

step_header "Step 2: Configuring Apache for SPA Routing"

log_info "Creating Apache vhost configuration..."
ssh $MPANEL_SERVER << 'ENDSSH'
set -e
log_info() { echo -e "\033[0;34mℹ\033[0m $1"; }
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

# Create vhost config
sudo tee /etc/apache2/sites-available/migrapanel.com.conf > /dev/null << 'EOF'
<VirtualHost *:80>
    ServerName migrapanel.com
    ServerAlias www.migrapanel.com
    DocumentRoot /var/www/migrapanel.com/public

    <Directory /var/www/migrapanel.com/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # Enable mod_rewrite for React Router
        RewriteEngine On
        RewriteBase /
        
        # Don't rewrite files or directories
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        
        # Rewrite everything else to index.html
        RewriteRule ^ index.html [L]
    </Directory>

    # Proxy API requests to backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:2271/api
    ProxyPassReverse /api http://localhost:2271/api
    
    # Proxy WebSocket
    ProxyPass /ws ws://localhost:2271/ws
    ProxyPassReverse /ws ws://localhost:2271/ws

    ErrorLog ${APACHE_LOG_DIR}/migrapanel.com-error.log
    CustomLog ${APACHE_LOG_DIR}/migrapanel.com-access.log combined
</VirtualHost>
EOF

log_success "Apache vhost config created"

# Enable required modules
log_info "Enabling Apache modules..."
sudo a2enmod rewrite proxy proxy_http proxy_wstunnel headers

# Enable site
log_info "Enabling site..."
sudo a2ensite migrapanel.com.conf

# Test configuration
log_info "Testing Apache configuration..."
sudo apache2ctl configtest

# Reload Apache
log_info "Reloading Apache..."
sudo systemctl reload apache2

log_success "Apache configured and reloaded"
ENDSSH

log_success "Step 2 completed"

###############################################################################
# STEP 3: Deploy Auto-Provisioning Worker to srv1
###############################################################################

step_header "Step 3: Deploying Auto-Provisioning Worker"

log_info "Creating directories on srv1..."
ssh $SRV1_SERVER << 'ENDSSH'
set -e
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

sudo mkdir -p /srv/web/clients
sudo mkdir -p /var/log/migrahosting
sudo chown mhadmin:mhadmin /var/log/migrahosting
sudo chmod 755 /srv/web/clients

log_success "Directories created"
ENDSSH

log_info "Installing provisioning script..."
ssh $SRV1_SERVER << 'ENDSSH'
set -e
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

sudo mv /tmp/provision_shared_hosting.sh /usr/local/bin/provision_shared_hosting.sh
sudo chmod +x /usr/local/bin/provision_shared_hosting.sh

log_success "Provisioning script installed"
ENDSSH

log_info "Installing Node.js dependencies..."
ssh $SRV1_SERVER << 'ENDSSH'
set -e
log_info() { echo -e "\033[0;34mℹ\033[0m $1"; }
log_success() { echo -e "\033[0;32m✓\033[0m $1"; }

cd /home/mhadmin

if [ ! -d "node_modules/pg" ]; then
    log_info "Installing pg module..."
    npm install pg
    log_success "pg module installed"
else
    log_success "pg module already installed"
fi
ENDSSH

log_info "Setting up cron job..."
ssh $SRV1_SERVER << ENDSSH
set -e
log_info() { echo -e "\033[0;34mℹ\033[0m \$1"; }
log_success() { echo -e "\033[0;32m✓\033[0m \$1"; }

# Remove existing cron if present
crontab -l 2>/dev/null | grep -v 'provision-worker.js' | crontab - || true

# Add new cron job
(crontab -l 2>/dev/null || true; echo '* * * * * DATABASE_URL="$DB_URL" node /home/mhadmin/provision-worker.js >> /var/log/migrahosting/worker.log 2>&1') | crontab -

log_success "Cron job configured (runs every minute)"

# Verify cron
log_info "Current crontab:"
crontab -l | grep provision-worker
ENDSSH

log_success "Step 3 completed"

###############################################################################
# STEP 4: Test Complete System
###############################################################################

step_header "Step 4: Testing Complete System"

log_info "Testing mPanel frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://migrapanel.com)
if [ "$FRONTEND_STATUS" = "200" ]; then
    log_success "Frontend accessible (HTTP $FRONTEND_STATUS)"
else
    log_warning "Frontend returned HTTP $FRONTEND_STATUS"
fi

log_info "Testing mPanel API..."
API_HEALTH=$(curl -s http://10.1.10.206:2271/health | grep -o '"status":"healthy"' || echo "")
if [ -n "$API_HEALTH" ]; then
    log_success "Backend API healthy"
else
    log_warning "Backend API may have issues"
fi

log_info "Testing provisioning endpoint..."
PROV_TEST=$(curl -s -X POST http://10.1.10.206:2271/api/provisioning/stripe \
  -H 'Content-Type: application/json' \
  -H "x-mpanel-token: $PROVISIONING_TOKEN" \
  -d '{"stripePaymentIntentId":"deploy-test-'$(date +%s)'","amount":1000,"currency":"usd","status":"paid","customerEmail":"deploy-test@example.com","cart":[{"id":"hosting:starter:test","name":"Test Starter","amount":1000}]}')

if echo "$PROV_TEST" | grep -q '"ok":true'; then
    log_success "Provisioning endpoint working"
    ORDER_ID=$(echo "$PROV_TEST" | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
    log_info "Test order created: $ORDER_ID"
else
    log_warning "Provisioning test failed: $PROV_TEST"
fi

log_info "Checking database..."
ssh $MPANEL_SERVER << ENDSSH
cd /opt/mpanel && node -e "
import('pg').then(async ({ default: pg }) => {
  const pool = new pg.Pool({ connectionString: '$DB_URL' });
  const orders = await pool.query('SELECT COUNT(*) FROM stripe_orders');
  const subs = await pool.query('SELECT COUNT(*) FROM hosting_subscriptions');
  const pending = await pool.query('SELECT COUNT(*) FROM hosting_subscriptions WHERE provisioning_status = \\\$1', ['pending']);
  console.log('📊 Database Status:');
  console.log('   Orders: ' + orders.rows[0].count);
  console.log('   Subscriptions: ' + subs.rows[0].count);
  console.log('   Pending Provisioning: ' + pending.rows[0].count);
  await pool.end();
}).catch(err => {
  console.error('Database check failed:', err.message);
  process.exit(1);
});
" || exit 1
ENDSSH

log_info "Testing worker (manual run)..."
ssh $SRV1_SERVER << ENDSSH
log_info() { echo -e "\033[0;34mℹ\033[0m \$1"; }
log_success() { echo -e "\033[0;32m✓\033[0m \$1"; }

log_info "Running worker once..."
DATABASE_URL="$DB_URL" node /home/mhadmin/provision-worker.js

if [ \$? -eq 0 ]; then
    log_success "Worker executed successfully"
else
    log_warning "Worker had issues - check logs"
fi

# Show last few log lines
if [ -f /var/log/migrahosting/worker.log ]; then
    echo ""
    log_info "Last 10 lines of worker log:"
    tail -10 /var/log/migrahosting/worker.log
fi
ENDSSH

log_success "Step 4 completed"

###############################################################################
# SUMMARY
###############################################################################

echo ""
echo "════════════════════════════════════════════════════════════════════"
echo -e "${GREEN}  ✓ Deployment Complete!${NC}"
echo "════════════════════════════════════════════════════════════════════"
echo ""
echo "📋 What was deployed:"
echo ""
echo "  ✓ mPanel Frontend (Production)"
echo "    https://migrapanel.com"
echo "    - Built with Vite"
echo "    - Deployed to /var/www/migrapanel.com/public"
echo "    - Apache configured for SPA routing"
echo ""
echo "  ✓ API Proxy"
echo "    https://migrapanel.com/api/* → http://localhost:2271/api/*"
echo ""
echo "  ✓ Auto-Provisioning Worker"
echo "    - Worker script: /home/mhadmin/provision-worker.js"
echo "    - Shell script: /usr/local/bin/provision_shared_hosting.sh"
echo "    - Cron: Runs every minute"
echo "    - Logs: /var/log/migrahosting/worker.log"
echo ""
echo "🧪 Test the complete flow:"
echo ""
echo "  1. Make a test payment:"
echo "     https://migrahosting.com/checkout"
echo ""
echo "  2. Check order created:"
echo "     ssh mhadmin@10.1.10.206 'cd /opt/mpanel && node -e \"..."
echo ""
echo "  3. Wait 1-2 minutes for worker"
echo ""
echo "  4. Check provisioned accounts:"
echo "     ssh mhadmin@10.1.10.10 'ls -la /srv/web/clients/'"
echo ""
echo "  5. Login to control panel:"
echo "     https://migrapanel.com"
echo ""
echo "📊 Monitor logs:"
echo ""
echo "  Worker:       tail -f /var/log/migrahosting/worker.log"
echo "  Provisioning: ls -la /var/log/migrahosting/provision_*.log"
echo "  Backend:      ssh mhadmin@10.1.10.206 'pm2 logs tenant-billing'"
echo ""
echo "════════════════════════════════════════════════════════════════════"
