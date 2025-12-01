/**
 * Seed Products and Prices from Existing Config
 * 
 * This script reads the official plan configuration from src/config/plansConfig.ts
 * and creates/updates Product + Price records in the database.
 * 
 * The source of truth is plansConfig.ts - NO prices are hardcoded here.
 * 
 * Uses direct SQL to work with the actual database schema.
 * 
 * Usage: npm run seed:products
 */

import 'dotenv/config';
import pg from 'pg';
import {
  ALL_PLANS,
  type BasePlan,
  type CloudPodPlan,
  type WordpressHostingPlan,
  type EmailPlan,
  type VpsPlan,
  type BackupPlan,
  type AddonPlan,
  type PlanFamily,
} from '../src/config/plansConfig.js';

dotenv.config();

const { Pool } = pg;

// Database connection - requires DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Map plan family to product type for database
 */
const FAMILY_TO_PRODUCT_TYPE: Record<PlanFamily, string> = {
  cloudpods: 'cloudpod',
  wordpress: 'wordpress',
  email: 'email',
  vps: 'vps',
  backup: 'backup',
  addon: 'addon',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert dollars to cents for database storage
 */
function dollarsToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Extract limits/metadata from a plan based on its type
 */
function extractMetadata(plan: BasePlan): Record<string, any> {
  const base: Record<string, any> = {
    features: plan.features,
    tags: plan.tags ?? [],
    sortOrder: plan.sortOrder,
    isFeatured: plan.isFeatured ?? false,
  };

  if (plan.family === 'cloudpods') {
    const p = plan as CloudPodPlan;
    return {
      ...base,
      vcpu: p.vcpu,
      ramMb: p.ramMb,
      storageGb: p.storageGb,
      bandwidthGb: p.bandwidthGb,
    };
  }

  if (plan.family === 'wordpress') {
    const p = plan as WordpressHostingPlan;
    return {
      ...base,
      sites: p.sites,
      storageGb: p.storageGb,
      bandwidth: p.bandwidth,
      includesStaging: p.includesStaging,
      includesUpdates: p.includesUpdates,
    };
  }

  if (plan.family === 'email') {
    const p = plan as EmailPlan;
    return {
      ...base,
      mailboxes: p.mailboxes,
      storagePerMailboxGb: p.storagePerMailboxGb,
      customDomain: p.customDomain,
    };
  }

  if (plan.family === 'vps') {
    const p = plan as VpsPlan;
    return {
      ...base,
      vcpu: p.vcpu,
      ramMb: p.ramMb,
      storageGb: p.storageGb,
      bandwidthTb: p.bandwidthTb,
    };
  }

  if (plan.family === 'backup') {
    const p = plan as BackupPlan;
    return {
      ...base,
      storageGb: p.storageGb,
      redundancy: p.redundancy,
      isForPods: p.isForPods,
      isForWebsites: p.isForWebsites,
    };
  }

  if (plan.family === 'addon') {
    const p = plan as AddonPlan;
    return {
      ...base,
      unit: p.unit,
      unitAmount: p.unitAmount,
    };
  }

  return base;
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

interface SeedSummary {
  productsCreated: number;
  productsUpdated: number;
  pricesCreated: number;
  pricesUpdated: number;
  products: Array<{
    code: string;
    name: string;
    type: string;
    prices: Array<{
      interval: string;
      amount: string;
    }>;
  }>;
}

async function seedProducts(): Promise<SeedSummary> {
  console.log('🌱 Seeding Products and Prices from plansConfig.ts...\n');

  const client = await pool.connect();

  try {
    // Get or create the default tenant
    let tenantResult = await client.query(
      `SELECT id FROM tenants WHERE slug = 'migrahosting' OR domain = 'migrahosting' LIMIT 1`
    );

    let tenantId: string;
    if (tenantResult.rows.length === 0) {
      // Try to find any existing tenant
      tenantResult = await client.query(
        `SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1`
      );
    }

    if (tenantResult.rows.length === 0) {
      // Create a system tenant for products
      const newTenant = await client.query(
        `INSERT INTO tenants (name, domain, slug, status, is_active)
         VALUES ('MigraHosting', 'migrahosting', 'migrahosting', 'active', true)
         RETURNING id`
      );
      tenantId = newTenant.rows[0].id;
      console.log('📌 Created system tenant: MigraHosting\n');
    } else {
      tenantId = tenantResult.rows[0].id;
      console.log(`📌 Using existing tenant: ${tenantId}\n`);
    }

    const summary: SeedSummary = {
      productsCreated: 0,
      productsUpdated: 0,
      pricesCreated: 0,
      pricesUpdated: 0,
      products: [],
    };

    // Process all plans
    for (const plan of ALL_PLANS) {
      // Skip non-public plans with zero price (enterprise/custom pricing)
      if (!plan.isPublic && plan.priceMonthly === 0 && plan.family !== 'cloudpods') {
        console.log(`⏭️  Skipping non-public plan: ${plan.code}`);
        continue;
      }

      const productType = FAMILY_TO_PRODUCT_TYPE[plan.family];
      const metadata = extractMetadata(plan);

      console.log(`📦 Processing: ${plan.code} (${plan.name})`);

      // Check if product exists by code
      const existingProduct = await client.query(
        `SELECT id FROM products WHERE code = $1`,
        [plan.code]
      );

      let productId: string;

      if (existingProduct.rows.length > 0) {
        // Update existing product
        productId = existingProduct.rows[0].id;
        await client.query(
          `UPDATE products 
           SET name = $1, description = $2, type = $3, price = $4, 
               metadata = $5, status = $6, updated_at = NOW()
           WHERE code = $7`,
          [
            plan.name,
            plan.description ?? null,
            productType,
            plan.priceMonthly,
            JSON.stringify(metadata),
            plan.isPublic ? 'active' : 'inactive',
            plan.code,
          ]
        );
        summary.productsUpdated++;
        console.log(`   ✏️  Updated product: ${plan.code}`);
      } else {
        // Create new product
        const newProduct = await client.query(
          `INSERT INTO products (tenant_id, name, description, type, price, code, metadata, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            tenantId,
            plan.name,
            plan.description ?? null,
            productType,
            plan.priceMonthly,
            plan.code,
            JSON.stringify(metadata),
            plan.isPublic ? 'active' : 'inactive',
          ]
        );
        productId = newProduct.rows[0].id;
        summary.productsCreated++;
        console.log(`   ✅ Created product: ${plan.code}`);
      }

      const productPrices: Array<{ interval: string; amount: string }> = [];

      // Create/update monthly price
      if (plan.priceMonthly !== undefined) {
        const monthlyAmountCents = dollarsToCents(plan.priceMonthly);

        const existingMonthly = await client.query(
          `SELECT id FROM prices WHERE product_id = $1 AND billing_cycle = 'monthly'`,
          [productId]
        );

        if (existingMonthly.rows.length > 0) {
          await client.query(
            `UPDATE prices 
             SET unit_amount = $1, currency = $2, is_active = $3, updated_at = NOW()
             WHERE product_id = $4 AND billing_cycle = 'monthly'`,
            [monthlyAmountCents, plan.currency.toUpperCase(), plan.isPublic, productId]
          );
          summary.pricesUpdated++;
          console.log(`   ✏️  Updated price: monthly ($${plan.priceMonthly}/mo)`);
        } else {
          await client.query(
            `INSERT INTO prices (product_id, billing_cycle, unit_amount, currency, is_active)
             VALUES ($1, 'monthly', $2, $3, $4)`,
            [productId, monthlyAmountCents, plan.currency.toUpperCase(), plan.isPublic]
          );
          summary.pricesCreated++;
          console.log(`   ✅ Created price: monthly ($${plan.priceMonthly}/mo)`);
        }

        productPrices.push({
          interval: 'monthly',
          amount: `$${plan.priceMonthly.toFixed(2)}/mo`,
        });
      }

      // Create/update yearly price (if different from monthly)
      if (plan.priceYearly !== undefined && plan.priceYearly > 0) {
        const yearlyAmountCents = dollarsToCents(plan.priceYearly);

        const existingYearly = await client.query(
          `SELECT id FROM prices WHERE product_id = $1 AND billing_cycle = 'yearly'`,
          [productId]
        );

        if (existingYearly.rows.length > 0) {
          await client.query(
            `UPDATE prices 
             SET unit_amount = $1, currency = $2, is_active = $3, updated_at = NOW()
             WHERE product_id = $4 AND billing_cycle = 'yearly'`,
            [yearlyAmountCents, plan.currency.toUpperCase(), plan.isPublic, productId]
          );
          summary.pricesUpdated++;
          console.log(`   ✏️  Updated price: yearly ($${plan.priceYearly}/yr)`);
        } else {
          await client.query(
            `INSERT INTO prices (product_id, billing_cycle, unit_amount, currency, is_active)
             VALUES ($1, 'yearly', $2, $3, $4)`,
            [productId, yearlyAmountCents, plan.currency.toUpperCase(), plan.isPublic]
          );
          summary.pricesCreated++;
          console.log(`   ✅ Created price: yearly ($${plan.priceYearly}/yr)`);
        }

        productPrices.push({
          interval: 'yearly',
          amount: `$${plan.priceYearly.toFixed(2)}/yr`,
        });
      }

      summary.products.push({
        code: plan.code,
        name: plan.name,
        type: productType,
        prices: productPrices,
      });

      console.log('');
    }

    return summary;
  } finally {
    client.release();
  }
}

// ============================================
// ENTRY POINT
// ============================================

async function main() {
  try {
    const summary = await seedProducts();

    console.log('\n' + '='.repeat(60));
    console.log('🎉 SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Products created: ${summary.productsCreated}`);
    console.log(`   Products updated: ${summary.productsUpdated}`);
    console.log(`   Prices created:   ${summary.pricesCreated}`);
    console.log(`   Prices updated:   ${summary.pricesUpdated}`);

    console.log('\n📋 All Seeded Products & Prices:\n');
    console.log('-'.repeat(60));

    for (const product of summary.products) {
      console.log(`\n${product.name} (${product.code})`);
      console.log(`   Type: ${product.type}`);
      for (const price of product.prices) {
        console.log(`   💰 ${price.interval}: ${price.amount}`);
      }
    }

    console.log('\n' + '-'.repeat(60));
    console.log('\n✅ Products and prices are now in sync with plansConfig.ts');
    console.log('   The marketing site, checkout, and mPanel will all use these prices.\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
