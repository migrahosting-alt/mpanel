import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createMailbox,
  getMailboxes,
  getMailbox,
  updatePassword,
  updateQuota,
  suspendMailbox,
  activateMailbox,
  deleteMailbox
} from '../controllers/mailboxController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createMailbox);
router.get('/', getMailboxes);
router.get('/:id', getMailbox);
router.put('/:id/password', updatePassword);
router.put('/:id/quota', updateQuota);
router.post('/:id/suspend', suspendMailbox);
router.post('/:id/activate', activateMailbox);
router.delete('/:id', deleteMailbox);

export default router;

