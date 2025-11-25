/**
 * Single Source of Truth for MigraHosting Pricing (Backend)
 * 
 * This is the JavaScript version of pricing-config.ts for backend use.
 * All product pricing, plans, addons, and coupons are defined here.
 * No backend code should hardcode prices - everything reads from this file.
 */

// ============================================================================
// HOSTING PLANS
// ============================================================================

const HOSTING_PLANS = [
  {
    id: 'hosting-starter',
    slug: 'starter',
    productType: 'hosting',
    name: 'Starter',
    description: 'Perfect for personal websites and blogs',
    features: [
      '1 Website',
      '10 GB SSD Storage',
      'Unmetered Bandwidth',
      'Free SSL Certificate',
      'Daily Backups',
      '24/7 Support',
      '99.9% Uptime Guarantee',
    ],
    basePrice: {
      monthly: 7.95,
      yearly: 79.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: false,
  },
  {
    id: 'hosting-pro',
    slug: 'pro',
    productType: 'hosting',
    name: 'Pro',
    description: 'Ideal for growing businesses',
    features: [
      '5 Websites',
      '50 GB SSD Storage',
      'Unmetered Bandwidth',
      'Free SSL Certificates',
      'Daily Backups',
      'Priority Support',
      '99.9% Uptime Guarantee',
      'Free Domain for 1 Year',
    ],
    basePrice: {
      monthly: 14.95,
      yearly: 149.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-priority-support'],
    popular: true,
  },
  {
    id: 'hosting-business',
    slug: 'business',
    productType: 'hosting',
    name: 'Business',
    description: 'For high-traffic websites',
    features: [
      'Unlimited Websites',
      '100 GB SSD Storage',
      'Unmetered Bandwidth',
      'Free SSL Certificates',
      'Hourly Backups',
      'Premium Support',
      '99.99% Uptime Guarantee',
      'Free Domain for 1 Year',
      'Dedicated IP',
      'Advanced Security',
    ],
    basePrice: {
      monthly: 29.95,
      yearly: 299.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-priority-support', 'addon-advanced-security'],
    popular: false,
  },
];

// ============================================================================
// WORDPRESS PLANS
// ============================================================================

const WORDPRESS_PLANS = [
  {
    id: 'wordpress-starter',
    slug: 'wp-starter',
    productType: 'wordpress',
    name: 'WP Starter',
    description: 'Optimized for WordPress blogs',
    features: [
      '1 WordPress Site',
      '20 GB SSD Storage',
      'WordPress Auto-Updates',
      'Free SSL Certificate',
      'Daily Backups',
      'WordPress Support',
      '99.9% Uptime',
      'WP-CLI Access',
    ],
    basePrice: {
      monthly: 9.95,
      yearly: 99.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: false,
  },
  {
    id: 'wordpress-pro',
    slug: 'wp-pro',
    productType: 'wordpress',
    name: 'WP Pro',
    description: 'For professional WordPress sites',
    features: [
      '3 WordPress Sites',
      '50 GB SSD Storage',
      'WordPress Auto-Updates',
      'Free SSL Certificates',
      'Hourly Backups',
      'WordPress Expert Support',
      '99.9% Uptime',
      'WP-CLI Access',
      'Staging Environment',
      'CDN Integration',
    ],
    basePrice: {
      monthly: 19.95,
      yearly: 199.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-wp-staging'],
    popular: true,
  },
  {
    id: 'wordpress-business',
    slug: 'wp-business',
    productType: 'wordpress',
    name: 'WP Business',
    description: 'Enterprise WordPress hosting',
    features: [
      'Unlimited WordPress Sites',
      '100 GB SSD Storage',
      'WordPress Auto-Updates',
      'Free SSL Certificates',
      'Real-time Backups',
      '24/7 WordPress Expert Support',
      '99.99% Uptime',
      'WP-CLI Access',
      'Multiple Staging Environments',
      'CDN Integration',
      'Advanced Caching',
      'Malware Scanning',
    ],
    basePrice: {
      monthly: 39.95,
      yearly: 399.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-wp-staging', 'addon-advanced-security'],
    popular: false,
  },
];

// ============================================================================
// CLOUD STORAGE PLANS
// ============================================================================

const CLOUD_STORAGE_PLANS = [
  {
    id: 'storage-basic',
    slug: 'storage-basic',
    productType: 'cloud-storage',
    name: 'Basic Storage',
    description: 'Essential cloud storage',
    features: [
      '100 GB Storage',
      'File Versioning',
      'Web Access',
      'Mobile Apps',
      'Share Links',
      '99.9% Uptime',
    ],
    basePrice: {
      monthly: 4.95,
      yearly: 49.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: false,
  },
  {
    id: 'storage-pro',
    slug: 'storage-pro',
    productType: 'cloud-storage',
    name: 'Pro Storage',
    description: 'Advanced storage features',
    features: [
      '500 GB Storage',
      'File Versioning (30 days)',
      'Web Access',
      'Mobile Apps',
      'Share Links',
      'Team Collaboration',
      'Advanced Search',
      '99.9% Uptime',
    ],
    basePrice: {
      monthly: 9.95,
      yearly: 99.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: true,
  },
  {
    id: 'storage-business',
    slug: 'storage-business',
    productType: 'cloud-storage',
    name: 'Business Storage',
    description: 'Enterprise storage solution',
    features: [
      '2 TB Storage',
      'Unlimited File Versioning',
      'Web Access',
      'Mobile Apps',
      'Share Links',
      'Team Collaboration',
      'Advanced Search',
      'Admin Controls',
      'Audit Logs',
      '99.99% Uptime',
    ],
    basePrice: {
      monthly: 19.95,
      yearly: 199.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-team-collaboration'],
    popular: false,
  },
];

// ============================================================================
// CLOUD BACKUP PLANS
// ============================================================================

const CLOUD_BACKUP_PLANS = [
  {
    id: 'backup-essential',
    slug: 'backup-essential',
    productType: 'cloud-backup',
    name: 'Essential Backup',
    description: 'Basic backup protection',
    features: [
      '50 GB Backup Storage',
      'Daily Backups',
      '7-Day Retention',
      'Web Restore',
      'Email Notifications',
      '99.9% Uptime',
    ],
    basePrice: {
      monthly: 3.95,
      yearly: 39.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: false,
  },
  {
    id: 'backup-pro',
    slug: 'backup-pro',
    productType: 'cloud-backup',
    name: 'Pro Backup',
    description: 'Advanced backup solution',
    features: [
      '200 GB Backup Storage',
      'Hourly Backups',
      '30-Day Retention',
      'Web & CLI Restore',
      'Email Notifications',
      'Point-in-Time Recovery',
      '99.9% Uptime',
    ],
    basePrice: {
      monthly: 7.95,
      yearly: 79.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: [],
    popular: true,
  },
  {
    id: 'backup-business',
    slug: 'backup-business',
    productType: 'cloud-backup',
    name: 'Business Backup',
    description: 'Enterprise backup & disaster recovery',
    features: [
      '1 TB Backup Storage',
      'Real-time Backups',
      '90-Day Retention',
      'Web & CLI Restore',
      'Email & SMS Notifications',
      'Point-in-Time Recovery',
      'Disaster Recovery Plan',
      'Compliance Reports',
      '99.99% Uptime',
    ],
    basePrice: {
      monthly: 14.95,
      yearly: 149.50,
    },
    trialEnabled: true,
    trialDays: 14,
    defaultAddons: ['addon-disaster-recovery'],
    popular: false,
  },
];

// ============================================================================
// ALL PLANS (Combined)
// ============================================================================

const PLANS = [
  ...HOSTING_PLANS,
  ...WORDPRESS_PLANS,
  ...CLOUD_STORAGE_PLANS,
  ...CLOUD_BACKUP_PLANS,
];

// ============================================================================
// ADDONS
// ============================================================================

const ADDONS = [
  {
    id: 'addon-priority-support',
    name: 'Priority Support',
    description: '24/7 priority ticket response within 1 hour',
    price: {
      monthly: 4.95,
      yearly: 49.50,
    },
    appliesTo: ['hosting', 'wordpress'],
  },
  {
    id: 'addon-advanced-security',
    name: 'Advanced Security Suite',
    description: 'Malware scanning, firewall, and DDoS protection',
    price: {
      monthly: 9.95,
      yearly: 99.50,
    },
    appliesTo: ['hosting', 'wordpress'],
  },
  {
    id: 'addon-extra-backups',
    name: 'Extended Backup Retention',
    description: 'Increase backup retention to 90 days',
    price: {
      monthly: 5.95,
      yearly: 59.50,
    },
    appliesTo: ['hosting', 'wordpress', 'cloud-backup'],
  },
  {
    id: 'addon-wp-staging',
    name: 'WordPress Staging',
    description: 'Create staging environments for testing',
    price: {
      monthly: 3.95,
      yearly: 39.50,
    },
    appliesTo: ['wordpress'],
  },
  {
    id: 'addon-team-collaboration',
    name: 'Team Collaboration Tools',
    description: 'Advanced sharing, permissions, and team management',
    price: {
      monthly: 6.95,
      yearly: 69.50,
    },
    appliesTo: ['cloud-storage'],
  },
  {
    id: 'addon-disaster-recovery',
    name: 'Disaster Recovery Plan',
    description: 'Complete disaster recovery documentation and testing',
    price: {
      monthly: 12.95,
      yearly: 129.50,
    },
    appliesTo: ['cloud-backup'],
  },
  {
    id: 'addon-dedicated-ip',
    name: 'Dedicated IP Address',
    description: 'Your own dedicated IPv4 address',
    price: {
      monthly: 2.95,
      yearly: 29.50,
    },
    appliesTo: ['hosting', 'wordpress'],
  },
  {
    id: 'addon-cdn',
    name: 'Global CDN',
    description: 'Content delivery network with 150+ edge locations',
    price: {
      monthly: 7.95,
      yearly: 79.50,
    },
    appliesTo: ['hosting', 'wordpress'],
  },
];

// ============================================================================
// COUPONS
// ============================================================================

const COUPONS = [
  {
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    appliesToProducts: undefined,
    minSubtotal: undefined,
    firstInvoiceOnly: true,
    maxUses: undefined,
    expiresAt: '2026-05-31',
  },
  {
    code: 'SAVE20',
    type: 'percent',
    value: 20,
    appliesToProducts: undefined,
    minSubtotal: 10,
    firstInvoiceOnly: false,
    maxUses: 100,
    expiresAt: '2026-02-28',
  },
  {
    code: 'FIRST50',
    type: 'percent',
    value: 50,
    appliesToProducts: ['hosting', 'wordpress'],
    minSubtotal: undefined,
    firstInvoiceOnly: true,
    maxUses: 50,
    expiresAt: '2025-12-31',
  },
  {
    code: 'FIXED5',
    type: 'flat',
    value: 5.00,
    appliesToProducts: undefined,
    minSubtotal: 15,
    firstInvoiceOnly: false,
    maxUses: undefined,
    expiresAt: '2026-11-30',
  },
  {
    code: 'FREEMONTH',
    type: 'free-first-month',
    value: 100,
    appliesToProducts: ['hosting', 'wordpress'],
    minSubtotal: undefined,
    firstInvoiceOnly: true,
    maxUses: 25,
    expiresAt: '2025-12-31',
  },
  {
    code: 'STORAGE15',
    type: 'percent',
    value: 15,
    appliesToProducts: ['cloud-storage', 'cloud-backup'],
    minSubtotal: undefined,
    firstInvoiceOnly: false,
    maxUses: undefined,
    expiresAt: '2026-06-30',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a plan by ID
 */
function getPlanById(planId) {
  return PLANS.find((p) => p.id === planId);
}

/**
 * Get a plan by slug
 */
function getPlanBySlug(slug) {
  return PLANS.find((p) => p.slug === slug);
}

/**
 * Get all plans for a specific product type
 */
function getPlansByType(productType) {
  return PLANS.filter((p) => p.productType === productType);
}

/**
 * Get an addon by ID
 */
function getAddonById(addonId) {
  return ADDONS.find((a) => a.id === addonId);
}

/**
 * Get applicable addons for a product type
 */
function getAddonsForProductType(productType) {
  return ADDONS.filter((a) => a.appliesTo.includes(productType));
}

/**
 * Get a coupon by code (case-insensitive)
 */
function getCouponByCode(code) {
  const normalizedCode = code.trim().toUpperCase();
  return COUPONS.find((c) => c.code.toUpperCase() === normalizedCode);
}

/**
 * Check if a coupon is valid (not expired)
 */
function isCouponValid(coupon) {
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return false;
  }
  return true;
}

/**
 * Get the price for a specific billing cycle
 */
function getPlanPrice(plan, cycle) {
  return plan.basePrice[cycle] || plan.basePrice.monthly;
}

/**
 * Get the price for an addon for a specific billing cycle
 */
function getAddonPrice(addon, cycle) {
  return addon.price[cycle] || addon.price.monthly;
}

/**
 * Calculate subtotal for plan + addons
 */
function calculateSubtotal(plan, addons = [], billingCycle = 'monthly', trialActive = false) {
  if (trialActive && plan.trialEnabled) {
    return 0; // First charge is $0 during trial
  }

  const planPrice = getPlanPrice(plan, billingCycle);
  const addonsTotal = addons.reduce((sum, addon) => {
    return sum + getAddonPrice(addon, billingCycle);
  }, 0);

  return planPrice + addonsTotal;
}

/**
 * Calculate discount amount based on coupon
 */
function calculateDiscount(coupon, subtotal, plan, billingCycle = 'monthly') {
  if (!coupon || subtotal === 0) return 0;

  // Check product applicability
  if (coupon.appliesToProducts && !coupon.appliesToProducts.includes(plan.productType)) {
    return 0;
  }

  // Check minimum subtotal
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return 0;
  }

  let discount = 0;

  switch (coupon.type) {
    case 'percent':
      discount = (subtotal * coupon.value) / 100;
      break;
    case 'flat':
      discount = coupon.value;
      break;
    case 'free-first-month':
      // Only applies if this is first invoice
      if (coupon.firstInvoiceOnly) {
        const planPrice = getPlanPrice(plan, billingCycle);
        discount = planPrice; // Discount the plan price only, not addons
      }
      break;
  }

  // Discount cannot exceed subtotal
  return Math.min(discount, subtotal);
}

/**
 * Calculate final totals
 */
function calculateTotals({ plan, addons = [], billingCycle = 'monthly', trialActive = false, coupon = null }) {
  const subtotal = calculateSubtotal(plan, addons, billingCycle, trialActive);
  const discount = calculateDiscount(coupon, subtotal, plan, billingCycle);
  const total = Math.max(0, subtotal - discount);

  return {
    subtotal,
    discount,
    total,
    trialActive,
    hasDiscount: discount > 0,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  PLANS,
  HOSTING_PLANS,
  WORDPRESS_PLANS,
  CLOUD_STORAGE_PLANS,
  CLOUD_BACKUP_PLANS,
  ADDONS,
  COUPONS,
  getPlanById,
  getPlanBySlug,
  getPlansByType,
  getAddonById,
  getAddonsForProductType,
  getCouponByCode,
  isCouponValid,
  getPlanPrice,
  getAddonPrice,
  calculateSubtotal,
  calculateDiscount,
  calculateTotals,
};
