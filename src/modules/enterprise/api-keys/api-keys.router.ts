/**
 * ENTERPRISE API KEYS & WEBHOOKS Router
 * Routes: /api/enterprise/api-keys, /api/enterprise/webhooks
 */

import { Router } from 'express';
import * as apiKeysController from './api-keys.controller.js';

const router = Router();

// API Keys
router.get('/api-keys', apiKeysController.handleListApiKeys);
router.post('/api-keys', apiKeysController.handleCreateApiKey);
router.post('/api-keys/:id/revoke', apiKeysController.handleRevokeApiKey);

// Webhook Endpoints
router.get('/webhooks', apiKeysController.handleListWebhooks);
router.post('/webhooks', apiKeysController.handleCreateWebhook);
router.delete('/webhooks/:id', apiKeysController.handleDeleteWebhook);

// Webhook Deliveries
router.post('/webhooks/trigger', apiKeysController.handleTriggerWebhook);
router.get('/webhooks/deliveries', apiKeysController.handleListDeliveries);

export default router;
