/**
 * grantSuperAdmin.ts
 * 
 * Grants MH Admin full SUPER_ADMIN + OWNER access to the root tenant.
 * This ensures all RBAC checks pass for billing, invoices, subscriptions, 
 * guardian, provisioning, etc.
 * 
 * Usage: npx tsx scripts/grantSuperAdmin.ts
 */

import { Pool } from 'pg';

const ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'mhadmin@migrahosting.com';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔧 Granting Super Admin access...\n');

    // Step 1: Ensure root tenant exists
    console.log('1️⃣ Checking root tenant...');
    const tenantCheck = await pool.query(
      'SELECT id, name FROM tenants WHERE id = $1',
      [ROOT_TENANT_ID]
    );

    if (tenantCheck.rows.length === 0) {
      console.log('   Creating root tenant...');
      await pool.query(`
        INSERT INTO tenants (id, name, domain, slug, status, is_active, billing_email, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `, [
        ROOT_TENANT_ID,
        'MigraHosting Root',
        'migrahosting.com',
        'migrahosting-root',
        'active',
        true,
        'admin@migrahosting.com'
      ]);
      console.log('   ✅ Root tenant created');
    } else {
      console.log(`   ✅ Root tenant exists: ${tenantCheck.rows[0].name}`);
    }

    // Step 2: Find the admin user
    console.log('\n2️⃣ Finding admin user...');
    const userCheck = await pool.query(
      'SELECT id, email, role, tenant_id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (userCheck.rows.length === 0) {
      console.error(`❌ User not found: ${ADMIN_EMAIL}`);
      console.error('   Please create the user first using the create admin script.');
      process.exit(1);
    }

    const user = userCheck.rows[0];
    console.log(`   ✅ Found user: ${user.email} (ID: ${user.id})`);
    console.log(`   Current role: ${user.role}, tenant_id: ${user.tenant_id}`);

    // Step 3: Update user to SUPER_ADMIN and assign to root tenant
    console.log('\n3️⃣ Updating user to SUPER_ADMIN...');
    await pool.query(`
      UPDATE users 
      SET role = 'super_admin',
          tenant_id = $1,
          status = 'active',
          is_active = true,
          deleted_at = NULL,
          updated_at = NOW()
      WHERE id = $2
    `, [ROOT_TENANT_ID, user.id]);
    console.log('   ✅ User updated to super_admin');

    // Step 4: Ensure TenantUser membership exists with OWNER role
    console.log('\n4️⃣ Setting up TenantUser membership as OWNER...');
    
    // Check if membership exists
    const membershipCheck = await pool.query(
      'SELECT id, role FROM tenant_users WHERE user_id = $1 AND tenant_id = $2',
      [user.id, ROOT_TENANT_ID]
    );

    if (membershipCheck.rows.length === 0) {
      // Create new membership
      await pool.query(`
        INSERT INTO tenant_users (user_id, tenant_id, role, created_at, updated_at)
        VALUES ($1, $2, 'OWNER', NOW(), NOW())
      `, [user.id, ROOT_TENANT_ID]);
      console.log('   ✅ Created TenantUser membership as OWNER');
    } else {
      // Update existing membership
      await pool.query(`
        UPDATE tenant_users 
        SET role = 'OWNER',
            deleted_at = NULL,
            updated_at = NOW()
        WHERE user_id = $1 AND tenant_id = $2
      `, [user.id, ROOT_TENANT_ID]);
      console.log('   ✅ Updated TenantUser membership to OWNER');
    }

    // Step 5: Move all existing customers to root tenant (optional - for testing)
    console.log('\n5️⃣ Migrating orphan customers to root tenant...');
    const customerUpdate = await pool.query(`
      UPDATE customers 
      SET tenant_id = $1, updated_at = NOW()
      WHERE tenant_id IS NULL OR tenant_id NOT IN (SELECT id FROM tenants)
      RETURNING id
    `, [ROOT_TENANT_ID]);
    console.log(`   ✅ Migrated ${customerUpdate.rowCount} orphan customers`);

    // Also update customers with numeric tenant_ids (legacy data)
    const legacyCustomerUpdate = await pool.query(`
      UPDATE customers 
      SET tenant_id = $1, updated_at = NOW()
      WHERE tenant_id IS NOT NULL 
        AND tenant_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      RETURNING id
    `, [ROOT_TENANT_ID]);
    console.log(`   ✅ Migrated ${legacyCustomerUpdate.rowCount} legacy customers`);

    // Step 6: Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ SUPER ADMIN ACCESS GRANTED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log(`\n📋 Summary:`);
    console.log(`   User:     ${ADMIN_EMAIL}`);
    console.log(`   User ID:  ${user.id}`);
    console.log(`   Role:     super_admin`);
    console.log(`   Tenant:   MigraHosting Root`);
    console.log(`   Tenant ID: ${ROOT_TENANT_ID}`);
    console.log(`   TenantUser Role: OWNER`);
    
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the backend: pm2 restart mpanel');
    console.log('   2. Log out of mPanel UI');
    console.log('   3. Log back in as mhadmin@migrahosting.com');
    console.log('   4. Test customers, subscriptions, invoices, Guardian AI, etc.');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
