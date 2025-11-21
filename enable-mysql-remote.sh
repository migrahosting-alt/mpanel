#!/bin/bash
# Run this on the WHMCS server (31.220.98.95) to enable remote MySQL access

echo "🔧 Configuring MySQL for remote access..."

# Check current bind address
echo "Current MySQL bind address:"
sudo grep bind-address /etc/mysql/mysql.conf.d/mysqld.cnf || sudo grep bind-address /etc/my.cnf || sudo grep bind-address /etc/mysql/my.cnf

echo ""
echo "Updating MySQL to listen on all interfaces..."

# Backup config
sudo cp /etc/mysql/mysql.conf.d/mysqld.cnf /etc/mysql/mysql.conf.d/mysqld.cnf.backup 2>/dev/null || true

# Update bind address to allow remote connections
if [ -f /etc/mysql/mysql.conf.d/mysqld.cnf ]; then
    sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
elif [ -f /etc/my.cnf ]; then
    sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/my.cnf
elif [ -f /etc/mysql/my.cnf ]; then
    sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/my.cnf
fi

echo "✅ MySQL configuration updated"

# Grant remote access to whmcs_user
echo "Granting remote access to whmcs_user..."
sudo mysql -e "CREATE USER IF NOT EXISTS 'whmcs_user'@'%' IDENTIFIED BY 'Sikse@222';"
sudo mysql -e "GRANT ALL PRIVILEGES ON whmcs.* TO 'whmcs_user'@'%';"
sudo mysql -e "FLUSH PRIVILEGES;"

echo "✅ User privileges granted"

# Restart MySQL
echo "Restarting MySQL..."
sudo systemctl restart mysql

echo "✅ MySQL restarted"

# Test if MySQL is listening on 3306
echo ""
echo "MySQL listening status:"
sudo netstat -tulpn | grep 3306

echo ""
echo "✅ Configuration complete! MySQL should now accept remote connections."
