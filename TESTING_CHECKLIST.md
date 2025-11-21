# Enhanced Plan Access System - Testing Checklist

**Date**: November 18, 2025  
**Status**: Ready for Local Testing  
**Tables**: ✅ 19/19 Created

---

## 🗄️ Database Verification

### ✅ Base Tables (6 tables)
- [x] service_plans
- [x] premium_tool_bundles
- [x] premium_tools
- [x] client_service_subscriptions
- [x] client_addon_subscriptions
- [x] security_policy_templates

### ✅ Enhanced Tables (13 tables)
- [x] usage_overage_charges
- [x] plan_overage_rates
- [x] referral_codes
- [x] referral_rewards
- [x] resource_pools
- [x] pooled_subscriptions
- [x] failed_payment_attempts
- [x] dunning_rules
- [x] promotional_pricing
- [x] promo_code_redemptions
- [x] loyalty_discounts
- [x] loyalty_tiers
- [x] plan_recommendations
- [x] client_success_metrics
- [x] success_milestones
- [x] trial_conversions

---

## 📊 Section 1: Base Plan Access System

### Test 1.1: View Service Plans
```bash
# API Call
curl -s http://localhost:2271/api/plans/pricing | jq '.data[] | {name, tier_level, price_monthly}'

# Expected: 4 plans (Starter, Professional, Business, Enterprise)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 1.2: View Premium Bundles
```bash
curl -s http://localhost:2271/api/plans/bundles | jq '.data[] | {name, price_monthly, discount_percent}'

# Expected: 4 bundles (Security Pro, Developer Suite, Performance Pack, Marketing Master)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 1.3: Check Trial Configuration
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT name, tier_level, trial_enabled, trial_days FROM service_plans ORDER BY tier_level;"

# Expected: Tiers 1-3 have trials (7, 14, 30 days)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 💰 Section 2: Usage-Based Billing & Overages

### Test 2.1: Check Overage Rates Seeded
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT resource_type, COUNT(*) as rate_count FROM plan_overage_rates GROUP BY resource_type;"

# Expected: disk_space: 4 rates, bandwidth: 4 rates
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 2.2: Simulate Overage Calculation
```javascript
// In Node.js console or test file
import * as enhancedPlanService from './src/services/enhancedPlanService.js';

// Create test subscription first, then:
const charges = await enhancedPlanService.calculateOverageCharges(
  'subscription-id',
  'tenant-id',
  '2025-11-01',
  '2025-11-30'
);
console.log('Overage charges:', charges);

// Expected: Returns array of charges if usage > limit
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🎁 Section 3: Trial Periods & Freemium

### Test 3.1: Start Trial Subscription
```javascript
import * as enhancedPlanService from './src/services/enhancedPlanService.js';

const trial = await enhancedPlanService.startTrial(
  'customer-id',
  'tenant-id',
  'professional-plan-id'
);
console.log('Trial started:', trial);

// Expected: is_trial=true, trial_ends_at = 14 days from now
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 3.2: Check Expiring Trials
```javascript
const expiring = await enhancedPlanService.getExpiringTrials('tenant-id', 3);
console.log('Trials expiring in 3 days:', expiring);

// Expected: Returns trials ending soon
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 3.3: Convert Trial to Paid
```javascript
const converted = await enhancedPlanService.convertTrialToPaid(
  'subscription-id',
  'tenant-id',
  'payment-method-id'
);
console.log('Converted:', converted);

// Expected: is_trial=false, converted_from_trial=true
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🎯 Section 4: Referral Program

### Test 4.1: Generate Referral Code
```javascript
import * as enhancedPlanService from './src/services/enhancedPlanService.js';

const code = await enhancedPlanService.generateReferralCode(
  'customer-id',
  'tenant-id',
  { discountValue: 10.00, referrerRewardValue: 10.00 }
);
console.log('Referral code:', code.referral_code);

// Expected: Returns unique code like 'JOHN3X7K'
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 4.2: Apply Referral Code
```javascript
const result = await enhancedPlanService.applyReferralCode(
  'JOHN3X7K',
  'new-customer-id',
  'tenant-id',
  'subscription-id'
);
console.log('Referral applied:', result);

// Expected: refereeDiscount and referrerReward amounts
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 4.3: Get Referral Stats
```javascript
const stats = await enhancedPlanService.getReferralStats(
  'customer-id',
  'tenant-id'
);
console.log('Referral stats:', stats);

// Expected: Shows total referrals, rewards earned
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 📅 Section 5: Annual Commit Discounts

### Test 5.1: Create Annual Commitment
```javascript
const commitment = await enhancedPlanService.createAnnualCommitment(
  'customer-id',
  'tenant-id',
  'plan-id',
  12 // 12 months
);
console.log('Commitment:', commitment);

