// src/config/cloudPods.js
// ============================================================================
// MigraHosting – Cloud Pods Config (JavaScript)
//
// SINGLE SOURCE OF TRUTH for Cloud Pod plans
// Generated from cloudPodsSpec.ts
//
// Plans: Student ($0/mo) | Starter ($1.49/mo) | Premium ($2.49/mo) | Business ($3.99/mo)
// ============================================================================

// ============================================================================
// 1) Infrastructure layout
// ============================================================================

export const CLOUD_INFRA = {
  proxmox: {
    // Proxmox VE server - pve node
    apiBaseUrl: process.env.PROXMOX_API_URL || 'https://10.1.10.70:8006/api2/json',
    nodeName: process.env.PROXMOX_NODE_NAME || 'pve',
    defaultStorage: process.env.PROXMOX_CLOUDPOD_STORAGE || 'local-lvm',
    defaultTemplateId: parseInt(process.env.PROXMOX_CLOUDPOD_TEMPLATE_ID || '9000', 10),
    defaultBridge: process.env.PROXMOX_CLOUDPOD_BRIDGE || 'vmbr0',
    useLxc: true,
  },
  dnsNode: {
    name: 'dns-core',
    host: 'dns-core.migra.local',
    internalIp: '10.1.10.102',
  },
  mailNode: {
    name: 'mail-core',
    host: 'mail-core.migra.local',
    internalIp: '10.1.10.101',
  },
  backupRootPath: '/mnt/windows-backup',
  publicWebIp: '73.139.18.218',
  mailHostname: 'mail.migrahosting.com',
  ns1Hostname: 'ns1.migrahosting.com',
  ns2Hostname: 'ns2.migrahosting.com',
};

// ============================================================================
// 2) Backup tiers
// ============================================================================

export const POD_BACKUP_TIERS = {
  BACKUP_NONE: {
    code: 'BACKUP_NONE',
    name: 'No Backups',
    description: 'No automatic backups for this Cloud Pod.',
    enabled: true,
    retentionDays: 0,
    frequency: 'NONE',
    pathPattern: '',
  },
  BACKUP_BASIC_7D: {
    code: 'BACKUP_BASIC_7D',
    name: 'Basic Backups (7 days)',
    description: 'Daily backups with 7-day retention.',
    enabled: true,
    retentionDays: 7,
    frequency: 'DAILY',
    pathPattern: '{root}/cloudpods/{podId}/{date}',
  },
  BACKUP_PREMIUM_30D: {
    code: 'BACKUP_PREMIUM_30D',
    name: 'Premium Backups (30 days)',
    description: 'Daily backups with 30-day retention.',
    enabled: true,
    retentionDays: 30,
    frequency: 'DAILY',
    pathPattern: '{root}/cloudpods/{podId}/{date}',
  },
};

// ============================================================================
// 3) Email plans
// ============================================================================

export const POD_EMAIL_PLANS = {
  EMAIL_INCLUDED: {
    code: 'EMAIL_INCLUDED',
    name: 'Email Included',
    description: 'Includes email hosting on the central mail server for this Pod.',
    enabled: true,
    includedMailboxes: 10,
    mailHostname: CLOUD_INFRA.mailHostname,
  },
  EMAIL_NONE: {
    code: 'EMAIL_NONE',
    name: 'No Email',
    description: 'No email hosting included by default.',
    enabled: true,
    includedMailboxes: 0,
    mailHostname: CLOUD_INFRA.mailHostname,
  },
};

// ============================================================================
// 4) Cloud Pod Plans – Student / Starter / Premium / Business
// ============================================================================
//
// Pricing from screenshot:
// Student:  $0.00/mo (Annual, 2GB SSD, 50GB BW, 1 DB, 1 mailbox)
// Starter:  $1.49/mo (Triennial $53.64, 30GB NVMe, unmetered BW, 1 site)
// Premium:  $2.49/mo (Triennial $89.64, 75GB NVMe, up to 50 sites)
// Business: $3.99/mo (Triennial $143.64, 100GB NVMe, unlimited sites)
// ============================================================================

