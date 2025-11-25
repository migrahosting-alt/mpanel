# 🚀 READY TO LAUNCH - Complete End-to-End Testing Guide

**Status**: ✅ ALL SYSTEMS CONFIGURED AND READY
**Date**: January 2025
**Mission**: First customer acquisition with full automation

---

## 🎯 System Status Overview

### ✅ Infrastructure - 100% Complete
- **Admin Panel**: https://migrapanel.com (LIVE)
- **Backend API**: http://10.1.10.206:2271 (Nginx proxied)
- **Database**: PostgreSQL on db-core (10.1.10.210)
- **DNS Server**: PowerDNS on dns-core (10.1.10.102)
- **Mail Server**: mail-core (10.1.10.101)
- **Default Server**: srv1 (73.139.18.218) - CONFIGURED ✅

### ✅ API Integrations - 100% Complete
- **Stripe**: Configured with webhook secret
- **NameSilo**: API key configured (sandbox mode enabled)
- **PowerDNS**: API URL and key configured
- **cPanel/WHM**: Integration ready
- **Let's Encrypt**: Certbot automation ready
- **SMTP**: Welcome email service ready

### ✅ Provisioning System - 100% Complete
All 7 services deployed:
1. ✅ Stripe webhook handler (`/api/webhooks/stripe`)
2. ✅ Domain registration service (NameSilo)
3. ✅ DNS provisioning service (PowerDNS)
4. ✅ cPanel account creation service
5. ✅ SSL certificate service (Let's Encrypt)
6. ✅ Hosting orchestrator (6-step automation)
7. ✅ Email notification service

---

## 🧪 Testing the Complete Flow

### Step 1: Configure Stripe Webhook (5 minutes)

1. **Log into Stripe Dashboard**:
   ```bash
   # Open Stripe dashboard in browser
   https://dashboard.stripe.com/test/webhooks
   ```

2. **Add Webhook Endpoint**:
   - Click "Add endpoint"
   - URL: `https://migrapanel.com/api/webhooks/stripe`
   - Events to listen for:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

3. **Get Webhook Secret**:
   - After creating, copy the webhook signing secret (starts with `whsec_`)
   - Verify it matches in `.env` on mpanel-core

4. **Test Webhook Endpoint**:
   ```bash
   # Should return 400 "Webhook signature verification failed" (expected without signature)
   curl -X POST https://migrapanel.com/api/webhooks/stripe \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```

### Step 2: Test Domain Availability (2 minutes)

```bash
# Test NameSilo integration
ssh root@10.1.10.206 'cd /opt/mpanel && node -e "
const dns = require(\"./src/services/domainRegistrationService.js\");
dns.checkAvailability(\"test-$(date +%s).com\").then(console.log);
"'
```

Expected output:
```json
{
  "available": true,
  "domain": "test-1736000000.com",
  "price": 10.99
}
```

### Step 3: End-to-End Test Flow (15 minutes)

#### A. Create Test Subscription via Stripe

1. **Use Stripe Test Mode** (already configured):
   - Test Card: `4242 4242 4242 4242`
   - Any future expiry (e.g., 12/25)
   - Any CVV (e.g., 123)
   - Any ZIP (e.g., 12345)

2. **Trigger Checkout** (via your marketing website):
   ```bash
   # If marketing site not ready, create test subscription directly in Stripe
   # Or use Stripe Checkout API test mode
   ```

#### B. Monitor Provisioning Logs

Open 3 terminal windows:

**Terminal 1 - Backend Logs**:
```bash
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 50'
```

**Terminal 2 - Database Changes**:
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT w.id, w.domain, w.status, w.created_at, s.name as server
FROM websites w
LEFT JOIN servers s ON w.server_id = s.id
ORDER BY w.created_at DESC LIMIT 5;
"'
```

**Terminal 3 - DNS Zones**:
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT zone_name, status, created_at
FROM dns_zones
ORDER BY created_at DESC LIMIT 5;
"'
```

#### C. Verify Each Provisioning Step

After Stripe test payment completes:

**1. Domain Registration** (if domain included):
```bash
# Check domain in NameSilo sandbox
ssh root@10.1.10.206 'cd /opt/mpanel && node -e "
const dns = require(\"./src/services/domainRegistrationService.js\");
dns.getDomainInfo(\"customer-domain.com\").then(console.log);
"'
```

**2. DNS Zone Creation**:
```bash
# Check PowerDNS API
curl -s -H "X-API-Key: pdns-migra-2025" \
  http://10.1.10.102:8081/api/v1/servers/localhost/zones | jq '.[] | select(.name | contains("customer-domain"))'
```

**3. cPanel Account**:
```bash
# Check cPanel/WHM (replace with actual credentials)
ssh root@73.139.18.218 'whmapi1 accountsummary user=customer-username'
```

**4. SSL Certificate**:
```bash
# Check certificates directory
ssh root@73.139.18.218 'ls -lh /etc/letsencrypt/live/ | tail -5'
```

**5. Database Records**:
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  w.domain,
  w.status,
  w.cpanel_username,
  s.name as server,
  d.zone_name as dns,
  ssl.status as ssl_status
FROM websites w
LEFT JOIN servers s ON w.server_id = s.id
LEFT JOIN dns_zones d ON d.zone_name = w.domain
LEFT JOIN ssl_certificates ssl ON ssl.domain = w.domain
ORDER BY w.created_at DESC
LIMIT 1;
"'
```

**6. Welcome Email**:
- Check email inbox for welcome email
- Should contain: temporary password, cPanel URL, nameservers

---

## 🔍 Monitoring & Debugging

### Real-Time Monitoring

**System Health**:
```bash
# Overall backend status
curl -s https://migrapanel.com/api/health | jq

# PM2 process status
ssh root@10.1.10.206 'pm2 status'
```

**Database Queries**:
```bash
# Count provisioned websites
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT status, COUNT(*) 
FROM websites 
GROUP BY status;
"'

# Recent provisioning activity
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  w.domain,
  w.status,
  w.created_at,
  (w.created_at > NOW() - INTERVAL '\''5 minutes'\'') as recent
FROM websites w
ORDER BY w.created_at DESC LIMIT 10;
"'
```

**DNS Verification**:
```bash
# Check if DNS is resolving
dig @10.1.10.102 customer-domain.com
dig @ns1.migrahosting.com customer-domain.com
```

### Common Issues & Fixes

#### Issue: Webhook Not Triggering

**Symptoms**: Payment succeeds but no provisioning happens

**Debug**:
```bash
# Check webhook logs
ssh root@10.1.10.206 'pm2 logs mpanel-backend | grep webhook'

# Verify webhook secret
ssh root@10.1.10.206 'cd /opt/mpanel && grep STRIPE_WEBHOOK_SECRET .env'

# Test webhook manually
curl -X POST https://migrapanel.com/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
```

**Fix**:
1. Verify webhook URL in Stripe dashboard matches `https://migrapanel.com/api/webhooks/stripe`
2. Ensure webhook secret in `.env` matches Stripe
3. Check Nginx is proxying correctly
4. Restart backend: `ssh root@10.1.10.206 'pm2 restart mpanel-backend'`

#### Issue: Domain Registration Fails

**Symptoms**: `Error registering domain` in logs

**Debug**:
```bash
# Test NameSilo API connection
ssh root@10.1.10.206 'cd /opt/mpanel && node -e "
const axios = require(\"axios\");
const url = \"https://www.namesilo.com/api/checkRegisterAvailability?version=1&type=xml&key=dbb5289e88744b950e72f&domains=test.com\";
axios.get(url).then(r => console.log(r.data)).catch(console.error);
"'
```

**Fix**:
1. Verify `NAMESILO_API_KEY` in `.env`
2. Check NameSilo account balance (sandbox mode has limits)
3. Ensure domain TLD is supported
4. Review logs for API error messages

#### Issue: DNS Zone Not Created

**Symptoms**: Domain provisioned but DNS not working

**Debug**:
```bash
# Check PowerDNS API
curl -s -H "X-API-Key: pdns-migra-2025" \
  http://10.1.10.102:8081/api/v1/servers/localhost/zones

# Check dns_zones table
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "SELECT * FROM dns_zones ORDER BY created_at DESC LIMIT 5;"'
```

**Fix**:
1. Verify `POWERDNS_API_URL` and `POWERDNS_API_KEY`
2. Check PowerDNS service: `ssh root@10.1.10.102 'systemctl status pdns'`
3. Ensure firewall allows port 8081
4. Review dnsProvisioningService.js logs

#### Issue: cPanel Account Creation Fails

**Symptoms**: `Error creating cPanel account` in logs

**Debug**:
```bash
# Test WHM API access
ssh root@73.139.18.218 'whmapi1 version'

# Check server status in database
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "SELECT * FROM servers WHERE status = '\''active'\'';"'
```

**Fix**:
1. Verify WHM API token in cPanel server configuration
2. Check server disk space: `ssh root@73.139.18.218 'df -h'`
3. Ensure account quota limits are valid
4. Review cpanelProvisioningService.js for detailed errors

#### Issue: SSL Certificate Fails

**Symptoms**: Website created but SSL status is "failed"

**Debug**:
```bash
# Check certbot logs
ssh root@73.139.18.218 'tail -100 /var/log/letsencrypt/letsencrypt.log'

# Verify domain DNS resolution
dig customer-domain.com
```

**Fix**:
1. Ensure domain DNS is fully propagated (can take 5-15 minutes)
2. Check if certbot is installed: `ssh root@73.139.18.218 'certbot --version'`
3. Verify domain points to correct IP
4. Try manual certbot: `certbot certonly --webroot -w /home/username/public_html -d domain.com`

---

## 📊 Success Metrics

After successful provisioning, verify all these exist:

### Database Records
```bash
ssh root@10.1.10.210 'sudo -u postgres psql -d mpanel -c "
SELECT 
  '\''websites'\'' as table_name, COUNT(*) as records FROM websites
UNION ALL
SELECT '\''dns_zones'\'', COUNT(*) FROM dns_zones
UNION ALL
SELECT '\''dns_records'\'', COUNT(*) FROM dns_records
UNION ALL
SELECT '\''ssl_certificates'\'', COUNT(*) FROM ssl_certificates
UNION ALL
SELECT '\''subscriptions'\'', COUNT(*) FROM subscriptions;
"'
```

Expected output (after 1 successful provisioning):
```
  table_name     | records
-----------------+---------
 websites        |       1
 dns_zones       |       1
 dns_records     |      6+  (A, MX, TXT, NS, CNAME)
 ssl_certificates|       1
 subscriptions   |       1
```

### Customer Experience Checklist

- [ ] Customer received welcome email within 2 minutes
- [ ] Email contains:
  - [ ] cPanel login URL (e.g., https://srv1.migrahosting.com:2083)
  - [ ] Temporary password
  - [ ] Nameservers (ns1/ns2.migrahosting.com)
  - [ ] Domain name
  - [ ] Next steps instructions
- [ ] Customer can log into cPanel
- [ ] Website shows "Coming Soon" page
- [ ] SSL certificate installed (https:// works)
- [ ] DNS records propagating

---

## 🚀 Go Live Checklist

Before switching to production mode:

### 1. Verify Test Mode Works (this document)
- [ ] Complete at least 1 successful test provisioning
- [ ] Webhook receives and processes events correctly
- [ ] All services (domain, DNS, cPanel, SSL) working
- [ ] Welcome email delivered successfully
- [ ] Customer can access cPanel

### 2. Production Environment Prep
```bash
# On mpanel-core
ssh root@10.1.10.206 'cd /opt/mpanel && nano .env'

# Update these variables:
NAMESILO_SANDBOX=false  # Switch to live NameSilo
NODE_ENV=production     # Enable production mode
MARKETING_TEST_MODE=false  # If using marketing checkout

# Restart backend
ssh root@10.1.10.206 'pm2 restart mpanel-backend'
```

### 3. Stripe Production Mode
- [ ] Switch Stripe dashboard to "Live" mode
- [ ] Update webhook endpoint with live API keys
- [ ] Verify `STRIPE_SECRET_KEY` starts with `sk_live_`
- [ ] Update `STRIPE_WEBHOOK_SECRET` with live webhook secret

### 4. NameSilo Production
- [ ] Ensure NameSilo account has sufficient balance
- [ ] Set `NAMESILO_SANDBOX=false`
- [ ] Test domain registration with cheap TLD (e.g., .com at $10.99)

### 5. Monitoring Setup
```bash
# Set up automated alerts (optional but recommended)
# Add to crontab for daily health checks
ssh root@10.1.10.206 'crontab -e'
```

Add:
```cron
# Daily health check at 9 AM
0 9 * * * curl -s https://migrapanel.com/api/health || echo "Backend down!" | mail -s "mPanel Alert" admin@migrahosting.com
```

### 6. Customer Support Prep
- [ ] Document customer onboarding process
- [ ] Prepare FAQ for DNS propagation times
- [ ] Set up support email (support@migrahosting.com)
- [ ] Create cPanel video tutorials
- [ ] Prepare refund policy for failed provisioning

---

## 📞 Support & Troubleshooting

### Quick Diagnostics
```bash
# One-command system check
ssh root@10.1.10.206 'cd /opt/mpanel && node -e "
console.log(\"Backend:\", process.env.PORT);
console.log(\"Database:\", process.env.DATABASE_URL.split(\"@\")[1]);
console.log(\"Stripe:\", process.env.STRIPE_SECRET_KEY ? \"Configured\" : \"Missing\");
console.log(\"NameSilo:\", process.env.NAMESILO_API_KEY ? \"Configured\" : \"Missing\");
console.log(\"PowerDNS:\", process.env.POWERDNS_API_URL);
"'
```

### Log Analysis
```bash
# Search for errors in last 1000 lines
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 1000 --nostream | grep -i error'

# Find provisioning attempts
ssh root@10.1.10.206 'pm2 logs mpanel-backend --lines 500 --nostream | grep -i "provisioning"'
```

### Emergency Rollback
```bash
# If critical issue, rollback to previous version
ssh root@10.1.10.206 'cd /opt/mpanel && git log --oneline | head -5'
ssh root@10.1.10.206 'cd /opt/mpanel && git checkout PREVIOUS_COMMIT_HASH'
ssh root@10.1.10.206 'pm2 restart mpanel-backend'
```

---

## 🎉 Success!

When you see this output after a test purchase:

```
✓ Webhook received: checkout.session.completed
✓ Domain registered: customer-domain.com
✓ DNS zone created: 6 records added
✓ cPanel account created: customer123
✓ SSL certificate issued: customer-domain.com
✓ Website record created: ID abc-123
✓ Welcome email sent to: customer@email.com
```

**You're ready to accept real customers!** 🚀

---

**Next Steps**:
1. Complete test flow using this guide
2. Fix any issues found during testing
3. Switch to production mode
4. Market your hosting service
5. Monitor first customer signups

**For detailed architecture**: See `CUSTOMER_ACQUISITION_FLOW.md`
**For deployment**: See `GO_LIVE_GUIDE.md`
**For troubleshooting**: See logs via `pm2 logs mpanel-backend`

---

**Last Updated**: January 2025  
**Status**: ✅ READY FOR TESTING → PRODUCTION LAUNCH
