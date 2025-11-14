import db from '../db/index.js';
import logger from '../config/logger.js';
import { cache, CacheTTL, CacheNamespace } from './cache.js';

/**
 * Integration Service
 * Manages third-party integrations (Google Analytics, Social Media, SEO tools)
 */
class IntegrationService {
  /**
   * Connect Google Analytics
   * @param {number} websiteId - Website ID
   * @param {Object} config - GA configuration
   * @returns {Promise<Object>} Integration config
   */
  async connectGoogleAnalytics(websiteId, config) {
    try {
      const { measurementId, propertyId, apiKey } = config;

      const query = `
        INSERT INTO integrations (
          website_id,
          type,
          provider,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (website_id, type, provider)
        DO UPDATE SET
          config = $4,
          status = $5,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        'analytics',
        'google_analytics',
        JSON.stringify({ measurementId, propertyId, apiKey }),
        'active'
      ]);

      await cache.del(CacheNamespace.WEBSITE, `integrations:${websiteId}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error connecting Google Analytics:', error);
      throw new Error('Failed to connect Google Analytics');
    }
  }

  /**
   * Connect Google Search Console
   * @param {number} websiteId - Website ID
   * @param {Object} config - GSC configuration
   * @returns {Promise<Object>} Integration config
   */
  async connectGoogleSearchConsole(websiteId, config) {
    try {
      const { siteUrl, verificationToken } = config;

      const query = `
        INSERT INTO integrations (
          website_id,
          type,
          provider,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (website_id, type, provider)
        DO UPDATE SET
          config = $4,
          status = $5,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        'seo',
        'google_search_console',
        JSON.stringify({ siteUrl, verificationToken }),
        'pending_verification'
      ]);

      await cache.del(CacheNamespace.WEBSITE, `integrations:${websiteId}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error connecting Google Search Console:', error);
      throw new Error('Failed to connect Google Search Console');
    }
  }

  /**
   * Connect Google My Business
   * @param {number} websiteId - Website ID
   * @param {Object} config - GMB configuration
   * @returns {Promise<Object>} Integration config
   */
  async connectGoogleMyBusiness(websiteId, config) {
    try {
      const { locationId, accountId, apiKey } = config;

      const query = `
        INSERT INTO integrations (
          website_id,
          type,
          provider,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (website_id, type, provider)
        DO UPDATE SET
          config = $4,
          status = $5,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        'business',
        'google_my_business',
        JSON.stringify({ locationId, accountId, apiKey }),
        'active'
      ]);

      await cache.del(CacheNamespace.WEBSITE, `integrations:${websiteId}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error connecting Google My Business:', error);
      throw new Error('Failed to connect Google My Business');
    }
  }

  /**
   * Connect Facebook Pixel
   * @param {number} websiteId - Website ID
   * @param {Object} config - FB Pixel configuration
   * @returns {Promise<Object>} Integration config
   */
  async connectFacebookPixel(websiteId, config) {
    try {
      const { pixelId, accessToken } = config;

      const query = `
        INSERT INTO integrations (
          website_id,
          type,
          provider,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (website_id, type, provider)
        DO UPDATE SET
          config = $4,
          status = $5,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        'analytics',
        'facebook_pixel',
        JSON.stringify({ pixelId, accessToken }),
        'active'
      ]);

      await cache.del(CacheNamespace.WEBSITE, `integrations:${websiteId}`);

      return result.rows[0];
    } catch (error) {
      logger.error('Error connecting Facebook Pixel:', error);
      throw new Error('Failed to connect Facebook Pixel');
    }
  }

  /**
   * Connect social media accounts
   * @param {number} websiteId - Website ID
   * @param {Object} config - Social media configuration
   * @returns {Promise<Object>} Integration config
   */
  async connectSocialMedia(websiteId, config) {
    try {
      const { platform, accountId, accessToken, refreshToken } = config;

      const query = `
        INSERT INTO integrations (
          website_id,
          type,
          provider,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (website_id, type, provider)
        DO UPDATE SET
          config = $4,
          status = $5,
          updated_at = NOW()
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        'social_media',
        platform,
        JSON.stringify({ accountId, accessToken, refreshToken }),
        'active'
      ]);

      await cache.del(CacheNamespace.WEBSITE, `integrations:${websiteId}`);

      return result.rows[0];
    } catch (error) {
      logger.error(`Error connecting ${config.platform}:`, error);
      throw new Error(`Failed to connect ${config.platform}`);
    }
  }

  /**
   * Get all integrations for a website
   * @param {number} websiteId - Website ID
   * @returns {Promise<Array>} Integrations
   */
  async getIntegrations(websiteId) {
    const cacheKey = `integrations:${websiteId}`;
    
    const cached = await cache.get(CacheNamespace.WEBSITE, cacheKey);
    if (cached) return cached;

    try {
      const query = `
        SELECT 
          id,
          website_id,
          type,
          provider,
          config,
          status,
          last_sync_at,
          created_at,
          updated_at
        FROM integrations
        WHERE website_id = $1
        ORDER BY type, provider
      `;

      const result = await db.query(query, [websiteId]);
      
      const integrations = result.rows.map(row => ({
        ...row,
        config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config
      }));

      await cache.set(CacheNamespace.WEBSITE, cacheKey, integrations, CacheTTL.LONG);

      return integrations;
    } catch (error) {
      logger.error('Error getting integrations:', error);
      throw new Error('Failed to retrieve integrations');
    }
  }

  /**
   * Disconnect integration
   * @param {number} integrationId - Integration ID
   * @returns {Promise<boolean>} Success
   */
  async disconnectIntegration(integrationId) {
    try {
      const query = `
        DELETE FROM integrations
        WHERE id = $1
        RETURNING website_id
      `;

      const result = await db.query(query, [integrationId]);
      
      if (result.rows.length > 0) {
        await cache.del(CacheNamespace.WEBSITE, `integrations:${result.rows[0].website_id}`);
      }

      return true;
    } catch (error) {
      logger.error('Error disconnecting integration:', error);
      throw new Error('Failed to disconnect integration');
    }
  }

  /**
   * Sync integration data
   * @param {number} integrationId - Integration ID
   * @returns {Promise<Object>} Sync result
   */
  async syncIntegration(integrationId) {
    try {
      const query = `
        UPDATE integrations
        SET last_sync_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [integrationId]);

      if (result.rows.length > 0) {
        await cache.del(CacheNamespace.WEBSITE, `integrations:${result.rows[0].website_id}`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error syncing integration:', error);
      throw new Error('Failed to sync integration');
    }
  }

  /**
   * Get analytics data from Google Analytics
   * @param {number} integrationId - Integration ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Analytics data
   */
  async getGoogleAnalyticsData(integrationId, options = {}) {
    try {
      const { startDate, endDate, metrics = ['pageViews', 'sessions', 'users'] } = options;

      // In production, this would call Google Analytics API
      // For now, return mock data
      return {
        metrics: {
          pageViews: 12543,
          sessions: 8234,
          users: 6789,
          bounceRate: 42.3,
          avgSessionDuration: 234
        },
        dateRange: { startDate, endDate },
        topPages: [
          { path: '/', views: 3421, uniqueViews: 2891 },
          { path: '/about', views: 1234, uniqueViews: 987 },
          { path: '/services', views: 892, uniqueViews: 745 }
        ],
        traffic: {
          organic: 45.2,
          direct: 28.3,
          social: 15.8,
          referral: 10.7
        }
      };
    } catch (error) {
      logger.error('Error getting Google Analytics data:', error);
      throw new Error('Failed to retrieve analytics data');
    }
  }
}

export default new IntegrationService();
