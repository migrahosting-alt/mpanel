// Plan Access Service
// Handles service plans, premium bundles, and client subscriptions
import pool from '../db/index.js';
import logger from '../utils/logger.js';

// ============================================
// SERVICE PLANS
// ============================================

/**
 * Get all active service plans
 */
export async function getAllServicePlans(tenantId, filters = {}) {
  let query = `
    SELECT * FROM service_plans
    WHERE tenant_id = $1 AND is_active = true
  `;
  const params = [tenantId];
  let paramCount = 1;

  if (filters.plan_type) {
    paramCount++;
    query += ` AND plan_type = $${paramCount}`;
    params.push(filters.plan_type);
  }

  if (filters.tier_level) {
    paramCount++;
    query += ` AND tier_level = $${paramCount}`;
    params.push(filters.tier_level);
  }

  query += ' ORDER BY tier_level, display_order';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get service plan by ID or slug
 */
export async function getServicePlanBySlug(tenantId, slug) {
  const result = await pool.query(
    'SELECT * FROM service_plans WHERE tenant_id = $1 AND slug = $2',
    [tenantId, slug]
  );
  return result.rows[0];
}

/**
 * Create service plan (admin only)
 */
export async function createServicePlan(tenantId, planData) {
  const {
    name, slug, description, plan_type, tier_level,
    price_monthly, price_yearly, price_biennial, price_triennial,
    disk_space_gb, bandwidth_gb, websites_limit,
    features_summary, ...otherFields
  } = planData;

  const columns = ['tenant_id', 'name', 'slug', 'description', 'plan_type', 'tier_level',
    'price_monthly', 'price_yearly', 'price_biennial', 'price_triennial',
    'disk_space_gb', 'bandwidth_gb', 'websites_limit', 'features_summary'];
  const values = [tenantId, name, slug, description, plan_type, tier_level,
    price_monthly, price_yearly, price_biennial, price_triennial,
    disk_space_gb, bandwidth_gb, websites_limit, 
    typeof features_summary === 'object' ? JSON.stringify(features_summary) : features_summary];

  // Add optional fields
  Object.keys(otherFields).forEach(key => {
    columns.push(key);
    values.push(otherFields[key]);
  });

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const query = `
    INSERT INTO service_plans (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await pool.query(query, values);
  logger.info('Service plan created', { planId: result.rows[0].id, name, tenantId });
  return result.rows[0];
}

/**
 * Update service plan (admin only)
 */
export async function updateServicePlan(planId, tenantId, updates) {
  const allowedFields = [
    'name', 'description', 'price_monthly', 'price_yearly', 'price_biennial', 'price_triennial',
    'disk_space_gb', 'bandwidth_gb', 'websites_limit', 'subdomains_limit', 
    'email_accounts_limit', 'databases_limit', 'features_summary', 'is_active', 
    'is_featured', 'display_order', 'popular_badge'
  ];

  const setClauses = [];
  const values = [];
  let paramCount = 0;

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      paramCount++;
      setClauses.push(`${key} = $${paramCount}`);
      values.push(updates[key]);
    }
  });

  if (setClauses.length === 0) {
    throw new Error('No valid fields to update');
  }

  paramCount++;
  values.push(planId);
  paramCount++;
  values.push(tenantId);

  const query = `
    UPDATE service_plans
    SET ${setClauses.join(', ')}
    WHERE id = $${paramCount - 1} AND tenant_id = $${paramCount}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  if (result.rows.length === 0) {
    throw new Error('Service plan not found');
  }

  return result.rows[0];
}

// ============================================
// PREMIUM BUNDLES
// ============================================

/**
 * Get all active premium bundles
 */
export async function getAllPremiumBundles(tenantId, filters = {}) {
  let query = `
    SELECT * FROM premium_tool_bundles
    WHERE tenant_id = $1 AND is_active = true
  `;
  const params = [tenantId];
  let paramCount = 1;

  if (filters.bundle_type) {
    paramCount++;
    query += ` AND bundle_type = $${paramCount}`;
    params.push(filters.bundle_type);
  }

  query += ' ORDER BY is_featured DESC, price_monthly';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get premium bundle by slug
 */
export async function getPremiumBundleBySlug(tenantId, slug) {
  const result = await pool.query(
    'SELECT * FROM premium_tool_bundles WHERE tenant_id = $1 AND slug = $2',
    [tenantId, slug]
  );
  return result.rows[0];
}

// ============================================
// PREMIUM TOOLS (À la carte)
// ============================================

/**
 * Get all active premium tools
 */
export async function getAllPremiumTools(tenantId, filters = {}) {
  let query = `
    SELECT * FROM premium_tools
    WHERE tenant_id = $1 AND is_active = true
  `;
  const params = [tenantId];
  let paramCount = 1;

  if (filters.tool_category) {
    paramCount++;
    query += ` AND tool_category = $${paramCount}`;
    params.push(filters.tool_category);
  }

  query += ' ORDER BY tool_category, name';

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================
// CLIENT SUBSCRIPTIONS
// ============================================

/**
 * Get client's active subscription
 */
export async function getClientActiveSubscription(customerId, tenantId) {
  const result = await pool.query(
    `
    SELECT css.*, sp.name as plan_name, sp.slug as plan_slug, sp.tier_level,
           sp.disk_space_gb as plan_disk_gb, sp.bandwidth_gb as plan_bandwidth_gb,
           sp.websites_limit as plan_websites_limit,
           sp.advanced_waf, sp.ssh_access, sp.git_integration, sp.cdn_enabled,
           sp.white_label_enabled, sp.support_level
    FROM client_service_subscriptions css
    JOIN service_plans sp ON css.service_plan_id = sp.id
    WHERE css.customer_id = $1 AND css.tenant_id = $2 AND css.status = 'active'
    LIMIT 1
    `,
    [customerId, tenantId]
  );
  return result.rows[0];
}

/**
 * Get all client subscriptions (including historical)
 */
export async function getClientSubscriptions(customerId, tenantId) {
  const result = await pool.query(
    `
    SELECT css.*, sp.name as plan_name, sp.slug as plan_slug, sp.tier_level
    FROM client_service_subscriptions css
    JOIN service_plans sp ON css.service_plan_id = sp.id
    WHERE css.customer_id = $1 AND css.tenant_id = $2
    ORDER BY css.created_at DESC
    `,
    [customerId, tenantId]
  );
  return result.rows;
}

/**
 * Create client subscription (when customer signs up or upgrades)
 */
export async function createClientSubscription(customerId, tenantId, subscriptionData) {
  const { service_plan_id, billing_cycle, price_paid } = subscriptionData;

  // Calculate next billing date based on cycle
  const nextBillingDate = calculateNextBillingDate(billing_cycle);

  const result = await pool.query(
    `
    INSERT INTO client_service_subscriptions (
      tenant_id, customer_id, service_plan_id, billing_cycle, 
      price_paid, next_billing_date, status, activated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)
    RETURNING *
    `,
    [tenantId, customerId, service_plan_id, billing_cycle, price_paid, nextBillingDate]
  );

  logger.info('Client subscription created', { 
    customerId, 
    planId: service_plan_id, 
    billingCycle: billing_cycle 
  });

  return result.rows[0];
}

/**
 * Update subscription status (suspend, cancel, reactivate)
 */
export async function updateSubscriptionStatus(subscriptionId, tenantId, status, reason = null) {
  const validStatuses = ['active', 'suspended', 'cancelled', 'expired'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const timestampField = {
    suspended: 'suspended_at',
    cancelled: 'cancelled_at',
    expired: 'expires_at'
  }[status];

  let query = `
    UPDATE client_service_subscriptions
    SET status = $1
  `;
  const params = [status];
  let paramCount = 1;

  if (timestampField) {
    paramCount++;
    query += `, ${timestampField} = CURRENT_TIMESTAMP`;
  }

  if (reason) {
    paramCount++;
    query += `, suspension_reason = $${paramCount}`;
    params.push(reason);
  }

  paramCount++;
  params.push(subscriptionId);
  paramCount++;
  params.push(tenantId);

  query += ` WHERE id = $${paramCount - 1} AND tenant_id = $${paramCount} RETURNING *`;

  const result = await pool.query(query, params);
  if (result.rows.length === 0) {
    throw new Error('Subscription not found');
  }

  logger.info('Subscription status updated', { subscriptionId, status, reason });
  return result.rows[0];
}

/**
 * Update subscription usage (disk, bandwidth)
 */
export async function updateSubscriptionUsage(subscriptionId, tenantId, usageData) {
  const { disk_usage_gb, bandwidth_usage_gb, current_websites } = usageData;

  const result = await pool.query(
    `
    UPDATE client_service_subscriptions
    SET disk_usage_gb = COALESCE($1, disk_usage_gb),
        bandwidth_usage_gb = COALESCE($2, bandwidth_usage_gb),
        current_websites = COALESCE($3, current_websites)
    WHERE id = $4 AND tenant_id = $5
    RETURNING *
    `,
    [disk_usage_gb, bandwidth_usage_gb, current_websites, subscriptionId, tenantId]
  );

  return result.rows[0];
}

// ============================================
// CLIENT ADDON SUBSCRIPTIONS
// ============================================

/**
 * Get client's active addons
 */
export async function getClientActiveAddons(customerId, tenantId) {
  const result = await pool.query(
    `
    SELECT cas.*,
           CASE 
             WHEN cas.addon_type = 'bundle' THEN ptb.name
             WHEN cas.addon_type = 'tool' THEN pt.name
           END as addon_name,
           CASE 
             WHEN cas.addon_type = 'bundle' THEN ptb.slug
             WHEN cas.addon_type = 'tool' THEN pt.slug
           END as addon_slug,
           CASE 
             WHEN cas.addon_type = 'bundle' THEN ptb.bundle_type
             WHEN cas.addon_type = 'tool' THEN pt.tool_category
           END as addon_category
    FROM client_addon_subscriptions cas
    LEFT JOIN premium_tool_bundles ptb ON cas.bundle_id = ptb.id
    LEFT JOIN premium_tools pt ON cas.tool_id = pt.id
    WHERE cas.customer_id = $1 AND cas.tenant_id = $2 AND cas.status = 'active'
    ORDER BY cas.created_at DESC
    `,
    [customerId, tenantId]
  );
  return result.rows;
}

/**
 * Add addon to client subscription
 */
export async function addClientAddon(customerId, tenantId, addonData) {
  const { service_subscription_id, addon_type, bundle_id, tool_id, billing_cycle, price_paid } = addonData;

  // Validate that either bundle_id OR tool_id is provided
  if ((addon_type === 'bundle' && !bundle_id) || (addon_type === 'tool' && !tool_id)) {
    throw new Error('Invalid addon configuration');
  }

  const nextBillingDate = calculateNextBillingDate(billing_cycle);

  const result = await pool.query(
    `
    INSERT INTO client_addon_subscriptions (
      tenant_id, customer_id, service_subscription_id, addon_type,
      bundle_id, tool_id, billing_cycle, price_paid, next_billing_date,
      status, activated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', CURRENT_TIMESTAMP)
    RETURNING *
    `,
    [tenantId, customerId, service_subscription_id, addon_type, bundle_id, tool_id, 
     billing_cycle, price_paid, nextBillingDate]
  );

  logger.info('Client addon subscription created', { 
    customerId, 
    addonType: addon_type, 
    bundleId: bundle_id, 
    toolId: tool_id 
  });

  return result.rows[0];
}

/**
 * Cancel client addon
 */
export async function cancelClientAddon(addonSubscriptionId, tenantId) {
  const result = await pool.query(
    `
    UPDATE client_addon_subscriptions
    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
    `,
    [addonSubscriptionId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Addon subscription not found');
  }

  logger.info('Client addon cancelled', { addonSubscriptionId });
  return result.rows[0];
}

// ============================================
// SECURITY POLICY TEMPLATES
// ============================================

/**
 * Get security policy templates
 */
export async function getSecurityPolicyTemplates(tenantId, minTier = 1) {
  const result = await pool.query(
    `
    SELECT * FROM security_policy_templates
    WHERE tenant_id = $1 AND minimum_tier <= $2 AND is_active = true
    ORDER BY minimum_tier, name
    `,
    [tenantId, minTier]
  );
  return result.rows;
}

/**
 * Get default security template for tier
 */
export async function getDefaultSecurityTemplate(tenantId, tierLevel) {
  const result = await pool.query(
    `
    SELECT * FROM security_policy_templates
    WHERE tenant_id = $1 AND minimum_tier <= $2 AND is_default = true
    ORDER BY minimum_tier DESC
    LIMIT 1
    `,
    [tenantId, tierLevel]
  );
  return result.rows[0];
}

// ============================================
// FEATURE ACCESS CHECKS
// ============================================

/**
 * Check if client has access to a specific feature
 */
export async function checkFeatureAccess(customerId, tenantId, featureName) {
  const subscription = await getClientActiveSubscription(customerId, tenantId);
  
  if (!subscription) {
    return { 
      hasAccess: false, 
      reason: 'No active subscription',
      upgrade_required: true
    };
  }

  // Check if feature is enabled in plan
  const hasAccess = subscription[featureName] === true;

  if (!hasAccess) {
    // Check if feature is available in addons
    const addons = await getClientActiveAddons(customerId, tenantId);
    // This would need more complex logic to check addon features
  }

  return {
    hasAccess,
    current_plan: subscription.plan_name,
    tier_level: subscription.tier_level,
    feature_value: subscription[featureName]
  };
}

/**
 * Get all features available to client
 */
export async function getClientFeatureAccess(customerId, tenantId) {
  const subscription = await getClientActiveSubscription(customerId, tenantId);
  const addons = await getClientActiveAddons(customerId, tenantId);

  if (!subscription) {
    return { features: {}, plan: null, addons: [] };
  }

  // Extract boolean features from plan
  const planFeatures = {
    free_ssl: subscription.free_ssl,
    firewall_enabled: subscription.firewall_enabled,
    ddos_protection: subscription.ddos_protection,
    malware_scanning: subscription.malware_scanning,
    daily_backups: subscription.daily_backups,
    advanced_waf: subscription.advanced_waf,
    geo_blocking: subscription.geo_blocking,
    intrusion_detection: subscription.intrusion_detection,
    cdn_enabled: subscription.cdn_enabled,
    ssh_access: subscription.ssh_access,
    git_integration: subscription.git_integration,
    white_label_enabled: subscription.white_label_enabled,
    // Add more as needed
  };

  return {
    plan: {
      name: subscription.plan_name,
      slug: subscription.plan_slug,
      tier_level: subscription.tier_level
    },
    features: planFeatures,
    addons: addons.map(a => ({
      name: a.addon_name,
      type: a.addon_type,
      category: a.addon_category
    })),
    usage: {
      disk_usage_gb: subscription.disk_usage_gb,
      disk_limit_gb: subscription.plan_disk_gb,
      bandwidth_usage_gb: subscription.bandwidth_usage_gb,
      bandwidth_limit_gb: subscription.plan_bandwidth_gb,
      websites_count: subscription.current_websites,
      websites_limit: subscription.plan_websites_limit
    }
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate next billing date based on cycle
 */
function calculateNextBillingDate(billingCycle) {
  const now = new Date();
  
  switch (billingCycle) {
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    case 'yearly':
      return new Date(now.setFullYear(now.getFullYear() + 1));
    case 'biennial':
      return new Date(now.setFullYear(now.getFullYear() + 2));
    case 'triennial':
      return new Date(now.setFullYear(now.getFullYear() + 3));
    default:
      return new Date(now.setMonth(now.getMonth() + 1));
  }
}

/**
 * Get usage percentage
 */
export async function getClientUsageStats(customerId, tenantId) {
  const subscription = await getClientActiveSubscription(customerId, tenantId);
  
  if (!subscription) {
    return null;
  }

  return {
    disk: {
      used_gb: subscription.disk_usage_gb || 0,
      limit_gb: subscription.plan_disk_gb,
      percentage: ((subscription.disk_usage_gb || 0) / subscription.plan_disk_gb) * 100,
      warning: ((subscription.disk_usage_gb || 0) / subscription.plan_disk_gb) > 0.8
    },
    bandwidth: {
      used_gb: subscription.bandwidth_usage_gb || 0,
      limit_gb: subscription.plan_bandwidth_gb,
      percentage: ((subscription.bandwidth_usage_gb || 0) / subscription.plan_bandwidth_gb) * 100,
      warning: ((subscription.bandwidth_usage_gb || 0) / subscription.plan_bandwidth_gb) > 0.8
    },
    websites: {
      count: subscription.current_websites || 0,
      limit: subscription.plan_websites_limit,
      percentage: ((subscription.current_websites || 0) / subscription.plan_websites_limit) * 100,
      warning: ((subscription.current_websites || 0) / subscription.plan_websites_limit) > 0.9
    }
  };
}
