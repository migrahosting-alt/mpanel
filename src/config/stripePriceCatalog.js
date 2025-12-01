/**
 * Stripe Price Catalog
 * 
 * Central mapping of product slugs to Stripe Price IDs.
 * This is the single source of truth for Stripe integration.
 * 
 * IMPORTANT: Replace all price_xxx_... placeholders with actual Stripe Price IDs
 * from your Stripe Dashboard (https://dashboard.stripe.com/prices)
 */

export const STRIPE_PRICE_CATALOG = {
  // ============================================================================
  // SHARED HOSTING PLANS
  // ============================================================================
  'starter': {
    monthly: process.env.PRICE_STARTER_MONTHLY || 'price_starter_monthly',
    yearly: process.env.PRICE_STARTER_YEARLY || 'price_starter_yearly',
    kind: 'recurring',
    interval: 'month', // Primary interval for monthly
  },
  'pro': {
    monthly: process.env.PRICE_PRO_MONTHLY || 'price_pro_monthly',
    yearly: process.env.PRICE_PRO_YEARLY || 'price_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'business': {
    monthly: process.env.PRICE_BUSINESS_MONTHLY || 'price_business_monthly',
    yearly: process.env.PRICE_BUSINESS_YEARLY || 'price_business_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // WORDPRESS HOSTING PLANS
  // ============================================================================
  'wp-starter': {
    monthly: process.env.PRICE_WP_STARTER_MONTHLY || 'price_wp_starter_monthly',
    yearly: process.env.PRICE_WP_STARTER_YEARLY || 'price_wp_starter_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'wp-growth': {
    monthly: process.env.PRICE_WP_GROWTH_MONTHLY || 'price_wp_growth_monthly',
    yearly: process.env.PRICE_WP_GROWTH_YEARLY || 'price_wp_growth_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'wp-pro': {
    monthly: process.env.PRICE_WP_PRO_MONTHLY || 'price_wp_pro_monthly',
    yearly: process.env.PRICE_WP_PRO_YEARLY || 'price_wp_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'wp-business': {
    monthly: process.env.PRICE_WP_BUSINESS_MONTHLY || 'price_wp_business_monthly',
    yearly: process.env.PRICE_WP_BUSINESS_YEARLY || 'price_wp_business_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // VPS PLANS
  // ============================================================================
  'vps-basic': {
    monthly: process.env.PRICE_VPS_BASIC_MONTHLY || 'price_vps_basic_monthly',
    yearly: process.env.PRICE_VPS_BASIC_YEARLY || 'price_vps_basic_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'vps-plus': {
    monthly: process.env.PRICE_VPS_PLUS_MONTHLY || 'price_vps_plus_monthly',
    yearly: process.env.PRICE_VPS_PLUS_YEARLY || 'price_vps_plus_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'vps-pro': {
    monthly: process.env.PRICE_VPS_PRO_MONTHLY || 'price_vps_pro_monthly',
    yearly: process.env.PRICE_VPS_PRO_YEARLY || 'price_vps_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // EMAIL HOSTING PLANS
  // ============================================================================
  'email-basic': {
    monthly: process.env.PRICE_EMAIL_BASIC_MONTHLY || 'price_email_basic_monthly',
    yearly: process.env.PRICE_EMAIL_BASIC_YEARLY || 'price_email_basic_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'email-pro': {
    monthly: process.env.PRICE_EMAIL_PRO_MONTHLY || 'price_email_pro_monthly',
    yearly: process.env.PRICE_EMAIL_PRO_YEARLY || 'price_email_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'email-business': {
    monthly: process.env.PRICE_EMAIL_BUSINESS_MONTHLY || 'price_email_business_monthly',
    yearly: process.env.PRICE_EMAIL_BUSINESS_YEARLY || 'price_email_business_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // CLOUD STORAGE PLANS
  // ============================================================================
  'storage-basic': {
    monthly: process.env.PRICE_STORAGE_BASIC_MONTHLY || 'price_storage_basic_monthly',
    yearly: process.env.PRICE_STORAGE_BASIC_YEARLY || 'price_storage_basic_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'storage-pro': {
    monthly: process.env.PRICE_STORAGE_PRO_MONTHLY || 'price_storage_pro_monthly',
    yearly: process.env.PRICE_STORAGE_PRO_YEARLY || 'price_storage_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'storage-business': {
    monthly: process.env.PRICE_STORAGE_BUSINESS_MONTHLY || 'price_storage_business_monthly',
    yearly: process.env.PRICE_STORAGE_BUSINESS_YEARLY || 'price_storage_business_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // CLOUD BACKUP PLANS
  // ============================================================================
  'backup-essential': {
    monthly: process.env.PRICE_BACKUP_ESSENTIAL_MONTHLY || 'price_backup_essential_monthly',
    yearly: process.env.PRICE_BACKUP_ESSENTIAL_YEARLY || 'price_backup_essential_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'backup-pro': {
    monthly: process.env.PRICE_BACKUP_PRO_MONTHLY || 'price_backup_pro_monthly',
    yearly: process.env.PRICE_BACKUP_PRO_YEARLY || 'price_backup_pro_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'backup-business': {
    monthly: process.env.PRICE_BACKUP_BUSINESS_MONTHLY || 'price_backup_business_monthly',
    yearly: process.env.PRICE_BACKUP_BUSINESS_YEARLY || 'price_backup_business_yearly',
    kind: 'recurring',
    interval: 'month',
  },

  // ============================================================================
  // DOMAINS (One-time charge)
  // ============================================================================
  'domain-1y': {
    price: process.env.PRICE_DOMAIN_1Y || 'price_domain_1y',
    kind: 'one_time',
  },
  'domain-2y': {
    price: process.env.PRICE_DOMAIN_2Y || 'price_domain_2y',
    kind: 'one_time',
  },

  // ============================================================================
  // ADD-ONS
  // ============================================================================
  'addon-priority-support': {
    monthly: process.env.PRICE_ADDON_PRIORITY_SUPPORT_MONTHLY || 'price_addon_priority_support_monthly',
    yearly: process.env.PRICE_ADDON_PRIORITY_SUPPORT_YEARLY || 'price_addon_priority_support_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-advanced-security': {
    monthly: process.env.PRICE_ADDON_ADVANCED_SECURITY_MONTHLY || 'price_addon_advanced_security_monthly',
    yearly: process.env.PRICE_ADDON_ADVANCED_SECURITY_YEARLY || 'price_addon_advanced_security_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-extra-backups': {
    monthly: process.env.PRICE_ADDON_EXTRA_BACKUPS_MONTHLY || 'price_addon_extra_backups_monthly',
    yearly: process.env.PRICE_ADDON_EXTRA_BACKUPS_YEARLY || 'price_addon_extra_backups_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-wp-staging': {
    monthly: process.env.PRICE_ADDON_WP_STAGING_MONTHLY || 'price_addon_wp_staging_monthly',
    yearly: process.env.PRICE_ADDON_WP_STAGING_YEARLY || 'price_addon_wp_staging_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-team-collaboration': {
    monthly: process.env.PRICE_ADDON_TEAM_COLLAB_MONTHLY || 'price_addon_team_collab_monthly',
    yearly: process.env.PRICE_ADDON_TEAM_COLLAB_YEARLY || 'price_addon_team_collab_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-disaster-recovery': {
    monthly: process.env.PRICE_ADDON_DISASTER_RECOVERY_MONTHLY || 'price_addon_disaster_recovery_monthly',
    yearly: process.env.PRICE_ADDON_DISASTER_RECOVERY_YEARLY || 'price_addon_disaster_recovery_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-dedicated-ip': {
    monthly: process.env.PRICE_ADDON_DEDICATED_IP_MONTHLY || 'price_addon_dedicated_ip_monthly',
    yearly: process.env.PRICE_ADDON_DEDICATED_IP_YEARLY || 'price_addon_dedicated_ip_yearly',
    kind: 'recurring',
    interval: 'month',
  },
  'addon-cdn': {
    monthly: process.env.PRICE_ADDON_CDN_MONTHLY || 'price_addon_cdn_monthly',
    yearly: process.env.PRICE_ADDON_CDN_YEARLY || 'price_addon_cdn_yearly',
    kind: 'recurring',
    interval: 'month',
  },
};

/**
 * Get Stripe Price ID for a product slug and billing cycle
 * 
 * @param {string} slug - Product slug (e.g., 'starter', 'wp-growth', 'email-basic')
 * @param {string} billingCycle - 'monthly' or 'yearly'
 * @returns {string|null} Stripe Price ID or null if not found
 */
export function getStripePriceId(slug, billingCycle = 'monthly') {
  const priceConfig = STRIPE_PRICE_CATALOG[slug];
  
  if (!priceConfig) {
    console.warn(`[stripePriceCatalog] Unknown product slug: ${slug}`);
    return null;
  }

  // Handle one-time prices (domains)
  if (priceConfig.kind === 'one_time') {
    return priceConfig.price;
  }

  // Handle recurring prices
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const priceId = priceConfig[cycle];

  if (!priceId) {
    console.warn(`[stripePriceCatalog] No price ID for ${slug} ${cycle}`);
    return null;
  }

  return priceId;
}

/**
 * Check if a product is recurring or one-time
 * 
 * @param {string} slug - Product slug
 * @returns {'recurring'|'one_time'|null}
 */
export function getPriceKind(slug) {
  const priceConfig = STRIPE_PRICE_CATALOG[slug];
  return priceConfig ? priceConfig.kind : null;
}

/**
 * Validate that all required Stripe Price IDs are configured
 * Useful for startup checks
 * 
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateStripePrices() {
  const missing = [];
  
  for (const [slug, config] of Object.entries(STRIPE_PRICE_CATALOG)) {
    if (config.kind === 'one_time') {
      if (!config.price || config.price.startsWith('price_') && config.price.includes('_')) {
        missing.push(`${slug} (one-time)`);
      }
    } else {
      if (config.monthly && (!config.monthly || config.monthly.startsWith('price_'))) {
        missing.push(`${slug} (monthly)`);
      }
      if (config.yearly && (!config.yearly || config.yearly.startsWith('price_'))) {
        missing.push(`${slug} (yearly)`);
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Build Stripe line_items from cart items
 * 
 * @param {Array} cartItems - Array of cart items with { slug, billingCycle, quantity }
 * @returns {Array} Stripe line_items array
 */
export function buildStripeLineItems(cartItems) {
  const lineItems = [];

  for (const item of cartItems) {
    // Skip coupons and non-chargeable items
    if (item.type === 'coupon' || item.skip) continue;

    const slug = item.slug || item.planId || item.id;
    const cycle = item.billingCycle || 'monthly';
    const priceId = getStripePriceId(slug, cycle);

    if (priceId) {
      lineItems.push({
        price: priceId,
        quantity: item.quantity || 1,
      });
    } else {
      console.warn(`[stripePriceCatalog] No Stripe price ID for ${slug} ${cycle}, skipping`);
    }
  }

  return lineItems;
}

/**
 * Get cart summary string for metadata/display
 * 
 * @param {Array} cartItems - Array of cart items
 * @returns {string} Human-readable summary
 */
export function getCartSummary(cartItems) {
  return cartItems
    .filter(item => item.type !== 'coupon')
    .map(item => {
      const name = item.displayName || item.name || item.slug || item.id;
      const qty = item.quantity || 1;
      return `${name} x${qty}`;
    })
    .join(', ');
}
