// apps/api/src/spec/cloudPodsSpec.ts
// ============================================================================
// MigraHosting – Cloud Pods Spec (for Copilot & API)
//
// This file is the SINGLE SOURCE OF TRUTH for:
//
//   • Cloud Pods infrastructure + plan catalog
//   • Student / Starter / Premium / Business pricing (screenshot)
//   • Public DTOs for plan listing & compare table
//   • Order + provisioning intent structure
//   • High-level API contracts (GET /plans, GET /compare, POST /order)
//
// IMPORTANT:
//  - Do NOT hardcode prices, resources, or limits anywhere else.
//  - ALWAYS import from here when dealing with Cloud Pods.
// ============================================================================

// ============================================================================
// 1) Infrastructure layout
// ============================================================================

export interface InfraNodeConfig {
  name: string;         // e.g. "proxmox-node01"
  host: string;         // hostname or IP
  internalIp?: string;
}

export interface CloudInfraConfig {
  proxmox: {
    apiBaseUrl: string;        // "https://10.1.10.5:8006/api2/json"
    nodeName: string;          // "migra-node01"
    defaultStorage: string;    // "local-lvm" or "nvme-storage"
    defaultTemplateId: number; // base LXC/VM template ID
    useLxc: boolean;           // true = LXC containers, false = full VMs
  };
  dnsNode: InfraNodeConfig;    // PowerDNS host
  mailNode: InfraNodeConfig;   // central mail server
  backupRootPath: string;      // "/mnt/windows-backup"
  mailHostname: string;        // "mail.migrahosting.com"
  ns1Hostname: string;         // "ns1.migrahosting.com"
  ns2Hostname: string;         // "ns2.migrahosting.com"
}

/**
 * EDIT these values to match your real environment.
 * They exist here so Copilot understands the shape.
 * In production, these are overridden by environment variables in cloudPods.js
 */
