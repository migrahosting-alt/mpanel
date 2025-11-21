# 🚀 Data Migration System - WHMCS & CyberPanel Importers

**Status**: ✅ Complete and Ready  
**Created**: November 15, 2025  
**Features**: Full data import from WHMCS (billing) and CyberPanel (hosting)

---

## 📦 What's Included

### 1. **WHMCS Importer** (`src/services/whmcsImporter.js`)
Imports all billing and customer data from your WHMCS installation:
- ✅ Clients → Customers (with auto-created user accounts)
- ✅ Products → Product catalog
- ✅ Servers → Server configurations
- ✅ Orders → Order history
- ✅ Invoices → Billing invoices (last 2 years)
- ✅ Domains → Domain registrations
- ✅ Support Tickets → Ticket history (last 6 months)
- ✅ Email Logs → Recent email history

### 2. **CyberPanel Importer** (`src/services/cyberpanelImporter.js`)
Imports all hosting data from your CyberPanel server:
- ✅ Websites → Website configurations with quotas
- ✅ Databases → MySQL databases
- ✅ Email Accounts → Mailboxes
- ✅ DNS Zones → DNS records
- ✅ FTP Accounts → FTP access info
- ✅ Package Info → Hosting resource limits

### 3. **API Endpoints** (`/api/migrations/*`)
- `POST /api/migrations/whmcs/test` - Test WHMCS connection
- `POST /api/migrations/whmcs/import` - Import from WHMCS
- `POST /api/migrations/cyberpanel/test` - Test CyberPanel connection
- `POST /api/migrations/cyberpanel/import` - Import from CyberPanel
- `GET /api/migrations/history` - View import history

### 4. **CLI Migration Tool** (`migrate.js`)
Command-line script for automated migrations:
```bash
# WHMCS
node migrate.js --mode=whmcs --host=HOST --user=USER --password=PASS --database=DB

# CyberPanel
node migrate.js --mode=cyberpanel --host=HOST --admin-user=USER --admin-pass=PASS --db-user=USER --db-pass=PASS
```

---

## 🎯 Usage Examples

### Migrate from Your Hosting Server (WHMCS)

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

node migrate.js --mode=whmcs \
  --host=hosting.migrahosting.com \
  --user=whmcs_reader \
  --password=YourWHMCSPassword \
  --database=whmcs
```

**Expected Output:**
```
🔄 Starting WHMCS Migration...
📡 Connecting to WHMCS database at hosting.migrahosting.com/whmcs...
✅ Migration completed successfully!

📊 Import Statistics:
   Clients:       245
   Products:      18
   Servers:       3
   Orders:        412
   Invoices:      567
   Domains:       189
   Emails:        1250
   Tickets:       78
```

### Migrate from Your Mail Server (CyberPanel)

```bash
node migrate.js --mode=cyberpanel \
  --host=mail.migrahosting.com \
  --admin-user=admin \
  --admin-pass=CyberPanelAdminPass \
  --db-user=root \
  --db-pass=MySQLRootPass
```

**Expected Output:**
```
🔄 Starting CyberPanel Migration...
📡 Connecting to CyberPanel at mail.migrahosting.com...
✅ Migration completed successfully!

📊 Import Statistics:
   Websites:      127
   Databases:     84
   Emails:        356
   DNS Zones:     103
   FTP Accounts:  67
```

---

## 🔒 Security Features

1. **Read-Only Access**: Importers only require SELECT permissions
2. **Duplicate Prevention**: ON CONFLICT DO NOTHING on all inserts
3. **Data Validation**: Validates all data before import
4. **Error Handling**: Continues on errors, logs failures
5. **Password Hashing**: Auto-generates secure passwords for new users
6. **Metadata Tracking**: Preserves source system IDs for reference

---

## 📝 Migration Workflow

### Step 1: Prepare Source Systems

**WHMCS:**
```sql
-- Create read-only user on WHMCS database
CREATE USER 'mpanel_import'@'%' IDENTIFIED BY 'SecureRandomPassword';
GRANT SELECT ON whmcs.* TO 'mpanel_import'@'%';
FLUSH PRIVILEGES;
```

**CyberPanel:**
- Ensure CyberPanel API is accessible (port 8090)
- Have MySQL root credentials ready
- Firewall allows connection from mPanel server

### Step 2: Test Connections

```bash
# Test WHMCS
curl -X POST http://localhost:2271/api/migrations/whmcs/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"host":"hosting.migrahosting.com","user":"mpanel_import","password":"SecurePassword","database":"whmcs"}'

# Test CyberPanel
curl -X POST http://localhost:2271/api/migrations/cyberpanel/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"host":"mail.migrahosting.com","adminUser":"admin","adminPass":"CyberPass","dbUser":"root","dbPassword":"RootPass"}'
```

### Step 3: Run Migrations

```bash
# Import from both servers
./migrate.js --mode=whmcs --host=hosting.migrahosting.com --user=mpanel_import --password=Pass1 --database=whmcs
./migrate.js --mode=cyberpanel --host=mail.migrahosting.com --admin-user=admin --admin-pass=Pass2 --db-user=root --db-pass=Pass3
```

### Step 4: Verify Data

Check your mPanel dashboard:
- **Total Users**: Should match WHMCS clients
- **Total Websites**: Should match CyberPanel websites
- **Total Invoices**: Should match WHMCS invoices
- **DNS Zones**: Should match CyberPanel DNS

---

## 🛠️ Troubleshooting

### "Connection refused"
- Check MySQL port (3306) is open
- Verify firewall allows connections
- Test with `telnet HOST 3306`

### "Access denied"
- Verify username/password
- Check user has SELECT permissions
- Ensure user can connect from your IP

### "Column does not exist"
- WHMCS/CyberPanel schema may have been customized
- Check importer logs for specific column names
- May need to modify importer for custom schema

### Partial Import
- Check `/tmp/mpanel-backend.log` for errors
- Re-run import (duplicates are skipped)
- Contact support if data issues persist

---

## 📊 Import Statistics

After migration, check your dashboard at http://localhost:2272

The migration preserves all metadata from source systems:
- WHMCS IDs stored in `metadata.whmcs_id`
- CyberPanel IDs stored in `metadata.cyberpanel_id`
- Import source tracked: `metadata.imported_from`

---

## 🎉 Success!

You now have a complete migration system that can:
- ✅ Import all your WHMCS billing data
- ✅ Import all your CyberPanel hosting data
- ✅ Merge data from multiple servers
- ✅ Preserve customer relationships
- ✅ Maintain billing history
- ✅ Keep DNS configurations

**Next Steps:**
1. Run migrations on production data
2. Verify all data imported correctly
3. Send welcome emails to customers
4. Update DNS to point to mPanel
5. Decommission old systems

---

**Full Documentation**: `MIGRATION_GUIDE.md`  
**Support**: Review backend logs at `/tmp/mpanel-backend.log`