export const CLOUD_POD_PLANS = {
  // STUDENT - Free for verified students
  CLOUD_POD_STUDENT: {
    code: 'CLOUD_POD_STUDENT',
    name: 'Student Plan',
    marketingLabel: 'Student Cloud Pod',
    enabled: true,

    // Billing
    billingCycle: 'ANNUALLY',
    billingCycleMonths: 12,
    chargePerCycleUsd: 0.0,
    effectiveMonthlyPriceUsd: 0.0,

    // Resources
    vcpu: 1,
    ramGb: 1,
    diskGb: 2,
    bandwidthMode: 'METERED',
    bandwidthGb: 50,

    // Limits
    websitesLimit: 1,           // subdomain only
    mysqlDatabasesLimit: 1,
    mailboxesLimit: 1,
    includesFreeSsl: true,
    includesDailyBackups: false,
    includesFreeMigrations: false,
    includesPrioritySupport: false,

    // Stack
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: false,
      sshAccess: true,
      sftpAccess: true,
    },

    // Proxmox
    proxmox: {
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },

    defaultBackupTier: 'BACKUP_NONE',
    emailPlan: 'EMAIL_INCLUDED',

    featureBullets: [
      'Subdomain only',
      '2 GB SSD storage',
      '50 GB/month bandwidth',
      '1 MySQL database',
      '1 mailbox',
      'Free SSL',
      'Student verification required for renewal',
    ],
    tags: ['student', 'free', 'cloud-pod'],
  },

  // STARTER - $1.49/mo
  CLOUD_POD_STARTER: {
    code: 'CLOUD_POD_STARTER',
    name: 'Starter',
    marketingLabel: 'Starter Cloud Pod',
    enabled: true,

    // Billing
    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 53.64,
    effectiveMonthlyPriceUsd: 1.49,

    // Resources
    vcpu: 1,
    ramGb: 1,
    diskGb: 30,
    bandwidthMode: 'UNMETERED',

    // Limits
    websitesLimit: 1,
    mysqlDatabasesLimit: 1,
    mailboxesLimit: 10,
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: false,
    includesPrioritySupport: false,

    // Stack
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: false,
      sshAccess: true,
      sftpAccess: true,
    },

    // Proxmox
    proxmox: {
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },

    defaultBackupTier: 'BACKUP_BASIC_7D',
    emailPlan: 'EMAIL_INCLUDED',

    featureBullets: [
      '14-day free trial',
      '1 website',
      '30 GB NVMe storage',
      'Unmetered bandwidth',
      'Free SSL',
      'Daily backups',
    ],
    tags: ['starter', 'cloud-pod', 'trial'],
  },

  // PREMIUM - $2.49/mo
  CLOUD_POD_PREMIUM: {
    code: 'CLOUD_POD_PREMIUM',
    name: 'Premium',
    marketingLabel: 'Premium Cloud Pod',
    enabled: true,

    // Billing
    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 89.64,
    effectiveMonthlyPriceUsd: 2.49,

    // Resources
    vcpu: 2,
    ramGb: 2,
    diskGb: 75,
    bandwidthMode: 'UNMETERED',

    // Limits
    websitesLimit: 50,
    mysqlDatabasesLimit: 10,
    mailboxesLimit: 'UNLIMITED',
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: true,
    includesPrioritySupport: false,

    // Stack
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },

    // Proxmox
    proxmox: {
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },

    defaultBackupTier: 'BACKUP_BASIC_7D',
    emailPlan: 'EMAIL_INCLUDED',

    featureBullets: [
      'Up to 50 websites',
      '75 GB NVMe storage',
      'Up to 10 MySQL databases',
      'Unlimited email accounts',
      'Free SSL',
      'Free migrations',
    ],
    tags: ['premium', 'multi-site', 'cloud-pod'],
  },

  // BUSINESS - $3.99/mo
  CLOUD_POD_BUSINESS: {
    code: 'CLOUD_POD_BUSINESS',
    name: 'Business',
    marketingLabel: 'Business Cloud Pod',
    enabled: true,

    // Billing
    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 143.64,
    effectiveMonthlyPriceUsd: 3.99,

    // Resources
    vcpu: 3,
    ramGb: 4,
    diskGb: 100,
    bandwidthMode: 'UNMETERED',

    // Limits
    websitesLimit: 'UNLIMITED',
    mysqlDatabasesLimit: 'UNLIMITED',
    mailboxesLimit: 'UNLIMITED',
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: true,
    includesPrioritySupport: true,

    // Stack
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },

    // Proxmox
    proxmox: {
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },

    defaultBackupTier: 'BACKUP_PREMIUM_30D',
    emailPlan: 'EMAIL_INCLUDED',

    featureBullets: [
      'Unlimited websites',
      '100 GB NVMe storage',
      'Unmetered bandwidth',
      'Unlimited mailboxes per site',
      'Free SSL',
      'Priority support',
    ],
    tags: ['business', 'agency', 'cloud-pod'],
  },
};

