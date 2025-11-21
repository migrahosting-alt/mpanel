#!/usr/bin/env node

/**
 * Quick WHMCS Import - No arguments needed!
 * Reads credentials from migration-config.json
 */

import SmartImporter from './src/services/smartImporter.js';
import fs from 'fs';

async function main() {
  try {
    console.log('🚀 Quick WHMCS Import Starting...\n');
    
    // Read config
    const config = JSON.parse(fs.readFileSync('./migration-config.json', 'utf8'));
    
    console.log(`📡 Connecting to WHMCS: ${config.whmcs.host}/${config.whmcs.database}\n`);
    
    const importer = new SmartImporter({
      host: config.whmcs.host,
      port: config.whmcs.port,
      user: config.whmcs.user,
      password: config.whmcs.password,
      database: config.whmcs.database
    });
    
    const stats = await importer.importAll(null);
    
    console.log('\n🎉 IMPORT COMPLETE!\n');
    console.log('Next steps:');
    console.log('  1. Check your admin dashboard - it should show real data now');
    console.log('  2. Imported users can login with password: ChangeMe123!');
    console.log('  3. They will need to reset their passwords\n');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
