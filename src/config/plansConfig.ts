/**
 * Global pricing + plan catalog for MigraHosting.
 *
 * This file is the SINGLE source of truth for all plan
 * definitions used by:
 * - marketing website
 * - mPanel / CloudPods
 * - checkout flows
 *
 * IMPORTANT:
 *  - We NO LONGER offer traditional shared hosting.
 *  - Shared hosting has been replaced by CloudPods.
 *  - Do NOT re-introduce any "shared" family here.
 */

export type BillingInterval = 'monthly' | 'yearly';

export type PlanFamily =
  | 'cloudpods'
  | 'wordpress'
  | 'email'
  | 'vps'
  | 'backup'
  | 'addon';

export interface BasePlan {
  family: PlanFamily;
  code: string;               // unique across all plans
  name: string;
  description?: string;
  priceMonthly: number;       // USD
  priceYearly?: number;       // USD (optional if not offered)
  currency: string;           // "USD"
  isPublic: boolean;          // visible on marketing site
  isFeatured?: boolean;
  sortOrder: number;          // lower = earlier
  features: string[];
  tags?: string[];
}

export interface CloudPodPlan extends BasePlan {
  family: 'cloudpods';
  vcpu: number;
  ramMb: number;
  storageGb: number;
  bandwidthGb?: number | null;   // null = unmetered
}

export interface WordpressHostingPlan extends BasePlan {
  family: 'wordpress';
  sites: number | 'unlimited';
  storageGb: number;
  bandwidth: 'metered' | 'unmetered';
  includesStaging: boolean;
  includesUpdates: boolean;
}

export interface EmailPlan extends BasePlan {
  family: 'email';
  mailboxes: number | 'per-user';
  storagePerMailboxGb?: number;
  customDomain: boolean;
}

export interface VpsPlan extends BasePlan {
  family: 'vps';
  vcpu: number;
  ramMb: number;
  storageGb: number;
  bandwidthTb: number;
}

export interface BackupPlan extends BasePlan {
  family: 'backup';
  storageGb: number;
  redundancy: 'single-region' | 'multi-region';
  isForPods?: boolean;
  isForWebsites?: boolean;
}

export interface AddonPlan extends BasePlan {
  family: 'addon';
  unit?: 'ip' | 'gb' | 'mailbox' | 'domain' | 'slot';
  unitAmount?: number; // e.g. "50" GB, or "1" IP
}

/* ------------------------------------------------------------------ */
/* 1) CloudPods (Cloud VM) Plans – FINAL APPROVED PRICES              */
/* ------------------------------------------------------------------ */

export const CLOUDPOD_PLANS: CloudPodPlan[] = [
  {
    family: 'cloudpods',
    code: 'cloudpods-student',
    name: 'Student',
    description: 'Free dev/testing CloudPod for students and labs.',
    priceMonthly: 0.0,
    priceYearly: 0.0,
    currency: 'USD',
    isPublic: true,
    isFeatured: false,
    sortOrder: 10,
    vcpu: 1,
    ramMb: 1024,
    storageGb: 2,
    bandwidthGb: 50,
    features: [
      '1 vCPU',
      '1GB RAM',
      '2GB NVMe storage',
      '50GB bandwidth',
      'Ideal for practice & labs',
    ],
    tags: ['cloudpods', 'student', 'free'],
  },
  {
    family: 'cloudpods',
    code: 'cloudpods-starter',
    name: 'Starter',
    description: 'Entry-level CloudPod for small apps and dev stacks.',
    priceMonthly: 1.49,
    priceYearly: 1.49 * 12,
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
    vcpu: 1,
    ramMb: 1024,
    storageGb: 30,
    bandwidthGb: null, // Unmetered
    features: [
      '1 vCPU',
      '1GB RAM',
      '30GB NVMe storage',
      'Unmetered bandwidth',
      'Perfect for small websites & APIs',
    ],
    tags: ['cloudpods', 'starter'],
  },
  {
    family: 'cloudpods',
    code: 'cloudpods-premium',
    name: 'Premium',
    description: 'More power for production workloads and growing apps.',
    priceMonthly: 2.49,
    priceYearly: 2.49 * 12,
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 30,
    vcpu: 2,
    ramMb: 2048,
    storageGb: 75,
    bandwidthGb: null,
    features: [
      '2 vCPU',
      '2GB RAM',
      '75GB NVMe storage',
      'Unmetered bandwidth',
      'Great for busy sites & app stacks',
    ],
    tags: ['cloudpods', 'premium', 'recommended'],
  },
  {
    family: 'cloudpods',
    code: 'cloudpods-business',
    name: 'Business',
    description: 'High value CloudPod for agencies and small businesses.',
    priceMonthly: 3.99,
    priceYearly: 3.99 * 12,
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 40,
    vcpu: 3,
    ramMb: 4096,
    storageGb: 100,
    bandwidthGb: null,
    features: [
      '3 vCPU',
      '4GB RAM',
      '100GB NVMe storage',
      'Unmetered bandwidth',
      'Ideal for business-critical workloads',
    ],
    tags: ['cloudpods', 'business'],
  },
];

