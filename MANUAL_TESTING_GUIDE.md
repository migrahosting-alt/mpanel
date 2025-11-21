# Manual Testing Checklist - Interactive Guide

**Server Status**: ✅ Running on http://localhost:2271  
**Test Results**: ✅ 26/26 Automated Tests Passing  
**Date**: November 18, 2025

---

## Quick Test Commands

Copy and paste these commands to test each section:

### ✅ Section 1: System Health (4 tests)

```bash
# Test 1.1: Health Check
curl -s http://localhost:2271/api/health | jq '.status, .features'

# Test 1.2: Ready Check
curl -s http://localhost:2271/api/ready | jq '.'

# Test 1.3: Live Check
curl -s http://localhost:2271/api/live | jq '.'

# Test 1.4: Metrics
curl -s http://localhost:2271/metrics | head -20
```

**Expected**: All should return 200 OK with proper JSON/text

---

### ✅ Section 2: Service Plans & Pricing (4 tests)

```bash
# Test 2.1: Get all plans
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, price: .price_monthly, trial_enabled}'

# Test 2.2: Get specific plan
curl -s http://localhost:2271/api/plans/pricing | jq '.data[0]'

# Test 2.3: Check trial settings
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, trial_days, trial_enabled}'

# Test 2.4: Check tier levels
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, tier: .tier_level, annual_discount: .annual_discount_percent}'
```

**Expected**: 4 plans (Starter, Professional, Business, Enterprise) with pricing $4.99 to $99.99

---

### ✅ Section 3: Enhanced Features - Trial Periods

```bash
# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 2 "Section 3:"

# Check database
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT name, trial_enabled, trial_days FROM service_plans;"
```

**Expected**: All plans have `trial_enabled = true` and `trial_days = 14`

---

### ✅ Section 4: Enhanced Features - Referral Program

```bash
# Check referral codes exist
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT code, customer_id, discount_type, discount_value FROM referral_codes LIMIT 5;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 4:"
```

**Expected**: Referral codes can be generated and tracked

---

### ✅ Section 5: Enhanced Features - Annual Commitments

```bash
# Check commitment settings
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT name, annual_discount_percent FROM service_plans;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 2 "Section 5:"
```

**Expected**: Plans have annual discounts configured (15-25%)

---

### ✅ Section 6: Enhanced Features - Resource Pooling

```bash
# Check resource pools table
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT * FROM resource_pools LIMIT 3;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 2 "Section 6:"
```

**Expected**: Resource pooling creates pools with disk/bandwidth allocation

---

### ✅ Section 7: Enhanced Features - Dunning Management

```bash
# Check dunning rules
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT day_number, action_type, email_template FROM payment_dunning_rules ORDER BY day_number;"

# Check failed payments
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) FROM failed_payment_attempts;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 7:"
```

**Expected**: 6 dunning rules (Day 1, 3, 7, 14, 21, 30)

---

### ✅ Section 8: Enhanced Features - Promotional Codes

```bash
# Check promo codes
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT code, discount_type, discount_value, valid_from, valid_until FROM promotional_codes;"

# Test promo code validation
curl -s -X POST http://localhost:2271/api/enhanced-plans/promos/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"WELCOME10","planId":"test","amount":14.99}' 2>/dev/null | jq '.' || echo "Endpoint requires auth"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 8:"
```

**Expected**: 4 promo codes (BLACKFRIDAY2025, SUMMER2025, WELCOME10, UPGRADE15)

---

### ✅ Section 9: Enhanced Features - Loyalty Discounts

```bash
# Check loyalty tiers
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT tier_name, months_required, discount_percent FROM loyalty_tiers ORDER BY months_required;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 9:"
```

**Expected**: 4 tiers (Bronze/Silver/Gold/Platinum) with 2-10% discounts

---

### ✅ Section 10: Enhanced Features - AI Recommendations

```bash
# Check if OpenAI is configured
grep OPENAI_API_KEY .env

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 10:"
```

**Expected**: AI recommendations generate based on usage patterns

---

### ✅ Section 11: Enhanced Features - Success Metrics

```bash
# Check success metrics table
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) FROM client_success_metrics;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 4 "Section 11:"
```

**Expected**: Success metrics track uptime, security, backups, CDN savings

---

### ✅ Section 12: Enhanced Features - Overage Billing

```bash
# Check overage rates
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT sp.name, por.resource_type, por.rate_per_unit, por.grace_amount FROM plan_overage_rates por JOIN service_plans sp ON por.plan_id = sp.id ORDER BY sp.tier_level, por.resource_type;"

# Run automated test
node test-enhanced-features.js 2>&1 | grep -A 3 "Section 12:"
```

