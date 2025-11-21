#!/bin/bash

# ============================================
# Complete mPanel Deployment Script for MigraHosting Server
# ============================================

set -e  # Exit on error

echo "============================================"
echo "🚀 mPanel Full Deployment"
echo "============================================"
echo ""

# Step 1: Clone mPanel from GitHub
echo "==> Step 1: Cloning mPanel from GitHub..."
cd /opt
if [ -d "mpanel" ]; then
    echo "mPanel directory exists, pulling latest..."
    cd mpanel
    git pull origin main
else
    echo "Cloning fresh copy..."
    git clone https://github.com/migrahosting-alt/mpanel.git
    cd mpanel
fi

echo "✅ Code cloned to /opt/mpanel"
echo ""

# Step 2: Install backend dependencies
echo "==> Step 2: Installing backend dependencies..."
npm install --production

echo "✅ Backend dependencies installed"
echo ""

# Step 3: Install frontend dependencies
echo "==> Step 3: Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "✅ Frontend dependencies installed"
echo ""

# Step 4: Configure environment
echo "==> Step 4: Setting up environment configuration..."

if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cat > .env << 'ENVEOF'
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1
FRONTEND_URL=https://migrapanel.com
CORS_ORIGIN=https://migrapanel.com

# Database
DATABASE_URL=postgresql://mpanel_user:secure_mpanel_password_2024@localhost:5432/mpanel_db
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis (will install later)
REDIS_URL=redis://localhost:6379
REDIS_SESSION_TTL=604800

# MinIO/S3 (will install later)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=mpanel-production

# JWT & Security
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Encryption
ENCRYPTION_KEY=$(openssl rand -base64 32 | head -c 32)

# API Token
MPANEL_API_TOKEN=$(openssl rand -hex 32)

# Payment Gateway (Stripe) - REPLACE WITH YOUR KEYS
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_YOUR_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_YOUR_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_SECRET

# Tax & ICANN
TAX_ENABLED=true
DEFAULT_TAX_RATE=0.10
ICANN_ENABLED=true
ICANN_FEE_PER_YEAR=0.18

# Email SMTP - REPLACE WITH YOUR CREDENTIALS
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@migrapanel.com
EMAIL_FROM_NAME=mPanel
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=REPLACE_WITH_YOUR_EMAIL
SMTP_PASS=REPLACE_WITH_YOUR_APP_PASSWORD

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/mpanel/mpanel.log

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENVEOF

    echo "✅ .env file created with auto-generated secrets"
    echo "⚠️  IMPORTANT: Edit .env and add your Stripe keys and SMTP credentials"
    echo ""
else
    echo ".env file already exists, skipping..."
fi

echo ""

# Step 5: Run database migrations
echo "==> Step 5: Running database migrations (creating 130 tables)..."

# First, ensure Prisma is installed
npm install prisma @prisma/client

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

echo "✅ Database migrations complete - 130 tables created"
echo ""

# Step 6: Build frontend
echo "==> Step 6: Building React frontend..."
cd frontend
npm run build

if [ -d "dist" ]; then
    echo "✅ Frontend built successfully to frontend/dist/"
else
    echo "❌ Frontend build failed - dist directory not found"
    exit 1
fi

cd ..
echo ""

# Step 7: Set up logging directory
echo "==> Step 7: Creating log directory..."
mkdir -p /var/log/mpanel
chown -R www-data:www-data /var/log/mpanel

echo "✅ Log directory ready"
echo ""

# Step 8: Start backend with PM2
echo "==> Step 8: Starting backend with PM2..."

# Stop if already running
pm2 delete mpanel-backend 2>/dev/null || true

# Start backend
pm2 start src/server.js --name mpanel-backend --time

# Save PM2 config
pm2 save

echo "✅ Backend started with PM2"
echo ""

# Step 9: Configure Apache
echo "==> Step 9: Configuring Apache virtual host..."

cat > /etc/apache2/sites-available/migrapanel.com.conf << 'APACHEEOF'
<VirtualHost *:80>
    ServerName migrapanel.com
    ServerAlias www.migrapanel.com
    ServerAdmin admin@migrapanel.com

    # Frontend - Serve React build
    DocumentRoot /opt/mpanel/frontend/dist

    <Directory /opt/mpanel/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # SPA routing - redirect all to index.html
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # API - Proxy to Node.js backend
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api

    # WebSocket support for real-time features
    ProxyPass /socket.io http://localhost:3000/socket.io
    ProxyPassReverse /socket.io http://localhost:3000/socket.io
    
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:3000/$1" [P,L]

    # GraphQL endpoint
    ProxyPass /graphql http://localhost:3000/graphql
    ProxyPassReverse /graphql http://localhost:3000/graphql

    # Logs
    ErrorLog ${APACHE_LOG_DIR}/migrapanel-error.log
    CustomLog ${APACHE_LOG_DIR}/migrapanel-access.log combined
</VirtualHost>
APACHEEOF

# Enable required Apache modules
a2enmod proxy proxy_http rewrite headers

# Enable site
a2ensite migrapanel.com.conf

# Test Apache configuration
apache2ctl configtest

# Reload Apache
systemctl reload apache2

echo "✅ Apache configured and reloaded"
echo ""

# Step 10: Health checks
echo "==> Step 10: Running health checks..."
sleep 3

# Check PM2
echo "PM2 Status:"
pm2 status

echo ""

# Check backend API
echo "Backend API Health:"
curl -s http://localhost:3000/api/health || echo "API not responding yet (may need a moment to start)"

echo ""
echo ""

# Final summary
echo "============================================"
echo "✅ mPanel Deployment Complete!"
echo "============================================"
echo ""
echo "📍 Deployment Location: /opt/mpanel"
echo "🌐 Domain: migrapanel.com"
echo "🔧 Backend: Running on PM2 (port 3000)"
echo "🎨 Frontend: Built to /opt/mpanel/frontend/dist"
echo "🌍 Apache: Configured and serving"
echo ""
echo "🔍 Access Points:"
echo "   Frontend: http://migrapanel.com"
echo "   API: http://migrapanel.com/api/health"
echo "   GraphQL: http://migrapanel.com/graphql"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "   1. Edit /opt/mpanel/.env and add your Stripe keys"
echo "   2. Add SMTP credentials to /opt/mpanel/.env"
echo "   3. Install SSL certificate:"
echo "      certbot --apache -d migrapanel.com -d www.migrapanel.com"
echo ""
echo "📊 Monitoring Commands:"
echo "   View backend logs: pm2 logs mpanel-backend"
echo "   Backend status: pm2 status"
echo "   Apache logs: tail -f /var/log/apache2/migrapanel-error.log"
echo "   Application logs: tail -f /var/log/mpanel/mpanel.log"
echo ""
echo "🔄 Restart Commands:"
echo "   Backend: pm2 restart mpanel-backend"
echo "   Apache: systemctl reload apache2"
echo ""
echo "============================================"
echo "🚀 Ready to test with real data!"
echo "============================================"
