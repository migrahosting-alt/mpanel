#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# MigraHosting Deployment - Run as root on mpanel-core (10.1.10.206)
###############################################################################

echo "════════════════════════════════════════════════════════════════════"
echo "  MigraHosting Frontend Deployment (mpanel-core)"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Deploy frontend
echo "→ Deploying frontend from /opt/mpanel/dist..."
mkdir -p /var/www/migrapanel.com/public
rm -rf /var/www/migrapanel.com/public/*
cp -r /opt/mpanel/dist/* /var/www/migrapanel.com/public/
chown -R www-data:www-data /var/www/migrapanel.com/public
chmod -R 755 /var/www/migrapanel.com/public
echo "✓ Frontend deployed to /var/www/migrapanel.com/public"

# Step 2: Create Apache vhost
echo "→ Creating Apache vhost configuration..."
cat > /etc/apache2/sites-available/migrapanel.com.conf << 'EOF'
<VirtualHost *:80>
    ServerName migrapanel.com
    ServerAlias www.migrapanel.com
    DocumentRoot /var/www/migrapanel.com/public

    <Directory /var/www/migrapanel.com/public>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.html [L]
    </Directory>

    ProxyPreserveHost On
    ProxyPass /api http://localhost:2271/api
    ProxyPassReverse /api http://localhost:2271/api
    ProxyPass /ws ws://localhost:2271/ws
    ProxyPassReverse /ws ws://localhost:2271/ws

    ErrorLog ${APACHE_LOG_DIR}/migrapanel.com-error.log
    CustomLog ${APACHE_LOG_DIR}/migrapanel.com-access.log combined
</VirtualHost>
EOF
echo "✓ Vhost config created"

# Step 3: Enable modules and site
echo "→ Enabling Apache modules..."
a2enmod rewrite proxy proxy_http proxy_wstunnel headers

echo "→ Enabling site..."
a2ensite migrapanel.com.conf

# Step 4: Test and reload
echo "→ Testing Apache configuration..."
apache2ctl configtest

echo "→ Reloading Apache..."
systemctl reload apache2

echo ""
echo "✓ Frontend deployment complete!"
echo ""
echo "Test: curl -I https://migrapanel.com"
echo ""
