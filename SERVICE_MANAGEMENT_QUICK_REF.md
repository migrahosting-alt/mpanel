# Service Management Quick Reference 🚀

## Access URLs

### Client Portal
- **SSL Management**: http://localhost:2272/client/ssl
- **Email Management**: http://localhost:2272/client/email-management
- **Backup Management**: http://localhost:2272/client/backups (Premium)
- **Website Migration**: http://localhost:2272/client/migration (Premium)

### Standalone Access
- http://localhost:2272/manage/ssl
- http://localhost:2272/manage/backups
- http://localhost:2272/manage/email
- http://localhost:2272/migrate

## API Endpoints

**Base URL**: `http://localhost:2271/api/service-management`

### SSL Management
```bash
# Get SSL status
GET /ssl/status/:domain

# Install SSL certificate
POST /ssl/install
Body: { "domain": "example.com", "type": "lets-encrypt" }
```

### Backup Management
```bash
# List backups
GET /backups?domain=example.com

# Create backup
POST /backups/create
Body: { "domain": "example.com", "label": "Before update" }

# Restore backup
POST /backups/restore
Body: { "backupId": "backup-123", "domain": "example.com" }
```

### Email Management
```bash
# List email accounts
GET /email/list?domain=example.com

# Create email account
POST /email/create
Body: { "email": "admin@example.com", "password": "secure123", "quota": 5000 }

# Delete email account
DELETE /email/:emailAddress
```

### Website Migration
```bash
# Request migration
POST /migration/request
Body: {
  "domain": "example.com",
  "currentHost": "GoDaddy",
  "contactEmail": "user@example.com",
  "migrationType": "cpanel",
  "cpanelUrl": "https://cpanel.oldhost.com",
  "cpanelUsername": "username",
  "cpanelPassword": "password"
}

# Get migration status
GET /migration/status/:migrationId
```

### Domain Transfer
```bash
# Check eligibility
POST /domain/check-eligibility
Body: { "domain": "example.com" }

# Initiate transfer
POST /domain/transfer
Body: {
  "domainName": "example.com",
  "authCode": "ABC123",
  "currentRegistrar": "GoDaddy",
  "email": "user@example.com"
}

# Get transfer status
GET /domain/transfer/:transferId
```

## Authentication

**All requests require JWT token in Authorization header:**

```javascript
const token = localStorage.getItem('token');

fetch('http://localhost:2271/api/service-management/ssl/status/example.com', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Testing from CLI

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:2271/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@migrahosting.com","password":"admin123"}' | jq -r '.token')

# Test SSL status
curl http://localhost:2271/api/service-management/ssl/status/example.com \
  -H "Authorization: Bearer $TOKEN" | jq .

# Test backup list
curl "http://localhost:2271/api/service-management/backups?domain=example.com" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Create email account
curl -X POST http://localhost:2271/api/service-management/email/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secure123","quota":5000}' | jq .
```

## Service Tiers

### Basic Services (FREE for all customers)
- ✅ SSL Certificates (Let's Encrypt)
- ✅ Email Accounts (with quota limits)

### Premium Services (Paid add-ons)
- 💎 Automated Backups ($5/month per site)
- 💎 Expert Migration Service ($49 one-time)

## Response Format

**Success:**
```json
{
  "success": true,
  "data": {
    "domain": "example.com",
    "hasSSL": true,
    "issuer": "Let's Encrypt",
    "expiresAt": "2026-02-17T06:28:03.868Z",
    "autoRenew": true
  }
}
```

**Error:**
```json
{
  "error": "Domain is required"
}
```

## Integration Status

✅ Backend API - Fully implemented
✅ Frontend Pages - Updated with auth
✅ JWT Authentication - Working
✅ Routes Registered - Active
✅ API Testing - All endpoints passing
⏳ Real Integrations - TODO (Let's Encrypt, cPanel, etc.)

## Next: Test UI

1. Open browser: http://localhost:2272
2. Login: admin@migrahosting.com / admin123
3. Navigate to: `/client/ssl`
4. Verify SSL status loads
5. Test other service pages

---

**Last Updated**: November 19, 2025
**Status**: ✅ READY FOR UI TESTING
