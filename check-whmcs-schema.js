#!/usr/bin/env node

import mysql from 'mysql2/promise';

const config = {
  host: '31.220.98.95',
  port: 3306,
  user: 'whmcs_user',
  password: 'Sikse@222',
  database: 'whmcs'
};

async function checkSchema() {
  const connection = await mysql.createConnection(config);
  
  console.log('📋 Checking WHMCS Database Schema...\n');
  
  // Check tblclients columns
  const [clientCols] = await connection.query(`SHOW COLUMNS FROM tblclients`);
  console.log('✅ tblclients columns:');
  clientCols.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
  
  console.log('\n');
  
  // Check tblproducts columns
  const [productCols] = await connection.query(`SHOW COLUMNS FROM tblproducts`);
  console.log('✅ tblproducts columns:');
  productCols.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
  
  console.log('\n');
  
  // Check tblhosting columns
  const [hostingCols] = await connection.query(`SHOW COLUMNS FROM tblhosting`);
  console.log('✅ tblhosting columns:');
  hostingCols.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
  
  console.log('\n');
  
  // Sample data
  const [clients] = await connection.query(`SELECT * FROM tblclients LIMIT 1`);
  console.log('📄 Sample client data:');
  console.log(JSON.stringify(clients[0], null, 2));
  
  console.log('\n');
  
  const [products] = await connection.query(`SELECT * FROM tblproducts LIMIT 1`);
  console.log('📄 Sample product data:');
  console.log(JSON.stringify(products[0], null, 2));
  
  await connection.end();
}

checkSchema().catch(console.error);
