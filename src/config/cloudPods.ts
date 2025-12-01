// apps/api/src/config/cloudPods.ts
// ============================================================================
// MigraHosting Cloud Pods – Single Source of Truth
// ============================================================================
// This file defines:
//
//  1) Infrastructure layout for Cloud Pods (Proxmox, DNS, mail, backups)
//  2) Cloud Pod plans (Mini / Pro / Business / Enterprise)
//  3) Backup tiers & email behavior for pods
//  4) Provisioning intents for "one pod per client" model
//  5) Helper functions for checkout, validation, and workers
//  6) Suggested Prisma schema (in comments) for subscriptions & pods
//
//  GOAL:
//  - Replace old-school "shared hosting" with isolated containers.
//  - Every client gets their own "Pod" (LXC/VM) = their own world.
//  - No neighbors, no noisy tenant, no classic shared hosting.
//
//  RULES FOR COPILOT & DEVS:
//  - Do NOT hardcode Pod resources or pricing anywhere else.
//  - ALWAYS import from this file when dealing with Cloud Pods.
//  - If you add/edit a Pod plan, update the config here first.
// ============================================================================

// ============================================================================
// 1) Infrastructure layout for Cloud Pods
// ============================================================================

export interface InfraNodeConfig {
  name: string;       // e.g. "proxmox-node01"
  host: string;       // hostname or IP
  internalIp?: string;
}

export interface CloudInfraConfig {
  proxmox: {
    apiBaseUrl: string;          // e.g. "https://10.1.10.5:8006/api2/json"
    nodeName: string;            // e.g. "migra-node01"
    defaultStorage: string;      // e.g. "local-lvm" or "nvme-storage"
    defaultTemplateId: number;   // base LXC template ID
    useLxc: boolean;             // true = LXC containers, false = full VMs
  };
  dnsNode: InfraNodeConfig;      // PowerDNS host
  mailNode: InfraNodeConfig;     // central mail server
  backupRootPath: string;        // e.g. "/mnt/windows-backup"
  publicWebIp: string;           // main public IP for web entry if needed
  mailHostname: string;          // e.g. "mail.migrahosting.com"
  ns1Hostname: string;           // "ns1.migrahosting.com"
  ns2Hostname: string;           // "ns2.migrahosting.com"
}

/**
 * INFRASTRUCTURE CONFIG - Values from environment with sensible defaults
 * In production, these come from .env file on each server
 */
export const CLOUD_INFRA: CloudInfraConfig = {
  proxmox: {
    apiBaseUrl: process.env.PROXMOX_API_URL || 'https://proxmox-node:8006/api2/json',
    nodeName: process.env.PROXMOX_NODE_NAME || 'migra-node01',
    defaultStorage: process.env.PROXMOX_STORAGE || 'local-lvm',
    defaultTemplateId: parseInt(process.env.PROXMOX_TEMPLATE_ID || '9000', 10),
    useLxc: true,
  },
  dnsNode: {
    name: 'dns-core',
    host: process.env.DNS_CORE_HOST || 'dns-core.migra.local',
    internalIp: process.env.DNS_CORE_IP || '10.1.10.102',
  },
  mailNode: {
    name: 'mail-core',
    host: process.env.MAIL_CORE_HOST || 'mail-core.migra.local',
    internalIp: process.env.MAIL_CORE_IP || '10.1.10.101',
  },
  backupRootPath: process.env.BACKUP_ROOT_PATH || '/mnt/windows-backup',
  publicWebIp: process.env.PUBLIC_WEB_IP || '73.139.18.218',
  mailHostname: process.env.MAIL_HOSTNAME || 'mail.migrahosting.com',
  ns1Hostname: process.env.NS1_HOSTNAME || 'ns1.migrahosting.com',
  ns2Hostname: process.env.NS2_HOSTNAME || 'ns2.migrahosting.com',
};

// ============================================================================
// 2) Core types – Pod plans, billing, backup, email
// ============================================================================

export type PodBillingPeriod = 'MONTHLY' | 'YEARLY';

