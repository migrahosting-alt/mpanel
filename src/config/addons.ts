// apps/api/src/config/addons.ts
// ============================================================================
// mPanel Add-ons – Single Source of Truth
// ============================================================================
// This file defines:
//
//  1) Types for add-ons and billing
//  2) The full add-on catalog (names, prices, billing)
//  3) Helper functions for UI, billing & validation
//  4) Provisioning "intent" flags for backend workers
//  5) Suggested database schema (Prisma) as comments
//
//  IMPORTANT (for Copilot & future devs):
//  - Do NOT hardcode add-on prices, names, or billing anywhere else.
//  - ALWAYS import from this file when working with add-ons.
//  - If you add or change an add-on, update the catalog here first.
// ============================================================================

/**
 * Billing frequency for an add-on.
 *
 * - MONTHLY: billed each month with the parent subscription
 * - YEARLY: billed once per year (e.g. Premium SSL)
 */
export type BillingPeriod = 'MONTHLY' | 'YEARLY';

/**
 * What kind of "parent" a given add-on can attach to.
 *
 * HOSTING  – shared hosting subscription on srv1-web
 * VPS      – VPS subscription on Proxmox
 * DOMAIN   – domain registration (e.g. Premium SSL)
 */
export type AddonTargetType = 'HOSTING' | 'VPS' | 'DOMAIN';

/**
 * Definition of an add-on in the catalog.
 */
export interface AddonDefinition {
  /** Unique internal code, used in DB & API (stable identifier). */
  code: string;

  /** Human-friendly name to show in UI. */
  name: string;

  /** Short description for UI / tooltips. */
  description: string;

  /** Price in USD for one billing period (monthly or yearly). */
  price: number;

  /** How often this add-on is billed. */
  billingPeriod: BillingPeriod;

  /**
   * Where this add-on can be attached:
   * - HOSTING (shared hosting subscription)
   * - VPS (VPS subscription)
   * - DOMAIN (domain registration / DNS)
   */
  applicableTo: AddonTargetType[];

  /** Can the customer buy multiple units (stacking)? */
  stackable: boolean;

  /**
   * Optional max units when stackable = true.
   * If undefined/null, treat as "no explicit hard limit".
   */
  maxUnits?: number | null;
}

/**
 * Provisioning behavior flags – what the system should *do* if this add-on
 * is active on a given subscription or domain.
 *
 * These flags are not stored in the DB directly – they are hints for
 * provisioning workers and scripts.
 */
export interface AddonProvisioningIntent {
  /** If true, enable premium SSL management for the domain. */
  enablePremiumSsl?: boolean;

  /** If true, upgrade backup retention to 30 days for this service. */
  enablePremiumBackups30d?: boolean;

  /** If true, mark tenant/account as priority support. */
  enablePrioritySupport?: boolean;

  /** Number of extra GB of storage per unit of this add-on. */
  extraStorageGbPerUnit?: number;

  /** If true, enable CDN for the primary domain. */
  enableCdn?: boolean;

  /** If true, enable uptime monitoring + alerts. */
  enableMonitoring?: boolean;
}

/**
 * Combined view of an add-on: static catalog definition + provisioning intent.
 * Use this when deciding what to actually do on the server.
 */
export interface AddonConfig extends AddonDefinition {
  provisioning: AddonProvisioningIntent;
}

// ============================================================================
// Add-ons Catalog
// ============================================================================
// IMPORTANT BUSINESS RULES:
//
// - Premium SSL (ADDON_PREMIUM_SSL)
//     • Price: 9.99 / YEARLY
//     • Attached to: DOMAIN
//     • Behavior: managed premium SSL (paid/managed cert) for one domain.
//
// - Daily Backups (ADDON_DAILY_BACKUPS)
//     • Price: 4.99 / MONTHLY
//     • Attached to: HOSTING or VPS
//     • Behavior: 30-day retention with off-server storage.
//
// - Priority Support (ADDON_PRIORITY_SUPPORT)
//     • Price: 19.99 / MONTHLY
//     • Attached to: HOSTING or VPS
//     • Behavior: higher SLA, priority routing.
//
// - 100GB Storage (ADDON_100GB_STORAGE)
//     • Price: 7.99 / MONTHLY
//     • Attached to: HOSTING or VPS
//     • Behavior: each unit = +100GB storage quota.
//
// - CDN (ADDON_CDN)
//     • Price: 5.99 / MONTHLY
//     • Attached to: HOSTING or VPS
//     • Behavior: enable CDN for primary domain.
//
// - Monitoring (ADDON_MONITORING)
//     • Price: 3.99 / MONTHLY
//     • Attached to: HOSTING or VPS
//     • Behavior: uptime & health checks + alerts.
// ============================================================================

