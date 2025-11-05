import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  payInvoice,
  getDueInvoices
} from '../controllers/invoiceController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', requireRole('admin', 'manager'), createInvoice);
router.get('/', getInvoices);
router.get('/due', requireRole('admin', 'manager'), getDueInvoices);
router.get('/:id', getInvoice);
router.post('/:id/pay', payInvoice);

export default router;
