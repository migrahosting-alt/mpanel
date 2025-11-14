const express = require('express');
const router = express.Router();
const integrationsService = require('../services/integrationsService');
const auth = require('../middleware/auth');

/**
 * API Marketplace & Integrations Hub Routes
 */

// ===========================
// WEBHOOKS
// ===========================

// Create webhook
router.post('/webhooks', auth, async (req, res) => {
  try {
    const webhook = await integrationsService.createWebhook({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List webhooks
router.get('/webhooks', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM webhooks WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenantId]
    );

    const webhooks = result.rows.map(w => ({
      ...w,
      events: JSON.parse(w.events),
      headers: JSON.parse(w.headers)
    }));

    res.json(webhooks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get webhook details
router.get('/webhooks/:id', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM webhooks WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const webhook = result.rows[0];
    webhook.events = JSON.parse(webhook.events);
    webhook.headers = JSON.parse(webhook.headers);

    res.json(webhook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update webhook
router.patch('/webhooks/:id', auth, async (req, res) => {
  try {
    const { name, url, events, isActive, headers } = req.body;
    
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (url !== undefined) updates.url = url;
    if (events !== undefined) updates.events = JSON.stringify(events);
    if (isActive !== undefined) updates.is_active = isActive;
    if (headers !== undefined) updates.headers = JSON.stringify(headers);

    const setClause = Object.keys(updates)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');

    const result = await require('../config/database').query(
      `UPDATE webhooks SET ${setClause}, updated_at = NOW() 
       WHERE id = $1 AND tenant_id = $${Object.keys(updates).length + 2}
       RETURNING *`,
      [req.params.id, ...Object.values(updates), req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete webhook
router.delete('/webhooks/:id', auth, async (req, res) => {
  try {
    await require('../config/database').query(
      'DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger webhook (manual test)
router.post('/webhooks/:id/trigger', auth, async (req, res) => {
  try {
    const { event, payload } = req.body;
    
    const delivery = await integrationsService.triggerWebhook(
      parseInt(req.params.id),
      event,
      payload
    );

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get webhook deliveries
router.get('/webhooks/:id/deliveries', auth, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    let query = `
      SELECT wd.* FROM webhook_deliveries wd
      JOIN webhooks w ON wd.webhook_id = w.id
      WHERE w.id = $1 AND w.tenant_id = $2
    `;
    const params = [req.params.id, req.user.tenantId];

    if (status) {
      params.push(status);
      query += ` AND wd.status = $${params.length}`;
    }

    query += ` ORDER BY wd.created_at DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const result = await require('../config/database').query(query, params);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Replay webhook delivery
router.post('/webhooks/deliveries/:deliveryId/replay', auth, async (req, res) => {
  try {
    const delivery = await integrationsService.replayWebhook(parseInt(req.params.deliveryId));
    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// OAUTH 2.0
// ===========================

// Create OAuth application
router.post('/oauth/apps', auth, async (req, res) => {
  try {
    const app = await integrationsService.createOAuthApp({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(app);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List OAuth applications
router.get('/oauth/apps', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM oauth_applications WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenantId]
    );

    const apps = result.rows.map(app => ({
      ...app,
      redirect_uris: JSON.parse(app.redirect_uris),
      scopes: JSON.parse(app.scopes),
      client_secret: app.is_public ? null : '***hidden***' // Hide secret in list
    }));

    res.json(apps);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get OAuth application
router.get('/oauth/apps/:id', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM oauth_applications WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = result.rows[0];
    app.redirect_uris = JSON.parse(app.redirect_uris);
    app.scopes = JSON.parse(app.scopes);

    res.json(app);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OAuth authorization endpoint
router.post('/oauth/authorize', auth, async (req, res) => {
  try {
    const { client_id, redirect_uri, scope, state } = req.body;
    const scopes = scope ? scope.split(' ') : [];

    const code = await integrationsService.generateAuthorizationCode(
      client_id,
      req.user.id,
      redirect_uri,
      scopes
    );

    // In production, redirect to redirect_uri with code and state
    res.json({
      code,
      state,
      redirect_uri: `${redirect_uri}?code=${code}&state=${state}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// OAuth token endpoint
router.post('/oauth/token', async (req, res) => {
  try {
    const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = req.body;

    if (grant_type === 'authorization_code') {
      const tokens = await integrationsService.exchangeCodeForToken(
        code,
        client_id,
        client_secret,
        redirect_uri
      );
      res.json(tokens);
    } else if (grant_type === 'refresh_token') {
      const tokens = await integrationsService.refreshAccessToken(
        refresh_token,
        client_id,
        client_secret
      );
      res.json(tokens);
    } else {
      res.status(400).json({ error: 'Unsupported grant_type' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ===========================
// API KEYS
// ===========================

// Create API key
router.post('/api-keys', auth, async (req, res) => {
  try {
    const apiKey = await integrationsService.createAPIKey({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(apiKey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List API keys
router.get('/api-keys', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      `SELECT id, tenant_id, user_id, name, key_prefix, scopes, rate_limit, 
              is_active, last_used_at, expires_at, created_at
       FROM api_keys 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [req.user.tenantId]
    );

    const keys = result.rows.map(key => ({
      ...key,
      scopes: JSON.parse(key.scopes)
    }));

    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Revoke API key
router.delete('/api-keys/:id', auth, async (req, res) => {
  try {
    await require('../config/database').query(
      'UPDATE api_keys SET is_active = false WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user.tenantId]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get API key usage stats
router.get('/api-keys/:id/usage', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const result = await require('../config/database').query(
      `SELECT 
        DATE_TRUNC('hour', aku.created_at) as hour,
        COUNT(*) as request_count
       FROM api_key_usage aku
       JOIN api_keys ak ON aku.api_key_id = ak.id
       WHERE ak.id = $1 
         AND ak.tenant_id = $2
         AND aku.created_at >= $3
         AND aku.created_at <= $4
       GROUP BY hour
       ORDER BY hour DESC`,
      [
        req.params.id,
        req.user.tenantId,
        startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate || new Date()
      ]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// ANALYTICS
// ===========================

// Get integration analytics
router.get('/analytics', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const analytics = await integrationsService.getIntegrationAnalytics(
      req.user.tenantId,
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date()
    );

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
