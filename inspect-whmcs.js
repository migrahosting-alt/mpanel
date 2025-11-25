#!/usr/bin/env node
import mysql from 'mysql2/promise';

const config = {
  host: '31.220.98.95',
  port: 3306,
  user: 'whmcs_user',
  password: 'Sikse@222',
  database: 'whmcs'
};

async function inspectSchema() {
  console.log('🔍 Inspecting WHMCS Database Schema...\n');
  
  const connection = await mysql.createConnection(config);
  
  try {
    // Get all tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`📊 Found ${tables.length} tables\n`);
    
    // Key tables we need
    const keyTables = [
      'tblclients',
      'tblproducts', 
      'tblservers',
      'tblhosting',
      'tblinvoices',
      'tbldomains',
      'tblemails',
      'tbltickets',
      'tblorders'
    ];
    
    for (const tableName of keyTables) {
      const table = Object.values(tables[0])[0];
      const tableExists = tables.some(t => Object.values(t)[0] === tableName);
      
      if (!tableExists) {
        console.log(`⚠️  Table ${tableName} not found`);
        continue;
      }
      
      console.log(`\n📋 ${tableName}:`);
      
      // Get columns
      const [columns] = await connection.query(`DESCRIBE ${tableName}`);
      console.log('   Columns:', columns.map(c => c.Field).join(', '));
      
      // Get row count
      const [count] = await connection.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      console.log(`   Rows: ${count[0].count}`);
      
      // Get sample row
      const [sample] = await connection.query(`SELECT * FROM ${tableName} LIMIT 1`);
      if (sample.length > 0) {
        console.log('   Sample data:', JSON.stringify(sample[0], null, 2).substring(0, 200) + '...');
      }
    }
    
    console.log('\n✅ Schema inspection complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

inspectSchema();
