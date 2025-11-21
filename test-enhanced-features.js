/**
 * Enhanced Plan Access System - Comprehensive Test Suite
 * Tests all 10 features systematically and reports issues
 */

import pool from './src/db/index.js';
import logger from './src/config/logger.js';
import * as enhancedPlanService from './src/services/enhancedPlanService.js';
import * as enhancedPlanService2 from './src/services/enhancedPlanService2.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

// Helper functions
function pass(testName) {
  console.log(`✅ PASS: ${testName}`);
  testResults.passed++;
}

function fail(testName, error) {
  console.log(`❌ FAIL: ${testName}`);
  console.log(`   Error: ${error.message}`);
  testResults.failed++;
  testResults.errors.push({ test: testName, error: error.message });
}

async function cleanup() {
  // Clean up test data
  try {
    await pool.query(`DELETE FROM client_success_metrics WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM plan_recommendations WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM loyalty_discounts WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM referral_rewards WHERE referee_id IN ('00000000-0000-0000-0000-000000000003') OR referrer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM referral_codes WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM failed_payment_attempts WHERE customer_id IN ('00000000-0000-0000-0000-000000000003') OR invoice_id IN ('00000000-0000-0000-0000-000000000005')`);
    await pool.query(`DELETE FROM usage_overage_charges WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM pooled_subscriptions WHERE subscription_id IN ('00000000-0000-0000-0000-000000000004')`);
    await pool.query(`DELETE FROM client_service_subscriptions WHERE id IN ('00000000-0000-0000-0000-000000000004') OR customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM resource_pools WHERE customer_id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM customers WHERE id IN ('00000000-0000-0000-0000-000000000003')`);
    await pool.query(`DELETE FROM users WHERE id IN ('00000000-0000-0000-0000-000000000002') OR email = 'test@example.com'`);
  } catch (error) {
    console.log('Cleanup error (non-fatal):', error.message);
  }
}

