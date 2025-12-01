#!/bin/bash
#
# Simple Backend Deployment Script
# Single SSH session to avoid multiple password prompts
#

set -e

echo "========================================="
echo "mPanel Backend Deployment (Simple)"
echo "========================================="
echo ""

# Configuration
REMOTE_HOST="10.1.10.206"
REMOTE_USER="mhadmin"
REMOTE_PATH="/opt/mpanel"
LOCAL_PATH="/home/bonex/MigraWeb/MigraHosting/dev/migra-panel"

echo "📋 Configuration:"
echo "   Local:  $LOCAL_PATH"
echo "   Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo ""

# Step 1: Generate Prisma Client locally
echo "Step 1: Generating Prisma Client locally..."
cd "$LOCAL_PATH"
npx prisma generate
echo "✓ Local Prisma client generated"
echo ""

# Step 2: Sync files to production
echo "Step 2: Syncing files to production..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'frontend/build' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '.env.local' \
  prisma/ \
  src/config/ \
  src/modules/ \
  src/jobs/ \
  src/routes/api.ts \
  package.json \
  tsconfig.json \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo "✓ Files synced"
echo ""

# Step 3: Remote operations in a single SSH session
echo "Step 3: Running remote setup (single SSH session)..."
ssh "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /opt/mpanel
echo "→ Installing dependencies..."
npm install --production
echo "→ Generating Prisma client..."
npx prisma generate
echo "→ Restarting PM2 service..."
pm2 restart tenant-billing
echo "→ Waiting for service to start..."
sleep 3
echo "→ Checking service status..."
pm2 status tenant-billing
echo ""
echo "→ Recent logs:"
pm2 logs tenant-billing --lines 20 --nostream
ENDSSH

echo ""
echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Check logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs tenant-billing'"
echo "  2. Test health: curl http://10.1.10.206:2271/api/health"
echo "  3. Test products: curl http://10.1.10.206:2271/api/public/products"
echo ""