// Expected: has_annual_commit=true, commit_discount_percent=15, early_termination_fee set
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 5.2: Process Early Termination
```javascript
const termination = await enhancedPlanService.processEarlyTermination(
  'subscription-id',
  'tenant-id',
  'customer request'
);
console.log('Termination fee:', termination);

// Expected: Returns early_termination_fee amount
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🏢 Section 6: Resource Pooling (Enterprise)

### Test 6.1: Create Resource Pool
```javascript
const pool = await enhancedPlanService.createResourcePool(
  'enterprise-customer-id',
  'tenant-id',
  {
    poolName: 'Agency Pool',
    totalDiskGb: 500,
    totalBandwidthGb: 5000,
    totalWebsites: 50,
    priceMonthly: 299.99
  }
);
console.log('Pool created:', pool);

// Expected: Returns pool with usage tracking
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 6.2: Add Subscription to Pool
```javascript
const added = await enhancedPlanService.addSubscriptionToPool(
  'pool-id',
  'subscription-id',
  'tenant-id',
  { diskGb: 50, bandwidthGb: 500, websites: 5 }
);
console.log('Added to pool:', added);

// Expected: Returns true, pool usage updated
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🔄 Section 7: Grace Periods & Dunning

### Test 7.1: Record Failed Payment
```javascript
const failed = await enhancedPlanService.recordFailedPayment(
  'subscription-id',
  'tenant-id',
  {
    customerId: 'customer-id',
    invoiceId: 'invoice-id',
    amount: 14.99,
    failureReason: 'insufficient_funds'
  }
);
console.log('Failed payment recorded:', failed);

// Expected: attempt_number=1, next_retry_date = 3 days from now
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 7.2: Check Dunning Rules
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT rule_name, days_after_failure, action_type FROM dunning_rules ORDER BY days_after_failure;"

# Expected: 6 rules (Day 1, 3, 7, 14, 21, 30)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 7.3: Get Payments to Retry
```javascript
const retries = await enhancedPlanService.getPaymentsToRetry('tenant-id');
console.log('Payments to retry:', retries);

// Expected: Returns payments where next_retry_date <= today
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🎉 Section 8: Promotional Pricing

### Test 8.1: Check Seeded Promo Codes
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT promo_code, promo_name, discount_type, discount_value FROM promotional_pricing;"

# Expected: 4 codes (BLACKFRIDAY2025, SUMMER2025, WELCOME10, UPGRADE15)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 8.2: Apply Promo Code
```javascript
import * as enhancedPlanService2 from './src/services/enhancedPlanService2.js';

const discount = await enhancedPlanService2.applyPromoCode(
  'WELCOME10',
  'customer-id',
  'tenant-id',
  'plan-id',
  true // isNewCustomer
);
console.log('Discount:', discount);

// Expected: discountAmount = 10% of plan price
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 8.3: Record Redemption
```javascript
const redeemed = await enhancedPlanService2.recordPromoRedemption(
  'promo-id',
  'customer-id',
  'tenant-id',
  'subscription-id',
  { discountAmount: 1.50, originalAmount: 14.99, finalAmount: 13.49 }
);
console.log('Redeemed:', redeemed);

// Expected: true, promo current_uses incremented
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🏆 Section 9: Loyalty & Volume Discounts

### Test 9.1: Check Loyalty Tiers
```bash
docker exec mpanel-postgres psql -U mpanel -d mpanel -c "SELECT tier_name, tier_level, discount_percent FROM loyalty_tiers ORDER BY tier_level;"

# Expected: 4 tiers (Bronze 2%, Silver 5%, Gold 8%, Platinum 10%)
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 9.2: Calculate Loyalty Discount
```javascript
import * as enhancedPlanService2 from './src/services/enhancedPlanService2.js';

const discount = await enhancedPlanService2.calculateLoyaltyDiscount(
  'customer-id',
  'tenant-id'
);
console.log('Loyalty discount:', discount);

// Expected: Returns eligible, discountPercent, reason
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🤖 Section 10: AI-Powered Recommendations

### Test 10.1: Generate Recommendation
```javascript
const recommendation = await enhancedPlanService2.generatePlanRecommendation(
  'customer-id',
  'tenant-id'
);
console.log('Recommendation:', recommendation);