/* ------------------------------------------------------------------ */
/* 2) WordPress Hosting Plans – PLACEHOLDER PRICES                    */
/* ------------------------------------------------------------------ */

export const WORDPRESS_PLANS: WordpressHostingPlan[] = [
  {
    family: 'wordpress',
    code: 'wp-starter',
    name: 'WP Starter',
    description: 'Managed WordPress for a single site.',
    priceMonthly: 3.99, // TODO: sync with marketing site
    priceYearly: 3.49 * 12, // TODO: adjust
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 10,
    sites: 1,
    storageGb: 20,
    bandwidth: 'unmetered',
    includesStaging: false,
    includesUpdates: true,
    features: [
      '1 WordPress site',
      '20GB NVMe storage',
      'Unmetered bandwidth',
      'Automatic WordPress updates',
      'Free SSL',
    ],
    tags: ['wordpress', 'starter'],
  },
  {
    family: 'wordpress',
    code: 'wp-growth',
    name: 'WP Growth',
    description: 'For growing blogs and business sites.',
    priceMonthly: 6.99, // TODO: sync
    priceYearly: 6.49 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
    sites: 3,
    storageGb: 40,
    bandwidth: 'unmetered',
    includesStaging: true,
    includesUpdates: true,
    features: [
      'Up to 3 WordPress sites',
      '40GB NVMe storage',
      'Unmetered bandwidth',
      'Staging environments',
      'Daily backups',
    ],
    tags: ['wordpress', 'growth'],
  },
  {
    family: 'wordpress',
    code: 'wp-agency',
    name: 'WP Agency',
    description: 'Managed WordPress hosting for agencies.',
    priceMonthly: 11.99, // TODO: sync
    priceYearly: 10.99 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 30,
    sites: 'unlimited',
    storageGb: 80,
    bandwidth: 'unmetered',
    includesStaging: true,
    includesUpdates: true,
    features: [
      'Unlimited WordPress sites',
      '80GB NVMe storage',
      'Unmetered bandwidth',
      'Staging for every site',
      'Advanced security & WAF',
    ],
    tags: ['wordpress', 'agency'],
  },
];

/* ------------------------------------------------------------------ */
/* 3) Email Hosting Plans – PLACEHOLDER PRICES                        */
/* ------------------------------------------------------------------ */

