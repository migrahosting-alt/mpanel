const pool = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

/**
 * API Marketplace & Integrations Hub Service
 * 
 * Features:
 * - Custom webhooks with retry logic & exponential backoff
 * - OAuth 2.0 authorization server (RFC 6749)
 * - API key management with scopes & rate limiting
 * - Integration marketplace (Zapier, Make.com, n8n)
 * - Integration analytics & health monitoring
 * - Webhook event replay for debugging
 */

class IntegrationsService {
  constructor() {
    this.maxRetries = 5;
    this.retryDelays = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff
    this.oauthTokenExpiry = 3600; // 1 hour
    this.refreshTokenExpiry = 2592000; // 30 days
  }

  /**
   * Create custom webhook
   * 
   * @param {Object} webhookData
   * @returns {Promise<Object>}
   */
  async createWebhook(webhookData) {
    const {
      tenantId,
      userId,
      name,
      url,
      events, // Array of event types: ['user.created', 'invoice.paid', etc.]
      secret,
      isActive = true,
      headers = {},
      retryEnabled = true
    } = webhookData;

    try {
      // Generate secret if not provided
      const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

      const result = await pool.query(
        `INSERT INTO webhooks 
        (tenant_id, user_id, name, url, events, secret, is_active, headers, 
         retry_enabled, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [tenantId, userId, name, url, JSON.stringify(events), webhookSecret, 
         isActive, JSON.stringify(headers), retryEnabled]
      );

      const webhook = result.rows[0];
      webhook.events = JSON.parse(webhook.events);
      webhook.headers = JSON.parse(webhook.headers);

      logger.info('Webhook created', { webhookId: webhook.id, tenantId });

      return webhook;
    } catch (error) {
      logger.error('Failed to create webhook:', error);
      throw error;
    }
  }

  /**
   * Trigger webhook with retry logic
   * 
   * @param {number} webhookId
   * @param {string} event
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async triggerWebhook(webhookId, event, payload) {
    try {
      const webhookResult = await pool.query(
        'SELECT * FROM webhooks WHERE id = $1 AND is_active = true',
        [webhookId]
      );

      if (webhookResult.rows.length === 0) {
        throw new Error('Webhook not found or inactive');
      }

      const webhook = webhookResult.rows[0];
      const events = JSON.parse(webhook.events);

      // Check if webhook subscribes to this event
      if (!events.includes(event) && !events.includes('*')) {
        logger.debug('Webhook not subscribed to event', { webhookId, event });
        return { skipped: true };
      }

      // Create webhook delivery record
      const deliveryResult = await pool.query(
        `INSERT INTO webhook_deliveries 
        (webhook_id, event, payload, status, attempt, created_at)
        VALUES ($1, $2, $3, 'pending', 1, NOW())
        RETURNING *`,
        [webhookId, event, JSON.stringify(payload)]
      );

      const delivery = deliveryResult.rows[0];

      // Attempt delivery
      await this.deliverWebhook(webhook, delivery, payload);

      return delivery;
    } catch (error) {
      logger.error('Failed to trigger webhook:', error);
      throw error;
    }
  }

  /**
   * Deliver webhook with signature
   */
  async deliverWebhook(webhook, delivery, payload) {
    try {
      const headers = JSON.parse(webhook.headers || '{}');
      const timestamp = Math.floor(Date.now() / 1000);

      // Generate HMAC signature
      const signature = this.generateWebhookSignature(
        webhook.secret,
        timestamp,
        JSON.stringify(payload)
      );

      // Prepare request
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
        'X-Webhook-ID': delivery.id.toString(),
        'User-Agent': 'mPanel-Webhooks/1.0',
        ...headers
      };

      // Send webhook
      const response = await axios.post(webhook.url, payload, {
        headers: requestHeaders,
        timeout: 30000, // 30 seconds
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Update delivery as successful
      await pool.query(
        `UPDATE webhook_deliveries 
         SET status = 'success', response_code = $1, 
             response_body = $2, delivered_at = NOW()
         WHERE id = $3`,
        [response.status, JSON.stringify(response.data), delivery.id]
      );

      logger.info('Webhook delivered successfully', { 
        webhookId: webhook.id, 
        deliveryId: delivery.id 
      });

    } catch (error) {
      // Handle delivery failure
      await this.handleWebhookFailure(webhook, delivery, error);
    }
  }

  /**
   * Handle webhook delivery failure with retry
   */
  async handleWebhookFailure(webhook, delivery, error) {
    const errorMessage = error.response 
      ? `HTTP ${error.response.status}: ${error.response.statusText}`
      : error.message;

    const responseCode = error.response ? error.response.status : 0;

    await pool.query(
      `UPDATE webhook_deliveries 
       SET status = 'failed', response_code = $1, error_message = $2
       WHERE id = $3`,
      [responseCode, errorMessage, delivery.id]
    );

    // Schedule retry if enabled
    if (webhook.retry_enabled && delivery.attempt < this.maxRetries) {
      const nextAttempt = delivery.attempt + 1;
      const retryDelay = this.retryDelays[delivery.attempt - 1] || 30000;

      setTimeout(async () => {
        await this.retryWebhook(webhook, delivery, nextAttempt);
      }, retryDelay);

      logger.warn('Webhook delivery failed, retry scheduled', {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        attempt: delivery.attempt,
        nextAttempt,
        retryDelay
      });
    } else {
      logger.error('Webhook delivery failed permanently', {
        webhookId: webhook.id,
        deliveryId: delivery.id,
        error: errorMessage
      });
    }
  }

  /**
   * Retry webhook delivery
   */
  async retryWebhook(webhook, delivery, attempt) {
    try {
      await pool.query(
        'UPDATE webhook_deliveries SET attempt = $1, status = $2 WHERE id = $3',
        [attempt, 'retrying', delivery.id]
      );

      const payload = JSON.parse(delivery.payload);
      await this.deliverWebhook(webhook, { ...delivery, attempt }, payload);
    } catch (error) {
      logger.error('Webhook retry failed:', error);
    }
  }

  /**
   * Generate HMAC signature for webhook
   */
  generateWebhookSignature(secret, timestamp, payload) {
    const signedPayload = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
  }

  /**
   * Verify webhook signature (for incoming webhooks from external services)
   */
  verifyWebhookSignature(secret, signature, timestamp, payload) {
    const expectedSignature = this.generateWebhookSignature(secret, timestamp, payload);
    
    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Create OAuth 2.0 application
   * 
   * @param {Object} appData
   * @returns {Promise<Object>}
   */
  async createOAuthApp(appData) {
    const {
      tenantId,
      userId,
      name,
      description,
      redirectUris,
      scopes = ['read', 'write'],
      isPublic = false // Public clients (mobile/SPA) vs confidential (server)
    } = appData;

    try {
      // Generate client credentials
      const clientId = crypto.randomBytes(16).toString('hex');
      const clientSecret = isPublic ? null : crypto.randomBytes(32).toString('hex');

      const result = await pool.query(
        `INSERT INTO oauth_applications 
        (tenant_id, user_id, name, description, client_id, client_secret, 
         redirect_uris, scopes, is_public, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [tenantId, userId, name, description, clientId, clientSecret,
         JSON.stringify(redirectUris), JSON.stringify(scopes), isPublic]
      );

      const app = result.rows[0];
      app.redirect_uris = JSON.parse(app.redirect_uris);
      app.scopes = JSON.parse(app.scopes);

      logger.info('OAuth application created', { appId: app.id, clientId });

      return app;
    } catch (error) {
      logger.error('Failed to create OAuth application:', error);
      throw error;
    }
  }

  /**
   * Generate OAuth 2.0 authorization code
   * 
   * @param {string} clientId
   * @param {number} userId
   * @param {string} redirectUri
   * @param {Array} scopes
   * @returns {Promise<string>}
   */
  async generateAuthorizationCode(clientId, userId, redirectUri, scopes = []) {
    try {
      // Verify application exists
      const appResult = await pool.query(
        'SELECT * FROM oauth_applications WHERE client_id = $1',
        [clientId]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Invalid client_id');
      }

      const app = appResult.rows[0];
      const allowedRedirectUris = JSON.parse(app.redirect_uris);

      // Verify redirect URI
      if (!allowedRedirectUris.includes(redirectUri)) {
        throw new Error('Invalid redirect_uri');
      }

      // Verify scopes
      const allowedScopes = JSON.parse(app.scopes);
      const invalidScopes = scopes.filter(s => !allowedScopes.includes(s));
      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes: ${invalidScopes.join(', ')}`);
      }

      // Generate authorization code
      const code = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      await pool.query(
        `INSERT INTO oauth_authorization_codes 
        (code, client_id, user_id, redirect_uri, scopes, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [code, clientId, userId, redirectUri, JSON.stringify(scopes), expiresAt]
      );

      return code;
    } catch (error) {
      logger.error('Failed to generate authorization code:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for access token
   * 
   * @param {string} code
   * @param {string} clientId
   * @param {string} clientSecret
   * @param {string} redirectUri
   * @returns {Promise<Object>}
   */
  async exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
    try {
      // Verify application
      const appResult = await pool.query(
        'SELECT * FROM oauth_applications WHERE client_id = $1',
        [clientId]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Invalid client_id');
      }

      const app = appResult.rows[0];

      // Verify client secret (for confidential clients)
      if (!app.is_public && app.client_secret !== clientSecret) {
        throw new Error('Invalid client_secret');
      }

      // Get authorization code
      const codeResult = await pool.query(
        `SELECT * FROM oauth_authorization_codes 
         WHERE code = $1 AND client_id = $2 AND used_at IS NULL
         AND expires_at > NOW()`,
        [code, clientId]
      );

      if (codeResult.rows.length === 0) {
        throw new Error('Invalid or expired authorization code');
      }

      const authCode = codeResult.rows[0];

      // Verify redirect URI matches
      if (authCode.redirect_uri !== redirectUri) {
        throw new Error('Invalid redirect_uri');
      }

      // Mark code as used
      await pool.query(
        'UPDATE oauth_authorization_codes SET used_at = NOW() WHERE id = $1',
        [authCode.id]
      );

      // Generate tokens
      const tokens = await this.generateTokens(
        authCode.client_id,
        authCode.user_id,
        JSON.parse(authCode.scopes)
      );

      return tokens;
    } catch (error) {
      logger.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(clientId, userId, scopes) {
    // Generate access token (JWT)
    const accessToken = jwt.sign(
      {
        client_id: clientId,
        user_id: userId,
        scopes
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: this.oauthTokenExpiry }
    );

    // Generate refresh token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + this.refreshTokenExpiry * 1000);

    // Store refresh token
    await pool.query(
      `INSERT INTO oauth_refresh_tokens 
      (token, client_id, user_id, scopes, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())`,
      [refreshToken, clientId, userId, JSON.stringify(scopes), refreshExpiresAt]
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.oauthTokenExpiry,
      refresh_token: refreshToken,
      scope: scopes.join(' ')
    };
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken, clientId, clientSecret) {
    try {
      // Verify application
      const appResult = await pool.query(
        'SELECT * FROM oauth_applications WHERE client_id = $1',
        [clientId]
      );

      if (appResult.rows.length === 0) {
        throw new Error('Invalid client_id');
      }

      const app = appResult.rows[0];

      // Verify client secret (for confidential clients)
      if (!app.is_public && app.client_secret !== clientSecret) {
        throw new Error('Invalid client_secret');
      }

      // Get refresh token
      const tokenResult = await pool.query(
        `SELECT * FROM oauth_refresh_tokens 
         WHERE token = $1 AND client_id = $2 AND revoked_at IS NULL
         AND expires_at > NOW()`,
        [refreshToken, clientId]
      );

      if (tokenResult.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const storedToken = tokenResult.rows[0];
      const scopes = JSON.parse(storedToken.scopes);

      // Generate new access token
      const accessToken = jwt.sign(
        {
          client_id: clientId,
          user_id: storedToken.user_id,
          scopes
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: this.oauthTokenExpiry }
      );

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: this.oauthTokenExpiry,
        scope: scopes.join(' ')
      };
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Create API key
   * 
   * @param {Object} keyData
   * @returns {Promise<Object>}
   */
  async createAPIKey(keyData) {
    const {
      tenantId,
      userId,
      name,
      scopes = ['read'],
      expiresAt = null,
      rateLimit = 1000 // requests per hour
    } = keyData;

    try {
      // Generate API key
      const apiKey = 'mpanel_' + crypto.randomBytes(32).toString('hex');
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      const result = await pool.query(
        `INSERT INTO api_keys 
        (tenant_id, user_id, name, key_hash, key_prefix, scopes, 
         rate_limit, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [tenantId, userId, name, hashedKey, apiKey.substring(0, 12), 
         JSON.stringify(scopes), rateLimit, expiresAt]
      );

      const key = result.rows[0];
      key.scopes = JSON.parse(key.scopes);

      // Return plaintext key only once
      return {
        ...key,
        key: apiKey, // Only shown on creation
        message: 'Save this key securely - it will not be shown again'
      };
    } catch (error) {
      logger.error('Failed to create API key:', error);
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(apiKey) {
    try {
      const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

      const result = await pool.query(
        `SELECT ak.*, t.id as tenant_id, u.id as user_id
         FROM api_keys ak
         JOIN tenants t ON ak.tenant_id = t.id
         JOIN users u ON ak.user_id = u.id
         WHERE ak.key_hash = $1 
           AND ak.is_active = true
           AND (ak.expires_at IS NULL OR ak.expires_at > NOW())`,
        [hashedKey]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const key = result.rows[0];

      // Update last used
      await pool.query(
        'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
        [key.id]
      );

      // Check rate limit
      const isRateLimited = await this.checkAPIKeyRateLimit(key.id, key.rate_limit);
      
      if (isRateLimited) {
        throw new Error('API key rate limit exceeded');
      }

      return {
        ...key,
        scopes: JSON.parse(key.scopes)
      };
    } catch (error) {
      logger.error('Failed to validate API key:', error);
      throw error;
    }
  }

  /**
   * Check API key rate limit
   */
  async checkAPIKeyRateLimit(keyId, rateLimit) {
    const hour = new Date();
    hour.setMinutes(0, 0, 0);

    const result = await pool.query(
      `SELECT COUNT(*) as request_count
       FROM api_key_usage
       WHERE api_key_id = $1 AND created_at >= $2`,
      [keyId, hour]
    );

    const requestCount = parseInt(result.rows[0].request_count);

    // Record this request
    await pool.query(
      'INSERT INTO api_key_usage (api_key_id, created_at) VALUES ($1, NOW())',
      [keyId]
    );

    return requestCount >= rateLimit;
  }

  /**
   * Get integration analytics
   */
  async getIntegrationAnalytics(tenantId, startDate, endDate) {
    try {
      // Webhook success rate
      const webhookStats = await pool.query(
        `SELECT 
          w.id,
          w.name,
          COUNT(wd.id) as total_deliveries,
          COUNT(CASE WHEN wd.status = 'success' THEN 1 END) as successful,
          COUNT(CASE WHEN wd.status = 'failed' THEN 1 END) as failed,
          AVG(EXTRACT(EPOCH FROM (wd.delivered_at - wd.created_at))) as avg_delivery_time
         FROM webhooks w
         LEFT JOIN webhook_deliveries wd ON w.id = wd.webhook_id
         WHERE w.tenant_id = $1
           AND wd.created_at >= $2
           AND wd.created_at <= $3
         GROUP BY w.id, w.name`,
        [tenantId, startDate, endDate]
      );

      // API key usage
      const apiKeyStats = await pool.query(
        `SELECT 
          ak.name,
          COUNT(aku.id) as request_count,
          DATE_TRUNC('day', aku.created_at) as date
         FROM api_keys ak
         LEFT JOIN api_key_usage aku ON ak.id = aku.api_key_id
         WHERE ak.tenant_id = $1
           AND aku.created_at >= $2
           AND aku.created_at <= $3
         GROUP BY ak.name, date
         ORDER BY date DESC`,
        [tenantId, startDate, endDate]
      );

      // OAuth application usage
      const oauthStats = await pool.query(
        `SELECT 
          oa.name,
          COUNT(DISTINCT ort.user_id) as unique_users,
          COUNT(ort.id) as token_count
         FROM oauth_applications oa
         LEFT JOIN oauth_refresh_tokens ort ON oa.client_id = ort.client_id
         WHERE oa.tenant_id = $1
           AND ort.created_at >= $2
           AND ort.created_at <= $3
         GROUP BY oa.name`,
        [tenantId, startDate, endDate]
      );

      return {
        webhooks: webhookStats.rows,
        apiKeys: apiKeyStats.rows,
        oauthApps: oauthStats.rows
      };
    } catch (error) {
      logger.error('Failed to get integration analytics:', error);
      throw error;
    }
  }

  /**
   * Replay webhook delivery (for debugging)
   */
  async replayWebhook(deliveryId) {
    try {
      const deliveryResult = await pool.query(
        `SELECT wd.*, w.*
         FROM webhook_deliveries wd
         JOIN webhooks w ON wd.webhook_id = w.id
         WHERE wd.id = $1`,
        [deliveryId]
      );

      if (deliveryResult.rows.length === 0) {
        throw new Error('Delivery not found');
      }

      const delivery = deliveryResult.rows[0];
      const webhook = {
        id: delivery.webhook_id,
        url: delivery.url,
        secret: delivery.secret,
        headers: delivery.headers,
        retry_enabled: false // Don't retry replays
      };

      const payload = JSON.parse(delivery.payload);

      // Create new delivery record for replay
      const replayResult = await pool.query(
        `INSERT INTO webhook_deliveries 
        (webhook_id, event, payload, status, attempt, is_replay, created_at)
        VALUES ($1, $2, $3, 'pending', 1, true, NOW())
        RETURNING *`,
        [webhook.id, delivery.event, delivery.payload]
      );

      const replayDelivery = replayResult.rows[0];

      // Attempt delivery
      await this.deliverWebhook(webhook, replayDelivery, payload);

      return replayDelivery;
    } catch (error) {
      logger.error('Failed to replay webhook:', error);
      throw error;
    }
  }
}

module.exports = new IntegrationsService();