// Array form for easy iteration
export const CLOUD_POD_PLANS_LIST = Object.values(CLOUD_POD_PLANS);

// ============================================================================
// 5) Helper lookups
// ============================================================================

export function getPodPlan(code) {
  const plan = CLOUD_POD_PLANS[code];
  if (!plan) throw new Error(`Unknown Cloud Pod plan: ${code}`);
  return plan;
}

export function getPodBackupTier(code) {
  const tier = POD_BACKUP_TIERS[code];
  if (!tier) throw new Error(`Unknown Pod backup tier: ${code}`);
  return tier;
}

export function getPodEmailPlan(code) {
  const plan = POD_EMAIL_PLANS[code];
  if (!plan) throw new Error(`Unknown Pod email plan: ${code}`);
  return plan;
}

export function getAllPodPlanCodes() {
  return Object.keys(CLOUD_POD_PLANS);
}

export function getEnabledPodPlans() {
  return CLOUD_POD_PLANS_LIST.filter(p => p.enabled);
}

export function isValidPodPlanCode(code) {
  return code in CLOUD_POD_PLANS;
}

// ============================================================================
// 6) Public DTOs – for GET /api/cloud-pods/plans & /compare
// ============================================================================

export function buildPublicPlans() {
  return CLOUD_POD_PLANS_LIST
    .filter((p) => p.enabled)
    .map((p) => {
      const bandwidth =
        p.bandwidthMode === 'UNMETERED'
          ? 'Unmetered bandwidth'
          : `${p.bandwidthGb ?? 0} GB/mo bandwidth`;

      return {
        code: p.code,
        name: p.name,
        label: p.marketingLabel,
        pricePerMonth: p.effectiveMonthlyPriceUsd,
        billingCycle: p.billingCycle,
        billingCycleMonths: p.billingCycleMonths,
        chargePerCycleUsd: p.chargePerCycleUsd,
        cpu: `${p.vcpu} vCPU`,
        ram: `${p.ramGb} GB RAM`,
        storage: `${p.diskGb} GB NVMe storage`,
        bandwidth,
        mainFeatures: p.featureBullets,
        limits: {
          websites: p.websitesLimit,
          databases: p.mysqlDatabasesLimit,
          mailboxes: p.mailboxesLimit,
        },
        includes: {
          freeSsl: p.includesFreeSsl,
          dailyBackups: p.includesDailyBackups,
          freeMigrations: p.includesFreeMigrations,
          prioritySupport: p.includesPrioritySupport,
        },
      };
    });
}

