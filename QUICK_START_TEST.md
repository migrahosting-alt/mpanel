# ⚡ Quick Start - Test Your Customer Flow NOW

**Time to First Test**: 20 minutes  
**Status**: All systems ready, just need to test!

---

## 🎯 5-Minute Stripe Setup

### Step 1: Configure Webhook
```
1. Open: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Paste: https://migrapanel.com/api/webhooks/stripe
4. Select these events:
   ✓ checkout.session.completed
   ✓ payment_intent.succeeded
   ✓ customer.subscription.created
5. Click "Add endpoint"
6. Copy the webhook signing secret (whsec_...)
```

### Step 2: Verify Webhook Secret
```bash
ssh root@10.1.10.206 'cd /opt/mpanel && grep STRIPE_WEBHOOK_SECRET .env'
```

Make sure it matches the webhook secret from Stripe dashboard. If not:
```bash
ssh root@10.1.10.206 'cd /opt/mpanel && nano .env'
# Update STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
# Save and exit
ssh root@10.1.10.206 'pm2 restart mpanel-backend'
```

---

## 🧪 15-Minute End-to-End Test

### Before You Start - Open 2 Terminal Windows

**Terminal 1 - Monitor Backend Logs**:
```bash
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 100'
```
Keep this running to see provisioning in real-time!

**Terminal 2 - Database Queries** (run commands as needed):
```bash
# Check websites created
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT domain, status, cpanel_username, created_at 
FROM websites 
ORDER BY created_at DESC LIMIT 3;
"'

# Check DNS zones created
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT zone_name, status, created_at 
FROM dns_zones 
ORDER BY created_at DESC LIMIT 3;
"'
```

### Test Flow

#### Option A: Via Marketing Website (Recommended)
If your marketing website is live with Stripe checkout:

1. Go to your marketing site
2. Choose a hosting plan
3. Click "Sign Up" or "Get Started"
4. Fill in customer details
5. Use Stripe test card:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/25`)
   - CVV: `123`
   - ZIP: `12345`
6. Complete payment
7. Watch Terminal 1 for provisioning logs!

#### Option B: Direct Stripe Test (If Marketing Site Not Ready)

Create a test subscription via Stripe API:
```bash
# Create a test customer and subscription
curl -X POST https://api.stripe.com/v1/customers \
  -u YOUR_STRIPE_SECRET_KEY: \
  -d email="test@example.com" \
  -d name="Test Customer"

# Note the customer ID (cus_...), then create subscription
curl -X POST https://api.stripe.com/v1/subscriptions \
  -u YOUR_STRIPE_SECRET_KEY: \
  -d customer=cus_CUSTOMER_ID \
  -d "items[0][price]=YOUR_PRICE_ID"
```

Or use Stripe dashboard:
```
1. Go to: https://dashboard.stripe.com/test/subscriptions
2. Click "Create subscription"
3. Add customer email: test@example.com
4. Select your hosting plan price
5. Click "Start subscription"
6. Webhook will fire automatically!
```

### What to Watch For

**In Terminal 1 (Backend Logs)**, you should see:
```
✓ Webhook received: checkout.session.completed
✓ Starting provisioning for subscription: sub_...
✓ Registering domain: customer-domain.com
✓ Creating DNS zone...
✓ Creating cPanel account...
✓ Issuing SSL certificate...
✓ Creating website record...
✓ Sending welcome email...
✓ Provisioning completed successfully!
```

**In Terminal 2 (Database)**, run queries to verify:
```bash
# Should show new website
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "SELECT * FROM websites ORDER BY created_at DESC LIMIT 1;"'

# Should show new DNS zone
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "SELECT * FROM dns_zones ORDER BY created_at DESC LIMIT 1;"'