export const EMAIL_PLANS: EmailPlan[] = [
  {
    family: 'email',
    code: 'email-basic',
    name: 'Email Basic',
    description: 'Professional email for small teams.',
    priceMonthly: 1.99, // TODO: sync
    priceYearly: 1.79 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 10,
    mailboxes: 10,
    storagePerMailboxGb: 5,
    customDomain: true,
    features: [
      'Up to 10 mailboxes',
      '5GB per mailbox',
      'Custom domain support',
      'Webmail + IMAP/SMTP',
      'Spam and virus protection',
    ],
    tags: ['email'],
  },
  {
    family: 'email',
    code: 'email-business',
    name: 'Email Business',
    description: 'Scalable email for growing businesses.',
    priceMonthly: 3.99, // TODO: sync
    priceYearly: 3.59 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
    mailboxes: 50,
    storagePerMailboxGb: 10,
    customDomain: true,
    features: [
      'Up to 50 mailboxes',
      '10GB per mailbox',
      'Mobile & desktop sync',
      'Advanced spam filtering',
    ],
    tags: ['email', 'business'],
  },
  {
    family: 'email',
    code: 'email-enterprise',
    name: 'Email Enterprise',
    description: 'Custom mailbox counts and storage.',
    priceMonthly: 0, // custom quote
    priceYearly: 0,
    currency: 'USD',
    isPublic: false, // sales only
    isFeatured: false,
    sortOrder: 30,
    mailboxes: 'per-user',
    storagePerMailboxGb: 25,
    customDomain: true,
    features: [
      'Per-user pricing',
      'Up to 25GB per mailbox',
      'Priority support',
      'Custom migration assistance',
    ],
    tags: ['email', 'enterprise'],
  },
];

/* ------------------------------------------------------------------ */
/* 4) VPS Plans – PLACEHOLDER PRICES                                  */
/* ------------------------------------------------------------------ */

export const VPS_PLANS: VpsPlan[] = [
  {
    family: 'vps',
    code: 'vps-1',
    name: 'VPS 1',
    description: 'Entry-level VPS for light workloads.',
    priceMonthly: 4.99, // TODO: sync
    priceYearly: 4.49 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 10,
    vcpu: 1,
    ramMb: 2048,
    storageGb: 40,
    bandwidthTb: 1,
    features: [
      '1 vCPU',
      '2GB RAM',
      '40GB NVMe storage',
      '1TB traffic',
      'Full root access',
    ],
    tags: ['vps'],
  },
  {
    family: 'vps',
    code: 'vps-2',
    name: 'VPS 2',
    description: 'Balanced VPS for production workloads.',
    priceMonthly: 8.99, // TODO: sync
    priceYearly: 8.49 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
    vcpu: 2,
    ramMb: 4096,
    storageGb: 80,
    bandwidthTb: 2,
    features: [
      '2 vCPU',
      '4GB RAM',
      '80GB NVMe storage',
      '2TB traffic',
      'Full root access',
    ],
    tags: ['vps'],
  },
  {
    family: 'vps',
    code: 'vps-3',
    name: 'VPS 3',
    description: 'High-performance VPS for agencies & apps.',
    priceMonthly: 14.99, // TODO: sync
    priceYearly: 13.99 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 30,
    vcpu: 4,
    ramMb: 8192,
    storageGb: 160,
    bandwidthTb: 3,
    features: [
      '4 vCPU',
      '8GB RAM',
      '160GB NVMe storage',
      '3TB traffic',
      'Priority support',
    ],
    tags: ['vps', 'business'],
  },
];

/* ------------------------------------------------------------------ */
/* 5) Cloud Backup / Storage Plans – PLACEHOLDER PRICES               */
/* ------------------------------------------------------------------ */

