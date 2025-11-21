import db from '../db/index.js';
import logger from '../config/logger.js';
import { cache, CacheTTL, CacheNamespace } from './cache.js';

/**
 * Quota Service
 * Manages API quotas and usage tracking per API key
 */
class QuotaService {
  constructor() {
    // Default quota limits by plan
    this.defaultQuotas = {
      free: {
        requestsPerHour: 100,
        requestsPerDay: 1000,
        requestsPerMonth: 10000,
        maxStorage: 1024 * 1024 * 100, // 100MB
        maxBandwidth: 1024 * 1024 * 1024, // 1GB
        maxDomains: 1,
        maxWebsites: 1,
        maxDatabases: 1,
        maxEmailAccounts: 5
      },
      starter: {
        requestsPerHour: 500,
        requestsPerDay: 10000,
        requestsPerMonth: 100000,
        maxStorage: 1024 * 1024 * 1024 * 5, // 5GB
        maxBandwidth: 1024 * 1024 * 1024 * 50, // 50GB
        maxDomains: 5,
        maxWebsites: 5,
        maxDatabases: 10,
        maxEmailAccounts: 25
      },
      professional: {
        requestsPerHour: 2000,
        requestsPerDay: 50000,
        requestsPerMonth: 500000,
        maxStorage: 1024 * 1024 * 1024 * 25, // 25GB
        maxBandwidth: 1024 * 1024 * 1024 * 250, // 250GB
        maxDomains: 25,
        maxWebsites: 25,
        maxDatabases: 50,
        maxEmailAccounts: 100
      },
      enterprise: {
        requestsPerHour: 10000,
        requestsPerDay: 250000,
        requestsPerMonth: 2500000,
        maxStorage: 1024 * 1024 * 1024 * 100, // 100GB
        maxBandwidth: 1024 * 1024 * 1024 * 1000, // 1TB
        maxDomains: -1, // Unlimited
        maxWebsites: -1,
        maxDatabases: -1,
        maxEmailAccounts: -1
      }
    };
  }

  /**
   * Get quota configuration for API key
   * @param {string} apiKeyId - API key ID
   * @returns {Promise<Object>} Quota configuration
   */
  async getQuota(apiKeyId) {
    const cacheKey = `quota:${apiKeyId}`;
    
    // Try cache first
    const cached = await cache.get(CacheNamespace.STATS, cacheKey);
    if (cached) return cached;

    try {
      const query = `
        SELECT 
          ak.id,
          ak.tenant_id,
          ak.plan_type,
          q.*
        FROM api_keys ak
        LEFT JOIN api_quotas q ON q.api_key_id = ak.id
        WHERE ak.id = $1
      `;

      const result = await db.query(query, [apiKeyId]);
      
      if (result.rows.length === 0) {
        throw new Error('API key not found');
      }

      const row = result.rows[0];
      const planType = row.plan_type || 'free';
      
      // Use custom quota if exists, otherwise use default for plan
      const quota = row.id ? {
        apiKeyId: row.id,
        requestsPerHour: row.requests_per_hour,
        requestsPerDay: row.requests_per_day,
        requestsPerMonth: row.requests_per_month,
        maxStorage: row.max_storage,
        maxBandwidth: row.max_bandwidth,
        maxDomains: row.max_domains,
        maxWebsites: row.max_websites,
        maxDatabases: row.max_databases,
        maxEmailAccounts: row.max_email_accounts,
        overageAllowed: row.overage_allowed || false,
        overageRate: row.overage_rate || 0
      } : {
        apiKeyId,
        ...this.defaultQuotas[planType],
        overageAllowed: false,
        overageRate: 0
      };

      // Cache for 1 hour
      await cache.set(CacheNamespace.STATS, cacheKey, quota, CacheTTL.LONG);
      
      return quota;
    } catch (error) {
      logger.error('Error getting quota:', error);
      throw new Error('Failed to retrieve quota configuration');
    }
  }

