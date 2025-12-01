// src/config/addons.js
// ============================================================================
// mPanel Add-ons – Single Source of Truth (JavaScript version)
// ============================================================================
// This file defines:
//
//  1) The full add-on catalog (names, prices, billing)
//  2) Helper functions for UI, billing & validation
//  3) Provisioning "intent" flags for backend workers
//
//  IMPORTANT (for Copilot & future devs):
//  - Do NOT hardcode add-on prices, names, or billing anywhere else.
//  - ALWAYS import from this file when working with add-ons.
//  - If you add or change an add-on, update the catalog here first.
// ============================================================================

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

export const ADDONS_BY_CODE = {
  ADDON_PREMIUM_SSL: {
    code: 'ADDON_PREMIUM_SSL',
    name: 'Premium SSL',
    description:
      'Premium SSL certificate with managed renewals and site seal for one domain.',
    price: 9.99,
    billingPeriod: 'YEARLY',
    applicableTo: ['DOMAIN'],
    stackable: false,
    maxUnits: null,
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
    maxUnits: null,
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
    maxUnits: null,
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
    maxUnits: 10,
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
    maxUnits: null,
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
    maxUnits: null,
    provisioning: {
      enableMonitoring: true,
    },
  },
};

// Easier list form for UI, seeding DB, etc.
export const ADDONS = Object.values(ADDONS_BY_CODE);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get full add-on config by code.
 * Throws if the code is invalid.
 */
export function getAddon(code) {
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
export function isAddonApplicableTo(addonCode, targetType) {
  const addon = getAddon(addonCode);
  return addon.applicableTo.includes(targetType);
}

/**
 * Returns true if this add-on allows multiple units (stacking).
 */
export function isAddonStackable(addonCode) {
  return getAddon(addonCode).stackable;
}

/**
 * Returns the maximum units allowed for this add-on.
 * If null/undefined, treat as "no explicit limit" for stackable add-ons.
 */
export function getAddonMaxUnits(addonCode) {
  return getAddon(addonCode).maxUnits;
}

/**
 * Calculate total monthly and yearly recurring cost for a set of selected add-ons.
 * @param {Array<{code: string, units: number}>} selected
 * @returns {{monthlyTotal: number, yearlyTotal: number}}
 */
export function calculateAddonRecurringTotals(selected) {
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
 * @param {Array<{code: string, units: number}>} selected
 * @param {'HOSTING' | 'VPS' | 'DOMAIN'} targetType
 * @returns {string[]} Array of error messages. Empty = OK.
 */
export function validateSelectedAddons(selected, targetType) {
  const errors = [];

  for (const item of selected) {
    const addon = getAddon(item.code);
    const units = item.units ?? 1;

    if (!isAddonApplicableTo(addon.code, targetType)) {
      errors.push(
        `Add-on ${addon.code} cannot be attached to target type ${targetType}.`
      );
      continue;
    }

    if (units < 1) {
      errors.push(`Add-on ${addon.code} must have at least 1 unit.`);
      continue;
    }

    if (!addon.stackable && units !== 1) {
      errors.push(
        `Add-on ${addon.code} is not stackable and must have exactly 1 unit.`
      );
      continue;
    }

    if (addon.stackable && addon.maxUnits != null && units > addon.maxUnits) {
      errors.push(
        `Add-on ${addon.code} allows at most ${addon.maxUnits} units (requested ${units}).`
      );
    }
  }

  return errors;
}

/**
 * Split selected add-ons into monthly and yearly lists.
 * @param {Array<{code: string, units: number}>} selected
 * @returns {{monthly: Array, yearly: Array}}
 */
export function splitAddonsByBillingPeriod(selected) {
  const monthly = [];
  const yearly = [];

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

/**
 * Get add-ons applicable to a specific target type.
 * @param {'HOSTING' | 'VPS' | 'DOMAIN'} targetType
 * @returns {Array}
 */
export function getAddonsForTargetType(targetType) {
  return ADDONS.filter(addon => addon.applicableTo.includes(targetType));
}

export default {
  ADDONS,
  ADDONS_BY_CODE,
  getAddon,
  isAddonApplicableTo,
  isAddonStackable,
  getAddonMaxUnits,
  calculateAddonRecurringTotals,
  validateSelectedAddons,
  splitAddonsByBillingPeriod,
  getAddonsForTargetType,
};
