// Plan Feature Access Middleware
// Protects routes based on client's plan tier and features
import * as planAccessService from '../services/planAccessService.js';

/**
 * Require specific plan feature
 * Usage: requirePlanFeature('ssh_access')
 */
export function requirePlanFeature(featureName) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.customerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const accessCheck = await planAccessService.checkFeatureAccess(
        req.user.customerId,
        req.user.tenantId,
        featureName
      );

      if (!accessCheck.hasAccess) {
        return res.status(403).json({
          error: `This feature requires a higher plan tier`,
          feature: featureName,
          current_plan: accessCheck.current_plan,
          current_tier: accessCheck.tier_level,
          upgrade_url: '/client/plans/upgrade',
          upgrade_required: true
        });
      }

      // Attach feature info to request for later use
      req.planFeature = {
        name: featureName,
        plan: accessCheck.current_plan,
        tier: accessCheck.tier_level
      };

      next();
    } catch (error) {
      console.error('Plan feature check error:', error);
      res.status(500).json({ error: 'Failed to check plan feature access' });
    }
  };
}

/**
 * Require minimum plan tier
 * Usage: requireMinimumTier(2) // Requires Professional or higher
 */
export function requireMinimumTier(minimumTierLevel) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.customerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const subscription = await planAccessService.getClientActiveSubscription(
        req.user.customerId,
        req.user.tenantId
      );

      if (!subscription) {
        return res.status(403).json({
          error: 'No active subscription',
          upgrade_url: '/client/plans/select',
          subscription_required: true
        });
      }

      if (subscription.tier_level < minimumTierLevel) {
        const tierNames = {
          1: 'Starter',
          2: 'Professional',
          3: 'Business',
          4: 'Enterprise'
        };

        return res.status(403).json({
          error: `This feature requires ${tierNames[minimumTierLevel]} plan or higher`,
          current_plan: subscription.plan_name,
          current_tier: subscription.tier_level,
          required_tier: minimumTierLevel,
          upgrade_url: '/client/plans/upgrade',
          upgrade_required: true
        });
      }

      req.planTier = subscription.tier_level;
      next();
    } catch (error) {
      console.error('Tier check error:', error);
      res.status(500).json({ error: 'Failed to check plan tier' });
    }
  };
}

/**
 * Check usage limit
 * Usage: checkUsageLimit('websites', 5) // Check if client can add 5 more websites
 */
export function checkUsageLimit(resourceType, additionalUsage = 1) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.customerId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const usage = await planAccessService.getClientUsageStats(
        req.user.customerId,
        req.user.tenantId
      );

      if (!usage) {
        return res.status(403).json({ error: 'No active subscription' });
      }

      let limitExceeded = false;
      let errorMessage = '';
      let currentUsage = 0;
      let limit = 0;

      switch (resourceType) {
        case 'websites':
          currentUsage = usage.websites.count;
          limit = usage.websites.limit;
          limitExceeded = (currentUsage + additionalUsage) > limit;
          errorMessage = `Website limit exceeded. Your plan allows ${limit} websites, you currently have ${currentUsage}.`;
          break;

        case 'disk':
          currentUsage = usage.disk.used_gb;
          limit = usage.disk.limit_gb;
          limitExceeded = (currentUsage + additionalUsage) > limit;
          errorMessage = `Disk space limit exceeded. Your plan allows ${limit}GB, you have used ${currentUsage}GB.`;
          break;

        case 'bandwidth':
          currentUsage = usage.bandwidth.used_gb;
          limit = usage.bandwidth.limit_gb;
          limitExceeded = (currentUsage + additionalUsage) > limit;
          errorMessage = `Bandwidth limit exceeded. Your plan allows ${limit}GB, you have used ${currentUsage}GB.`;
          break;

        default:
          return res.status(400).json({ error: 'Invalid resource type' });
      }

      if (limitExceeded) {
        return res.status(403).json({
          error: errorMessage,
          current_usage: currentUsage,
          limit: limit,
          resource_type: resourceType,
          upgrade_url: '/client/plans/upgrade',
          upgrade_required: true
        });
      }

      req.usageCheck = {
        resource_type: resourceType,
        current: currentUsage,
        limit: limit,
        available: limit - currentUsage
      };

      next();
    } catch (error) {
      console.error('Usage limit check error:', error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  };
}

/**
 * Attach client's feature access to request
 * Usage: attachClientFeatures (always call this on client routes)
 */
export async function attachClientFeatures(req, res, next) {
  try {
    if (!req.user || !req.user.customerId) {
      return next();
    }

    const features = await planAccessService.getClientFeatureAccess(
      req.user.customerId,
      req.user.tenantId
    );

    // Attach to request for easy access in controllers
    req.clientFeatures = features.features;
    req.clientPlan = features.plan;
    req.clientUsage = features.usage;
    req.clientAddons = features.addons;

    next();
  } catch (error) {
    console.error('Attach client features error:', error);
    // Don't block request, just log error
    next();
  }
}

/**
 * Helper function to check if client has specific feature
 * Can be used in controllers: req.hasFeature('ssh_access')
 */
export function hasFeature(req, featureName) {
  return req.clientFeatures && req.clientFeatures[featureName] === true;
}

/**
 * Check if client can perform bulk operations
 * Usage: requireBulkOperationAccess(50) // Check if can perform 50 operations
 */
export function requireBulkOperationAccess(operationCount = 10) {
  return requireMinimumTier(operationCount > 10 ? 2 : 1); // Business logic: >10 requires Pro
}

/**
 * Rate limit based on plan tier
 * Higher tiers get higher rate limits
 */
export function tierBasedRateLimit() {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.customerId) {
        return next();
      }

      const subscription = await planAccessService.getClientActiveSubscription(
        req.user.customerId,
        req.user.tenantId
      );

      if (!subscription) {
        return next();
      }

      // Set rate limit based on tier
      const rateLimits = {
        1: 60,    // Starter: 60 req/min
        2: 120,   // Professional: 120 req/min
        3: 300,   // Business: 300 req/min
        4: 1000   // Enterprise: 1000 req/min
      };

      req.rateLimit = rateLimits[subscription.tier_level] || 60;
      next();
    } catch (error) {
      console.error('Tier-based rate limit error:', error);
      next();
    }
  };
}

/**
 * Warn if approaching usage limits
 * Adds warning to response headers
 */
export function warnApproachingLimits() {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.customerId) {
        return next();
      }

      const usage = await planAccessService.getClientUsageStats(
        req.user.customerId,
        req.user.tenantId
      );

      if (!usage) {
        return next();
      }

      const warnings = [];

      if (usage.disk.warning) {
        warnings.push(`disk:${usage.disk.percentage.toFixed(0)}%`);
      }
      if (usage.bandwidth.warning) {
        warnings.push(`bandwidth:${usage.bandwidth.percentage.toFixed(0)}%`);
      }
      if (usage.websites.warning) {
        warnings.push(`websites:${usage.websites.count}/${usage.websites.limit}`);
      }

      if (warnings.length > 0) {
        res.setHeader('X-Usage-Warning', warnings.join(', '));
      }

      next();
    } catch (error) {
      console.error('Usage warning error:', error);
      next();
    }
  };
}

export default {
  requirePlanFeature,
  requireMinimumTier,
  checkUsageLimit,
  attachClientFeatures,
  hasFeature,
  requireBulkOperationAccess,
  tierBasedRateLimit,
  warnApproachingLimits
};
