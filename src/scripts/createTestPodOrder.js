#!/usr/bin/env node
/**
 * Create a test Cloud Pod order in the provisioning queue
 * This triggers the cloudPodWorker to provision an actual container
 */

import pg from 'pg';
const { Pool } = pg;

// Use DATABASE_URL from env or fallback
const connectionString = process.env.DATABASE_URL || 'postgres://mpanel_app:mpanel_Sikse7171222!@10.1.10.210:5432/mpanel';
const pool = new Pool({ connectionString });

async function createTestOrder() {
  const client = await pool.connect();
  try {
    const orderId = 'test-order-' + Date.now();
    const podId = 'pod-' + Date.now();
    
    console.log('\n====================================');
    console.log('  Creating Test Cloud Pod Order');
    console.log('====================================\n');
    
    // Check if table exists and its structure
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cloud_pod_queue'
      ORDER BY ordinal_position
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('⚠️  cloud_pod_queue table not found. Creating it...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS cloud_pod_queue (
          id VARCHAR(64) PRIMARY KEY,
          order_id VARCHAR(64) NOT NULL,
          customer_id VARCHAR(64) NOT NULL,
          plan_code VARCHAR(32) NOT NULL,
          primary_domain VARCHAR(255),
          status VARCHAR(20) DEFAULT 'pending',
          vmid INTEGER,
          ip_address VARCHAR(45),
          error_message TEXT,
          attempts INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          completed_at TIMESTAMP
        )
      `);
      console.log('✅ Table created');
    } else {
      console.log('📋 cloud_pod_queue columns:', tableCheck.rows.map(r => r.column_name).join(', '));
    }
    
    // Insert test order
    await client.query(`
      INSERT INTO cloud_pod_queue (
        id, order_id, customer_id, plan_code, primary_domain,
        status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
    `, [podId, orderId, 'test-customer-001', 'CLOUD_POD_STARTER', 'testpod.migrahosting.com']);
    
    console.log('✅ Test order created:');
    console.log('   Pod ID:', podId);
    console.log('   Order ID:', orderId);
    console.log('   Plan: CLOUD_POD_STARTER');
    console.log('   Domain: testpod.migrahosting.com');
    
    // Check queue status
    const queue = await client.query(`SELECT * FROM cloud_pod_queue WHERE status = 'pending' ORDER BY created_at`);
    console.log('\n📋 Queue status:', queue.rows.length, 'pending jobs');
    queue.rows.forEach(job => {
      console.log(`   - ${job.id}: ${job.plan_code} (${job.status})`);
    });
    
    console.log('\n🚀 The cloudpod-worker will pick this up and provision the container.');
    console.log('   Monitor with: pm2 logs cloudpod-worker');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

createTestOrder();
