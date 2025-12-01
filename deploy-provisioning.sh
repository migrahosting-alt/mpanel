#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# MigraHosting Provisioning Setup - Run as root on srv1 (10.1.10.10)
###############################################################################

echo "════════════════════════════════════════════════════════════════════"
echo "  MigraHosting Provisioning Setup (srv1)"
echo "════════════════════════════════════════════════════════════════════"
echo ""

# Step 1: Install provisioning script
echo "→ Installing provisioning script..."
mv /tmp/provision_shared_hosting.sh /usr/local/bin/provision_shared_hosting.sh
chmod +x /usr/local/bin/provision_shared_hosting.sh
echo "✓ Script installed to /usr/local/bin/"

# Step 2: Create directories
echo "→ Creating directories..."
mkdir -p /srv/web/clients
mkdir -p /var/log/migrahosting
chown mhadmin:mhadmin /var/log/migrahosting
chmod 755 /srv/web/clients
echo "✓ Directories created"

# Step 3: Install pg module as mhadmin
echo "→ Installing Node.js dependencies..."
su - mhadmin -c "cd /home/mhadmin && npm install pg"
echo "✓ pg module installed"

# Step 4: Setup cron as mhadmin
echo "→ Setting up cron job..."
su - mhadmin << 'EOFCRON'
# Remove old cron if exists
crontab -l 2>/dev/null | grep -v 'provision-worker.js' | crontab - || true

# Add new cron
(crontab -l 2>/dev/null || true; echo '* * * * * DATABASE_URL="postgres://mpanel_app:mpanel_Sikse7171222!@10.1.10.210:5432/mpanel" node /home/mhadmin/provision-worker.js >> /var/log/migrahosting/worker.log 2>&1') | crontab -

echo "✓ Cron job configured"
crontab -l | grep provision-worker
EOFCRON

# Step 5: Test worker manually
echo "→ Running worker test..."
su - mhadmin -c 'DATABASE_URL="postgres://mpanel_app:mpanel_Sikse7171222!@10.1.10.210:5432/mpanel" node /home/mhadmin/provision-worker.js'

echo ""
echo "✓ Provisioning setup complete!"
echo ""
echo "Monitor logs: tail -f /var/log/migrahosting/worker.log"
echo "Check accounts: ls -la /srv/web/clients/"
echo ""
