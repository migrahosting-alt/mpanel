#!/usr/bin/env node
// provision-worker.js
// Auto-provisioning worker for MigraHosting
// Runs via cron every minute to provision pending subscriptions

import pg from 'pg';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const DB_URL = process.env.DATABASE_URL || process.env.MPANEL_DB_URL;

if (!DB_URL) {
  console.error('❌ DATABASE_URL or MPANEL_DB_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DB_URL });

async function provisionSharedHosting(subscription, customerEmail) {
  // Generate unique username from subscription ID
  const shortId = subscription.id.replace(/-/g, '').slice(0, 10);
  const username = `mh${shortId}`;

  console.log(`📦 Provisioning shared hosting for ${username}`);

  try {
    const { stdout, stderr } = await execFileAsync(
      '/usr/local/bin/provision_shared_hosting.sh',
      [
        username,
        customerEmail,
        subscription.order_id,
        JSON.stringify({
          subscriptionId: subscription.id,
          productCode: subscription.product_code,
          productName: subscription.product_name,
        }),
      ],
      { timeout: 30000 }
    );

    console.log(stdout);
    if (stderr) console.error(stderr);

    return {
      success: true,
      serviceId: username,
      serviceData: {
        username,
        webRoot: `/srv/web/clients/${username}/public`,
        ftpUser: username,
      },
    };
  } catch (error) {
    console.error(`❌ Provisioning failed:`, error.message);
    throw error;
  }
}

async function processSubscription(client, subscription) {
  console.log(`\n🔄 Processing subscription ${subscription.id} (${subscription.product_code})`);

  try {
    // Update status to 'provisioning'
    await client.query(
      `UPDATE hosting_subscriptions
       SET provisioning_status = 'provisioning', updated_at = NOW()
       WHERE id = $1`,
      [subscription.id]
    );

    let result;

    // Determine provisioning action based on product_code
    if (subscription.product_code.includes('starter') || 
        subscription.product_code.includes('hosting')) {
      result = await provisionSharedHosting(subscription, subscription.customer_email);
    } else if (subscription.product_code.includes('wp-growth')) {
      result = await provisionSharedHosting(subscription, subscription.customer_email);
      // Future: Install WordPress automatically
    } else {
      console.log(`⚠️  No provisioning handler for product: ${subscription.product_code}`);
      return false;
    }

    // Mark as completed
    await client.query(
      `UPDATE hosting_subscriptions
       SET provisioning_status = 'completed',
           status = 'active',
           service_id = $2,
           provisioning_data = $3,
           starts_at = NOW(),
           renews_at = NOW() + INTERVAL '1 year',
           updated_at = NOW()
       WHERE id = $1`,
      [subscription.id, result.serviceId, JSON.stringify(result.serviceData)]
    );

    console.log(`✅ Subscription ${subscription.id} provisioned successfully`);
    return true;

  } catch (error) {
    console.error(`❌ Failed to provision subscription ${subscription.id}:`, error.message);

    // Mark as failed
    await client.query(
      `UPDATE hosting_subscriptions
       SET provisioning_status = 'failed',
           provisioning_data = jsonb_set(
             provisioning_data,
             '{error}',
             to_jsonb($2::text)
           ),
           updated_at = NOW()
       WHERE id = $1`,
      [subscription.id, error.message]
    );

    return false;
  }
}

async function runOnce() {
  const client = await pool.connect();

  try {
    console.log(`\n⏰ ${new Date().toISOString()} - Checking for pending subscriptions...`);

    // Find pending subscriptions with customer email
    const { rows: subscriptions } = await client.query(
      `SELECT 
        hs.*,
        so.customer_email,
        so.stripe_payment_intent_id
       FROM hosting_subscriptions hs
       JOIN stripe_orders so ON so.id = hs.order_id
       WHERE hs.provisioning_status = 'pending'
         AND so.status = 'paid'
       ORDER BY hs.created_at ASC
       LIMIT 5`
    );

    if (subscriptions.length === 0) {
      console.log('✓ No pending subscriptions to provision');
      return;
    }

    console.log(`📋 Found ${subscriptions.length} subscription(s) to provision`);

    for (const subscription of subscriptions) {
      await processSubscription(client, subscription);
    }

  } catch (error) {
    console.error('❌ Worker error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run and exit
runOnce()
  .then(() => {
    console.log('\n✓ Worker completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Worker failed:', error);
    process.exit(1);
  });
