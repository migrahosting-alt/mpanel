// src/routes/emailPreferencesRoutes.js
import express from 'express';
import * as emailPreferencesController from '../controllers/emailPreferencesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/email-preferences - Get user's email preferences
router.get('/', emailPreferencesController.getEmailPreferences);

// PUT /api/email-preferences - Update email preferences
router.put('/', emailPreferencesController.updateEmailPreferences);

export default router;