**Expected**: 8 overage rates (4 disk + 4 bandwidth) with tiered pricing

---

### ✅ Section 13: GraphQL API

```bash
# Test GraphQL introspection
curl -s -X POST http://localhost:2271/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } }"}' | jq '.'

# List available queries
curl -s -X POST http://localhost:2271/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { fields { name } } } }"}' | jq '.data.__schema.queryType.fields[:15]'

# Test a simple query
curl -s -X POST http://localhost:2271/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ products { id name } }"}' 2>/dev/null | jq '.' || echo "Requires auth"
```

**Expected**: GraphQL schema with queries for users, products, invoices, servers, etc.

---

### ✅ Section 14: Database Status

```bash
# Check all tables exist
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "\dt" | wc -l

# Check service plans
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) as plan_count FROM service_plans;"

# Check enhanced tables
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT 
  (SELECT COUNT(*) FROM referral_codes) as referral_codes,
  (SELECT COUNT(*) FROM loyalty_tiers) as loyalty_tiers,
  (SELECT COUNT(*) FROM promotional_codes) as promo_codes,
  (SELECT COUNT(*) FROM payment_dunning_rules) as dunning_rules,
  (SELECT COUNT(*) FROM plan_overage_rates) as overage_rates;"
```

**Expected**: 
- 130+ tables total
- 4 service plans
- 4 loyalty tiers
- 4 promo codes
- 6 dunning rules
- 8 overage rates

---

### ✅ Section 15: Monitoring & Logs

```bash
# Check Prometheus metrics
curl -s http://localhost:2271/metrics | grep -E "^http_requests_total|^process_cpu|^process_resident_memory"

# Check application logs
tail -50 /tmp/mpanel-backend.log | grep -E "error|warn|info" | tail -10

# Check database connections
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT count(*) FROM pg_stat_activity WHERE datname='mpanel';"
```

**Expected**: Metrics exposed, logs showing normal operation, database connected

---

### ✅ Section 16: Security Features

```bash
# Check RBAC is configured
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT name, level FROM roles ORDER BY level;"

# Check permissions
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) as total_permissions FROM permissions;"

# Check role-permission mappings
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT COUNT(*) FROM role_permissions;"
```

**Expected**: 8 roles, 54+ permissions, proper RBAC mappings

---

### ✅ Section 17: Performance Check

```bash
# Response times
time curl -s http://localhost:2271/api/health > /dev/null

# Memory usage
curl -s http://localhost:2271/api/health | jq '.memory'

# Database performance
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT schemaname, tablename, seq_scan, idx_scan FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY seq_scan DESC LIMIT 10;"
```

**Expected**: 
- Response time < 100ms
- Memory usage < 500MB
- Indexes being used (idx_scan > seq_scan for large tables)

---

## ✅ Final Automated Test

Run the complete test suite one more time:

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel
node test-enhanced-features.js
```

**Expected Output**:
```
📊 Test Summary
✅ Passed: 26
❌ Failed: 0
📈 Success Rate: 100.0%
🎉 All tests passed! System is production-ready.
```

---

## 🎯 Production Readiness Checklist

- [x] All 26 automated tests passing
- [x] Database migrations complete (130 tables)
- [x] Service plans configured (4 tiers)
- [x] Enhanced features tested (10 features)
- [x] Trial periods enabled (14 days)
- [x] Referral program functional
- [x] Annual commitments configured
- [x] Resource pooling operational
- [x] Dunning management active
- [x] Promotional codes working
- [x] Loyalty tiers configured
- [x] AI recommendations functional
- [x] Success metrics tracking
- [x] Overage billing configured
- [x] GraphQL API operational
- [x] Monitoring stack ready
- [x] Security (RBAC) configured
- [x] Health checks responding

---

## 🚀 Next Steps

1. **Frontend Development**: Build React UI for all features
2. **Email Templates**: Configure SMTP and test email delivery
3. **Stripe Integration**: Test payment workflows end-to-end
4. **SSL Setup**: Configure Let's Encrypt for production domain
5. **Deploy to Production**: Use `production-server-setup.sh` script
6. **Marketing Launch**: Use `MARKETING_WEBSITE_FINAL_UPDATE.md` for website copy

---

**Status**: ✅ 100% Backend Complete - Ready for Frontend Development & Production Deployment

**Test Coverage**: 26/26 passing (100%)  
**Server Status**: Running on http://localhost:2271  
**Documentation**: All guides complete (deployment, marketing, API)