// Expected: Suggests upgrade if usage >80%, downgrade if <30%
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 10.2: Accept Recommendation
```javascript
const accepted = await enhancedPlanService2.acceptRecommendation(
  'recommendation-id',
  'tenant-id'
);
console.log('Accepted:', accepted);

// Expected: Subscription plan_id updated
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 📈 Section 11: Success Metrics Dashboard

### Test 11.1: Record Success Metrics
```javascript
const metrics = await enhancedPlanService2.recordSuccessMetrics(
  'customer-id',
  'tenant-id',
  {
    metricDate: '2025-11-18',
    uptimePercentage: 99.99,
    attacksBlocked: 127,
    malwareScans: 24,
    backupCount: 1,
    cdnBandwidthSavedGb: 5.2
  }
);
console.log('Metrics recorded:', metrics);

// Expected: Creates/updates daily metric record
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 11.2: Get Success Dashboard
```javascript
const dashboard = await enhancedPlanService2.getSuccessDashboard(
  'customer-id',
  'tenant-id',
  30 // last 30 days
);
console.log('Dashboard:', dashboard);

// Expected: Returns aggregated metrics and milestones
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 11.3: Award Milestone
```javascript
const milestone = await enhancedPlanService2.awardMilestone(
  'customer-id',
  'tenant-id',
  'first_year',
  'One Year Anniversary',
  'Thank you for one year!'
);
console.log('Milestone awarded:', milestone);

// Expected: Creates milestone record
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## ⏰ Section 12: Cron Jobs (Manual Testing)

### Test 12.1: Import and Start Cron Jobs
```javascript
// In node REPL or test file
import enhancedPlanCronJobs from './src/services/enhancedPlanCronJobs.js';

enhancedPlanCronJobs.startAllCronJobs();

// Expected: Logs show all 9 cron jobs started
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 12.2: Manually Trigger Trial Check (for testing)
```javascript
// Temporarily change schedule to run immediately
import cron from 'node-cron';

const testJob = cron.schedule('* * * * *', async () => {
  // Copy code from expiringTrialsJob
  console.log('Running trial check...');
  // ... test logic
});

testJob.start();

// Expected: Job executes every minute for testing
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 12.3: Stop All Cron Jobs
```javascript
enhancedPlanCronJobs.stopAllCronJobs();

// Expected: All jobs stop gracefully
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## 🌐 Section 13: API Endpoints (Frontend Integration)

### Test 13.1: Public Pricing Endpoint
```bash
curl -s http://localhost:2271/api/plans/pricing | jq

# Expected: Returns all service plans
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 13.2: Client Features Endpoint (Requires Auth)
```bash
# First get auth token, then:
curl -s http://localhost:2271/api/plans/my-features \
  -H "Authorization: Bearer $TOKEN" | jq

# Expected: Returns customer's feature access
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

### Test 13.3: Premium Bundles Endpoint
```bash
curl -s http://localhost:2271/api/plans/bundles | jq

# Expected: Returns 4 bundles with pricing
```
**Result**: [ ] Pass [ ] Fail  
**Notes**: _________________________

---

## ✅ Final Verification

### Database Integrity
- [ ] All 19 tables exist
- [ ] Default data seeded (overage rates, dunning rules, loyalty tiers, promo codes)
- [ ] Indexes created
- [ ] Triggers working
- [ ] Foreign keys enforced

### Service Layer
- [ ] enhancedPlanService.js exports all functions
- [ ] enhancedPlanService2.js exports all functions
- [ ] enhancedPlanCronJobs.js exports cron manager
- [ ] No import errors
- [ ] Logging works

### Integration
- [ ] Routes registered in src/routes/index.js
- [ ] Cron jobs integrated in src/server.js
- [ ] Authentication middleware working
- [ ] RBAC checks in place

### Documentation
- [ ] ENHANCED_PLAN_ACCESS_COMPLETE.md accurate
- [ ] API examples tested
- [ ] Revenue projections validated

---

## 📝 Testing Notes

**Started**: _______________  
**Completed**: _______________  
**Total Tests**: 40+  
**Passed**: _____  
**Failed**: _____  

**Critical Issues Found**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Next Steps After Testing**:
1. [ ] Fix any critical bugs
2. [ ] Build frontend UI components
3. [ ] Integrate with Stripe for billing
4. [ ] Deploy to production
5. [ ] Enable cron jobs (NODE_ENV=production)
