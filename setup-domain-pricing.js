/**
 * Setup script for domain pricing table
 * Run this once: node setup-domain-pricing.js
 */

import pool from './src/db/index.js';
import logger from './src/config/logger.js';

async function setupDomainPricing() {
  const client = await pool.connect();
  
  try {
    console.log('Creating domain_pricing table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS domain_pricing (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tld VARCHAR(50) UNIQUE NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        registration_price DECIMAL(10, 2) NOT NULL,
        renewal_price DECIMAL(10, 2) NOT NULL,
        transfer_price DECIMAL(10, 2) NOT NULL,
        profit_margin DECIMAL(5, 2) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_updated TIMESTAMP,
        price_source VARCHAR(50) DEFAULT 'namesilo',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log('✓ Table created');
    
    console.log('Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_domain_pricing_tld ON domain_pricing(tld);
      CREATE INDEX IF NOT EXISTS idx_domain_pricing_active ON domain_pricing(is_active);
    `);
    
    console.log('✓ Indexes created');
    
    console.log('Creating trigger...');
    
    await client.query(`
      CREATE TRIGGER update_domain_pricing_updated_at
        BEFORE UPDATE ON domain_pricing
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('✓ Trigger created');
    
    console.log('Inserting popular TLDs...');
    
    const result = await client.query(`
      INSERT INTO domain_pricing (tld, cost_price, registration_price, renewal_price, transfer_price, profit_margin)
      VALUES 
        ('.com', 9.99, 11.99, 11.99, 11.99, 20.02),
        ('.net', 11.99, 13.99, 13.99, 13.99, 16.68),
        ('.org', 11.99, 13.99, 13.99, 13.99, 16.68),
        ('.io', 39.99, 45.99, 45.99, 45.99, 15.00),
        ('.co', 24.99, 28.99, 28.99, 28.99, 16.01),
        ('.ai', 99.99, 109.99, 109.99, 109.99, 10.00),
        ('.app', 14.99, 17.99, 17.99, 17.99, 20.01),
        ('.dev', 14.99, 17.99, 17.99, 17.99, 20.01)
      ON CONFLICT (tld) DO NOTHING
      RETURNING tld;
    `);
    
    console.log(`✓ Inserted ${result.rowCount} TLDs`);
    
    const countResult = await client.query('SELECT COUNT(*) FROM domain_pricing');
    console.log(`\n✅ Setup complete! Total TLDs in database: ${countResult.rows[0].count}`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
  }
}

setupDomainPricing();