export function buildCompareTable() {
  const st = getPodPlan('CLOUD_POD_STUDENT');
  const starter = getPodPlan('CLOUD_POD_STARTER');
  const prem = getPodPlan('CLOUD_POD_PREMIUM');
  const biz = getPodPlan('CLOUD_POD_BUSINESS');

  const fmtSites = (x) => (x === 'UNLIMITED' ? 'Unlimited' : x.toString());
  const fmtDb = (x) => (x === 'UNLIMITED' ? 'Unlimited' : x.toString());
  const fmtMailbox = (x) => (x === 'UNLIMITED' ? 'Unlimited' : x.toString());
  const fmtBandwidth = (p) =>
    p.bandwidthMode === 'UNMETERED' ? 'Unmetered' : `${p.bandwidthGb ?? 0} GB/mo`;

  return [
    {
      feature: 'Monthly price',
      student: `$${st.effectiveMonthlyPriceUsd.toFixed(2)}`,
      starter: `$${starter.effectiveMonthlyPriceUsd.toFixed(2)}`,
      premium: `$${prem.effectiveMonthlyPriceUsd.toFixed(2)}`,
      business: `$${biz.effectiveMonthlyPriceUsd.toFixed(2)}`,
    },
    {
      feature: 'Billing term',
      student: 'Annually (1 year)',
      starter: 'Triennially (3 years)',
      premium: 'Triennially (3 years)',
      business: 'Triennially (3 years)',
    },
    {
      feature: 'CPU',
      student: `${st.vcpu} vCPU`,
      starter: `${starter.vcpu} vCPU`,
      premium: `${prem.vcpu} vCPU`,
      business: `${biz.vcpu} vCPU`,
    },
    {
      feature: 'RAM',
      student: `${st.ramGb} GB`,
      starter: `${starter.ramGb} GB`,
      premium: `${prem.ramGb} GB`,
      business: `${biz.ramGb} GB`,
    },
    {
      feature: 'Storage',
      student: `${st.diskGb} GB SSD`,
      starter: `${starter.diskGb} GB NVMe`,
      premium: `${prem.diskGb} GB NVMe`,
      business: `${biz.diskGb} GB NVMe`,
    },
    {
      feature: 'Bandwidth',
      student: fmtBandwidth(st),
      starter: fmtBandwidth(starter),
      premium: fmtBandwidth(prem),
      business: fmtBandwidth(biz),
    },
    {
      feature: 'Websites',
      student: fmtSites(st.websitesLimit),
      starter: fmtSites(starter.websitesLimit),
      premium: fmtSites(prem.websitesLimit),
      business: fmtSites(biz.websitesLimit),
    },
    {
      feature: 'MySQL databases',
      student: fmtDb(st.mysqlDatabasesLimit),
      starter: fmtDb(starter.mysqlDatabasesLimit),
      premium: fmtDb(prem.mysqlDatabasesLimit),
      business: fmtDb(biz.mysqlDatabasesLimit),
    },
    {
      feature: 'Mailboxes',
      student: fmtMailbox(st.mailboxesLimit),
      starter: fmtMailbox(starter.mailboxesLimit),
      premium: fmtMailbox(prem.mailboxesLimit),
      business: fmtMailbox(biz.mailboxesLimit),
    },
    {
      feature: 'Free SSL',
      student: st.includesFreeSsl,
      starter: starter.includesFreeSsl,
      premium: prem.includesFreeSsl,
      business: biz.includesFreeSsl,
    },
    {
      feature: 'Daily backups',
      student: st.includesDailyBackups,
      starter: starter.includesDailyBackups,
      premium: prem.includesDailyBackups,
      business: biz.includesDailyBackups,
    },
    {
      feature: 'Free migrations',
      student: st.includesFreeMigrations,
      starter: starter.includesFreeMigrations,
      premium: prem.includesFreeMigrations,
      business: biz.includesFreeMigrations,
    },
    {
      feature: 'Priority support',
      student: st.includesPrioritySupport,
      starter: starter.includesPrioritySupport,
      premium: prem.includesPrioritySupport,
      business: biz.includesPrioritySupport,
    },
  ];
}

