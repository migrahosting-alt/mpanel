#!/usr/bin/env node
/**
 * Test Webhook Flow
 * Simulates a Stripe checkout.session.completed event
 */

import db from './src/db/index.js';
import logger from './src/utils/logger.js';

const TEST_EMAIL = `test-webhook-${Date.now()}@example.com`;
const TEST_PRODUCT = 'starter';
const TEST_BILLING = 'monthly';

async function testWebhookFlow() {
  console.log('\n🧪 TESTING WEBHOOK FLOW\n');
  console.log('=' .repeat(60));

  try {
    // 1. Create a checkout session (simulating frontend checkout)
    console.log('\n1️⃣  Creating checkout session...');
    const checkoutQuery = `
      INSERT INTO checkout_sessions (
        stripe_session_id,
        email,
        customer_name,
        product_code,
        billing_cycle,
        amount,
        currency,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    
    const sessionId = `cs_test_${Math.random().toString(36).substring(7)}`;
    const { rows: [checkout] } = await db.query(checkoutQuery, [
      sessionId,
      TEST_EMAIL,
      'Test User',
      TEST_PRODUCT,
      TEST_BILLING,
      799, // $7.99 in cents
      'usd',
      'pending'
    ]);
    
    console.log(`✅ Checkout created: ${checkout.id}`);
    console.log(`   Email: ${TEST_EMAIL}`);
    console.log(`   Session ID: ${sessionId}`);

    // 2. Simulate webhook handler logic
    console.log('\n2️⃣  Simulating webhook processing...');
    
    // Generate temp password
    const tempPassword = generateTempPassword();
    console.log(`   Generated temp password: ${tempPassword}`);

    // Create user
    console.log('\n3️⃣  Creating user account...');
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    
    const userQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified)
      VALUES ($1, $2, $3, $4, 'customer', 'active', false)
      RETURNING id, email;
    `;
    
    try {
      const { rows: [user] } = await db.query(userQuery, [
        TEST_EMAIL,
        passwordHash,
        'Test',
        'User'
      ]);
      console.log(`✅ User created: ${user.id}`);
      console.log(`   Email: ${user.email}`);

      // Create customer
      console.log('\n4️⃣  Creating customer record...');
      const customerQuery = `
        INSERT INTO customers (user_id, currency)
        VALUES ($1, $2)
        RETURNING id;
      `;
      
      const { rows: [customer] } = await db.query(customerQuery, [
        user.id,
        checkout.currency
      ]);
      console.log(`✅ Customer created: ${customer.id}`);

      // Get product
      console.log('\n5️⃣  Looking up product...');
      const productQuery = `
        SELECT p.*, pr.unit_amount, pr.billing_cycle
        FROM products p
        JOIN prices pr ON pr.product_id = p.id
        WHERE p.code = $1 AND pr.billing_cycle = $2
        LIMIT 1;
      `;
      
      const { rows: [product] } = await db.query(productQuery, [
        TEST_PRODUCT,
        TEST_BILLING
      ]);
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      console.log(`✅ Product found: ${product.name}`);
      console.log(`   Type: ${product.type}`);
      console.log(`   Price: $${(product.unit_amount / 100).toFixed(2)}`);

      // Create subscription
      console.log('\n6️⃣  Creating subscription...');
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      
      const subscriptionQuery = `
        INSERT INTO subscriptions (
          customer_id,
          product_id,
          status,
          billing_cycle,
          price,
          next_billing_date,
          auto_renew,
          metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb)
        RETURNING id;
      `;
      
      const subscriptionMetadata = {
        stripe_session_id: sessionId,
        product_code: TEST_PRODUCT,
        temp_password: tempPassword,
        test: true
      };
      
      const { rows: [subscription] } = await db.query(subscriptionQuery, [
        customer.id,
        product.id,
        'active',
        TEST_BILLING,
        (checkout.amount / 100).toFixed(2),
        nextBillingDate,
        JSON.stringify(subscriptionMetadata)
      ]);
      
      console.log(`✅ Subscription created: ${subscription.id}`);
      console.log(`   Next billing: ${nextBillingDate.toISOString().split('T')[0]}`);

      // Update checkout status
      console.log('\n7️⃣  Updating checkout status...');
      await db.query(
        `UPDATE checkout_sessions SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [checkout.id]
      );
      console.log(`✅ Checkout marked as completed`);

      // Provision service
      if (product.type === 'hosting' || product.type === 'wordpress') {
        console.log('\n8️⃣  Provisioning hosting service...');
        const websiteQuery = `
          INSERT INTO websites (
            customer_id,
            subscription_id,
            name,
            primary_domain,
            status,
            php_version
          ) VALUES ($1, $2, $3, $4, 'pending', '8.2')
          RETURNING id, primary_domain;
        `;
        
        const domain = `test${user.id}.migrahosting.com`;
        const { rows: [website] } = await db.query(websiteQuery, [
          customer.id,
          subscription.id,
          `Website for ${TEST_EMAIL}`,
          domain
        ]);
        
        console.log(`✅ Website provisioned: ${website.id}`);
        console.log(`   Domain: ${website.primary_domain}`);
      }

      // Summary
      console.log('\n' + '='.repeat(60));
      console.log('✨ WEBHOOK FLOW TEST COMPLETED SUCCESSFULLY!');
      console.log('='.repeat(60));
      console.log('\n📊 Summary:');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Customer ID: ${customer.id}`);
      console.log(`   Subscription ID: ${subscription.id}`);
      console.log(`   Product: ${product.name} (${product.type})`);
      console.log(`   Email: ${TEST_EMAIL}`);
      console.log(`   Temp Password: ${tempPassword}`);
      console.log(`   Status: Active`);
      console.log('\n💡 Note: Welcome email would be sent in production\n');

    } catch (err) {
      if (err.code === '23505' && err.constraint === 'users_tenant_id_email_key') {
        console.log(`ℹ️  User already exists (this is OK for testing)`);
        
        // Get existing user
        const { rows: [existingUser] } = await db.query(
          'SELECT id FROM users WHERE email = $1 LIMIT 1',
          [TEST_EMAIL]
        );
        console.log(`   Using existing user: ${existingUser.id}`);
      } else {
        throw err;
      }
    }

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(`   ${error.message}`);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
    if (error.detail) {
      console.error(`   Detail: ${error.detail}`);
    }
    console.error(`\n   Stack: ${error.stack}`);
    process.exit(1);
  } finally {
    // Cleanup connection
    process.exit(0);
  }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Run test
testWebhookFlow();
