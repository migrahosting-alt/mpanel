import mysql from 'mysql2/promise';
import pool from './src/db/index.js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./migration-config.json', 'utf8'));

async function test() {
  const whmcs = await mysql.createConnection(config.whmcs);
  
  // Check domains
  const [domains] = await whmcs.query('SELECT * FROM tbldomains LIMIT 1');
  console.log('Domain sample:', domains[0]);
  
  // Check invoices  
  const [invoices] = await whmcs.query('SELECT * FROM tblinvoices LIMIT 1');
  console.log('\nInvoice sample:', invoices[0]);
  
  await whmcs.end();
  await pool.end();
}

test().catch(console.error);
