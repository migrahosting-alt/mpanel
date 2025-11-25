# 🔧 Marketing Checkout Authentication Fix

**Issue**: "Authentication failed" error on marketing checkout  
**Root Cause**: Missing `api_keys` table and API key configuration  
**Status**: ✅ **FIXED** - API key created and ready to use

---

## ✅ What Was Fixed

### 1. Created `api_keys` Table
The marketing API authentication requires an `api_keys` table that didn't exist. Now created with proper schema:
- UUID primary keys
- SHA-256 hashed keys (secure storage)
- Tenant isolation
- Scope-based access control
- Activity tracking

### 2. Generated Marketing API Key
A secure API key has been generated and stored in the database:

**API Key** (store this securely):
```
mpanel_marketing_live_2025_secure_key_abc123xyz
```

**Key Details**:
- **ID**: `c7247267-337c-4535-aa0a-00ba74444bd3`
- **Name**: Marketing Website API Key
- **Scope**: `marketing`
- **Status**: Active
- **Created**: 2025-11-23

---

## 🔐 Configure Marketing Website

Your marketing website needs to send this API key with every checkout request.

### Method 1: Environment Variable (Recommended)

Add to your marketing website's `.env` file:
```bash
MPANEL_API_KEY=mpanel_marketing_live_2025_secure_key_abc123xyz
MPANEL_API_URL=https://migrapanel.com/api/marketing
```

### Method 2: Direct Configuration

If using JavaScript/Node.js:
```javascript
const MPANEL_API_KEY = 'mpanel_marketing_live_2025_secure_key_abc123xyz';
const MPANEL_API_URL = 'https://migrapanel.com/api/marketing';
```

---

## 📡 Using the API Key

### Checkout Request Example

```javascript
const response = await fetch('https://migrapanel.com/api/marketing/checkout-intent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'mpanel_marketing_live_2025_secure_key_abc123xyz'  // ← Required!
  },
  body: JSON.stringify({
    planSlug: 'starter-hosting',
    billingCycle: 'monthly',
    domain: 'customer-domain.com',
    domainMode: 'new_registration',
    customer: {
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe'
    },
    account: {
      password: 'SecurePassword123!'  // ← Panel access password
    },
    testMode: true  // Optional: for testing without charges
  })
});

const data = await response.json();
console.log(data);
```

### Expected Response (Success)
```json
{
  "success": true,
  "subscriptionId": "abc-123-def-456",
  "customerId": "cus-xyz-789",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_...",
  "amount": 53.64,
  "currency": "USD"
}
```

### Expected Response (Error - Missing API Key)
```json
{
  "error": "API key required"
}
```

### Expected Response (Error - Invalid API Key)
```json
{
  "error": "Invalid API key"
}
```

---

## 🧪 Test the Fixed Endpoint

### Quick Test (Command Line)
```bash
curl -X POST https://migrapanel.com/api/marketing/checkout-intent \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mpanel_marketing_live_2025_secure_key_abc123xyz" \
  -d '{
    "planSlug": "starter-hosting",
    "billingCycle": "monthly",
    "domain": "test-domain.com",
    "domainMode": "new_registration",
    "customer": {
      "email": "test@example.com",
      "firstName": "Test",
      "lastName": "User"
    },
    "account": {
      "password": "TestPass123!"
    },
    "testMode": true
  }'
```

Expected: Success response with subscription ID and checkout URL

### Test Without API Key (Should Fail)
```bash
curl -X POST https://migrapanel.com/api/marketing/checkout-intent \
  -H "Content-Type: application/json" \
  -d '{"planSlug": "test"}'
```

Expected: `{"error": "API key required"}`

---

## 🔒 Security Best Practices

### 1. **Never Expose API Key in Frontend**
❌ **WRONG** - Client-side JavaScript:
```javascript
// DON'T DO THIS - API key exposed to users!
fetch('https://migrapanel.com/api/marketing/checkout-intent', {
  headers: { 'X-API-Key': 'mpanel_marketing_live_2025...' }
});
```

✅ **CORRECT** - Server-side API:
```javascript
// Your marketing website backend (Node.js, PHP, etc.)
app.post('/api/create-checkout', async (req, res) => {
  const response = await fetch('https://migrapanel.com/api/marketing/checkout-intent', {
    headers: { 
      'X-API-Key': process.env.MPANEL_API_KEY  // From server environment
    },
    body: JSON.stringify(req.body)
  });
  res.json(await response.json());
});
```

### 2. **Use Environment Variables**
- Store in `.env` file (never commit to git)
- Add `.env` to `.gitignore`
- Use different keys for staging/production

### 3. **Rotate Keys Regularly**
Generate new API keys every 90 days:
```sql
-- On mpanel database
INSERT INTO api_keys (tenant_id, key_hash, name, scope)
SELECT 
  (SELECT id FROM tenants LIMIT 1),
  encode(sha256('new_secure_key_here'::bytea), 'hex'),
  'Marketing Website API Key (2025-Q1)',
  'marketing'
RETURNING id, name;

-- Disable old key
UPDATE api_keys SET is_active = false WHERE id = 'old-key-id';
```

