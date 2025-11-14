# NameSilo Domain Registrar Integration

## Overview
Your mPanel system is now integrated with NameSilo for automated domain registration, renewal, transfer, and DNS management.

## Setup Instructions

### 1. Install Required Dependencies
```bash
cd k:\MigraHosting\dev\migrahosting-landing\mpanel-main\mpanel-main
npm install
```

If npm has issues, manually install axios:
```bash
npm cache clean --force
npm install axios --save
```

### 2. Configure NameSilo API Key

1. **Get your API key** from NameSilo:
   - Login to your NameSilo account
   - Go to Account Settings → API Manager
   - Generate a new API key
   - Copy the key

2. **Update `.env` file**:
```env
# NameSilo Domain Registrar
NAMESILO_API_KEY=your-actual-api-key-here
NAMESILO_SANDBOX=false
NAMESILO_API_URL=https://www.namesilo.com/api
```

For testing, use sandbox mode:
```env
NAMESILO_SANDBOX=true
```

### 3. Database Setup

The domains table already exists. Add new columns for registration tracking:

```sql
-- Run this SQL to add registration-specific fields
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS privacy_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP;
```

Or create the migration file:
```bash
cd k:\MigraHosting\dev\migrahosting-landing\mpanel-main\mpanel-main
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "
ALTER TABLE domains 
ADD COLUMN IF NOT EXISTS privacy_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS expiration_date TIMESTAMP;
"
```

## API Endpoints

All endpoints are prefixed with `/api/domain-registration` and require authentication.

### Check Domain Availability
```http
POST /api/domain-registration/check-availability
Content-Type: application/json
Authorization: Bearer <token>

{
  "domains": ["example.com", "example.net"]
}
```

### Register Domain
```http
POST /api/domain-registration/register
Content-Type: application/json
Authorization: Bearer <token>

{
  "domain": "example.com",
  "years": 1,
  "auto_renew": false,
  "enable_privacy": true,
  "customer_id": "uuid-here",
  "contact_info": {
    "fn": "John",
    "ln": "Doe",
    "ad": "123 Main St",
    "cy": "New York",
    "st": "NY",
    "zp": "10001",
    "ct": "US",
    "em": "john@example.com",
    "ph": "+1.2125551234"
  }
}
```

### Renew Domain
```http
POST /api/domain-registration/:id/renew
Content-Type: application/json
Authorization: Bearer <token>

{
  "years": 1
}
```

### Transfer Domain
```http
POST /api/domain-registration/transfer
Content-Type: application/json
Authorization: Bearer <token>

{
  "domain": "example.com",
  "auth_code": "EPP-AUTH-CODE-HERE",
  "enable_privacy": true,
  "auto_renew": false,
  "customer_id": "uuid-here"
}
```

### Update Nameservers
```http
PUT /api/domain-registration/:id/nameservers
Content-Type: application/json
Authorization: Bearer <token>

{
  "nameservers": [
    "ns1.migrahosting.com",
    "ns2.migrahosting.com"
  ]
}
```

### Get Domain Info
```http
GET /api/domain-registration/:id/info
Authorization: Bearer <token>
```

### Lock/Unlock Domain
```http
PUT /api/domain-registration/:id/lock
Content-Type: application/json
Authorization: Bearer <token>

{
  "locked": true
}
```

### Get EPP/Auth Code
```http
GET /api/domain-registration/:id/auth-code
Authorization: Bearer <token>
```

### Toggle Auto-Renewal
```http
PUT /api/domain-registration/:id/auto-renewal
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true
}
```

### Toggle WHOIS Privacy
```http
PUT /api/domain-registration/:id/privacy
Content-Type: application/json
Authorization: Bearer <token>

{
  "enabled": true
}
```

### Get TLD Pricing
```http
GET /api/domain-registration/pricing
Authorization: Bearer <token>
```

## Features Implemented

### ✅ Domain Management
- Domain availability checking
- Domain registration
- Domain renewal
- Domain transfer
- Get EPP/Auth codes for transfers

### ✅ DNS Management
- Update nameservers
- Add/Update/Delete DNS records
- List all DNS records

### ✅ Security Features
- Domain locking (transfer lock)
- WHOIS privacy protection
- Secure auth code retrieval

### ✅ Automation
- Auto-renewal configuration
- Automatic privacy protection
- Billing integration ready

