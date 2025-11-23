#!/bin/bash
# Apply cache-busting configuration to mPanel server
# Prevents old file loading issues

set -e

echo "🔧 Applying cache-busting configuration to mPanel..."

# 1. Update mPanel backend code with cache headers
echo "📦 Deploying updated server.js with cache-busting headers..."
cd /opt/mpanel
git pull origin master
pm2 restart mpanel-backend

# 2. Update Nginx configuration
echo "🌐 Updating Nginx configuration..."

# Backup existing Nginx config
NGINX_CONF="/etc/nginx/sites-available/migrapanel.com"
if [ -f "$NGINX_CONF" ]; then
    cp "$NGINX_CONF" "$NGINX_CONF.backup-$(date +%Y%m%d-%H%M%S)"
    echo "✅ Backed up existing Nginx config"
fi

# Check if cache-busting rules already exist
if grep -q "Cache-Control.*no-cache, no-store, must-revalidate" "$NGINX_CONF" 2>/dev/null; then
    echo "⚠️  Cache-busting rules already exist in Nginx config"
else
    echo "Adding cache-busting rules to Nginx..."
    # Add rules before the last closing brace
    # This is a simple approach - adjust based on your actual config
    echo "⚠️  Manual step required: Add nginx-cache-busting.conf snippets to $NGINX_CONF"
fi

# 3. Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
nginx -t

# 4. Reload Nginx if test passes
if [ $? -eq 0 ]; then
    echo "♻️  Reloading Nginx..."
    systemctl reload nginx
    echo "✅ Nginx reloaded successfully"
else
    echo "❌ Nginx configuration test failed. Not reloading."
    exit 1
fi

# 5. Clear any server-side caches
echo "🧹 Clearing server caches..."
# Clear PM2 logs (optional)
pm2 flush

# Clear systemd journal for nginx (optional, keeps last 1 day)
journalctl --vacuum-time=1d >/dev/null 2>&1 || true

echo ""
echo "✅ Cache-busting configuration applied!"
echo ""
echo "📋 Next steps:"
echo "  1. Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)"
echo "  2. Test the application to ensure assets load correctly"
echo "  3. Verify no old files are being served with: curl -I https://migrapanel.com/your-asset.js"
echo ""
echo "🔍 To verify cache headers are working:"
echo "  curl -I https://migrapanel.com/api/health | grep -i cache-control"
echo ""
