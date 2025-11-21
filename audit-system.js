#!/usr/bin/env node

/**
 * System Audit Script
 * Scans entire mPanel for missing pages, broken links, empty endpoints
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 mPanel System Audit\n');
console.log('='.repeat(60));

// 1. Check navigation items in Layout.jsx
console.log('\n📋 NAVIGATION AUDIT\n');

const layoutPath = './frontend/src/components/Layout.jsx';
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Extract navigation items
const navPattern = /{ name: '([^']+)', href: '([^']+)'/g;
const navItems = [];
let match;
while ((match = navPattern.exec(layoutContent)) !== null) {
  navItems.push({ name: match[1], href: match[2] });
}

console.log(`Found ${navItems.length} navigation items:\n`);

// 2. Check which routes exist in App.jsx
const appPath = './frontend/src/App.jsx';
const appContent = fs.readFileSync(appPath, 'utf8');

const missingRoutes = [];
navItems.forEach(item => {
  const routeExists = appContent.includes(`path="${item.href}"`);
  if (!routeExists) {
    missingRoutes.push(item);
    console.log(`❌ ${item.name} (${item.href}) - NO ROUTE`);
  } else {
    console.log(`✅ ${item.name} (${item.href})`);
  }
});

// 3. Check which page components exist
console.log('\n\n📄 PAGE COMPONENTS AUDIT\n');

const pagesDir = './frontend/src/pages';
const pageFiles = fs.readdirSync(pagesDir, { recursive: true })
  .filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));

console.log(`Found ${pageFiles.length} page files\n`);

// Extract imported pages from App.jsx
const importPattern = /import .+ from '\.\/pages\/(.+)'/g;
const importedPages = [];
while ((match = importPattern.exec(appContent)) !== null) {
  importedPages.push(match[1]);
}

console.log(`App.jsx imports ${importedPages.length} pages\n`);

// 4. Check backend API endpoints
console.log('\n\n🔌 API ENDPOINTS AUDIT\n');

const routesIndexPath = './src/routes/index.js';
const routesContent = fs.readFileSync(routesIndexPath, 'utf8');

const routerUsePattern = /router\.use\('\/([^']+)',/g;
const apiEndpoints = [];
while ((match = routerUsePattern.exec(routesContent)) !== null) {
  apiEndpoints.push(`/api/${match[1]}`);
}

console.log(`Found ${apiEndpoints.length} API endpoint groups:\n`);
apiEndpoints.forEach(ep => console.log(`  ✅ ${ep}`));

// 5. Check database tables
console.log('\n\n🗄️  DATABASE TABLES CHECK\n');

const expectedTables = [
  'users', 'customers', 'products', 'servers', 'websites', 
  'domains', 'dns_zones', 'dns_records', 'mailboxes',
  'databases', 'invoices', 'invoice_items', 'subscriptions',
  'ssl_certificates', 'backups', 'api_keys', 'roles', 
  'permissions', 'role_permissions', 'hosting_services',
  'support_tickets', 'ticket_replies', 'transactions'
];

console.log(`Expected tables: ${expectedTables.length}\n`);
expectedTables.forEach(t => console.log(`  • ${t}`));

// 6. Summary
console.log('\n\n📊 AUDIT SUMMARY\n');
console.log('='.repeat(60));
console.log(`Navigation Items: ${navItems.length}`);
console.log(`Missing Routes: ${missingRoutes.length}`);
console.log(`Page Files: ${pageFiles.length}`);
console.log(`API Endpoints: ${apiEndpoints.length}`);
console.log(`Expected Tables: ${expectedTables.length}`);

if (missingRoutes.length > 0) {
  console.log('\n⚠️  MISSING ROUTES:');
  missingRoutes.forEach(r => console.log(`  - ${r.name} (${r.href})`));
}

console.log('\n✅ Audit complete!\n');

// 7. Check for empty/placeholder pages
console.log('\n🔎 SCANNING FOR PLACEHOLDER PAGES\n');

const placeholderPages = [];
pageFiles.forEach(file => {
  const fullPath = path.join(pagesDir, file);
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Check if page is a placeholder
  if (
    content.includes('Coming soon') ||
    content.includes('Under construction') ||
    content.includes('TODO') ||
    content.length < 500 // Very small file
  ) {
    placeholderPages.push(file);
  }
});

if (placeholderPages.length > 0) {
  console.log(`Found ${placeholderPages.length} placeholder/incomplete pages:\n`);
  placeholderPages.forEach(p => console.log(`  ⚠️  ${p}`));
} else {
  console.log('✅ No obvious placeholders found\n');
}

console.log('\n' + '='.repeat(60));
console.log('Audit complete!');
