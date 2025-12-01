#!/usr/bin/env tsx
/**
 * DEV DATA SEED SCRIPT
 * 
 * Seeds clean, canonical dev data after reset:dev
 * 
 * Creates:
 * - Root tenant (MigraHosting)
 * - Admin user (MH Admin) with super_admin role
 * - TenantUser link (OWNER role)
 * - One clean customer (MH Admin Customer)
 * - Optional: One test CloudPods subscription + pod
 * 
 * Prerequisites:
 *   1. npm run reset:dev
 *   2. npm run seed:products
 *   3. npm run seed:dev (this script)
 * 
 * Usage:
 *   npm run seed:dev
 *   or
 *   tsx prisma/seedDevData.ts
 */

import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import bcrypt from 'bcrypt';

const ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'mhadmin@migrahosting.com';
const ADMIN_PASSWORD = 'Test1234'; // DEV ONLY - Change in production!

// ANSI colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function seedDevData() {
  try {
    log('\n🌱 Starting dev data seed...', 'blue');
    log('─'.repeat(60), 'cyan');
    
    // ==========================================
    // 1. Root Tenant
    // ==========================================
    log('\n📦 Creating root tenant...', 'yellow');
    
    const rootTenant = await prisma.tenant.upsert({
      where: { id: ROOT_TENANT_ID },
      update: {
        name: 'MigraHosting',
        domain: 'migrahosting.com',
        slug: 'migrahosting',
        status: 'active',
        isActive: true,
      },
      create: {
        id: ROOT_TENANT_ID,
        name: 'MigraHosting',
        domain: 'migrahosting.com',
        slug: 'migrahosting',
        status: 'active',
        isActive: true,
      },
    });
    
    log(`   ✅ Tenant: ${rootTenant.name} (${rootTenant.id})`, 'green');
    
    // ==========================================
    // 2. Admin User
    // ==========================================
    log('\n📦 Creating admin user...', 'yellow');
    
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    
    const adminUser = await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash,
        firstName: 'MH',
        lastName: 'Admin',
        displayName: 'MH Admin',
        name: 'MH Admin',
        role: 'super_admin',
        status: 'active',
        isActive: true,
        emailVerified: true,
      },
      create: {
        email: ADMIN_EMAIL,
        passwordHash,
        firstName: 'MH',
        lastName: 'Admin',
        displayName: 'MH Admin',
        name: 'MH Admin',
        role: 'super_admin',
        status: 'active',
        isActive: true,
        emailVerified: true,
        tenantId: ROOT_TENANT_ID,
      },
    });
    
    log(`   ✅ User: ${adminUser.name} (${adminUser.email})`, 'green');
    log(`   🔑 Password: ${ADMIN_PASSWORD} (DEV ONLY)`, 'cyan');
    
    // ==========================================
    // 3. Tenant-User Link
    // ==========================================
    log('\n📦 Linking admin to tenant...', 'yellow');
    
    const tenantUser = await prisma.tenantUser.upsert({
      where: {
        userId_tenantId: {
          userId: adminUser.id,
          tenantId: rootTenant.id,
        },
      },
      update: {
        role: 'OWNER',
      },
      create: {
        userId: adminUser.id,
        tenantId: rootTenant.id,
        role: 'OWNER',
      },
    });
    
    log(`   ✅ TenantUser: ${tenantUser.role} role`, 'green');
    
    // ==========================================
    // 4. Clean Customer
    // ==========================================
    log('\n📦 Creating MH Admin customer...', 'yellow');
    
    const mhCustomer = await prisma.customer.create({
      data: {
        tenantId: rootTenant.id,
        userId: adminUser.id,
        email: ADMIN_EMAIL,
        firstName: 'MH',
        lastName: 'Admin',
        companyName: 'MigraHosting LLC',
        phone: '+1-555-0100',
        address: '123 Tech Street',
        city: 'Silicon Valley',
        state: 'CA',
        postalCode: '94000',
        country: 'US',
        status: 'active',
        stripeCustomerId: null, // Will be created on first Stripe operation
        metadata: {
          source: 'dev_seed',
          isTestAccount: true,
          accountType: 'internal',
        },
      },
    });
    
    log(`   ✅ Customer: ${mhCustomer.companyName} (${mhCustomer.email})`, 'green');
    
    // ==========================================
    // 5. Optional: Test CloudPods Subscription
    // ==========================================
    if (process.env.SEED_TEST_SUBSCRIPTION === 'YES') {
      log('\n📦 Creating test CloudPods subscription...', 'yellow');
      
      // Find cloudpods-starter product and price
      const starterProduct = await prisma.product.findFirst({
        where: {
          code: 'cloudpods-starter',
          tenantId: rootTenant.id,
        },
        include: {
          prices: {
            where: { interval: 'monthly' },
            take: 1,
          },
        },
      });
      
      if (starterProduct && starterProduct.prices.length > 0) {
        const price = starterProduct.prices[0];
        
        // Create subscription
        const subscription = await prisma.subscription.create({
          data: {
            tenantId: rootTenant.id,
            customerId: mhCustomer.id,
            productId: starterProduct.id,
            priceId: price.id,
            status: 'active',
            billingCycle: 'monthly',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
            cancelAtPeriodEnd: false,
            metadata: {
              source: 'dev_seed',
              isTestSubscription: true,
            },
          },
        });
        
        log(`   ✅ Subscription: ${starterProduct.name} (${subscription.id})`, 'green');
        
        // Create CloudPod for this subscription
        const cloudPod = await prisma.cloudPod.create({
          data: {
            tenantId: rootTenant.id,
            customerId: mhCustomer.id,
            subscriptionId: subscription.id,
            name: 'dev-test-pod',
            slug: 'dev-test-pod',
            planCode: 'cloudpods-starter',
            status: 'active',
            kubernetesNamespace: 'dev-test-pod',
            deploymentName: 'dev-test-pod-deployment',
            serviceName: 'dev-test-pod-service',
            ingressName: 'dev-test-pod-ingress',
            metadata: {
              source: 'dev_seed',
              isTestPod: true,
            },
          },
        });
        
        log(`   ✅ CloudPod: ${cloudPod.name} (${cloudPod.id})`, 'green');
      } else {
        log('   ⚠️  CloudPods Starter product not found - run seed:products first', 'yellow');
      }
    }
    
    // ==========================================
    // Summary
    // ==========================================
    log('\n✅ Dev data seed complete!', 'green');
    log('─'.repeat(60), 'cyan');
    log('\n📊 Created:', 'blue');
    log(`   - Tenant: ${rootTenant.name}`, 'cyan');
    log(`   - User: ${adminUser.email} (super_admin)`, 'cyan');
    log(`   - Customer: ${mhCustomer.companyName}`, 'cyan');
    if (process.env.SEED_TEST_SUBSCRIPTION === 'YES') {
      log(`   - Test subscription + CloudPod`, 'cyan');
    }
    
    log('\n🎯 Login credentials:', 'blue');
    log(`   Email: ${ADMIN_EMAIL}`, 'green');
    log(`   Password: ${ADMIN_PASSWORD}`, 'green');
    log('   ⚠️  CHANGE PASSWORD IN PRODUCTION!', 'yellow');
    
    log('\n🚀 Next steps:', 'blue');
    log('   1. Start backend: npm run dev', 'cyan');
    log('   2. Login at: http://localhost:2271/login', 'cyan');
    log('   3. Create test customers, subscriptions, etc.', 'cyan');
    log('', 'white');
    
  } catch (error: any) {
    log('\n❌ Error during seed:', 'yellow');
    log(error.message, 'yellow');
    if (error.stack) {
      console.error(error.stack);
    }
    throw error;
  }
}

async function main() {
  try {
    await seedDevData();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
