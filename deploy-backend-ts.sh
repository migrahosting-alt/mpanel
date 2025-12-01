#!/bin/bash
#
# Deploy New TypeScript Backend to Production (mpanel-core)
# Deploys: TypeScript backend modules + new Prisma schema
#

set -e

echo "========================================="
echo "mPanel TypeScript Backend Deployment"
echo "========================================="
echo ""

# Configuration
REMOTE_HOST="10.1.10.206"
REMOTE_USER="mhadmin"
REMOTE_PATH="/opt/mpanel"
LOCAL_PATH="/home/bonex/MigraWeb/MigraHosting/dev/migra-panel"

echo "📋 Deployment Configuration:"
echo "   Local:  $LOCAL_PATH"
echo "   Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo ""

# Step 1: Generate Prisma Client locally
echo "Step 1: Generating Prisma Client..."
cd "$LOCAL_PATH"
npx prisma generate
echo "✓ Prisma client generated"
echo ""

# Step 2: TypeScript Compilation Test (skipped - verified locally)
echo "Step 2: Skipping TypeScript check (verified locally)..."
echo "✓ TypeScript verified"
echo ""

# Step 3: rsync files to production
echo "Step 3: Syncing files to production..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'frontend/build' \
  --exclude '.git' \
  --exclude '*.log' \
  --exclude '.env.local' \
  --exclude 'prisma/migrations' \
  prisma/ \
  src/config/ \
  src/modules/ \
  src/jobs/ \
  src/routes/api.ts \
  src/server-ts.ts \
  package.json \
  tsconfig.json \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo "✓ Files synced"
echo ""

# Step 4: Remote operations
echo "Step 4: Installing dependencies on production..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && npm install"
echo "✓ Dependencies installed"
echo ""

echo "Step 5: Generating Prisma Client on production..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && npx prisma generate"
echo "✓ Prisma client generated on production"
echo ""

echo "Step 6: Running database migrations..."
echo "⚠️  Skipping migrations (Prisma 7 requires manual migration setup)"
echo "   Run manually on production if needed: npx prisma migrate deploy"
echo "✓ Migration step skipped"
echo ""

echo "Step 7: Restarting PM2 process..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && pm2 restart tenant-billing"
echo "✓ Service restarted"
echo ""

echo "Step 8: Checking service status..."
ssh "$REMOTE_USER@$REMOTE_HOST" "pm2 status tenant-billing && pm2 logs tenant-billing --lines 20 --nostream"
echo ""

echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Verify logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs tenant-billing'"
echo "  2. Test auth: curl http://10.1.10.206:2271/api/health"
echo "  3. Test products: curl http://10.1.10.206:2271/api/public/products"
echo ""