// ============================================================================
// 7) Provisioning Intent Builder
// ============================================================================

export function buildCloudPodProvisioningIntent(item) {
  const plan = getPodPlan(item.planCode);
  if (!plan.enabled) {
    throw new Error(`Cloud Pod plan ${plan.code} is disabled.`);
  }

  const backupTier = getPodBackupTier(plan.defaultBackupTier);
  const emailPlan = getPodEmailPlan(plan.emailPlan);
  const podLabel = `${plan.marketingLabel} for customer ${item.customerId}`;
  const internalHostname = `pod-${item.id}.migra.local`;

  const intent = {
    itemId: item.id,
    serviceKind: 'CLOUD_POD',
    pod: {
      plan,
      podLabel,
      customerId: item.customerId,
      resources: {
        vcpu: plan.vcpu,
        ramGb: plan.ramGb,
        diskGb: plan.diskGb,
        bandwidthMode: plan.bandwidthMode,
        bandwidthGb: plan.bandwidthGb,
      },
      proxmox: {
        nodeName: plan.proxmox.nodeName,
        templateId: plan.proxmox.templateId,
        storage: plan.proxmox.storage,
        useLxc: plan.proxmox.useLxc,
      },
      stack: plan.stack,
      backupTier,
      emailPlan,
      internalHostname,
    },
    domainConfig: item.primaryDomain
      ? {
          primaryDomain: item.primaryDomain,
          createDnsZone: true,
          ns1: CLOUD_INFRA.ns1Hostname,
          ns2: CLOUD_INFRA.ns2Hostname,
          pointARecordToPodIp: true,
          pointARecordToSharedIp: false,
          sharedIp: null,
          mxToCentralMail: emailPlan.includedMailboxes !== 0,
          spfIncludeMail: emailPlan.includedMailboxes !== 0,
          mailHostname: CLOUD_INFRA.mailHostname,
        }
      : undefined,
  };

  return intent;
}

export function calculateBackupPath(podId, backupTierCode, date = new Date()) {
  const tier = getPodBackupTier(backupTierCode);
  if (!tier.pathPattern) return '';
  
  const dateStr = date.toISOString().split('T')[0];
  return tier.pathPattern
    .replace('{root}', CLOUD_INFRA.backupRootPath)
    .replace('{podId}', podId)
    .replace('{date}', dateStr);
}

export function getPodResourcesSummary(planCode) {
  const plan = getPodPlan(planCode);
  const fmtBw = plan.bandwidthMode === 'UNMETERED' 
    ? 'Unmetered' 
    : `${plan.bandwidthGb} GB/mo`;
  
  return {
    vcpu: `${plan.vcpu} vCPU`,
    ram: `${plan.ramGb} GB RAM`,
    disk: `${plan.diskGb} GB NVMe SSD`,
    bandwidth: fmtBw,
    webServer: plan.stack.webServer,
    php: plan.stack.phpEnabled ? 'PHP 8.x' : 'Not included',
    database: plan.stack.databaseEnabled ? 'MySQL/MariaDB' : 'Not included',
    nodejs: plan.stack.nodeJsEnabled ? 'Node.js LTS' : 'Not included',
    ssh: plan.stack.sshAccess ? 'Full SSH Access' : 'No SSH',
    sftp: plan.stack.sftpAccess ? 'SFTP Access' : 'No SFTP',
  };
}

// ============================================================================
// Default export
// ============================================================================

export default {
  CLOUD_INFRA,
  POD_BACKUP_TIERS,
  POD_EMAIL_PLANS,
  CLOUD_POD_PLANS,
  CLOUD_POD_PLANS_LIST,
  getPodPlan,
  getPodBackupTier,
  getPodEmailPlan,
  getAllPodPlanCodes,
  getEnabledPodPlans,
  isValidPodPlanCode,
  buildPublicPlans,
  buildCompareTable,
  buildCloudPodProvisioningIntent,
  calculateBackupPath,
  getPodResourcesSummary,
};
