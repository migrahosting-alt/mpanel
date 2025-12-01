#!/usr/bin/env node
// ============================================================================
// Cloud Pod Provisioning Test Script
// 
// Usage:
//   node src/scripts/testCloudPodProvision.js CLOUD_POD_STARTER testpod.migra.local
//   node src/scripts/testCloudPodProvision.js CLOUD_POD_PREMIUM example.com --dry-run
//
// Environment Variables Required:
//   PROXMOX_API_URL           - https://10.1.10.70:8006/api2/json
//   PROXMOX_API_TOKEN_ID      - mpanel-api@pve!mpanel-token
//   PROXMOX_API_TOKEN_SECRET  - API token secret
//   DATABASE_URL              - PostgreSQL connection string
//
// ============================================================================

import 'dotenv/config';
import https from 'https';
import fetch from 'node-fetch';
import { CLOUD_INFRA, CLOUD_POD_PLANS, getPodPlan, buildCloudPodProvisioningIntent } from '../config/cloudPods.js';

// Parse CLI args
const args = process.argv.slice(2);
const planCode = args[0] || 'CLOUD_POD_STARTER';
const domain = args[1] || null;
const dryRun = args.includes('--dry-run');

console.log('\n====================================');
console.log('  Cloud Pod Provisioning Test');
console.log('====================================\n');

// Validate plan
if (!CLOUD_POD_PLANS[planCode]) {
  console.error(`❌ Invalid plan code: ${planCode}`);
  console.log('Available plans:', Object.keys(CLOUD_POD_PLANS).join(', '));
  process.exit(1);
}

const plan = getPodPlan(planCode);
console.log('📋 Plan Details:');
console.log(`   Name: ${plan.name}`);
console.log(`   Price: $${plan.effectiveMonthlyPriceUsd}/mo`);
console.log(`   vCPU: ${plan.vcpu}`);
console.log(`   RAM: ${plan.ramGb} GB`);
console.log(`   Disk: ${plan.diskGb} GB`);
console.log(`   Domain: ${domain || '(none - will use internal hostname)'}`);
console.log('');

// Build provisioning intent
const testIntent = buildCloudPodProvisioningIntent({
  id: `test-${Date.now()}`,
  customerId: 'test-customer-001',
  planCode,
  primaryDomain: domain,
});

console.log('📦 Provisioning Intent:');
console.log(JSON.stringify(testIntent, null, 2));
console.log('');

// Check Proxmox connectivity
console.log('🔌 Proxmox Configuration:');
console.log(`   API URL: ${CLOUD_INFRA.proxmox.apiBaseUrl}`);
console.log(`   Node: ${CLOUD_INFRA.proxmox.nodeName}`);
console.log(`   Template ID: ${CLOUD_INFRA.proxmox.defaultTemplateId}`);
console.log(`   Storage: ${CLOUD_INFRA.proxmox.defaultStorage}`);
console.log(`   Bridge: ${CLOUD_INFRA.proxmox.defaultBridge || 'vmbr0'}`);
console.log('');

// Check environment
const tokenId = process.env.PROXMOX_API_TOKEN_ID;
const tokenSecret = process.env.PROXMOX_API_TOKEN_SECRET;

if (!tokenId || !tokenSecret) {
  console.error('❌ Missing Proxmox credentials!');
  console.log('   Please set:');
  console.log('   - PROXMOX_API_TOKEN_ID=mpanel-api@pve!mpanel-token');
  console.log('   - PROXMOX_API_TOKEN_SECRET=<your-secret>');
  process.exit(1);
}

console.log('🔑 Proxmox Auth:');
console.log(`   Token ID: ${tokenId}`);
console.log(`   Token Secret: ${'*'.repeat(16)}${tokenSecret.slice(-4)}`);
console.log('');

if (dryRun) {
  console.log('🏃 DRY RUN MODE - Not actually creating anything');
  console.log('✅ Configuration looks valid!');
  process.exit(0);
}

// Test Proxmox connectivity
console.log('🔍 Testing Proxmox API connectivity...');

const agent = new https.Agent({ rejectUnauthorized: false });

async function testProxmoxConnection() {
  try {
    // Test auth
    const authHeader = `PVEAPIToken=${tokenId}=${tokenSecret}`;
    
    // Get cluster status
    const versionResponse = await fetch(`${CLOUD_INFRA.proxmox.apiBaseUrl}/version`, {
      method: 'GET',
      agent,
      headers: { Authorization: authHeader },
    });
    
    if (!versionResponse.ok) {
      throw new Error(`Proxmox API error: ${versionResponse.status} ${versionResponse.statusText}`);
    }
    
    const versionData = await versionResponse.json();
    console.log(`✅ Connected to Proxmox VE ${versionData.data?.version || 'unknown'}`);
    
    // Get next VMID
    const nextIdResponse = await fetch(`${CLOUD_INFRA.proxmox.apiBaseUrl}/cluster/nextid`, {
      method: 'GET',
      agent,
      headers: { Authorization: authHeader },
    });
    
    const nextIdData = await nextIdResponse.json();
    console.log(`✅ Next available VMID: ${nextIdData.data}`);
    
    // Check if template exists
    const node = CLOUD_INFRA.proxmox.nodeName;
    const templateId = CLOUD_INFRA.proxmox.defaultTemplateId;
    
    const lxcListResponse = await fetch(`${CLOUD_INFRA.proxmox.apiBaseUrl}/nodes/${node}/lxc`, {
      method: 'GET',
      agent,
      headers: { Authorization: authHeader },
    });
    
    const lxcList = await lxcListResponse.json();
    const template = lxcList.data?.find(ct => ct.vmid === templateId);
    
    if (template) {
      console.log(`✅ Template CT ${templateId} found: ${template.name || 'unnamed'}`);
      console.log(`   Status: ${template.status}`);
    } else {
      console.log(`⚠️  Template CT ${templateId} not found on node ${node}`);
      console.log('   Available containers:', lxcList.data?.map(ct => `${ct.vmid} (${ct.name})`).join(', ') || 'none');
    }
    
    // Get storage info
    const storageResponse = await fetch(`${CLOUD_INFRA.proxmox.apiBaseUrl}/nodes/${node}/storage`, {
      method: 'GET',
      agent,
      headers: { Authorization: authHeader },
    });
    
    const storageData = await storageResponse.json();
    console.log('');
    console.log('📁 Available Storage:');
    storageData.data?.forEach(s => {
      const usedPct = s.total > 0 ? Math.round((s.used / s.total) * 100) : 0;
      const content = Array.isArray(s.content) ? s.content.join(', ') : (s.content || 'unknown');
      console.log(`   - ${s.storage}: ${s.type} (${usedPct}% used, ${content})`);
    });
    
    console.log('');
    console.log('✅ All connectivity tests passed!');
    console.log('');
    console.log('🚀 Ready to provision Cloud Pods. Run the worker:');
    console.log('   node src/workers/cloudPodWorker.js');
    console.log('');
    console.log('Or create a pod via API:');
    console.log(`   POST /api/cloud-pods/order`);
    console.log(`   { "planCode": "${planCode}", "primaryDomain": "${domain || 'your-domain.com'}" }`);
    
  } catch (error) {
    console.error('❌ Proxmox connection failed:', error.message);
    process.exit(1);
  }
}

testProxmoxConnection();
