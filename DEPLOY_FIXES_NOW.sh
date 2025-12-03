#!/bin/bash
# Quick deployment script for mPanel error state fixes
# Run this from: /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

set -e

echo "🚀 Deploying mPanel Error State Fixes"
echo "======================================"
echo ""

# Step 1: Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

echo "✅ Build complete!"
echo ""

# Step 2: Deploy to server
echo "🌐 Deploying to server 100.97.213.11..."
rsync -avz --delete frontend/dist/ root@100.97.213.11:/usr/local/mPanel/html/

echo "✅ Frontend deployed!"
echo ""

# Step 3: Seed products (optional but recommended)
read -p "🌱 Do you want to seed products on the server? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🌱 Seeding products..."
    ssh root@100.97.213.11 'cd /opt/mpanel && npm run seed:products'
    echo "✅ Products seeded!"
fi

echo ""
echo "✨ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit https://mpanel.migrahosting.com"
echo "2. Check /products - should show helpful empty state or seeded plans"
echo "3. Check /subscriptions - should show helpful empty state"
echo "4. Check /metrics, /email, /databases, etc. - should show 'Coming Soon'"
echo "5. No more scary red 'Failed to load' errors! 🎉"
echo ""
