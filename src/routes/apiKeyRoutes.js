// src/routes/apiKeyRoutes.js
import express from 'express';
import * as apiKeyController from '../controllers/apiKeyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// API Key routes
router.get('/keys', apiKeyController.getKeys);
router.post('/keys', apiKeyController.createKey);
router.delete('/keys/:id', apiKeyController.revokeKey);

// Webhook routes
router.get('/webhooks', apiKeyController.getWebhooks);
router.post('/webhooks', apiKeyController.createWebhook);
router.put('/webhooks/:id', apiKeyController.updateWebhook);
router.delete('/webhooks/:id', apiKeyController.deleteWebhook);
router.get('/webhooks/:id/deliveries', apiKeyController.getDeliveries);

export default router;

