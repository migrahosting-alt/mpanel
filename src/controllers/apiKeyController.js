// src/controllers/apiKeyController.js
/**
 * API Key Management Controller
 * Handles API key creation, revocation, and webhook management
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import crypto from 'crypto';

/**
 * Generate API key
 */
function generateApiKey() {
  return 'mpanel_' + crypto.randomBytes(32).toString('hex');
}

/**
 * Hash API key for storage
 */
function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Get all API keys for user
 */
export const getKeys = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, name, key_prefix, permissions, last_used, expires_at, created_at 
       FROM api_keys 
       WHERE user_id = $1 AND revoked = false
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ keys: result.rows });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
};

/**
 * Create API key
 */
export const createKey = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, permissions, expires_at } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 15) + '...';

    // Store hashed key
    const result = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix, permissions, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, key_prefix, permissions, expires_at, created_at`,
      [
        userId,
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions || ['read']),
        expires_at || null,
      ]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'api_key_created', `Created API key: ${name}`]
    );

    logger.info(`API key created: ${name}`);

    // Return API key only once
    res.status(201).json({
      ...result.rows[0],
      api_key: apiKey, // Only shown once
      warning: 'Save this API key now. You will not be able to see it again!',
    });
  } catch (error) {
    logger.error('Error creating API key:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
};

/**
 * Revoke API key
 */
export const revokeKey = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE api_keys 
       SET revoked = true, revoked_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING name`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'api_key_revoked', `Revoked API key: ${result.rows[0].name}`]
    );

    logger.info(`API key revoked: ${result.rows[0].name}`);
    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
};

/**
 * Verify API key (middleware)
 */
export const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const keyHash = hashApiKey(apiKey);

    const result = await pool.query(
      `SELECT ak.*, u.id as user_id, u.email, u.role
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_hash = $1 AND ak.revoked = false`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const keyData = result.rows[0];

    // Check expiration
    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    // Update last used timestamp
    await pool.query(
      `UPDATE api_keys SET last_used = NOW() WHERE id = $1`,
      [keyData.id]
    );

    // Attach user to request
    req.user = {
      id: keyData.user_id,
      email: keyData.email,
      role: keyData.role,
    };
    req.apiKey = {
      id: keyData.id,
      permissions: keyData.permissions,
    };

    next();
  } catch (error) {
    logger.error('Error verifying API key:', error);
    res.status(500).json({ error: 'Failed to verify API key' });
  }
};

/**
 * Get all webhooks
 */
export const getWebhooks = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ webhooks: result.rows });
  } catch (error) {
    logger.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
};

/**
 * Create webhook
 */
export const createWebhook = async (req, res) => {
  try {
    const userId = req.user.id;
    const { url, events, secret } = req.body;

    if (!url || !events || events.length === 0) {
      return res.status(400).json({ error: 'URL and events are required' });
    }

    // Generate secret if not provided
    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    const result = await pool.query(
      `INSERT INTO webhooks (user_id, url, events, secret)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, url, JSON.stringify(events), webhookSecret]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'webhook_created', `Created webhook for ${url}`]
    );

    logger.info(`Webhook created: ${url}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
};

/**
 * Update webhook
 */
export const updateWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { url, events, enabled } = req.body;

    const result = await pool.query(
      `UPDATE webhooks 
       SET url = COALESCE($1, url),
           events = COALESCE($2, events),
           enabled = COALESCE($3, enabled),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [
        url,
        events ? JSON.stringify(events) : null,
        enabled,
        id,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
};

/**
 * Delete webhook
 */
export const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM webhooks WHERE id = $1 AND user_id = $2 RETURNING url`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'webhook_deleted', `Deleted webhook for ${result.rows[0].url}`]
    );

    res.json({ message: 'Webhook deleted successfully' });
  } catch (error) {
    logger.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
};

/**
 * Get webhook deliveries
 */
export const getDeliveries = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify webhook ownership
    const webhook = await pool.query(
      `SELECT * FROM webhooks WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (webhook.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const result = await pool.query(
      `SELECT * FROM webhook_deliveries 
       WHERE webhook_id = $1 
       ORDER BY created_at DESC 
       LIMIT 100`,
      [id]
    );

    res.json({ deliveries: result.rows });
  } catch (error) {
    logger.error('Error fetching webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
};

/**
 * Trigger webhook
 */
export const triggerWebhook = async (webhookId, event, payload) => {
  try {
    const webhook = await pool.query(
      `SELECT * FROM webhooks WHERE id = $1 AND enabled = true`,
      [webhookId]
    );

    if (webhook.rows.length === 0) {
      return;
    }

    const webhookData = webhook.rows[0];

    // Check if webhook listens to this event
    const events = webhookData.events;
    if (!events.includes(event)) {
      return;
    }

    // Create signature
    const signature = crypto
      .createHmac('sha256', webhookData.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Send webhook
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(webhookData.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': event,
      },
      body: JSON.stringify(payload),
    });

    const statusCode = response.status;
    const responseBody = await response.text();

    // Record delivery
    await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, status_code, response, success)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        webhookId,
        event,
        JSON.stringify(payload),
        statusCode,
        responseBody,
        statusCode >= 200 && statusCode < 300,
      ]
    );

    logger.info(`Webhook delivered: ${webhookData.url} - ${event} - ${statusCode}`);
  } catch (error) {
    logger.error('Error triggering webhook:', error);

    // Record failed delivery
    await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event, payload, success, error)
       VALUES ($1, $2, $3, $4, $5)`,
      [webhookId, event, JSON.stringify(payload), false, error.message]
    );
  }
};

/**
 * Trigger all webhooks for an event
 */
export const triggerWebhooks = async (userId, event, payload) => {
  try {
    const webhooks = await pool.query(
      `SELECT id FROM webhooks WHERE user_id = $1 AND enabled = true`,
      [userId]
    );

    for (const webhook of webhooks.rows) {
      await triggerWebhook(webhook.id, event, payload);
    }
  } catch (error) {
    logger.error('Error triggering webhooks:', error);
  }
};