export const ADDONS_BY_CODE: Record<string, AddonConfig> = {
  ADDON_PREMIUM_SSL: {
    code: 'ADDON_PREMIUM_SSL',
    name: 'Premium SSL',
    description:
      'Premium SSL certificate with managed renewals and site seal for one domain.',
    price: 9.99,
    billingPeriod: 'YEARLY',
    applicableTo: ['DOMAIN'],
    stackable: false, // one Premium SSL per domain
    provisioning: {
      enablePremiumSsl: true,
    },
  },

  ADDON_DAILY_BACKUPS: {
    code: 'ADDON_DAILY_BACKUPS',
    name: 'Daily Backups',
    description:
      'Automatic daily backups with 30-day retention for your hosting or VPS service.',
    price: 4.99,
    billingPeriod: 'MONTHLY',
    applicableTo: ['HOSTING', 'VPS'],
    stackable: false,
    provisioning: {
      enablePremiumBackups30d: true,
    },
  },

  ADDON_PRIORITY_SUPPORT: {
    code: 'ADDON_PRIORITY_SUPPORT',
    name: 'Priority Support',
    description:
      'Jump the queue with priority support and faster response SLAs.',
    price: 19.99,
    billingPeriod: 'MONTHLY',
    applicableTo: ['HOSTING', 'VPS'],
    stackable: false,
    provisioning: {
      enablePrioritySupport: true,
    },
  },

  ADDON_100GB_STORAGE: {
    code: 'ADDON_100GB_STORAGE',
    name: '100GB Storage',
    description:
      'Extra 100GB of premium SSD storage on top of your base plan quota.',
    price: 7.99,
    billingPeriod: 'MONTHLY',
    applicableTo: ['HOSTING', 'VPS'],
    stackable: true,
    maxUnits: 10, // up to +1TB; change if the offer changes
    provisioning: {
      extraStorageGbPerUnit: 100,
    },
  },

  ADDON_CDN: {
    code: 'ADDON_CDN',
    name: 'CDN',
    description:
      'CDN acceleration for the primary domain on this hosting or VPS service.',
    price: 5.99,
    billingPeriod: 'MONTHLY',
    applicableTo: ['HOSTING', 'VPS'],
    stackable: false,
    provisioning: {
      enableCdn: true,
    },
  },

  ADDON_MONITORING: {
    code: 'ADDON_MONITORING',
    name: 'Monitoring',
    description:
      '24/7 uptime monitoring with instant alerts via email (and later SMS/WhatsApp).',
    price: 3.99,
    billingPeriod: 'MONTHLY',
    applicableTo: ['HOSTING', 'VPS'],
    stackable: false,
    provisioning: {
      enableMonitoring: true,
    },
  },
};

// Easier list form for UI, seeding DB, etc.
export const ADDONS: AddonConfig[] = Object.values(ADDONS_BY_CODE);

// ============================================================================
// Helper Functions – for Copilot & All Call Sites
// ============================================================================

/**
 * Get full add-on config by code.
 * Throws in dev if the code is invalid, so bugs fail fast.
 */
export function getAddon(code: string): AddonConfig {
  const addon = ADDONS_BY_CODE[code];
  if (!addon) {
    throw new Error(`Unknown addon code: ${code}`);
  }
  return addon;
}

/**
 * Check if the add-on can be attached to a given target type
 * (HOSTING, VPS, or DOMAIN).
 */
export function isAddonApplicableTo(
  addonCode: string,
  targetType: AddonTargetType,
): boolean {
  const addon = getAddon(addonCode);
  return addon.applicableTo.includes(targetType);
}

/**
 * Returns true if this add-on allows multiple units (stacking).
 */
export function isAddonStackable(addonCode: string): boolean {
  return getAddon(addonCode).stackable;
}

/**
 * Returns the maximum units allowed for this add-on.
 * If undefined/null, treat as "no explicit limit" for stackable add-ons.
 */
export function getAddonMaxUnits(addonCode: string): number | null | undefined {
  return getAddon(addonCode).maxUnits;
}

/**
 * Utility type for selections in cart/checkout.
 */
export interface SelectedAddon {
  code: string;
  units: number; // must be >= 1
}

/**
 * Calculate total monthly and yearly recurring cost for a set of selected
 * add-ons. This is useful for cart/checkout UI and invoices.
 *
 * NOTE:
 * - MONTHLY add-ons contribute to `monthlyTotal`.
 * - YEARLY add-ons contribute to `yearlyTotal`.
 */
export function calculateAddonRecurringTotals(
  selected: SelectedAddon[],
): { monthlyTotal: number; yearlyTotal: number } {
  let monthlyTotal = 0;
  let yearlyTotal = 0;

  for (const item of selected) {
    const addon = getAddon(item.code);
    const units = Math.max(1, item.units || 1);

    if (addon.billingPeriod === 'MONTHLY') {
      monthlyTotal += addon.price * units;
    } else if (addon.billingPeriod === 'YEARLY') {
      yearlyTotal += addon.price * units;
    }
  }

  return { monthlyTotal, yearlyTotal };
}

