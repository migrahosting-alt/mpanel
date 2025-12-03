import { Router } from 'express';
import { authMiddleware } from '../../auth/auth.middleware.js';
import { requirePlatformPermission } from '../../../middleware/rbac.middleware.js';
import {
  listShieldPolicies,
  createShieldPolicy,
  updateShieldPolicy,
  listShieldDecisions,
} from './shield.controller.js';

const router = Router();

router.use(authMiddleware);
router.use(requirePlatformPermission('platform:shield:manage'));

router.get('/policies', listShieldPolicies);
router.post('/policies', createShieldPolicy);
router.patch('/policies/:id', updateShieldPolicy);
router.get('/decisions', listShieldDecisions);

export default router;
