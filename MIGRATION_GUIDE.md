# Data Migration Guide

Import your existing data from WHMCS and CyberPanel into mPanel.

## 📋 Prerequisites

Before starting, gather the following credentials:

### For WHMCS Migration:
- **Database Host**: MySQL server hostname/IP
- **Database Port**: Usually `3306`
- **Database User**: MySQL username with read access
- **Database Password**: MySQL password
- **Database Name**: WHMCS database name (usually `whmcs`)

### For CyberPanel Migration:
- **CyberPanel Host**: Server hostname/IP
- **Admin Username**: CyberPanel admin username
- **Admin Password**: CyberPanel admin password
- **Database User**: MySQL username (usually `root`)
- **Database Password**: MySQL root password
- **Database Host**: MySQL server (usually same as CyberPanel host)

---

## 🚀 Quick Start

### Option 1: Using CLI Script (Recommended)

#### Migrate from WHMCS:
```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

node migrate.js --mode=whmcs \
  --host=YOUR_WHMCS_DB_HOST \
  --user=YOUR_DB_USER \
  --password=YOUR_DB_PASSWORD \
  --database=whmcs \
  --port=3306
```

**Example (Hosting Server)**:
```bash
node migrate.js --mode=whmcs \
  --host=db.migrahosting.com \
  --user=whmcs_reader \
  --password=SecurePassword123 \
  --database=whmcs
```

#### Migrate from CyberPanel:
```bash
node migrate.js --mode=cyberpanel \
  --host=YOUR_CYBERPANEL_HOST \
  --admin-user=admin \
  --admin-pass=YOUR_ADMIN_PASSWORD \
  --db-user=root \
  --db-pass=YOUR_DB_PASSWORD
```

**Example (Mail Server)**:
```bash
node migrate.js --mode=cyberpanel \
  --host=mail.migrahosting.com \
  --admin-user=admin \
  --admin-pass=CyberPanelPassword \
  --db-user=root \
  --db-pass=MySQLRootPassword
```

---

### Option 2: Using API Endpoints

#### Test Connection First:

**WHMCS:**
```bash
curl -X POST http://localhost:2271/api/migrations/whmcs/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "db.migrahosting.com",
    "port": 3306,
    "user": "whmcs_reader",
    "password": "SecurePassword123",
    "database": "whmcs"
  }'
```

**CyberPanel:**
```bash
curl -X POST http://localhost:2271/api/migrations/cyberpanel/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "mail.migrahosting.com",
    "adminUser": "admin",
    "adminPass": "CyberPanelPassword",
    "dbUser": "root",
    "dbPassword": "MySQLRootPassword"
  }'
```

#### Run Import:

**WHMCS:**
```bash
curl -X POST http://localhost:2271/api/migrations/whmcs/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "db.migrahosting.com",
    "user": "whmcs_reader",
    "password": "SecurePassword123",
    "database": "whmcs"
  }'
```

**CyberPanel:**
```bash
curl -X POST http://localhost:2271/api/migrations/cyberpanel/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "mail.migrahosting.com",
    "adminUser": "admin",
    "adminPass": "CyberPanelPassword",
    "dbUser": "root",
    "dbPassword": "MySQLRootPassword"
  }'
```

---

## 📊 What Gets Imported?

### From WHMCS:
- ✅ **Clients** → Customers (with user accounts)
- ✅ **Products** → Products catalog
- ✅ **Servers** → Server configurations
- ✅ **Orders** → Order history
- ✅ **Invoices** → Billing invoices (last 2 years)
- ✅ **Domains** → Domain registrations
- ✅ **Emails** → Email logs (last 3 months)
- ✅ **Support Tickets** → Ticket history (last 6 months)

### From CyberPanel:
- ✅ **Websites** → Website configurations
- ✅ **Databases** → MySQL databases
- ✅ **Email Accounts** → Mail accounts
- ✅ **DNS Zones** → DNS records
- ✅ **FTP Accounts** → FTP access (logged)
- ✅ **Package Info** → Hosting quotas

---

## 🔐 Security Best Practices

### 1. Create Read-Only Database User for WHMCS:

```sql
-- On your WHMCS database server
CREATE USER 'whmcs_reader'@'%' IDENTIFIED BY 'SecureRandomPassword';
GRANT SELECT ON whmcs.* TO 'whmcs_reader'@'%';
FLUSH PRIVILEGES;
```

### 2. Use SSH Tunnels for Remote Connections:

```bash
# SSH tunnel to remote MySQL
ssh -L 3307:localhost:3306 user@remote-server

# Then connect via localhost:3307
node migrate.js --mode=whmcs --host=localhost --port=3307 ...
```

### 3. Firewall Configuration:

If accessing remote servers, ensure MySQL port (3306) is accessible:
```bash
# Allow from specific IP
sudo ufw allow from YOUR_MPANEL_IP to any port 3306
```

---

## 🐛 Troubleshooting

### Connection Issues:

**Error: "Connection refused"**
- Check if MySQL is running: `systemctl status mysql`
- Verify port is correct (default: 3306)
- Check firewall rules

**Error: "Access denied"**
- Verify username and password
- Check user has SELECT permissions
- Ensure user can connect from your IP

### CyberPanel API Issues:

**Error: "API authentication failed"**
- Verify admin username/password
- Check CyberPanel is accessible on port 8090
- Ensure SSL certificate is valid (or use `rejectUnauthorized: false`)

### Import Failures:

**Partial Import:**
- Check logs: `tail -f /tmp/mpanel-backend.log`
- Review error messages for specific failures
- Re-run import (duplicates are skipped)

**Data Mismatch:**
- Verify source database schema matches expected WHMCS/CyberPanel structure
- Check for custom modifications in source system

---

## 📝 Import from Both Servers

To import from your hosting server (WHMCS) and mail server (CyberPanel):

```bash
# 1. Import billing data from hosting server
echo "Importing from WHMCS (Hosting Server)..."
node migrate.js --mode=whmcs \
  --host=hosting.migrahosting.com \
  --user=whmcs_user \
  --password=WhmcsPass123 \
  --database=whmcs

echo "✅ Hosting data imported!"

# 2. Import mail/websites from mail server  
echo "Importing from CyberPanel (Mail Server)..."
node migrate.js --mode=cyberpanel \
  --host=mail.migrahosting.com \
  --admin-user=admin \
  --admin-pass=CyberPass123 \
  --db-user=root \
  --db-pass=RootPass123

echo "✅ Mail server data imported!"
echo "🎉 All migrations complete!"
```

---

## ✅ Post-Migration Checklist

After successful import:

1. **Verify Data**:
   - Check customer count in dashboard
   - Review imported invoices
   - Verify websites and databases

2. **Send Welcome Emails**:
   - Notify customers about new portal
   - Provide temporary passwords (auto-generated)
   - Share new login URL

3. **Update DNS** (if switching from WHMCS):
   - Point billing.yourdomain.com to mPanel
   - Update nameservers if needed

4. **Test Customer Access**:
   - Login as sample customer
   - Verify services are visible
   - Test invoice payment

5. **Archive Old System**:
   - Keep WHMCS/CyberPanel as read-only backup
   - Don't delete until fully migrated

---

## 🆘 Need Help?

- Review logs: `/tmp/mpanel-backend.log`
- Check import stats after completion
- Contact support if data inconsistencies occur

**Migration Support**: support@migrahosting.com
