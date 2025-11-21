#!/usr/bin/env node

import mysql from 'mysql2/promise';

const config = {
  host: '31.220.98.95',
  port: 3306,
  user: 'whmcs_user',
  password: 'Sikse@222',
  database: 'whmcs'
};

async function getCounts() {
  const connection = await mysql.createConnection(config);
  
  console.log('📊 WHMCS Data Counts:\n');
  
  const [clients] = await connection.query(`SELECT COUNT(*) as count FROM tblclients WHERE status = 'Active'`);
  console.log(`✅ Active Clients: ${clients[0].count}`);
  
  const [products] = await connection.query(`SELECT COUNT(*) as count FROM tblproducts WHERE hidden = 0`);
  console.log(`✅ Visible Products: ${products[0].count}`);
  
  const [invoices] = await connection.query(`SELECT COUNT(*) as count FROM tblinvoices`);
  console.log(`✅ Invoices: ${invoices[0].count}`);
  
  const [domains] = await connection.query(`SELECT COUNT(*) as count FROM tbldomains WHERE status IN ('Active', 'Pending')`);
  console.log(`✅ Active Domains: ${domains[0].count}`);
  
  const [servers] = await connection.query(`SELECT COUNT(*) as count FROM tblservers WHERE active = 1`);
  console.log(`✅ Active Servers: ${servers[0].count}`);
  
  const [hosting] = await connection.query(`SELECT COUNT(*) as count FROM tblhosting WHERE domainstatus = 'Active'`);
  console.log(`✅ Active Hosting Services: ${hosting[0].count}`);
  
  await connection.end();
}

getCounts().catch(console.error);
