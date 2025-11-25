import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createInvoice,
  getInvoices,
  getInvoice,
  payInvoice,
  getDueInvoices,
  downloadInvoicePDF,
  createPaymentIntent,
  markInvoicePaid
} from '../controllers/invoiceController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', requireRole('admin', 'manager'), createInvoice);
router.get('/', getInvoices);
router.get('/due', requireRole('admin', 'manager'), getDueInvoices);
router.get('/:id', getInvoice);
router.get('/:id/pdf', downloadInvoicePDF);  // Download invoice PDF
router.post('/:id/pay', payInvoice);
router.post('/:id/payment-intent', createPaymentIntent);  // Create Stripe payment intent
router.post('/:id/mark-paid', requireRole('admin'), markInvoicePaid);  // Admin manual mark paid

export default router;

