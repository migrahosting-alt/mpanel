import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../middleware/rbac.middleware.js';
import * as controller from './shield.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requirePlatformPermission());

// Zero Trust policies
router.get('/policies', controller.listPolicies);
router.get('/policies/:id', controller.getPolicy);
router.post('/policies', controller.createPolicy);
router.patch('/policies/:id', controller.updatePolicy);
router.delete('/policies/:id', controller.deletePolicy);

// WAF rules
router.get('/waf/rules', controller.listWAFRules);
router.post('/waf/rules', controller.createWAFRule);
router.delete('/waf/rules/:id', controller.deleteWAFRule);

// Security events
router.get('/events', controller.listSecurityEvents);
router.get('/events/:id', controller.getSecurityEvent);

// Analytics
router.get('/analytics', controller.getShieldAnalytics);

export default router;
