#!/bin/bash
# Stripe → mPanel Provisioning Integration Deployment
# Server: mhadmin@10.1.10.206 (mPanel)

set -e

echo "🚀 Deploying Stripe Provisioning Integration to mPanel"
echo "======================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

MPANEL_SERVER="mhadmin@10.1.10.206"
MPANEL_DIR="/opt/mpanel"

echo -e "${YELLOW}📦 Step 1: Deploying migration and code to mPanel...${NC}"

# Copy files to home directory first, then move with sudo
echo "Copying files..."
scp migrations/20251127_stripe_provisioning.sql \
    $MPANEL_SERVER:~/

scp src/routes/provisioningStripe.js \
    $MPANEL_SERVER:~/

scp src/server.js \
    $MPANEL_SERVER:~/server.js.new

# Move files to correct location with sudo
ssh $MPANEL_SERVER << 'ENDSSH'
sudo mv ~/20251127_stripe_provisioning.sql /opt/mpanel/migrations/
sudo mv ~/provisioningStripe.js /opt/mpanel/src/routes/
sudo mv ~/server.js.new /opt/mpanel/src/server.js
sudo chown -R mhadmin:mhadmin /opt/mpanel/migrations/
sudo chown -R mhadmin:mhadmin /opt/mpanel/src/
ENDSSH

echo -e "${GREEN}✓${NC} Files deployed"
echo ""

echo -e "${YELLOW}📊 Step 2: Running database migration...${NC}"

ssh $MPANEL_SERVER << 'ENDSSH'
cd /opt/mpanel

# Check if PostgreSQL is accessible
if ! psql "$DATABASE_URL" -c '\q' 2>/dev/null; then
    echo "❌ Cannot connect to PostgreSQL. Check DATABASE_URL in .env"
    exit 1
fi

# Run migration
echo "Running migration..."
psql "$DATABASE_URL" -f migrations/20251127_stripe_provisioning.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully"
else
    echo "❌ Migration failed"
    exit 1
fi
ENDSSH

echo ""

echo -e "${YELLOW}🔧 Step 3: Checking environment variables...${NC}"

ssh $MPANEL_SERVER << 'ENDSSH'
cd /opt/mpanel

# Check if MPANEL_PROVISIONING_TOKEN is set
if grep -q "^MPANEL_PROVISIONING_TOKEN=" .env; then
    echo "✓ MPANEL_PROVISIONING_TOKEN is already set"
else
    echo "⚠️  MPANEL_PROVISIONING_TOKEN not found in .env"
    echo ""
    echo "Please add to /opt/mpanel/.env:"
    echo "MPANEL_PROVISIONING_TOKEN=YOUR_SECURE_TOKEN_HERE"
    echo ""
    echo "Generate a secure token with:"
    echo "  openssl rand -hex 32"
fi
ENDSSH

echo ""

echo -e "${YELLOW}🔄 Step 4: Restarting mPanel backend...${NC}"

ssh $MPANEL_SERVER << 'ENDSSH'
cd /opt/mpanel

# Restart with PM2 if available, otherwise manual restart
if command -v pm2 &> /dev/null; then
    echo "Restarting with PM2..."
    pm2 restart mpanel-api || pm2 start src/server.js --name mpanel-api
    sleep 3
    pm2 status mpanel-api
else
    echo "PM2 not found. Please restart manually:"
    echo "  cd /opt/mpanel && node src/server.js"
fi
ENDSSH

echo ""

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Ensure MPANEL_PROVISIONING_TOKEN is set in mPanel .env"
echo "   ssh $MPANEL_SERVER"
echo "   cd /opt/mpanel"
echo "   nano .env  # Add: MPANEL_PROVISIONING_TOKEN=<secure_token>"
echo ""
echo "2. Update marketing-api on srv1 (10.1.10.10):"
echo "   ssh mhadmin@10.1.10.10"
echo "   cd /home/mhadmin/marketing-api"
echo "   nano .env  # Add:"
echo "   MPANEL_PROVISIONING_URL=https://mpanel.migrahosting.com/api/provisioning/stripe"
echo "   MPANEL_PROVISIONING_TOKEN=<same_token_as_above>"
echo ""
echo "3. Restart marketing-api:"
echo "   pkill -f 'node.*index.js'"
echo "   nohup node index.js > api.log 2>&1 &"
echo ""
echo "4. Test end-to-end:"
echo "   Make a test payment on migrahosting.com"
echo "   Check mPanel database:"
echo "   psql \$DATABASE_URL -c 'SELECT * FROM stripe_orders ORDER BY created_at DESC LIMIT 5;'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