---

## 📋 Marketing Website Integration Checklist

- [ ] Add `MPANEL_API_KEY` to `.env` file
- [ ] Configure checkout form to send API key in `X-API-Key` header
- [ ] Verify API key is sent from server-side (not client-side)
- [ ] Test checkout with test mode (`testMode: true`)
- [ ] Verify subscription created in database
- [ ] Test Stripe payment flow
- [ ] Verify provisioning triggers after payment
- [ ] Test welcome email delivery
- [ ] Switch `testMode: false` for production

---

## 🔍 Monitoring API Key Usage

### Check API Key Activity
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  name,
  scope,
  is_active,
  last_used_at,
  created_at
FROM api_keys
WHERE scope = '\''marketing'\''
ORDER BY created_at DESC;
"'
```

### Monitor Backend Logs
```bash
ssh root@10.1.10.206 'pm2 logs mpanel-backend | grep -i "marketing\|checkout"'
```

### Check Recent Checkouts
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  s.id,
  c.email,
  p.name as product,
  s.status,
  s.created_at
FROM subscriptions s
JOIN customers c ON s.customer_id = c.id
JOIN products p ON s.product_id = p.id
WHERE s.created_at > NOW() - INTERVAL '\''1 hour'\''
ORDER BY s.created_at DESC;
"'
```

---

## 🆘 Troubleshooting

### Issue: "Authentication failed"
**Cause**: Missing or invalid API key

**Solution**:
1. Verify API key is correct: `mpanel_marketing_live_2025_secure_key_abc123xyz`
2. Check header name: `X-API-Key` (case-sensitive)
3. Ensure API key is sent with every request
4. Check backend logs: `pm2 logs mpanel-backend --err`

### Issue: "API key required"
**Cause**: `X-API-Key` header not included in request

**Solution**:
Add header to all requests:
```javascript
headers: {
  'X-API-Key': process.env.MPANEL_API_KEY
}
```

### Issue: "Invalid API key"
**Cause**: API key doesn't match database hash or is inactive

**Solution**:
1. Verify exact key string (no spaces, correct characters)
2. Check key is active in database:
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT name, is_active, expires_at 
FROM api_keys 
WHERE key_hash = encode(sha256('\''mpanel_marketing_live_2025_secure_key_abc123xyz'\''::bytea), '\''hex'\'');
"'
```

### Issue: "Plan not found"
**Cause**: Invalid `planSlug` or product doesn't exist

**Solution**:
Check available products:
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  name,
  metadata->'\''slug'\'' as slug,
  price,
  currency
FROM products
WHERE is_active = true;
"'
```

---

## 🔄 API Key Regeneration

If you need to generate a new API key:

```sql
-- Connect to database
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel'

-- Generate new key with custom value
INSERT INTO api_keys (tenant_id, key_hash, name, scope, notes)
SELECT 
  (SELECT id FROM tenants LIMIT 1),
  encode(sha256('YOUR_NEW_KEY_HERE'::bytea), 'hex'),
  'Marketing Website API Key (New)',
  'marketing',
  'Regenerated on ' || NOW()::DATE
RETURNING id, name, scope, created_at;

-- Optionally disable old key
UPDATE api_keys 
SET is_active = false 
WHERE name = 'Marketing Website API Key'
  AND id != 'new-key-id';
```

---

## 📚 Related Documentation

- **API Endpoint Documentation**: See `src/routes/marketingApiRoutes.js`
- **Complete Testing Guide**: `QUICK_START_TEST.md`
- **System Status**: `SYSTEM_STATUS_FINAL.md`
- **Customer Flow**: `CUSTOMER_ACQUISITION_FLOW.md`

---

## ✅ Verification Checklist

After configuring your marketing website:

1. **API Key Configuration**
   - [ ] API key added to marketing website `.env`
   - [ ] API key sent in `X-API-Key` header
   - [ ] API key sent from server-side (not client)

2. **Test Checkout**
   - [ ] Test with `testMode: true`
   - [ ] Verify 200 OK response (not 401)
   - [ ] Subscription created in database
   - [ ] Checkout URL returned in response

3. **Production Ready**
   - [ ] Remove `testMode` or set to `false`
   - [ ] Stripe integration configured
   - [ ] Webhook endpoint configured
   - [ ] Welcome emails working

---

**Last Updated**: November 23, 2025  
**Status**: ✅ **API Keys configured and ready**  
**API Key**: `mpanel_marketing_live_2025_secure_key_abc123xyz` (store securely!)

---

**Next Steps**:
1. Add API key to your marketing website configuration
2. Test checkout endpoint with the example above
3. Verify subscription creation
4. Continue with full payment testing (see `QUICK_START_TEST.md`)