# Should show DNS records (A, MX, TXT, NS, CNAME)
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "SELECT * FROM dns_records ORDER BY created_at DESC LIMIT 10;"'
```

### Expected Timeline
```
0:00 - Customer completes Stripe payment
0:05 - Webhook received by mPanel
0:10 - Domain registered (NameSilo)
0:30 - DNS zone created (PowerDNS)
0:45 - cPanel account created (WHM)
1:30 - SSL certificate issued (Let's Encrypt)
2:00 - Website record in database
2:10 - Welcome email sent
2:15 - Customer receives email
```

---

## 📧 Verify Welcome Email

Customer should receive email with:

**Subject**: Welcome to [Your Company] - Your Hosting Account is Ready!

**Contents**:
- **cPanel URL**: https://srv1.migrahosting.com:2083
- **Username**: customer-username (generated)
- **Temporary Password**: (random secure password)
- **Domain**: customer-domain.com
- **Nameservers**:
  - ns1.migrahosting.com
  - ns2.migrahosting.com
- **Next Steps**: Point domain, upload files, create emails

### Test cPanel Login
```
1. Open cPanel URL from email
2. Login with username and temporary password
3. Should see cPanel dashboard
4. Check "File Manager" - should have public_html folder
5. Check "Email Accounts" - ready to create
```

---

## ✅ Success Checklist

After test completes, verify:

- [ ] Stripe webhook fired successfully
- [ ] Backend logs show "Provisioning completed successfully"
- [ ] `websites` table has new entry
- [ ] `dns_zones` table has new zone
- [ ] `dns_records` table has 6+ records
- [ ] `ssl_certificates` table has cert entry
- [ ] Welcome email received in inbox
- [ ] Can log into cPanel with credentials
- [ ] cPanel has correct domain and hosting space

If all checked ✅ → **SYSTEM IS WORKING! Ready for production!**

---

## 🚨 Quick Troubleshooting

### Webhook Not Firing
```bash
# Check webhook in Stripe dashboard
https://dashboard.stripe.com/test/webhooks
# View event logs - should show "succeeded" or error details

# Test webhook manually
curl -X POST https://migrapanel.com/api/webhooks/stripe
# Should return: "No stripe-signature header" (this is correct!)
```

### Domain Registration Fails
```bash
# NameSilo is in sandbox mode, so some TLDs may not work
# Try these TLDs for testing: .com, .net, .org
# Check NameSilo API logs in backend
ssh root@10.1.10.206 'pm2 logs mpanel-backend | grep -i namesilo'
```

### DNS Not Created
```bash
# Check PowerDNS is running
curl -H "X-API-Key: pdns-migra-2025" \
  http://10.1.10.102:8081/api/v1/servers/localhost

# Should return JSON with server info
```

### SSL Fails
```bash
# SSL requires domain to resolve to correct IP first
# Check DNS propagation (may take 5-15 minutes)
dig customer-domain.com @8.8.8.8

# If fails, SSL will retry automatically
# Or trigger manually later after DNS propagates
```

### Welcome Email Not Sent
```bash
# Check email service logs
ssh root@10.1.10.206 'pm2 logs mpanel-backend | grep -i email'

# Verify SMTP settings
ssh root@10.1.10.206 'cd /opt/mpanel && grep SMTP .env'
```

---

## 🎉 After Successful Test

### Go Live Steps

1. **Switch NameSilo to Production**:
```bash
ssh root@10.1.10.206 'cd /opt/mpanel && nano .env'
# Change: NAMESILO_SANDBOX=true → NAMESILO_SANDBOX=false
ssh root@10.1.10.206 'pm2 restart mpanel-backend'
```

2. **Switch Stripe to Live Mode**:
```
1. Stripe dashboard → Toggle "Live" mode (top right)
2. Update webhook with LIVE keys
3. Update .env with LIVE Stripe keys:
   - STRIPE_SECRET_KEY=sk_live_...
   - STRIPE_WEBHOOK_SECRET=whsec_... (live webhook)
```

3. **Update Frontend** (if needed):
```bash
# Update Stripe publishable key in frontend
cd frontend
nano .env
# VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
npm run build
```

4. **Enable Production Mode**:
```bash
ssh root@10.1.10.206 'cd /opt/mpanel && nano .env'
# Change: NODE_ENV=development → NODE_ENV=production
ssh root@10.1.10.206 'pm2 restart mpanel-backend'
```

5. **Start Marketing**! 🚀
   - Social media campaigns
   - Google Ads
   - SEO content
   - Affiliate program
   - First customers incoming!

---

## 📊 Monitor First Customers

```bash
# Dashboard of provisioned websites
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  COUNT(*) as total_websites,
  COUNT(CASE WHEN status = '\''active'\'' THEN 1 END) as active,
  COUNT(CASE WHEN status = '\''provisioning'\'' THEN 1 END) as provisioning,
  COUNT(CASE WHEN created_at > NOW() - INTERVAL '\''24 hours'\'' THEN 1 END) as last_24h
FROM websites;
"'

# Revenue tracking (subscriptions)
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  COUNT(*) as total_subscriptions,
  SUM(amount) as monthly_revenue
FROM subscriptions
WHERE status = '\''active'\'';
"'
```

---

## 🆘 Need Help?

**Check Logs**:
```bash
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 200 --nostream | grep -i error'
```

**Full System Check**:
```bash
curl -s https://migrapanel.com/api/health | jq .
```

**Documentation**:
- **Full Testing Guide**: `READY_TO_LAUNCH.md`
- **System Status**: `SYSTEM_STATUS_FINAL.md`
- **Architecture**: `CUSTOMER_ACQUISITION_FLOW.md`
- **Deployment**: `GO_LIVE_GUIDE.md`

---

**Ready? Let's test!** ⚡

1. Configure Stripe webhook (5 min)
2. Run test payment (2 min)
3. Watch logs (3 min)
4. Verify database (2 min)
5. Test cPanel login (2 min)
6. **Go live!** 🎉

**Current Status**: ✅ All systems operational, waiting for your test!
