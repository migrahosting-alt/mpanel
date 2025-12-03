#!/bin/bash
#
# Deploy TypeScript Backend (compiled to JS) to Production (mpanel-core)
# - Builds TS to dist/ and ships JS artifacts (no tsx needed in prod)
# - Restarts API and ensures Guardian Security worker is running under PM2
#

set -e

echo "========================================="
echo "mPanel TypeScript Backend Deployment (JS artifacts)"
echo "========================================="
echo ""

# Configuration
REMOTE_HOST="10.1.10.206"
REMOTE_USER="mhadmin"
REMOTE_PATH="/opt/mpanel"
LOCAL_PATH="/home/bonex/MigraWeb/MigraHosting/dev/migra-panel"

API_PM2_NAME="tenant-billing"
GUARDIAN_PM2_NAME="mpanel-guardian-security"

echo "📋 Deployment Configuration:"
echo "   Local:  $LOCAL_PATH"
echo "   Remote: $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH"
echo "   PM2 API: $API_PM2_NAME"
echo "   PM2 Guardian: $GUARDIAN_PM2_NAME"
echo ""

# Step 1: Generate Prisma Client locally
echo "Step 1: Generating Prisma Client..."
cd "$LOCAL_PATH"
npx prisma generate
echo "✓ Prisma client generated"
echo ""

# Step 2: Build backend (TS -> JS)
echo "Step 2: Building backend (tsc) ..."
npm run build
echo "✓ Build complete"
echo ""

# Step 3: Sync built files to production (dist + prisma + package.json)
echo "Step 3: Syncing files to production..."
rsync -avz --delete --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  dist/ \
  prisma/ \
  package.json \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

echo "✓ Files synced"

echo "Step 4: Installing dependencies on production..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && npm install --omit=dev"
echo "✓ Dependencies installed"
echo ""

# Step 5: Generate Prisma Client on production (ensures node_modules/@prisma/client)
echo "Step 5: Generating Prisma Client on production..."
ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && npx prisma generate"
echo "✓ Prisma client generated on production"
echo ""

# Step 6: Restart API and Guardian worker under PM2
echo "Step 6: Restarting PM2 processes..."
ssh "$REMOTE_USER@$REMOTE_HOST" bash -lc "\
  cd $REMOTE_PATH && \
  pm2 describe $API_PM2_NAME >/dev/null 2>&1 && pm2 restart $API_PM2_NAME || pm2 start dist/server-ts.js --name $API_PM2_NAME && \
  pm2 describe $GUARDIAN_PM2_NAME >/dev/null 2>&1 && pm2 restart $GUARDIAN_PM2_NAME || pm2 start dist/jobs/runGuardianSecurityWorker.js --name $GUARDIAN_PM2_NAME && \
  pm2 save"
echo "✓ PM2 processes running"
echo ""

# Step 7: Status & tail last lines
echo "Step 7: Checking service status..."
ssh "$REMOTE_USER@$REMOTE_HOST" "pm2 status $API_PM2_NAME $GUARDIAN_PM2_NAME && pm2 logs $API_PM2_NAME --lines 20 --nostream && pm2 logs $GUARDIAN_PM2_NAME --lines 20 --nostream"
echo ""

echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Verify logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $API_PM2_NAME && pm2 logs $GUARDIAN_PM2_NAME'"
echo "  2. Health: curl http://10.1.10.206:2271/api/health"
echo "  3. Guardian routes: curl http://10.1.10.206:2271/api/guardian/security/overview (with auth)"
echo ""