export const CLOUD_INFRA: CloudInfraConfig = {
  proxmox: {
    apiBaseUrl: 'https://10.1.10.70:8006/api2/json', // Proxmox VE - pve node
    nodeName: 'pve',
    defaultStorage: 'local-lvm',
    defaultTemplateId: 9000, // Ubuntu/Nginx/PHP LXC template
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
  mailHostname: 'mail.migrahosting.com',
  ns1Hostname: 'ns1.migrahosting.com',
  ns2Hostname: 'ns2.migrahosting.com',
};

// ============================================================================
// 2) Core enums / types
// ============================================================================

export type PodBillingCycle = 'MONTHLY' | 'ANNUALLY' | 'TRIENNIALLY';

export type CloudPodPlanCode =
  | 'CLOUD_POD_STUDENT'
  | 'CLOUD_POD_STARTER'
  | 'CLOUD_POD_PREMIUM'
  | 'CLOUD_POD_BUSINESS';

export type BackupTierCode =
  | 'BACKUP_NONE'
  | 'BACKUP_BASIC_7D'
  | 'BACKUP_PREMIUM_30D';

export type EmailPlanCode = 'EMAIL_INCLUDED' | 'EMAIL_NONE';

export type PodServiceKind = 'CLOUD_POD';

export type BandwidthMode = 'METERED' | 'UNMETERED';

// ============================================================================
// 3) Backup tiers
// ============================================================================

export interface BackupTierConfig {
  code: BackupTierCode;
  name: string;
  description: string;
  enabled: boolean;
  retentionDays: number;
  frequency: 'NONE' | 'DAILY' | 'EVERY_2H';
  /**
   * Relative path pattern under CLOUD_INFRA.backupRootPath.
   *
   * Placeholders:
   *   {server}   – e.g. "cloudpods"
   *   {podId}    – internal pod ID or subscription ID
   *   {date}     – YYYY-MM-DD string
   */
  pathPattern: string;
}

export const POD_BACKUP_TIERS: Record<BackupTierCode, BackupTierConfig> = {
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
// 4) Email plans
// ============================================================================

export interface EmailPlanConfig {
  code: EmailPlanCode;
  name: string;
  description: string;
  enabled: boolean;
  includedMailboxes: number | 'UNLIMITED';
  mailHostname: string;
}

export const POD_EMAIL_PLANS: Record<EmailPlanCode, EmailPlanConfig> = {
  EMAIL_INCLUDED: {
    code: 'EMAIL_INCLUDED',
    name: 'Email Included',
    description:
      'Includes email hosting on the central mail server for this Pod.',
    enabled: true,
    includedMailboxes: 10, // Student plan overrides via mailboxesLimit
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
// 5) Cloud Pod plans – Student / Starter / Premium / Business
// ============================================================================
//
// These match your pricing screenshot:
//
// Student:  $0.00/mo (Annual, 2GB SSD, 50GB BW, 1 DB, 1 mailbox)
// Starter:  $1.49/mo (Triennial, 30GB NVMe, unmetered BW, 1 site)
// Premium:  $2.49/mo (Triennial, 75GB NVMe, up to 50 sites)
// Business: $3.99/mo (Triennial, 100GB NVMe, unlimited sites)
// ============================================================================

export interface CloudPodPlanConfig {
  code: CloudPodPlanCode;
  name: string;           // "Student Plan", "Starter", etc.
  marketingLabel: string; // "Student Cloud Pod"
  enabled: boolean;

  // Billing
  billingCycle: PodBillingCycle;  // ANNUALLY / TRIENNIALLY
  billingCycleMonths: number;     // 12 or 36
  chargePerCycleUsd: number;      // e.g. 53.64
  effectiveMonthlyPriceUsd: number; // e.g. 1.49

  // Resources
  vcpu: number;
  ramGb: number;
  diskGb: number;
  bandwidthMode: BandwidthMode;
  bandwidthGb?: number;

  // Limits (marketing-level)
  websitesLimit: number | 'UNLIMITED';
  mysqlDatabasesLimit: number | 'UNLIMITED';
  mailboxesLimit: number | 'UNLIMITED';
  includesFreeSsl: boolean;
  includesDailyBackups: boolean;
  includesFreeMigrations: boolean;
  includesPrioritySupport: boolean;

  // Runtime stack
  stack: {
    webServer: 'NGINX' | 'APACHE';
    phpEnabled: boolean;
    databaseEnabled: boolean;
    nodeJsEnabled: boolean;
    sshAccess: boolean;
    sftpAccess: boolean;
  };

  // Proxmox
  proxmox: {
    nodeName: string;
    templateId: number;
    storage: string;
    useLxc: boolean;
  };

  defaultBackupTier: BackupTierCode;
  emailPlan: EmailPlanCode;

  // For landing pages / compare tables
  featureBullets: string[];
  tags?: string[];
}

export const CLOUD_POD_PLANS: Record<CloudPodPlanCode, CloudPodPlanConfig> = {
  // STUDENT
  CLOUD_POD_STUDENT: {
    code: 'CLOUD_POD_STUDENT',
    name: 'Student Plan',
    marketingLabel: 'Student Cloud Pod',
    enabled: true,

    billingCycle: 'ANNUALLY',
    billingCycleMonths: 12,
    chargePerCycleUsd: 0.0,
    effectiveMonthlyPriceUsd: 0.0,

    vcpu: 1,
    ramGb: 1,
    diskGb: 2,
    bandwidthMode: 'METERED',
    bandwidthGb: 50,

    websitesLimit: 1,           // subdomain only
    mysqlDatabasesLimit: 1,
    mailboxesLimit: 1,
    includesFreeSsl: true,
    includesDailyBackups: false,
    includesFreeMigrations: false,
    includesPrioritySupport: false,

    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: false,
      sshAccess: true,
      sftpAccess: true,
    },

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

  // STARTER
  CLOUD_POD_STARTER: {
    code: 'CLOUD_POD_STARTER',
    name: 'Starter',
    marketingLabel: 'Starter Cloud Pod',
    enabled: true,

    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 53.64,
    effectiveMonthlyPriceUsd: 1.49,

    vcpu: 1,
    ramGb: 1,
    diskGb: 30,
    bandwidthMode: 'UNMETERED',

    websitesLimit: 1,
    mysqlDatabasesLimit: 1,
    mailboxesLimit: 10,
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: false,
    includesPrioritySupport: false,

    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: false,
      sshAccess: true,
      sftpAccess: true,
    },

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

  // PREMIUM
  CLOUD_POD_PREMIUM: {
    code: 'CLOUD_POD_PREMIUM',
    name: 'Premium',
    marketingLabel: 'Premium Cloud Pod',
    enabled: true,

    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 89.64, // 2.49 * 36
    effectiveMonthlyPriceUsd: 2.49,

    vcpu: 2,
    ramGb: 2,
    diskGb: 75,
    bandwidthMode: 'UNMETERED',

    websitesLimit: 50,
    mysqlDatabasesLimit: 10,
    mailboxesLimit: 'UNLIMITED',
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: true,
    includesPrioritySupport: false,

    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },

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

  // BUSINESS
  CLOUD_POD_BUSINESS: {
    code: 'CLOUD_POD_BUSINESS',
    name: 'Business',
    marketingLabel: 'Business Cloud Pod',
    enabled: true,

    billingCycle: 'TRIENNIALLY',
    billingCycleMonths: 36,
    chargePerCycleUsd: 143.64, // 3.99 * 36
    effectiveMonthlyPriceUsd: 3.99,

    vcpu: 3,
    ramGb: 4,
    diskGb: 100,
    bandwidthMode: 'UNMETERED',

    websitesLimit: 'UNLIMITED',
    mysqlDatabasesLimit: 'UNLIMITED',
    mailboxesLimit: 'UNLIMITED',
    includesFreeSsl: true,
    includesDailyBackups: true,
    includesFreeMigrations: true,
    includesPrioritySupport: true,

    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },

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

// ============================================================================
// 6) Helper lookups
// ============================================================================

export function getPodPlan(code: CloudPodPlanCode): CloudPodPlanConfig {
  const plan = CLOUD_POD_PLANS[code];
  if (!plan) throw new Error(`Unknown Cloud Pod plan: ${code}`);
  return plan;
}

export function getPodBackupTier(code: BackupTierCode): BackupTierConfig {
  const tier = POD_BACKUP_TIERS[code];
  if (!tier) throw new Error(`Unknown Pod backup tier: ${code}`);
  return tier;
}

export function getPodEmailPlan(code: EmailPlanCode): EmailPlanConfig {
  const plan = POD_EMAIL_PLANS[code];
  if (!plan) throw new Error(`Unknown Pod email plan: ${code}`);
  return plan;
}

// ============================================================================
// 7) Public DTOs – for GET /api/cloud-pods/plans & /compare
// ============================================================================

export interface CloudPodPlanPublicDTO {
  code: CloudPodPlanCode;
  name: string;
  label: string;
  pricePerMonth: number;
  billingCycle: PodBillingCycle;
  billingCycleMonths: number;
  chargePerCycleUsd: number;
  cpu: string;            // "1 vCPU"
  ram: string;            // "1 GB RAM"
  storage: string;        // "30 GB NVMe"
  bandwidth: string;      // "Unmetered" or "50 GB/mo"
  mainFeatures: string[]; // bullets for card UI
}

/**
 * Build list of plans for GET /api/cloud-pods/plans
 */
export function buildPublicPlans(): CloudPodPlanPublicDTO[] {
  return (Object.values(CLOUD_POD_PLANS) as CloudPodPlanConfig[])
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
      };
    });
}

// ---- Compare table DTO ----

export interface CloudPodCompareRow {
  feature: string;
  student: string | boolean | number;
  starter: string | boolean | number;
  premium: string | boolean | number;
  business: string | boolean | number;
}

/**
 * Build compare table rows for GET /api/cloud-pods/compare
 */
export function buildCompareTable(): CloudPodCompareRow[] {
  const st = getPodPlan('CLOUD_POD_STUDENT');
  const starter = getPodPlan('CLOUD_POD_STARTER');
  const prem = getPodPlan('CLOUD_POD_PREMIUM');
  const biz = getPodPlan('CLOUD_POD_BUSINESS');

  const fmtSites = (x: number | 'UNLIMITED') =>
    x === 'UNLIMITED' ? 'Unlimited' : x.toString();

  const fmtDb = (x: number | 'UNLIMITED') =>
    x === 'UNLIMITED' ? 'Unlimited' : x.toString();

  const fmtMailbox = (x: number | 'UNLIMITED') =>
    x === 'UNLIMITED' ? 'Unlimited' : x.toString();

  const fmtBandwidth = (p: CloudPodPlanConfig) =>
    p.bandwidthMode === 'UNMETERED'
      ? 'Unmetered'
      : `${p.bandwidthGb ?? 0} GB/mo`;

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
// 8) Order + provisioning intent
// ============================================================================

export interface CloudPodOrderItem {
  id: string;                 // order/subscription ID
  customerId: string;
  planCode: CloudPodPlanCode;
  primaryDomain?: string;
}

export interface CloudPodProvisioningIntent {
  itemId: string;
  serviceKind: PodServiceKind;

  pod: {
    plan: CloudPodPlanConfig;
    podLabel: string;
    customerId: string;

    resources: {
      vcpu: number;
      ramGb: number;
      diskGb: number;
      bandwidthMode: BandwidthMode;
      bandwidthGb?: number;
    };

    proxmox: {
      nodeName: string;
      templateId: number;
      storage: string;
      useLxc: boolean;
    };

    stack: CloudPodPlanConfig['stack'];
    backupTier: BackupTierConfig;
    emailPlan: EmailPlanConfig;

    internalHostname: string;
  };

  domainConfig?: {
    primaryDomain: string;
    createDnsZone: boolean;
    ns1: string;
    ns2: string;
    pointARecordToPodIp: boolean;
    pointARecordToSharedIp: boolean;
    sharedIp: string | null;
    mxToCentralMail: boolean;
    spfIncludeMail: boolean;
    mailHostname: string;
  };
}

/**
 * Build the provisioning intent for a new Cloud Pod subscription.
 * The worker (separate service) will consume this and:
 *  - call Proxmox API
 *  - configure DNS on dns-core
 *  - configure email on mail-core
 *  - set up backups under backupRootPath
 */
export function buildCloudPodProvisioningIntent(
  item: CloudPodOrderItem,
): CloudPodProvisioningIntent {
  const plan = getPodPlan(item.planCode);
  if (!plan.enabled) {
    throw new Error(`Cloud Pod plan ${plan.code} is disabled.`);
  }

  const backupTier = getPodBackupTier(plan.defaultBackupTier);
  const emailPlan = getPodEmailPlan(plan.emailPlan);
  const podLabel = `${plan.marketingLabel} for customer ${item.customerId}`;
  const internalHostname = `pod-${item.id}.migra.local`;

  const intent: CloudPodProvisioningIntent = {
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

// ============================================================================
// 9) API CONTRACTS (for Copilot – comments only)
//
// 1) GET /api/cloud-pods/plans
//    - Returns CloudPodPlanPublicDTO[]
//    - Implementation:
//        res.json(buildPublicPlans());
//
// 2) GET /api/cloud-pods/compare
//    - Returns CloudPodCompareRow[]
//    - Implementation:
//        res.json(buildCompareTable());
//
// 3) POST /api/cloud-pods/order
//    - Body:
//        {
//          "customerId": "cus_123",
//          "planCode": "CLOUD_POD_PREMIUM",
//          "primaryDomain": "example.com",
//          "addons": [
//             { "code": "ADDON_DAILY_BACKUPS", "units": 1 },
//             { "code": "ADDON_CDN", "units": 1 }
//          ]
//        }
//
//    - Steps:
//        • Validate planCode / domain / addons.
//        • Create subscription record in DB.
//        • Build CloudPodProvisioningIntent via buildCloudPodProvisioningIntent.
//        • Attach addons into intent for worker.
//        • Push job to queue (Redis/BullMQ/RabbitMQ).
//        • Return subscriptionId, orderId, pricing summary.
//
// 4) Worker service (separate file/app):
//        • Consumes CloudPodProvisioningIntent from queue.
//        • Calls Proxmox API → clone template → set CPU/RAM/disk.
//        • Configures NGINX/PHP/MySQL stack inside container/VM.
//        • Sets up backup scripts using POD_BACKUP_TIERS + backupRootPath.
//        • Configures DNS zone on dns-core via PowerDNS API.
//        • Configures MX/SPF for mail-core.
//        • Sends "Welcome to your Cloud Pod" email to customer.
//
// ============================================================================
