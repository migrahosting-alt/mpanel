#!/bin/bash
set -e

echo "🚀 DEPLOYING ALL 5 ENTERPRISE ADMIN MODULES"
echo "============================================"
echo ""

# Backend deployment
echo "📦 1/2 Deploying Backend..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'frontend' \
  --exclude '.git' \
  dist/ src/ package.json ecosystem.config.cjs \
  root@100.97.213.11:/opt/mpanel/

echo "🔄 Restarting backend..."
ssh root@100.97.213.11 "cd /opt/mpanel && pm2 restart ecosystem.config.cjs"

echo ""
echo "🎨 2/2 Deploying Frontend..."
rsync -avz --delete frontend/dist/ root@100.97.213.11:/var/www/migrapanel.com/public/

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📋 Modules Deployed:"
echo "  1️⃣  Users Management       - /api/users"
echo "  2️⃣  Customers (Platform)   - /api/platform/customers"
echo "  3️⃣  Guardian AI             - /api/guardian"
echo "  4️⃣  Server Management       - /api/platform/servers"
echo "  5️⃣  Provisioning            - /api/provisioning"
echo ""
echo "🌐 Access at: https://migrapanel.com"
