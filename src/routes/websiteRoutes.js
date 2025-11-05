import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createWebsite,
  getWebsites,
  getWebsite,
  updateWebsite,
  updateSSL,
  deployWebsite
} from '../controllers/websiteController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createWebsite);
router.get('/', getWebsites);
router.get('/:id', getWebsite);
router.put('/:id', updateWebsite);
router.put('/:id/ssl', updateSSL);
router.post('/:id/deploy', deployWebsite);

export default router;
