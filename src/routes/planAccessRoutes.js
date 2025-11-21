// Plan Access Routes
// Public pricing, client subscriptions, admin plan management
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import * as planAccessService from '../services/planAccessService.js';

const router = express.Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * Get all active service plans (for pricing page)
 * GET /api/plans/pricing
 */
router.get('/pricing', async (req, res) => {
  try {
    // For public pricing, use first tenant or system tenant
    const tenantId = req.query.tenant_id || (await getTenantIdFromDomain(req.hostname));
    
    const filters = {
      plan_type: req.query.plan_type, // shared-hosting, vps, dedicated, cloud
      tier_level: req.query.tier_level ? parseInt(req.query.tier_level) : undefined
    };

    const plans = await planAccessService.getAllServicePlans(tenantId, filters);
    
    res.json({
      success: true,
      count: plans.length,
      data: plans
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single plan by slug (for plan details page)
 * GET /api/plans/pricing/:slug
 */
router.get('/pricing/:slug', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || (await getTenantIdFromDomain(req.hostname));
    const plan = await planAccessService.getServicePlanBySlug(tenantId, req.params.slug);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }
    
    res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Get plan error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all premium bundles (for marketplace page)
 * GET /api/plans/bundles
 */
router.get('/bundles', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || (await getTenantIdFromDomain(req.hostname));
    
    const filters = {
      bundle_type: req.query.bundle_type // security, developer, performance, marketing
    };

    const bundles = await planAccessService.getAllPremiumBundles(tenantId, filters);
    
    res.json({
      success: true,
      count: bundles.length,
      data: bundles
    });
  } catch (error) {
    console.error('Get bundles error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get premium tools à la carte
 * GET /api/plans/tools
 */
router.get('/tools', async (req, res) => {
  try {
    const tenantId = req.query.tenant_id || (await getTenantIdFromDomain(req.hostname));
    
    const filters = {
      tool_category: req.query.category // security, performance, developer, analytics, marketing
    };

    const tools = await planAccessService.getAllPremiumTools(tenantId, filters);
    
    res.json({
      success: true,
      count: tools.length,
      data: tools
    });
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CLIENT ROUTES (Authenticated clients)
// ============================================

router.use(authenticateToken); // All routes below require authentication

/**
 * Get client's current subscription
 * GET /api/plans/my-subscription
 */
router.get('/my-subscription', async (req, res) => {
  try {
    const subscription = await planAccessService.getClientActiveSubscription(
      req.user.customerId,
      req.user.tenantId
    );
    
    if (!subscription) {
      return res.json({ 
        success: true, 
        data: null,
        message: 'No active subscription'
      });
    }
    
    res.json({ success: true, data: subscription });
  } catch (error) {
    console.error('Get my subscription error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get client's feature access
 * GET /api/plans/my-features
 */
router.get('/my-features', async (req, res) => {
  try {
    const features = await planAccessService.getClientFeatureAccess(
      req.user.customerId,
      req.user.tenantId
    );
    
    res.json({ success: true, data: features });
  } catch (error) {
    console.error('Get my features error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get client's usage statistics
 * GET /api/plans/my-usage
 */
router.get('/my-usage', async (req, res) => {
  try {
    const usage = await planAccessService.getClientUsageStats(
      req.user.customerId,
      req.user.tenantId
    );
    
    if (!usage) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    res.json({ success: true, data: usage });
  } catch (error) {
    console.error('Get usage stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get client's active addons
 * GET /api/plans/my-addons
 */
router.get('/my-addons', async (req, res) => {
  try {
    const addons = await planAccessService.getClientActiveAddons(
      req.user.customerId,
      req.user.tenantId
    );
    
    res.json({ 
      success: true, 
      count: addons.length,
      data: addons 
    });
  } catch (error) {
    console.error('Get my addons error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Add addon to client subscription
 * POST /api/plans/my-addons
 * Body: { addon_type, bundle_id?, tool_id?, billing_cycle }
 */
router.post('/my-addons', async (req, res) => {
  try {
    const { addon_type, bundle_id, tool_id, billing_cycle } = req.body;

    // Get client's active subscription
    const subscription = await planAccessService.getClientActiveSubscription(
      req.user.customerId,
      req.user.tenantId
    );

    if (!subscription) {
      return res.status(400).json({ error: 'No active subscription. Please select a plan first.' });
    }

    // Get price for the addon
    let price_paid;
    if (addon_type === 'bundle') {
      const bundle = await planAccessService.getPremiumBundleBySlug(req.user.tenantId, bundle_id);
      price_paid = billing_cycle === 'yearly' ? bundle.price_yearly : bundle.price_monthly;
    } else {
      // Get tool price (would need to implement getPremiumToolById)
      price_paid = 0; // Placeholder
    }

    const addon = await planAccessService.addClientAddon(
      req.user.customerId,
      req.user.tenantId,
      {
        service_subscription_id: subscription.id,
        addon_type,
        bundle_id,
        tool_id,
        billing_cycle,
        price_paid
      }
    );

    res.status(201).json({ 
      success: true, 
      data: addon,
      message: 'Addon successfully added to your subscription'
    });
  } catch (error) {
    console.error('Add addon error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Cancel addon subscription
 * DELETE /api/plans/my-addons/:id
 */
router.delete('/my-addons/:id', async (req, res) => {
  try {
    const result = await planAccessService.cancelClientAddon(
      req.params.id,
      req.user.tenantId
    );

    res.json({ 
      success: true, 
      data: result,
      message: 'Addon cancelled. You will not be charged on next billing cycle.'
    });
  } catch (error) {
    console.error('Cancel addon error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * Check feature access
 * GET /api/plans/feature-check/:featureName
 */
router.get('/feature-check/:featureName', async (req, res) => {
  try {
    const accessCheck = await planAccessService.checkFeatureAccess(
      req.user.customerId,
      req.user.tenantId,
      req.params.featureName
    );
    
    res.json({ success: true, data: accessCheck });
  } catch (error) {
    console.error('Feature check error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get security policy templates available to client
 * GET /api/plans/security-templates
 */
router.get('/security-templates', async (req, res) => {
  try {
    const subscription = await planAccessService.getClientActiveSubscription(
      req.user.customerId,
      req.user.tenantId
    );

    if (!subscription) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const templates = await planAccessService.getSecurityPolicyTemplates(
      req.user.tenantId,
      subscription.tier_level
    );

    res.json({ 
      success: true, 
      count: templates.length,
      data: templates 
    });
  } catch (error) {
    console.error('Get security templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ADMIN ROUTES (Require admin permissions)
// ============================================

/**
 * Create service plan (admin only)
 * POST /api/plans/admin/plans
 */
router.post('/admin/plans', 
  requirePermission('billing.manage_plans'),
  async (req, res) => {
    try {
      const plan = await planAccessService.createServicePlan(
        req.user.tenantId,
        req.body
      );

      res.status(201).json({ 
        success: true, 
        data: plan,
        message: 'Service plan created successfully'
      });
    } catch (error) {
      console.error('Create plan error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Update service plan (admin only)
 * PUT /api/plans/admin/plans/:id
 */
router.put('/admin/plans/:id',
  requirePermission('billing.manage_plans'),
  async (req, res) => {
    try {
      const plan = await planAccessService.updateServicePlan(
        req.params.id,
        req.user.tenantId,
        req.body
      );

      res.json({ 
        success: true, 
        data: plan,
        message: 'Service plan updated successfully'
      });
    } catch (error) {
      console.error('Update plan error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Get all client subscriptions (admin only)
 * GET /api/plans/admin/subscriptions
 */
router.get('/admin/subscriptions',
  requirePermission('customers.read'),
  async (req, res) => {
    try {
      // This would need a new service function to get all subscriptions
      // For now, return placeholder
      res.json({ 
        success: true, 
        message: 'Admin subscription management coming soon',
        data: [] 
      });
    } catch (error) {
      console.error('Get subscriptions error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * Update subscription status (admin only - suspend/reactivate)
 * PUT /api/plans/admin/subscriptions/:id/status
 */
router.put('/admin/subscriptions/:id/status',
  requirePermission('billing.manage_subscriptions'),
  async (req, res) => {
    try {
      const { status, reason } = req.body;

      const subscription = await planAccessService.updateSubscriptionStatus(
        req.params.id,
        req.user.tenantId,
        status,
        reason
      );

      res.json({ 
        success: true, 
        data: subscription,
        message: `Subscription ${status} successfully`
      });
    } catch (error) {
      console.error('Update subscription status error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

/**
 * Update subscription usage (admin only - called by monitoring systems)
 * PUT /api/plans/admin/subscriptions/:id/usage
 */
router.put('/admin/subscriptions/:id/usage',
  requirePermission('billing.manage_subscriptions'),
  async (req, res) => {
    try {
      const subscription = await planAccessService.updateSubscriptionUsage(
        req.params.id,
        req.user.tenantId,
        req.body
      );

      res.json({ 
        success: true, 
        data: subscription 
      });
    } catch (error) {
      console.error('Update usage error:', error);
      res.status(400).json({ error: error.message });
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get tenant ID from domain (for multi-tenant deployments)
 */
async function getTenantIdFromDomain(hostname) {
  // For now, return the first tenant
  // In production, this would query database based on hostname
  const pool = (await import('../db/index.js')).default;
  const result = await pool.query('SELECT id FROM tenants LIMIT 1');
  return result.rows[0]?.id;
}

export default router;