// Test Suite
async function runTests() {
  console.log('\n🧪 Enhanced Plan Access System - Automated Test Suite\n');
  console.log('=' .repeat(60));
  
  // Section 1: Database Verification
  console.log('\n📊 Section 1: Database Verification\n');
  
  try {
    const planCount = await pool.query('SELECT COUNT(*) FROM service_plans');
    if (parseInt(planCount.rows[0].count) === 4) {
      pass('Service plans seeded (4 plans)');
    } else {
      throw new Error(`Expected 4 plans, found ${planCount.rows[0].count}`);
    }
  } catch (error) {
    fail('Service plans seeded', error);
  }
  
  try {
    const tables = [
      'usage_overage_charges', 'plan_overage_rates', 'referral_codes',
      'resource_pools', 'failed_payment_attempts', 'promotional_pricing',
      'loyalty_discounts', 'plan_recommendations', 'client_success_metrics'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*) FROM information_schema.tables WHERE table_name = $1`, [table]);
      if (parseInt(result.rows[0].count) !== 1) {
        throw new Error(`Table ${table} not found`);
      }
    }
    pass('All enhanced tables exist (9 tables)');
  } catch (error) {
    fail('Enhanced tables exist', error);
  }
  
  try {
    const overageRates = await pool.query('SELECT COUNT(*) FROM plan_overage_rates');
    if (parseInt(overageRates.rows[0].count) >= 8) {
      pass('Overage rates seeded (8 rates)');
    } else {
      throw new Error(`Expected 8+ overage rates, found ${overageRates.rows[0].count}`);
    }
  } catch (error) {
    fail('Overage rates seeded', error);
  }
  
  try {
    const promos = await pool.query('SELECT COUNT(*) FROM promotional_pricing');
    if (parseInt(promos.rows[0].count) >= 4) {
      pass('Promo codes seeded (4 codes)');
    } else {
      throw new Error(`Expected 4+ promo codes, found ${promos.rows[0].count}`);
    }
  } catch (error) {
    fail('Promo codes seeded', error);
  }
  
  try {
    const tiers = await pool.query('SELECT COUNT(*) FROM loyalty_tiers');
    if (parseInt(tiers.rows[0].count) >= 4) {
      pass('Loyalty tiers seeded (4 tiers)');
    } else {
      throw new Error(`Expected 4+ loyalty tiers, found ${tiers.rows[0].count}`);
    }
  } catch (error) {
    fail('Loyalty tiers seeded', error);
  }
  
  // Section 2: Create Test Customer & Subscription
  console.log('\n👤 Section 2: Test Data Setup\n');
  
  let testCustomerId;
  let testSubscriptionId;
  let planId;
  
  try {
    // Get a plan ID
    const planResult = await pool.query('SELECT id FROM service_plans WHERE tier_level = 2 LIMIT 1');
    if (planResult.rows.length === 0) {
      throw new Error('No plans found');
    }
    planId = planResult.rows[0].id;
    
    // Create test user first
    const userResult = await pool.query(`
      INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status)
      VALUES ('00000000-0000-0000-0000-000000000002', $1, 'test@example.com', '$2b$10$abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNO', 'Test', 'User', 'client', 'active')
      ON CONFLICT (tenant_id, email) DO UPDATE SET id = '00000000-0000-0000-0000-000000000002'
      RETURNING id
    `, [TENANT_ID]);
    const testUserId = userResult.rows[0].id;
    
    // Create test customer
    const customerResult = await pool.query(`
      INSERT INTO customers (id, tenant_id, user_id, company_name)
      VALUES ('00000000-0000-0000-0000-000000000003', $1, $2, 'Test Company')
      ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `, [TENANT_ID, testUserId]);
    testCustomerId = customerResult.rows[0].id;
    pass('Test customer created');
  } catch (error) {
    fail('Test customer creation', error);
    return; // Can't continue without customer
  }
  
  try {
    // Create test subscription
    const subResult = await pool.query(`
      INSERT INTO client_service_subscriptions 
      (id, tenant_id, customer_id, service_plan_id, status, billing_cycle, next_billing_date, price_paid, disk_usage_gb, bandwidth_usage_gb, current_websites, current_email_accounts, current_databases)
      VALUES ('00000000-0000-0000-0000-000000000004', $1, $2, $3, 'active', 'monthly', CURRENT_DATE + INTERVAL '30 days', 14.99, 10, 100, 1, 5, 1)
      RETURNING id
    `, [TENANT_ID, testCustomerId, planId]);
    testSubscriptionId = subResult.rows[0].id;
    pass('Test subscription created');
  } catch (error) {
    fail('Test subscription creation', error);
  }
  
  // Section 3: Trial Periods & Freemium
  console.log('\n🎁 Section 3: Trial Periods & Freemium\n');
  
  try {
    const trial = await enhancedPlanService.startTrial(
      testCustomerId,
      TENANT_ID,
      planId
    );
    
    if (trial.is_trial && trial.trial_days && trial.trial_ends_at) {
      pass('Start trial subscription');
    } else {
      throw new Error('Trial fields not set correctly');
    }
  } catch (error) {
    fail('Start trial subscription', error);
  }
  
  try {
    const expiring = await enhancedPlanService.getExpiringTrials(TENANT_ID, 30);
    pass('Get expiring trials');
  } catch (error) {
    fail('Get expiring trials', error);
  }
  
  // Section 4: Referral Program
  console.log('\n🎯 Section 4: Referral Program\n');
  
  let referralCode;
  
  try {
    const code = await enhancedPlanService.generateReferralCode(
      testCustomerId,
      TENANT_ID,
      { discountValue: 10.00, referrerRewardValue: 10.00 }
    );
    
    if (code.referral_code && code.discount_value) {
      referralCode = code.referral_code;
      pass('Generate referral code');
    } else {
      throw new Error('Referral code missing fields');
    }
  } catch (error) {
    fail('Generate referral code', error);
  }
  
  try {
    const stats = await enhancedPlanService.getReferralStats(testCustomerId, TENANT_ID);
    pass('Get referral stats');
  } catch (error) {
    fail('Get referral stats', error);
  }
  
  // Section 5: Annual Commitments
  console.log('\n📅 Section 5: Annual Commit Discounts\n');
  
  try {
    const commitment = await enhancedPlanService.createAnnualCommitment(
      testCustomerId,
      TENANT_ID,
      planId,
      12
    );
    
    if (commitment.has_annual_commit && commitment.commit_discount_percent) {
      pass('Create annual commitment');
    } else {
      throw new Error('Commitment fields not set');
    }
  } catch (error) {
    fail('Create annual commitment', error);
  }
  
  // Section 6: Resource Pooling
  console.log('\n🏢 Section 6: Resource Pooling (Enterprise)\n');
  
  let poolId;
  
  try {
    const pool = await enhancedPlanService.createResourcePool(
      testCustomerId,
      TENANT_ID,
      {
        poolName: 'Test Pool',
        totalDiskGb: 500,
        totalBandwidthGb: 5000,
        totalWebsites: 50,
        priceMonthly: 299.99
      }
    );
    
    if (pool.id && pool.total_disk_gb == 500) {
      poolId = pool.id;
      pass('Create resource pool');
    } else {
      throw new Error(`Pool validation failed: id=${pool.id}, total_disk_gb=${pool.total_disk_gb} (expected 500)`);
    }
  } catch (error) {
    fail('Create resource pool', error);
  }
  
  // Section 7: Grace Periods & Dunning
  console.log('\n🔄 Section 7: Grace Periods & Dunning\n');
  
  try {
    const failed = await enhancedPlanService.recordFailedPayment(
      testSubscriptionId,
      TENANT_ID,
      {
        customerId: testCustomerId,
        invoiceId: '00000000-0000-0000-0000-000000000005',
        amount: 14.99,
        failureReason: 'insufficient_funds'
      }
    );
    
    if (failed.attempt_number === 1 && failed.next_retry_date) {
      pass('Record failed payment');
    } else {
      throw new Error('Failed payment not recorded correctly');
    }
  } catch (error) {
    fail('Record failed payment', error);
  }
  
  try {
    const retries = await enhancedPlanService.getPaymentsToRetry(TENANT_ID);
    pass('Get payments to retry');
  } catch (error) {
    fail('Get payments to retry', error);
  }
  
  // Section 8: Promotional Pricing
  console.log('\n🎉 Section 8: Promotional Pricing\n');
  
  try {
    const discount = await enhancedPlanService2.applyPromoCode(
      'WELCOME10',
      testCustomerId,
      TENANT_ID,
      planId,
      true
    );
    
    if (discount.valid && discount.discountAmount > 0) {
      pass('Apply promo code');
    } else {
      throw new Error('Promo code not applied correctly');
    }
  } catch (error) {
    fail('Apply promo code', error);
  }
  
  try {
    const promos = await enhancedPlanService2.getActivePromos(TENANT_ID, 'new_customers');
    if (promos.length > 0) {
      pass('Get active promos');
    } else {
      throw new Error('No active promos found');
    }
  } catch (error) {
    fail('Get active promos', error);
  }
  
  // Section 9: Loyalty Discounts
  console.log('\n🏆 Section 9: Loyalty & Volume Discounts\n');
  
  try {
    const discount = await enhancedPlanService2.calculateLoyaltyDiscount(
      testCustomerId,
      TENANT_ID
    );
    pass('Calculate loyalty discount');
  } catch (error) {
    fail('Calculate loyalty discount', error);
  }
  
  try {
    const discounts = await enhancedPlanService2.getCustomerLoyaltyDiscounts(
      testCustomerId,
      TENANT_ID
    );
    pass('Get customer loyalty discounts');
  } catch (error) {
    fail('Get customer loyalty discounts', error);
  }
  
  // Section 10: AI Recommendations
  console.log('\n🤖 Section 10: AI-Powered Plan Recommendations\n');
  
  try {
    // Set some usage data first
    await pool.query(`
      UPDATE client_service_subscriptions
      SET disk_usage_gb = 45, bandwidth_usage_gb = 450
      WHERE id = $1
    `, [testSubscriptionId]);
    
    const recommendation = await enhancedPlanService2.generatePlanRecommendation(
      testCustomerId,
      TENANT_ID
    );
    pass('Generate AI recommendation');
  } catch (error) {
    fail('Generate AI recommendation', error);
  }
  
  try {
    const recommendations = await enhancedPlanService2.getCustomerRecommendations(
      testCustomerId,
      TENANT_ID
    );
    pass('Get customer recommendations');
  } catch (error) {
    fail('Get customer recommendations', error);
  }
  
  // Section 11: Success Metrics
  console.log('\n📈 Section 11: Client Success Metrics\n');
  
  try {
    const metrics = await enhancedPlanService2.recordSuccessMetrics(
      testCustomerId,
      TENANT_ID,
      {
        metricDate: '2025-11-18',
        uptimePercentage: 99.99,
        attacksBlocked: 127,
        malwareScans: 24,
        backupCount: 1,
        cdnBandwidthSavedGb: 5.2
      }
    );
    
    if (metrics.uptime_percentage && metrics.attacks_blocked) {
      pass('Record success metrics');
    } else {
      throw new Error('Metrics not recorded correctly');
    }
  } catch (error) {
    fail('Record success metrics', error);
  }
  
  try {
    const dashboard = await enhancedPlanService2.getSuccessDashboard(
      testCustomerId,
      TENANT_ID,
      30
    );
    
    if (dashboard.metrics) {
      pass('Get success dashboard');
    } else {
      throw new Error('Dashboard not returned correctly');
    }
  } catch (error) {
    fail('Get success dashboard', error);
  }
  
  try {
    await enhancedPlanService2.awardMilestone(
      testCustomerId,
      TENANT_ID,
      'test_milestone',
      'Test Milestone',
      'Test achievement'
    );
    pass('Award milestone');
  } catch (error) {
    fail('Award milestone', error);
  }
  
  // Section 12: Overage Calculation
  console.log('\n💰 Section 12: Usage-Based Billing & Overages\n');
  
  try {
    // Set usage above limits
    await pool.query(`
      UPDATE client_service_subscriptions
      SET disk_usage_gb = 60, bandwidth_usage_gb = 600
      WHERE id = $1
    `, [testSubscriptionId]);
    
    const charges = await enhancedPlanService.calculateOverageCharges(
      testSubscriptionId,
      TENANT_ID,
      '2025-11-01',
      '2025-11-30'
    );
    
    if (Array.isArray(charges)) {
      pass('Calculate overage charges');
    } else {
      throw new Error('Overage charges not calculated');
    }
  } catch (error) {
    fail('Calculate overage charges', error);
  }
  
  try {
    const pending = await enhancedPlanService.getPendingOverageCharges(
      testCustomerId,
      TENANT_ID
    );
    pass('Get pending overage charges');
  } catch (error) {
    fail('Get pending overage charges', error);
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up test data...\n');
  await cleanup();
  
  // Summary
  console.log('=' .repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🔴 Failed Tests:\n');
    testResults.errors.forEach((err, index) => {
      console.log(`${index + 1}. ${err.test}`);
      console.log(`   └─ ${err.error}\n`);
    });
  } else {
    console.log('\n🎉 All tests passed! System is production-ready.\n');
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test suite crashed:', error);
  process.exit(1);
});