  /**
   * Track API request usage
   * @param {string} apiKeyId - API key ID
   * @param {Object} options - Request metadata
   * @returns {Promise<Object>} Usage status
   */
  async trackUsage(apiKeyId, options = {}) {
    try {
      const { endpoint, method, responseSize = 0 } = options;
      const now = new Date();
      
      // Get quota configuration
      const quota = await this.getQuota(apiKeyId);
      
      // Increment hourly/daily/monthly counters in Redis
      const hourKey = `usage:${apiKeyId}:hour:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
      const dayKey = `usage:${apiKeyId}:day:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
      const monthKey = `usage:${apiKeyId}:month:${now.getUTCFullYear()}-${now.getUTCMonth()}`;
      
      const [hourUsage, dayUsage, monthUsage] = await Promise.all([
        cache.incr(CacheNamespace.STATS, hourKey),
        cache.incr(CacheNamespace.STATS, dayKey),
        cache.incr(CacheNamespace.STATS, monthKey)
      ]);
      
      // Set TTL on keys
      await Promise.all([
        cache.client.expire(`${CacheNamespace.STATS}:${hourKey}`, 3600), // 1 hour
        cache.client.expire(`${CacheNamespace.STATS}:${dayKey}`, 86400), // 1 day
        cache.client.expire(`${CacheNamespace.STATS}:${monthKey}`, 2592000) // 30 days
      ]);
      
      // Log usage to database
      const insertQuery = `
        INSERT INTO api_usage_logs (
          api_key_id, 
          endpoint, 
          method, 
          response_size,
          timestamp
        )
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      await db.query(insertQuery, [
        apiKeyId,
        endpoint,
        method,
        responseSize,
        now
      ]);
      
      // Check if over quota
      const isOverQuota = {
        hour: quota.requestsPerHour !== -1 && hourUsage > quota.requestsPerHour,
        day: quota.requestsPerDay !== -1 && dayUsage > quota.requestsPerDay,
        month: quota.requestsPerMonth !== -1 && monthUsage > quota.requestsPerMonth
      };
      
      const overQuota = isOverQuota.hour || isOverQuota.day || isOverQuota.month;
      
      return {
        success: true,
        usage: {
          hourly: hourUsage,
          daily: dayUsage,
          monthly: monthUsage
        },
        quota: {
          hourly: quota.requestsPerHour,
          daily: quota.requestsPerDay,
          monthly: quota.requestsPerMonth
        },
        overQuota,
        isOverQuota,
        overageAllowed: quota.overageAllowed
      };
    } catch (error) {
      logger.error('Error tracking usage:', error);
      throw new Error('Failed to track API usage');
    }
  }

  /**
   * Check if API key is within quota
   * @param {string} apiKeyId - API key ID
   * @returns {Promise<Object>} Quota check result
   */
  async checkQuota(apiKeyId) {
    try {
      const quota = await this.getQuota(apiKeyId);
      const now = new Date();
      
      const hourKey = `usage:${apiKeyId}:hour:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
      const dayKey = `usage:${apiKeyId}:day:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
      const monthKey = `usage:${apiKeyId}:month:${now.getUTCFullYear()}-${now.getUTCMonth()}`;
      
      const [hourUsage, dayUsage, monthUsage] = await Promise.all([
        cache.get(CacheNamespace.STATS, hourKey),
        cache.get(CacheNamespace.STATS, dayKey),
        cache.get(CacheNamespace.STATS, monthKey)
      ]);
      
      const usage = {
        hourly: parseInt(hourUsage) || 0,
        daily: parseInt(dayUsage) || 0,
        monthly: parseInt(monthUsage) || 0
      };
      
      const withinQuota = {
        hour: quota.requestsPerHour === -1 || usage.hourly < quota.requestsPerHour,
        day: quota.requestsPerDay === -1 || usage.daily < quota.requestsPerDay,
        month: quota.requestsPerMonth === -1 || usage.monthly < quota.requestsPerMonth
      };
      
      const allowed = (withinQuota.hour && withinQuota.day && withinQuota.month) || quota.overageAllowed;
      
      return {
        allowed,
        usage,
        quota: {
          hourly: quota.requestsPerHour,
          daily: quota.requestsPerDay,
          monthly: quota.requestsPerMonth
        },
        withinQuota,
        overageAllowed: quota.overageAllowed
      };
    } catch (error) {
      logger.error('Error checking quota:', error);
      throw new Error('Failed to check API quota');
    }
  }

  /**
   * Get usage statistics
   * @param {string} apiKeyId - API key ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(apiKeyId, options = {}) {
    const { period = 'day', limit = 30 } = options;
    
    try {
      let query;
      let groupBy;
      
      switch (period) {
        case 'hour':
          groupBy = `DATE_TRUNC('hour', timestamp)`;
          break;
        case 'day':
          groupBy = `DATE_TRUNC('day', timestamp)`;
          break;
        case 'month':
          groupBy = `DATE_TRUNC('month', timestamp)`;
          break;
        default:
          groupBy = `DATE_TRUNC('day', timestamp)`;
      }
      
      query = `
        SELECT 
          ${groupBy} as period,
          COUNT(*) as request_count,
          SUM(response_size) as total_bytes,
          AVG(response_size) as avg_bytes,
          COUNT(DISTINCT endpoint) as unique_endpoints
        FROM api_usage_logs
        WHERE api_key_id = $1
          AND timestamp >= NOW() - INTERVAL '${limit} ${period}s'
        GROUP BY ${groupBy}
        ORDER BY period DESC
      `;
      
      const result = await db.query(query, [apiKeyId]);
      
      return {
        period,
        data: result.rows.map(row => ({
          period: row.period,
          requestCount: parseInt(row.request_count),
          totalBytes: parseInt(row.total_bytes) || 0,
          avgBytes: parseFloat(row.avg_bytes) || 0,
          uniqueEndpoints: parseInt(row.unique_endpoints)
        }))
      };
    } catch (error) {
      logger.error('Error getting usage stats:', error);
      throw new Error('Failed to retrieve usage statistics');
    }
  }

  /**
   * Calculate overage charges
   * @param {string} apiKeyId - API key ID
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Overage charges
   */
  async calculateOverage(apiKeyId, options = {}) {
    const { period = 'month' } = options;
    
    try {
      const quota = await this.getQuota(apiKeyId);
      const now = new Date();
      
      let periodKey;
      let quotaLimit;
      
      switch (period) {
        case 'hour':
          periodKey = `usage:${apiKeyId}:hour:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
          quotaLimit = quota.requestsPerHour;
          break;
        case 'day':
          periodKey = `usage:${apiKeyId}:day:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
          quotaLimit = quota.requestsPerDay;
          break;
        case 'month':
        default:
          periodKey = `usage:${apiKeyId}:month:${now.getUTCFullYear()}-${now.getUTCMonth()}`;
          quotaLimit = quota.requestsPerMonth;
      }
      
      const usage = parseInt(await cache.get(CacheNamespace.STATS, periodKey)) || 0;
      
      if (quotaLimit === -1 || usage <= quotaLimit) {
        return {
          overage: 0,
          charge: 0,
          currency: 'USD'
        };
      }
      
      const overage = usage - quotaLimit;
      const charge = overage * (quota.overageRate || 0);
      
      return {
        overage,
        charge: parseFloat(charge.toFixed(2)),
        currency: 'USD',
        usage,
        limit: quotaLimit,
        rate: quota.overageRate
      };
    } catch (error) {
      logger.error('Error calculating overage:', error);
      throw new Error('Failed to calculate overage charges');
    }
  }

  /**
   * Reset quota usage
   * @param {string} apiKeyId - API key ID
   * @param {string} period - Period to reset (hour, day, month)
   * @returns {Promise<boolean>} Success
   */
  async resetQuota(apiKeyId, period = 'all') {
    try {
      const now = new Date();
      const patterns = [];
      
      if (period === 'all' || period === 'hour') {
        patterns.push(`${CacheNamespace.STATS}:usage:${apiKeyId}:hour:*`);
      }
      if (period === 'all' || period === 'day') {
        patterns.push(`${CacheNamespace.STATS}:usage:${apiKeyId}:day:*`);
      }
      if (period === 'all' || period === 'month') {
        patterns.push(`${CacheNamespace.STATS}:usage:${apiKeyId}:month:*`);
      }
      
      for (const pattern of patterns) {
        await cache.delPattern(pattern);
      }
      
      logger.info(`Quota reset for API key ${apiKeyId}, period: ${period}`);
      return true;
    } catch (error) {
      logger.error('Error resetting quota:', error);
      throw new Error('Failed to reset quota');
    }
  }

  /**
   * Update quota configuration
   * @param {string} apiKeyId - API key ID
   * @param {Object} quotaConfig - Quota configuration
   * @returns {Promise<Object>} Updated quota
   */
  async updateQuota(apiKeyId, quotaConfig) {
    try {
      const {
        requestsPerHour,
        requestsPerDay,
        requestsPerMonth,
        maxStorage,
        maxBandwidth,
        maxDomains,
        maxWebsites,
        maxDatabases,
        maxEmailAccounts,
        overageAllowed,
        overageRate
      } = quotaConfig;
      
      // Check if quota exists
      const checkQuery = 'SELECT id FROM api_quotas WHERE api_key_id = $1';
      const checkResult = await db.query(checkQuery, [apiKeyId]);
      
      let query;
      let values;
      
      if (checkResult.rows.length > 0) {
        // Update existing
        query = `
          UPDATE api_quotas SET
            requests_per_hour = COALESCE($2, requests_per_hour),
            requests_per_day = COALESCE($3, requests_per_day),
            requests_per_month = COALESCE($4, requests_per_month),
            max_storage = COALESCE($5, max_storage),
            max_bandwidth = COALESCE($6, max_bandwidth),
            max_domains = COALESCE($7, max_domains),
            max_websites = COALESCE($8, max_websites),
            max_databases = COALESCE($9, max_databases),
            max_email_accounts = COALESCE($10, max_email_accounts),
            overage_allowed = COALESCE($11, overage_allowed),
            overage_rate = COALESCE($12, overage_rate),
            updated_at = NOW()
          WHERE api_key_id = $1
          RETURNING *
        `;
        values = [
          apiKeyId,
          requestsPerHour,
          requestsPerDay,
          requestsPerMonth,
          maxStorage,
          maxBandwidth,
          maxDomains,
          maxWebsites,
          maxDatabases,
          maxEmailAccounts,
          overageAllowed,
          overageRate
        ];
      } else {
        // Insert new
        query = `
          INSERT INTO api_quotas (
            api_key_id, requests_per_hour, requests_per_day, requests_per_month,
            max_storage, max_bandwidth, max_domains, max_websites,
            max_databases, max_email_accounts, overage_allowed, overage_rate
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;
        values = [
          apiKeyId,
          requestsPerHour,
          requestsPerDay,
          requestsPerMonth,
          maxStorage,
          maxBandwidth,
          maxDomains,
          maxWebsites,
          maxDatabases,
          maxEmailAccounts,
          overageAllowed,
          overageRate
        ];
      }
      
      const result = await db.query(query, values);
      
      // Invalidate cache
      await cache.del(CacheNamespace.STATS, `quota:${apiKeyId}`);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating quota:', error);
      throw new Error('Failed to update quota configuration');
    }
  }
}

export default new QuotaService();
