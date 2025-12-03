/**
 * BILLING INVOICES Router
 * Routes: /api/billing/invoices
 */

import { Router } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import * as billingInvoicesController from './billing-invoices.controller.js';

const router = Router();

router.get('/', authMiddleware, requireRole('BILLING'), billingInvoicesController.handleListInvoices);
router.get('/:id', authMiddleware, requireRole('BILLING'), billingInvoicesController.handleGetInvoice);
router.post('/', authMiddleware, requireRole('ADMIN'), billingInvoicesController.handleCreateInvoice);
router.post('/:id/issue', authMiddleware, requireRole('ADMIN'), billingInvoicesController.handleIssueInvoice);
router.post('/:id/pay', authMiddleware, requireRole('ADMIN'), billingInvoicesController.handleRecordPayment);
router.post('/:id/void', authMiddleware, requireRole('ADMIN'), billingInvoicesController.handleVoidInvoice);

export default router;