export type CloudPodPlanCode =
  | 'CLOUD_POD_MINI'
  | 'CLOUD_POD_PRO'
  | 'CLOUD_POD_BUSINESS'
  | 'CLOUD_POD_ENTERPRISE';

export type BackupTierCode =
  | 'BACKUP_NONE'
  | 'BACKUP_BASIC_7D'
  | 'BACKUP_PREMIUM_30D';

export type EmailPlanCode =
  | 'EMAIL_INCLUDED'
  | 'EMAIL_NONE';

export type PodServiceKind = 'CLOUD_POD'; // future-proof if you add more.

// ============================================================================
// 3) Backup tiers for Pods
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
   *   {server}   – logical server name (e.g. "cloudpods")
   *   {podId}    – internal pod ID or subscription ID
   *   {date}     – formatted date (YYYY-MM-DD)
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
    description: 'Daily filesystem backups with 7-day retention.',
    enabled: true,
    retentionDays: 7,
    frequency: 'DAILY',
    pathPattern: '{root}/cloudpods/{podId}/{date}',
  },
  BACKUP_PREMIUM_30D: {
    code: 'BACKUP_PREMIUM_30D',
    name: 'Premium Backups (30 days)',
    description:
      'Daily filesystem backups with 30-day retention and off-node storage.',
    enabled: true,
    retentionDays: 30,
    frequency: 'DAILY',
    pathPattern: '{root}/cloudpods/{podId}/{date}',
  },
};

// ============================================================================
// 4) Email plan behavior for Pods
// ============================================================================

export interface EmailPlanConfig {
  code: EmailPlanCode;
  name: string;
  description: string;
  enabled: boolean;
  includedMailboxes: number | 'UNLIMITED';
  mailHostname: string; // IMAP/SMTP host (mail.migrahosting.com)
}

