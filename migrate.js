#!/usr/bin/env node

/**
 * CLI Migration Tool
 * Usage:
 *   node migrate-from-whmcs.js --host=HOST --user=USER --password=PASS --database=DB
 *   node migrate-from-cyberpanel.js --host=HOST --admin-user=USER --admin-pass=PASS --db-user=USER --db-pass=PASS
 */

import SmartImporter from './src/services/smartImporter.js';
import WHMCSImporter from './src/services/whmcsImporterFixed.js';
import CyberPanelImporter from './src/services/cyberpanelImporter.js';
import logger from './src/config/logger.js';

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  acc[key] = value;
  return acc;
}, {});

const mode = args.mode || 'whmcs'; // whmcs or cyberpanel

async function main() {
  try {
    if (mode === 'whmcs') {
      await migrateFromWHMCS();
    } else if (mode === 'cyberpanel') {
      await migrateFromCyberPanel();
    } else {
      console.error('Invalid mode. Use --mode=whmcs or --mode=cyberpanel');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

async function migrateFromWHMCS() {
  console.log('\n🔄 Starting WHMCS Migration...\n');

  if (!args.host || !args.user || !args.password || !args.database) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  node migrate.js --mode=whmcs \\');
    console.log('    --host=WHMCS_DB_HOST \\');
    console.log('    --user=WHMCS_DB_USER \\');
    console.log('    --password=WHMCS_DB_PASSWORD \\');
    console.log('    --database=WHMCS_DB_NAME \\');
    console.log('    [--port=3306] \\');
    console.log('    [--ssl=true]\n');
    process.exit(1);
  }

  const importer = new SmartImporter({
    host: args.host,
    port: args.port || 3306,
    user: args.user,
    password: args.password,
    database: args.database,
    ssl: args.ssl === 'true'
  });

  console.log(`📡 Connecting to WHMCS database at ${args.host}/${args.database}...`);
  
  const stats = await importer.importAll(null);

  console.log('\n✅ Migration completed successfully!\n');
  console.log('📊 Import Statistics:');
  console.log(`   Clients:       ${stats.clients}`);
  console.log(`   Products:      ${stats.products}`);
  console.log(`   Servers:       ${stats.servers}`);
  console.log(`   Orders:        ${stats.orders}`);
  console.log(`   Invoices:      ${stats.invoices}`);
  console.log(`   Domains:       ${stats.domains}`);
  console.log(`   Emails:        ${stats.emails}`);
  console.log(`   Tickets:       ${stats.tickets}\n`);
}

async function migrateFromCyberPanel() {
  console.log('\n🔄 Starting CyberPanel Migration...\n');

  if (!args.host || !args['admin-user'] || !args['admin-pass'] || !args['db-user'] || !args['db-pass']) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  node migrate.js --mode=cyberpanel \\');
    console.log('    --host=CYBERPANEL_HOST \\');
    console.log('    --admin-user=ADMIN_USER \\');
    console.log('    --admin-pass=ADMIN_PASSWORD \\');
    console.log('    --db-user=DB_USER \\');
    console.log('    --db-pass=DB_PASSWORD \\');
    console.log('    [--db-host=DB_HOST] \\');
    console.log('    [--db-port=3306]\n');
    process.exit(1);
  }

  const importer = new CyberPanelImporter({
    host: args.host,
    adminUser: args['admin-user'],
    adminPass: args['admin-pass'],
    dbHost: args['db-host'] || args.host,
    dbPort: args['db-port'] || 3306,
    dbUser: args['db-user'],
    dbPassword: args['db-pass']
  });

  console.log(`📡 Connecting to CyberPanel at ${args.host}...`);
  
  const stats = await importer.importAll(null);

  console.log('\n✅ Migration completed successfully!\n');
  console.log('📊 Import Statistics:');
  console.log(`   Websites:      ${stats.websites}`);
  console.log(`   Databases:     ${stats.databases}`);
  console.log(`   Emails:        ${stats.emails}`);
  console.log(`   DNS Zones:     ${stats.dnsZones}`);
  console.log(`   FTP Accounts:  ${stats.ftpAccounts}\n`);
}

main();
