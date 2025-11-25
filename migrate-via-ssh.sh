#!/bin/bash
# Migration via SSH tunnel to access remote databases

echo "🔐 Setting up SSH tunnel for WHMCS migration..."

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ]; then
    echo "⚠️  No SSH key found. You'll need to enter password for each connection."
fi

# Ask for SSH credentials
echo ""
echo "Enter SSH username for WHMCS server (31.220.98.95):"
read -r WHMCS_SSH_USER

echo ""
echo "Creating SSH tunnel to WHMCS server..."
echo "This will forward local port 13306 to remote MySQL port 3306"
echo ""

# Create SSH tunnel for WHMCS
ssh -f -N -L 13306:127.0.0.1:3306 ${WHMCS_SSH_USER}@31.220.98.95

if [ $? -eq 0 ]; then
    echo "✅ SSH tunnel established for WHMCS"
    echo ""
    echo "🔄 Running WHMCS migration..."
    node migrate.js --mode=whmcs --host=127.0.0.1 --port=13306 --user=whmcs_user --password=Sikse@222 --database=whmcs
    
    # Kill the tunnel
    pkill -f "ssh -f -N -L 13306"
    echo "✅ Closed SSH tunnel"
else
    echo "❌ Failed to create SSH tunnel"
    exit 1
fi

echo ""
echo "Enter SSH username for CyberPanel server (154.38.180.61):"
read -r CP_SSH_USER

echo ""
echo "Creating SSH tunnel to CyberPanel server..."
echo "This will forward local port 13307 to remote MySQL port 3306"
echo ""

# Create SSH tunnel for CyberPanel
ssh -f -N -L 13307:127.0.0.1:3306 -L 18090:127.0.0.1:8090 ${CP_SSH_USER}@154.38.180.61

if [ $? -eq 0 ]; then
    echo "✅ SSH tunnel established for CyberPanel"
    echo ""
    echo "🔄 Running CyberPanel migration..."
    node migrate.js --mode=cyberpanel --host=127.0.0.1 --api-port=18090 --admin-user=admin --admin-password=Sikse@222 --db-host=127.0.0.1 --db-port=13307 --db-user=root --db-password=Sikse@222
    
    # Kill the tunnel
    pkill -f "ssh -f -N -L 13307"
    echo "✅ Closed SSH tunnel"
else
    echo "❌ Failed to create SSH tunnel"
    exit 1
fi

echo ""
echo "✅ Migration complete!"
echo "Check the dashboard at http://localhost:2272"