/**
 * Validate a set of selected add-ons for a given parent target type.
 *
 * Rules enforced:
 * - The add-on must support the target type.
 * - units >= 1.
 * - If non-stackable, units must be 1.
 * - If stackable and maxUnits is set, units <= maxUnits.
 *
 * Returns an array of error messages. Empty array means OK.
 */
export function validateSelectedAddons(
  selected: SelectedAddon[],
  targetType: AddonTargetType,
): string[] {
  const errors: string[] = [];

  for (const item of selected) {
    const addon = getAddon(item.code);
    const units = item.units ?? 1;

    if (!isAddonApplicableTo(addon.code, targetType)) {
      errors.push(
        `Add-on ${addon.code} cannot be attached to target type ${targetType}.`,
      );
      continue;
    }

    if (units < 1) {
      errors.push(`Add-on ${addon.code} must have at least 1 unit.`);
      continue;
    }

    if (!addon.stackable && units !== 1) {
      errors.push(
        `Add-on ${addon.code} is not stackable and must have exactly 1 unit.`,
      );
      continue;
    }

    if (addon.stackable && addon.maxUnits != null && units > addon.maxUnits) {
      errors.push(
        `Add-on ${addon.code} allows at most ${addon.maxUnits} units (requested ${units}).`,
      );
    }
  }

  return errors;
}

/**
 * Convenience helper to split selected add-ons into:
 * - monthly recurring list
 * - yearly recurring list
 *
 * Useful when rendering invoice summaries or payment schedule breakdowns.
 */
export function splitAddonsByBillingPeriod(
  selected: SelectedAddon[],
): {
  monthly: { addon: AddonConfig; units: number }[];
  yearly: { addon: AddonConfig; units: number }[];
} {
  const monthly: { addon: AddonConfig; units: number }[] = [];
  const yearly: { addon: AddonConfig; units: number }[] = [];

  for (const item of selected) {
    const addon = getAddon(item.code);
    const units = Math.max(1, item.units || 1);

    if (addon.billingPeriod === 'MONTHLY') {
      monthly.push({ addon, units });
    } else {
      yearly.push({ addon, units });
    }
  }

  return { monthly, yearly };
}

// ============================================================================
// Suggested Database Schema (Prisma-style) – COMMENTS ONLY
// ============================================================================
//
// Put this in your schema.prisma, adjust names/relations to your setup.
// This is here so Copilot always "sees" it and stays consistent.
//
// model Subscription {
//   id              String              @id @default(cuid())
//   customerId      String
//   targetType      String              // 'HOSTING' | 'VPS' | ...
//   // ... other fields ...
//
//   addons          SubscriptionAddon[]
// }
//
// model SubscriptionAddon {
//   id              String         @id @default(cuid())
//
//   subscription    Subscription   @relation(fields: [subscriptionId], references: [id])
//   subscriptionId  String
//
//   // Must match one of the codes in ADDONS_BY_CODE
//   addonCode       String
//
//   // Number of units purchased (>=1)
//   units           Int            @default(1)
//
//   // Price snapshot at time of purchase, NOT auto-updated if catalog changes
//   unitPriceUsd    Decimal        @db.Decimal(10, 2)
//
//   // Billing period for this add-on (MONTHLY or YEARLY)
//   billingPeriod   String
//
//   // Next billing date for this add-on
//   nextBillingDate DateTime
//
//   createdAt       DateTime       @default(now())
//   updatedAt       DateTime       @updatedAt
// }
//
// model DomainRegistration {
//   id              String              @id @default(cuid())
//   domainName      String              @unique
//   // ...
//
//   premiumSslAddon SubscriptionAddon?  @relation("PremiumSslAddon", fields: [premiumSslAddonId], references: [id])
//   premiumSslAddonId String?
// }
//
// ============================================================================
//
// Usage Notes (for Copilot & devs):
//
// 1) Checkout / Cart:
//    - Import { ADDONS } and filter by applicableTo & stackable.
//    - Use validateSelectedAddons(...) before creating a subscription.
//
// 2) Billing / Invoicing:
//    - Use calculateAddonRecurringTotals(...) + splitAddonsByBillingPeriod(...)
//      to show correct monthly/yearly breakdowns.
//
// 3) Provisioning Workers:
//    - For each active SubscriptionAddon, call getAddon(addonCode) and inspect
//      the `.provisioning` flags to decide what to do on the servers.
//
// 4) Adding New Add-ons:
//    - Add a new entry to ADDONS_BY_CODE with:
//        • unique code
//        • price & billingPeriod
//        • applicableTo
//        • provisioning flags
//    - Adjust UI and provisioning workers only if new behavior is needed.
//
// ============================================================================