export const POD_EMAIL_PLANS: Record<EmailPlanCode, EmailPlanConfig> = {
  EMAIL_INCLUDED: {
    code: 'EMAIL_INCLUDED',
    name: 'Email Included',
    description:
      'Includes basic email hosting on the central mail server for this Pod.',
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
// 5) Cloud Pod plan configuration
// ============================================================================

export interface CloudPodPlanConfig {
  code: CloudPodPlanCode;
  name: string;
  description: string;
  enabled: boolean;

  // Billing
  billingPeriod: PodBillingPeriod;
  price: number; // USD / billing period

  // Resources (per Pod)
  vcpu: number;
  ramGb: number;
  diskGb: number;
  bandwidthTb: number;

  // What is pre-installed?
  stack: {
    webServer: 'NGINX' | 'APACHE';
    phpEnabled: boolean;
    databaseEnabled: boolean;
    nodeJsEnabled: boolean;
    sshAccess: boolean;
    sftpAccess: boolean;
  };

  // Templates & Proxmox specifics
  proxmox: {
    templateId: number;
    storage: string;
    nodeName: string;
    useLxc: boolean;
  };

  // Backups + email
  defaultBackupTier: BackupTierCode;
  emailPlan: EmailPlanCode;

  // Marketing tags (good for UI and filters)
  tags?: string[];
}

export const CLOUD_POD_PLANS: Record<CloudPodPlanCode, CloudPodPlanConfig> = {
  CLOUD_POD_MINI: {
    code: 'CLOUD_POD_MINI',
    name: 'Cloud Pod Mini',
    description:
      'Your own isolated container for a single small website or app.',
    enabled: true,
    billingPeriod: 'MONTHLY',
    price: 9.99,
    vcpu: 1,
    ramGb: 1,
    diskGb: 20,
    bandwidthTb: 2,
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: false,
      sshAccess: true,
      sftpAccess: true,
    },
    proxmox: {
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },
    defaultBackupTier: 'BACKUP_BASIC_7D',
    emailPlan: 'EMAIL_INCLUDED',
    tags: ['starter', 'single-site', 'cloud-pod'],
  },

  CLOUD_POD_PRO: {
    code: 'CLOUD_POD_PRO',
    name: 'Cloud Pod Pro',
    description:
      'More power and memory for multiple sites, stores, or apps.',
    enabled: true,
    billingPeriod: 'MONTHLY',
    price: 19.99,
    vcpu: 2,
    ramGb: 2,
    diskGb: 40,
    bandwidthTb: 3,
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },
    proxmox: {
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },
    defaultBackupTier: 'BACKUP_BASIC_7D',
    emailPlan: 'EMAIL_INCLUDED',
    tags: ['pro', 'multi-site', 'business', 'cloud-pod'],
  },

  CLOUD_POD_BUSINESS: {
    code: 'CLOUD_POD_BUSINESS',
    name: 'Cloud Pod Business',
    description:
      'For serious businesses, agencies, and high-traffic workloads.',
    enabled: true,
    billingPeriod: 'MONTHLY',
    price: 39.99,
    vcpu: 4,
    ramGb: 6,
    diskGb: 80,
    bandwidthTb: 5,
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },
    proxmox: {
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },
    defaultBackupTier: 'BACKUP_PREMIUM_30D',
    emailPlan: 'EMAIL_INCLUDED',
    tags: ['business', 'agency', 'high-traffic', 'cloud-pod'],
  },

  CLOUD_POD_ENTERPRISE: {
    code: 'CLOUD_POD_ENTERPRISE',
    name: 'Cloud Pod Enterprise',
    description:
      'High-performance isolated environment for demanding projects.',
    enabled: true,
    billingPeriod: 'MONTHLY',
    price: 79.99,
    vcpu: 8,
    ramGb: 16,
    diskGb: 160,
    bandwidthTb: 8,
    stack: {
      webServer: 'NGINX',
      phpEnabled: true,
      databaseEnabled: true,
      nodeJsEnabled: true,
      sshAccess: true,
      sftpAccess: true,
    },
    proxmox: {
      templateId: CLOUD_INFRA.proxmox.defaultTemplateId,
      storage: CLOUD_INFRA.proxmox.defaultStorage,
      nodeName: CLOUD_INFRA.proxmox.nodeName,
      useLxc: CLOUD_INFRA.proxmox.useLxc,
    },
    defaultBackupTier: 'BACKUP_PREMIUM_30D',
    emailPlan: 'EMAIL_INCLUDED',
    tags: ['enterprise', 'heavy', 'cloud-pod'],
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
// 7) Order / Provisioning intents
// ============================================================================

/**
 * Minimal order item for a Cloud Pod purchase.
 */
export interface CloudPodOrderItem {
  id: string;                     // order item ID
  customerId: string;             // internal customer ID
  planCode: CloudPodPlanCode;
  primaryDomain?: string;         // e.g. "example.com"
}

/**
 * Intent for the provisioning worker – what to actually do.
 */
export interface CloudPodProvisioningIntent {
  itemId: string;
  serviceKind: PodServiceKind;    // "CLOUD_POD"

  pod: {
    plan: CloudPodPlanConfig;
    podLabel: string;             // human readable label
    customerId: string;

    // Container/VM properties
    resources: {
      vcpu: number;
      ramGb: number;
      diskGb: number;
      bandwidthTb: number;
    };

    // Proxmox parameters
    proxmox: {
      nodeName: string;
      templateId: number;
      storage: string;
      useLxc: boolean;
      // worker will decide VMID/CTID
    };

    // OS stack flags (what bootstrap script should install/configure)
    stack: CloudPodPlanConfig['stack'];

    // Backup + email configuration
    backupTier: BackupTierConfig;
    emailPlan: EmailPlanConfig;

    // Hostname convention inside your infra
    internalHostname: string;     // e.g. "pod-<itemId>.migra.local"
  };

  domainConfig?: {
    primaryDomain: string;
    createDnsZone: boolean;
    ns1: string;
    ns2: string;

    // DNS linking options:
    // - if you're assigning a dedicated IP to Pod -> set A directly to Pod IP
    // - if you use reverse proxy/front IP, point to that
    pointARecordToPodIp: boolean;
    pointARecordToSharedIp: boolean;
    sharedIp: string | null;

    // Mail DNS
    mxToCentralMail: boolean;
    spfIncludeMail: boolean;
    mailHostname: string;
  };
}

/**
 * Build a provisioning intent for a new Cloud Pod order item.
 *
 * This does NOT talk to Proxmox or DNS – it only creates
 * a structured "todo" document.
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

  const podLabel = `${plan.name} for customer ${item.customerId}`;
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
        bandwidthTb: plan.bandwidthTb,
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
          // You can decide later if every Pod gets its own public IP.
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
// 8) Suggested Prisma schema (comments only) – Pods & Subscriptions
// ============================================================================
//
// model CloudPodPlan {
//   id          String  @id @default(cuid())
//   code        String  @unique   // CLOUD_POD_MINI, etc.
//   serviceKind String  // "CLOUD_POD"
//   // Optional: snapshot of price and resources for reporting.
// }
//
// model CloudPodSubscription {
//   id              String   @id @default(cuid())
//   customerId      String
//   planCode        String   // must match CloudPodPlanCode
//   primaryDomain   String?
//
//   // Proxmox identifiers
//   podVmId         Int?     // VMID or CTID in Proxmox
//   podNodeName     String?
//
//   // Resource snapshot for UI
//   vcpu            Int
//   ramGb           Int
//   diskGb          Int
//
//   backupTierCode  String   // BACKUP_BASIC_7D, etc.
//   emailPlanCode   String   // EMAIL_INCLUDED, etc.
//
//   status          String   // ACTIVE, SUSPENDED, TERMINATED, PROVISIONING
//
//   createdAt       DateTime @default(now())
//   updatedAt       DateTime @updatedAt
// }
//
// model CloudPodEvent {
//   id                String   @id @default(cuid())
//   cloudPodId        String
//   type              String   // CREATED, PROVISION_STARTED, PROVISION_DONE, BACKUP_FAILED, etc.
//   payload           Json?
//   createdAt         DateTime @default(now())
// }
//
// ============================================================================
//
// HOW COPILOT SHOULD USE THIS FILE:
//
// 1) Product Catalog / Pricing Page:
//    - Import { CLOUD_POD_PLANS }.
//    - Show only plans where plan.enabled === true.
//    - Never hardcode vCPU/RAM/disk in UI; always use plan values.
//
// 2) Checkout:
//    - When user picks a Cloud Pod plan, create a CloudPodOrderItem.
//    - Call buildCloudPodProvisioningIntent(orderItem).
//    - Store intent JSON or push to a queue for the provisioning worker.
//
// 3) Provisioning Worker (Node / PHP / Python / Bash):
//    - Read CloudPodProvisioningIntent.
//    - Steps for pod.pod:
//        • Call Proxmox API:
//            - Clone LXC/VM from templateId on nodeName/storage.
//            - Set CPU, RAM, disk according to pod.resources.
//            - Assign hostname (internalHostname) and optionally a public IP.
//        • Inside template bootstrap:
//            - Configure Nginx/PHP/MySQL/Node.js based on pod.stack.
//            - Create default system user for SFTP/SSH if needed.
//        • Configure backups:
//            - Use backupTier.pathPattern with:
//                {root}   = CLOUD_INFRA.backupRootPath
//                {server} = "cloudpods"
//                {podId}  = CloudPodSubscription.id
//            - Set cron/systemd timers according to backupTier.frequency.
//    - Steps for domainConfig (if present):
//        • On dns-core, create zone for primaryDomain.
//        • NS records → ns1Hostname / ns2Hostname.
//        • A record → Pod public IP (once known).
//        • MX → mailHostname if mxToCentralMail.
//        • SPF with include for mailHostname if spfIncludeMail.
//
// 4) Market Positioning (for the marketing site):
//    - We are NOT doing old "shared hosting".
//    - Every client gets an isolated Cloud Pod (container/VM).
//    - Taglines:
//        "Your own private server, at shared hosting prices."
//        "No neighbors. No noise. Just your Pod."
//
// ============================================================================