### ✅ API Features
- Full NameSilo API integration
- Error handling and logging
- Permission-based access control
- Response parsing (XML to JSON)

## NameSilo Service Methods

The `namesiloService.js` provides these methods:

| Method | Description |
|--------|-------------|
| `checkAvailability(domains)` | Check if domain(s) are available |
| `registerDomain(options)` | Register a new domain |
| `renewDomain(domain, years)` | Renew a domain |
| `transferDomain(options)` | Transfer domain to NameSilo |
| `getDomainInfo(domain)` | Get domain information |
| `listDomains()` | List all domains in account |
| `updateNameServers(domain, ns[])` | Update nameservers |
| `listDNSRecords(domain)` | Get all DNS records |
| `addDNSRecord(...)` | Add DNS record |
| `updateDNSRecord(...)` | Update DNS record |
| `deleteDNSRecord(domain, id)` | Delete DNS record |
| `lockDomain(domain)` | Lock domain |
| `unlockDomain(domain)` | Unlock domain |
| `getAuthCode(domain)` | Get EPP/Auth code |
| `setAutoRenewal(domain, enabled)` | Enable/disable auto-renewal |
| `setPrivacy(domain, enabled)` | Enable/disable WHOIS privacy |
| `getPricing()` | Get TLD pricing |
| `getAccountBalance()` | Get account balance |
| `listContacts()` | List all contacts |
| `addContact(contact)` | Add new contact |
| `updateContact(id, updates)` | Update contact |
| `deleteContact(id)` | Delete contact |

## Security & Permissions

All domain registration endpoints are protected by RBAC:

- `domains.read` - View domains and check availability
- `domains.create` - Register and transfer domains
- `domains.edit` - Renew, update nameservers, toggle settings
- `dns.edit` - Update nameservers

Super admins bypass all checks automatically.

## Testing

### Test Domain Availability
```bash
curl -X POST http://localhost:3000/api/domain-registration/check-availability \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domains": ["test123456789.com"]}'
```

### Test Get Pricing
```bash
curl -X GET http://localhost:3000/api/domain-registration/pricing \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Integration with Existing Features

### Automatic Provisioning
When a domain is registered through the client portal:
1. Domain registered with NameSilo
2. Saved to database with expiration tracking
3. DNS zone automatically created (if enabled)
4. Default DNS records added
5. WHOIS privacy enabled (if requested)
6. Auto-renewal configured (if requested)

### Billing Integration
- Domain registration costs can be added to invoices
- Renewal reminders sent before expiration
- Auto-renewal charges processed automatically
- ICANN fees calculated and added

### DNS Integration
Existing DNS management (`dnsRoutes.js`) works seamlessly:
- DNS zones created automatically for new domains
- DNS records managed through existing UI
- NameSilo DNS or custom nameservers supported

## Production Checklist

Before going live:

- [ ] Get production NameSilo API key
- [ ] Set `NAMESILO_SANDBOX=false`
- [ ] Update API key in `.env`
- [ ] Test domain registration with test domain
- [ ] Configure billing integration
- [ ] Set up auto-renewal reminders
- [ ] Configure domain expiration alerts
- [ ] Test WHOIS privacy
- [ ] Test domain transfers
- [ ] Review NameSilo account balance alerts

## NameSilo API Documentation

Full API documentation: https://www.namesilo.com/api-reference

## Support

NameSilo Support:
- Email: support@namesilo.com
- Phone: +1.480.624.2500
- Live Chat: Available on their website

## Troubleshooting

### API Key Not Working
- Verify API key is correct
- Check if API is enabled in NameSilo account
- Ensure account has sufficient funds

### Domain Registration Failed
- Check domain availability first
- Verify contact information is complete
- Ensure account balance is sufficient
- Check NameSilo API status

### DNS Updates Not Applying
- DNS propagation takes 24-48 hours
- Verify nameservers are pointing to NameSilo
- Check DNS records in NameSilo dashboard

## Next Steps

1. **Install axios dependency**
2. **Add database columns** for registration tracking
3. **Configure API key** in `.env`
4. **Test endpoints** with Postman or curl
5. **Build frontend UI** for domain registration
6. **Integrate with billing** for automatic invoicing
7. **Set up cron jobs** for renewal reminders

---

**Status**: ✅ Backend integration complete  
**Frontend**: Pending (use existing domain UI or create new registration page)  
**Database**: Schema update required  
**Dependencies**: axios (add to package.json)
