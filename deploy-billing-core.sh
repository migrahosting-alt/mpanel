#!/bin/bash
# Deploy mPanel billing core system
# Run this script from /opt/mpanel on mpanel-core server

set -e  # Exit on error

echo "🚀 Deploying mPanel Billing Core System"
echo "========================================"

# 1. Run database migration
echo ""
echo "📊 Running database migration..."
PGPASSWORD="mpanel_Sikse7171222!" psql -h 10.1.10.210 -U mpanel_app -d mpanel -f /opt/mpanel/migrations/20251127_billing_core.sql
echo "✓ Database migration completed"

# 2. Restart backend to load new routes
echo ""
echo "🔄 Restarting mPanel backend..."
pm2 restart tenant-billing
sleep 3
pm2 status tenant-billing
echo "✓ Backend restarted"

# 3. Test API endpoints
echo ""
echo "🧪 Testing new API endpoints..."

echo "  - Testing /api/admin/customers..."
curl -s http://localhost:2271/api/admin/customers | jq -r '.customers | length' | xargs -I {} echo "    Found {} customers"

echo "  - Testing /api/admin/subscriptions/tasks..."
curl -s http://localhost:2271/api/admin/subscriptions/tasks | jq -r '.tasks | length' | xargs -I {} echo "    Found {} provisioning tasks"

echo "  - Testing /api/admin/servers..."
curl -s http://localhost:2271/api/admin/servers | jq -r '.servers | length' | xargs -I {} echo "    Found {} servers"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Visit http://migrapanel.com/admin/customers to see customer list"
echo "2. Visit http://migrapanel.com/provisioning to see provisioning tasks"
echo "3. Make a test payment on migrahosting.com"
echo "4. Watch the order appear in mPanel automatically"
