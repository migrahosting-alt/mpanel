import quotaService from '../services/quotaService.js';
import logger from '../config/logger.js';

/**
 * Quota tracking middleware
 * Tracks API usage and enforces quota limits
 */
export const trackQuota = async (req, res, next) => {
  try {
    // Skip if no API key authentication
    if (!req.apiKey || !req.apiKey.id) {
      return next();
    }

    const apiKeyId = req.apiKey.id;
    
    // Check quota before processing request
    const quotaCheck = await quotaService.checkQuota(apiKeyId);
    
    if (!quotaCheck.allowed) {
      return res.status(429).json({
        error: 'Quota exceeded',
        message: 'API quota limit reached. Please upgrade your plan or wait for quota reset.',
        usage: quotaCheck.usage,
        quota: quotaCheck.quota,
        withinQuota: quotaCheck.withinQuota
      });
    }
    
    // Store quota info for response headers
    req.quotaInfo = quotaCheck;
    
    // Track usage after response
    const originalSend = res.send;
    res.send = function(data) {
      // Calculate response size
      const responseSize = Buffer.byteLength(JSON.stringify(data));
      
      // Track usage asynchronously
      quotaService.trackUsage(apiKeyId, {
        endpoint: req.path,
        method: req.method,
        responseSize
      }).catch(error => {
        logger.error('Error tracking quota usage:', error);
      });
      
      // Add quota headers
      res.setHeader('X-RateLimit-Limit-Hourly', quotaCheck.quota.hourly);
      res.setHeader('X-RateLimit-Limit-Daily', quotaCheck.quota.daily);
      res.setHeader('X-RateLimit-Limit-Monthly', quotaCheck.quota.monthly);
      res.setHeader('X-RateLimit-Remaining-Hourly', Math.max(0, quotaCheck.quota.hourly - quotaCheck.usage.hourly));
      res.setHeader('X-RateLimit-Remaining-Daily', Math.max(0, quotaCheck.quota.daily - quotaCheck.usage.daily));
      res.setHeader('X-RateLimit-Remaining-Monthly', Math.max(0, quotaCheck.quota.monthly - quotaCheck.usage.monthly));
      
      return originalSend.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Error in quota middleware:', error);
    // Don't block request on quota tracking errors
    next();
  }
};

/**
 * Get quota status
 */
export const getQuotaStatus = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    
    // Ensure user owns this API key
    if (req.apiKey && req.apiKey.id !== apiKeyId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const [quota, check, stats] = await Promise.all([
      quotaService.getQuota(apiKeyId),
      quotaService.checkQuota(apiKeyId),
      quotaService.getUsageStats(apiKeyId, { period: 'day', limit: 7 })
    ]);
    
    res.json({
      quota,
      current: check,
      history: stats
    });
  } catch (error) {
    logger.error('Error getting quota status:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get usage statistics
 */
export const getUsageStats = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { period, limit } = req.query;
    
    const stats = await quotaService.getUsageStats(apiKeyId, {
      period,
      limit: limit ? parseInt(limit) : undefined
    });
    
    res.json(stats);
  } catch (error) {
    logger.error('Error getting usage stats:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Calculate overage
 */
export const calculateOverage = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { period } = req.query;
    
    const overage = await quotaService.calculateOverage(apiKeyId, { period });
    
    res.json(overage);
  } catch (error) {
    logger.error('Error calculating overage:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update quota configuration (admin only)
 */
export const updateQuota = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const quota = await quotaService.updateQuota(apiKeyId, req.body);
    
    res.json(quota);
  } catch (error) {
    logger.error('Error updating quota:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset quota (admin only)
 */
export const resetQuota = async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { period } = req.body;
    
    await quotaService.resetQuota(apiKeyId, period);
    
    res.json({ message: 'Quota reset successfully' });
  } catch (error) {
    logger.error('Error resetting quota:', error);
    res.status(500).json({ error: error.message });
  }
};
