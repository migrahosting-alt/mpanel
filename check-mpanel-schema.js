#!/usr/bin/env node

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mpanel:mpanel@localhost:5433/mpanel'
});

async function inspectSchema() {
  console.log('🔍 Inspecting mPanel Database Schema\n');
  
  // Check customers table
  const customersQuery = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'customers'
    ORDER BY ordinal_position;
  `;
  
  const [customers] = await Promise.all([
    pool.query(customersQuery)
  ]);
  
  console.log('📋 CUSTOMERS Table Columns:');
  if (customers.rows.length > 0) {
    customers.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });
  } else {
    console.log('  ⚠️  Table does not exist or has no columns');
  }
  
  // Check users table
  const usersQuery = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'users'
    ORDER BY ordinal_position;
  `;
  
  const users = await pool.query(usersQuery);
  console.log('\n📋 USERS Table Columns:');
  users.rows.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });
  
  // Check products table
  const productsQuery = `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'products'
    ORDER BY ordinal_position;
  `;
  
  const products = await pool.query(productsQuery);
  console.log('\n📋 PRODUCTS Table Columns:');
  products.rows.forEach(col => {
    console.log(`  - ${col.column_name} (${col.data_type})`);
  });
  
  await pool.end();
}

inspectSchema().catch(console.error);