export const BACKUP_PLANS: BackupPlan[] = [
  {
    family: 'backup',
    code: 'backup-100',
    name: 'Cloud Backup 100GB',
    description: 'Off-site backup storage for websites & CloudPods.',
    priceMonthly: 2.99, // TODO: sync
    priceYearly: 2.79 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 10,
    storageGb: 100,
    redundancy: 'single-region',
    isForPods: true,
    isForWebsites: true,
    features: [
      '100GB backup storage',
      'Daily snapshots',
      'Off-site protection',
    ],
    tags: ['backup', 'storage'],
  },
  {
    family: 'backup',
    code: 'backup-500',
    name: 'Cloud Backup 500GB',
    description: 'Larger backup pool for agencies & resellers.',
    priceMonthly: 6.99, // TODO: sync
    priceYearly: 6.49 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 20,
    storageGb: 500,
    redundancy: 'single-region',
    isForPods: true,
    isForWebsites: true,
    features: [
      '500GB backup storage',
      'Daily snapshots',
      'File & database backups',
    ],
    tags: ['backup', 'agency'],
  },
  {
    family: 'backup',
    code: 'backup-1tb-multi',
    name: 'Cloud Backup 1TB Multi-Region',
    description: 'Redundant backup storage across regions.',
    priceMonthly: 14.99, // TODO: sync
    priceYearly: 13.99 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: true,
    sortOrder: 30,
    storageGb: 1024,
    redundancy: 'multi-region',
    isForPods: true,
    isForWebsites: true,
    features: [
      '1TB backup storage',
      'Multi-region redundancy',
      'Ideal for mission-critical data',
    ],
    tags: ['backup', 'enterprise'],
  },
];

/* ------------------------------------------------------------------ */
/* 6) Add-ons – IPs, extra storage, etc. – PLACEHOLDER PRICES         */
/* ------------------------------------------------------------------ */

export const ADDON_PLANS: AddonPlan[] = [
  {
    family: 'addon',
    code: 'addon-ipv4',
    name: 'Additional IPv4',
    description: 'Extra dedicated IPv4 address for your server or CloudPod.',
    priceMonthly: 1.49, // TODO: sync
    priceYearly: 1.49 * 12,
    currency: 'USD',
    isPublic: true,
    isFeatured: false,
    sortOrder: 10,
    unit: 'ip',
    unitAmount: 1,
    features: ['1 additional IPv4 address'],
    tags: ['addon', 'network'],
  },
  {
    family: 'addon',
    code: 'addon-storage-50',
    name: 'Extra 50GB Storage',
    description: 'Add 50GB NVMe storage to your plan.',
    priceMonthly: 1.99, // TODO: sync
    priceYearly: 1.79 * 12, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: false,
    sortOrder: 20,
    unit: 'gb',
    unitAmount: 50,
    features: ['Additional 50GB NVMe storage'],
    tags: ['addon', 'storage'],
  },
  {
    family: 'addon',
    code: 'addon-mailbox',
    name: 'Extra Mailbox',
    description: 'Add an extra mailbox to your email plan.',
    priceMonthly: 0.5, // TODO: sync
    priceYearly: 0.5 * 12,
    currency: 'USD',
    isPublic: true,
    isFeatured: false,
    sortOrder: 30,
    unit: 'mailbox',
    unitAmount: 1,
    features: ['1 extra mailbox'],
    tags: ['addon', 'email'],
  },
  {
    family: 'addon',
    code: 'addon-ssl',
    name: 'Premium SSL Certificate',
    description: 'Paid SSL for advanced validation or special use cases.',
    priceMonthly: 3.99, // TODO: sync or convert to yearly-only
    priceYearly: 39.99, // TODO: sync
    currency: 'USD',
    isPublic: true,
    isFeatured: false,
    sortOrder: 40,
    features: ['Premium SSL certificate', 'Advanced validation'],
    tags: ['addon', 'ssl'],
  },
];

/* ------------------------------------------------------------------ */
/* Aggregated helpers                                                 */
/* ------------------------------------------------------------------ */

export const ALL_PLANS: BasePlan[] = [
  ...CLOUDPOD_PLANS,
  ...WORDPRESS_PLANS,
  ...EMAIL_PLANS,
  ...VPS_PLANS,
  ...BACKUP_PLANS,
  ...ADDON_PLANS,
];

export const PLAN_BY_CODE: Record<string, BasePlan> = ALL_PLANS.reduce(
  (acc, plan) => {
    acc[plan.code] = plan;
    return acc;
  },
  {} as Record<string, BasePlan>,
);

export function getPlanByCode<T extends BasePlan = BasePlan>(
  code: string,
): T | undefined {
  return PLAN_BY_CODE[code] as T | undefined;
}
