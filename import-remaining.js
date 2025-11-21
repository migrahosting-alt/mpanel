#!/usr/bin/env node

import mysql from 'mysql2/promise';
import pool from './src/db/index.js';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./migration-config.json', 'utf8'));

async function importMissingData() {
  const whmcs = await mysql.createConnection({
    host: config.whmcs.host,
    port: config.whmcs.port,
    user: config.whmcs.user,
    password: config.whmcs.password,
    database: config.whmcs.database
  });

  console.log('✅ Connected to WHMCS\n');

  // Import domains
  console.log('📥 Importing domains...');
  const [domains] = await whmcs.query(`
    SELECT d.domain, d.registrar, d.registrationdate, d.expirydate, d.status, c.email
    FROM tbldomains d
    JOIN tblclients c ON d.userid = c.id
  `);
  
  let domainCount = 0;
  for (const domain of domains) {
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [domain.email]);
      if (userRes.rows.length === 0) continue;
      
      await pool.query(`
        INSERT INTO domains (user_id, domain_name, registrar, registration_date, expiry_date, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT DO NOTHING
      `, [userRes.rows[0].id, domain.domain, domain.registrar || 'imported', 
          domain.registrationdate, domain.expirydate, domain.status?.toLowerCase() || 'active']);
      
      domainCount++;
    } catch (e) {}
  }
  console.log(`✅ Imported ${domainCount} domains\n`);

  // Import hosting services
  console.log('📥 Importing hosting services...');
  const [services] = await whmcs.query(`
    SELECT h.domain, h.username, h.domainstatus, c.email
    FROM tblhosting h
    JOIN tblclients c ON h.userid = c.id
  `);
  
  let serviceCount = 0;
  for (const service of services) {
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [service.email]);
      if (userRes.rows.length === 0) continue;
      
      await pool.query(`
        INSERT INTO websites (user_id, domain, username, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT DO NOTHING
      `, [userRes.rows[0].id, service.domain, service.username || '', 
          service.domainstatus?.toLowerCase() || 'active']);
      
      serviceCount++;
    } catch (e) {}
  }
  console.log(`✅ Imported ${serviceCount} hosting services\n`);

  // Import invoices
  console.log('📥 Importing invoices...');
  const [invoices] = await whmcs.query(`
    SELECT i.id, i.date, i.duedate, i.subtotal, i.tax, i.tax2, i.total, i.status, c.email
    FROM tblinvoices i
    JOIN tblclients c ON i.userid = c.id
  `);
  
  let invoiceCount = 0;
  for (const inv of invoices) {
    try {
      const userRes = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [inv.email]);
      if (userRes.rows.length === 0) continue;
      
      await pool.query(`
        INSERT INTO invoices (user_id, invoice_number, invoice_date, due_date, subtotal, tax, total, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT DO NOTHING
      `, [userRes.rows[0].id, `WHMCS-${inv.id}`, inv.date, inv.duedate, 
          parseFloat(inv.subtotal || 0), parseFloat(inv.tax || 0) + parseFloat(inv.tax2 || 0),
          parseFloat(inv.total || 0), inv.status?.toLowerCase() || 'pending']);
      
      invoiceCount++;
    } catch (e) {}
  }
  console.log(`✅ Imported ${invoiceCount} invoices\n`);

  await whmcs.end();
  await pool.end();

  console.log('🎉 Import complete!\n');
  console.log(`Summary:`);
  console.log(`  Domains: ${domainCount}`);
  console.log(`  Services: ${serviceCount}`);
  console.log(`  Invoices: ${invoiceCount}`);
}

importMissingData().catch(console.error);
