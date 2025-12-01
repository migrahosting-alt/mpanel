#!/usr/bin/env tsx
/**
 * DEV DATABASE RESET SCRIPT
 * 
 * ⚠️  WARNING: This script DELETES ALL BUSINESS DATA from the database!
 * 
 * Safety checks:
 * - Requires NODE_ENV !== 'production'
 * - Requires RESET_DEV_DATABASE=YES environment variable
 * - Deletes in correct dependency order (respects FK constraints)
 * 
 * What it keeps:
 * - Products and Prices (from seed:products)
 * - Root tenant (00000000-0000-0000-0000-000000000001)
 * - Admin user (mhadmin@migrahosting.com)
 * 
 * Usage:
 *   npm run reset:dev
 *   or
 *   RESET_DEV_DATABASE=YES tsx scripts/reset-dev-database.ts
 */

import { prisma } from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = 'mhadmin@migrahosting.com';

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function banner(message: string) {
  const border = '='.repeat(60);
  console.log('\n' + colors.bold + colors.red + border);
  console.log(message);
  console.log(border + colors.reset + '\n');
}

async function safetyChecks() {
  banner('🚨 DEV DATABASE RESET – ALL DATA WILL BE DELETED 🚨');
  
  // Check 1: Production guard
  if (process.env.NODE_ENV === 'production') {
    log('❌ FATAL: Cannot run reset script in production!', 'red');
    log('   NODE_ENV is set to "production"', 'red');
    process.exit(1);
  }
  
  // Check 2: Explicit confirmation required
  if (process.env.RESET_DEV_DATABASE !== 'YES') {
    log('❌ FATAL: Missing confirmation flag', 'red');
    log('   Set RESET_DEV_DATABASE=YES to confirm', 'yellow');
    log('   Example: RESET_DEV_DATABASE=YES npm run reset:dev', 'cyan');
    process.exit(1);
  }
  
  // Check 3: Database URL check
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('production') || dbUrl.includes('prod')) {
    log('❌ FATAL: DATABASE_URL contains "production" or "prod"', 'red');
    log(`   URL: ${dbUrl}`, 'yellow');
    process.exit(1);
  }
  
  log('✅ Safety checks passed', 'green');
  log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`, 'cyan');
  log(`   Database: ${dbUrl.split('@')[1] || 'unknown'}`, 'cyan');
  log('', 'white');
}

async function resetDatabase() {
  const deletionLog: Record<string, number> = {};
  
  try {
    log('🔍 Starting database reset...', 'blue');
    
    // ==========================================
    // 1. CloudPods & Related
    // ==========================================
    log('\n📦 Deleting CloudPod data...', 'magenta');
    
    deletionLog.CloudPodWebhookDelivery = (await prisma.cloudPodWebhookDelivery.deleteMany({})).count;
    deletionLog.CloudPodWebhook = (await prisma.cloudPodWebhook.deleteMany({})).count;
    deletionLog.CloudPodSecurityGroupAssignment = (await prisma.cloudPodSecurityGroupAssignment.deleteMany({})).count;
    deletionLog.CloudPodSecurityGroupRule = (await prisma.cloudPodSecurityGroupRule.deleteMany({})).count;
    deletionLog.CloudPodSecurityGroup = (await prisma.cloudPodSecurityGroup.deleteMany({})).count;
    deletionLog.CloudPodVolume = (await prisma.cloudPodVolume.deleteMany({})).count;
    deletionLog.CloudPodUsageSample = (await prisma.cloudPodUsageSample.deleteMany({})).count;
    deletionLog.CloudPodUsageDaily = (await prisma.cloudPodUsageDaily.deleteMany({})).count;
    deletionLog.CloudPodBackup = (await prisma.cloudPodBackup.deleteMany({})).count;
    deletionLog.CloudPodBackupPolicy = (await prisma.cloudPodBackupPolicy.deleteMany({})).count;
    deletionLog.CloudPodHealthStatus = (await prisma.cloudPodHealthStatus.deleteMany({})).count;
    deletionLog.CloudPodHook = (await prisma.cloudPodHook.deleteMany({})).count;
    deletionLog.CloudPodDnsRecord = (await prisma.cloudPodDnsRecord.deleteMany({})).count;
    deletionLog.CloudPodAudit = (await prisma.cloudPodAudit.deleteMany({})).count;
    deletionLog.CloudPodEvent = (await prisma.cloudPodEvent.deleteMany({})).count;
    deletionLog.CloudPodJob = (await prisma.cloudPodJob.deleteMany({})).count;
    
    // ==========================================
    // 2. Provisioning & Jobs
    // ==========================================
    log('📦 Deleting job and event data...', 'magenta');
    
    deletionLog.PlatformJob = (await prisma.platformJob.deleteMany({})).count;
    deletionLog.Job = (await prisma.job.deleteMany({})).count;
    deletionLog.SystemEvent = (await prisma.systemEvent.deleteMany({})).count;
    
    // Keep recent audit logs (last 24h) or delete all
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    deletionLog.AuditLog = (await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: oneDayAgo } }
    })).count;
    
    // ==========================================
    // 3. Billing & Subscriptions
    // ==========================================
    log('📦 Deleting billing data...', 'magenta');
    
    deletionLog.CloudTenantResourceSubscription = (await prisma.cloudTenantResourceSubscription.deleteMany({})).count;
    deletionLog.Subscription = (await prisma.subscription.deleteMany({})).count;
    deletionLog.Order = (await prisma.order.deleteMany({})).count;
    
    // ==========================================
    // 4. Hosting / DNS / Email / Domains
    // ==========================================
    log('📦 Deleting hosting infrastructure...', 'magenta');
    
    deletionLog.DnsRecord = (await prisma.dnsRecord.deleteMany({})).count;
    deletionLog.DnsZone = (await prisma.dnsZone.deleteMany({})).count;
    deletionLog.Domain = (await prisma.domain.deleteMany({})).count;
    deletionLog.CloudPodQuota = (await prisma.cloudPodQuota.deleteMany({})).count;
    deletionLog.CloudPod = (await prisma.cloudPod.deleteMany({})).count;
    deletionLog.MailAccount = (await prisma.mailAccount.deleteMany({})).count;
    deletionLog.HostingAccount = (await prisma.hostingAccount.deleteMany({})).count;
    deletionLog.BackupJob = (await prisma.backupJob.deleteMany({})).count;
    deletionLog.VpsInstance = (await prisma.vpsInstance.deleteMany({})).count;
    deletionLog.SslCertificate = (await prisma.sslCertificate.deleteMany({})).count;
    deletionLog.ServerMetric = (await prisma.serverMetric.deleteMany({})).count;
    deletionLog.Server = (await prisma.server.deleteMany({})).count;
    
    // ==========================================
    // 5. Customers
    // ==========================================
    log('📦 Deleting customer data...', 'magenta');
    
    deletionLog.Customer = (await prisma.customer.deleteMany({})).count;
    
    // ==========================================
    // 6. Tenant-User Relationships (except root admin)
    // ==========================================
    log('📦 Cleaning tenant-user relationships...', 'magenta');
    
    // Delete all tenant_users except those for root tenant + admin email combo
    // We'll use a raw query since Prisma might have schema sync issues
    deletionLog.TenantUser = (await prisma.tenantUser.deleteMany({
      where: {
        NOT: {
          tenantId: ROOT_TENANT_ID
        }
      }
    })).count;
    
    // ==========================================
    // 7. Users (except admin)
    // ==========================================
    log('📦 Deleting users (except admin)...', 'magenta');
    
    deletionLog.User = (await prisma.user.deleteMany({
      where: {
        email: { not: ADMIN_EMAIL }
      }
    })).count;
    
    // ==========================================
    // 8. Tenants (except root)
    // ==========================================
    log('📦 Deleting tenants (except root)...', 'magenta');
    
    deletionLog.Tenant = (await prisma.tenant.deleteMany({
      where: {
        id: { not: ROOT_TENANT_ID }
      }
    })).count;
    
    // ==========================================
    // Summary
    // ==========================================
    log('\n✅ Database reset complete!', 'green');
    log('', 'white');
    log('📊 Deletion Summary:', 'cyan');
    log('─'.repeat(40), 'cyan');
    
    const sortedLog = Object.entries(deletionLog).sort((a, b) => b[1] - a[1]);
    for (const [table, count] of sortedLog) {
      if (count > 0) {
        log(`   ${table.padEnd(25)} ${count.toString().padStart(6)} rows`, 'yellow');
      }
    }
    
    log('', 'white');
    log('✅ Kept:', 'green');
    log('   - Root tenant (MigraHosting)', 'cyan');
    log('   - Admin user (mhadmin@migrahosting.com)', 'cyan');
    log('   - Products and Prices', 'cyan');
    log('   - Recent audit logs (last 24h)', 'cyan');
    log('', 'white');
    log('🎯 Next steps:', 'blue');
    log('   1. npm run seed:products', 'cyan');
    log('   2. npm run seed:dev', 'cyan');
    log('', 'white');
    
  } catch (error: any) {
    log('\n❌ Error during database reset:', 'red');
    log(error.message, 'red');
    if (error.stack) {
      log(error.stack, 'yellow');
    }
    process.exit(1);
  }
}

async function main() {
  try {
    await safetyChecks();
    await resetDatabase();
  } catch (error: any) {
    log('\n❌ Fatal error:', 'red');
    log(error.message, 'red');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
