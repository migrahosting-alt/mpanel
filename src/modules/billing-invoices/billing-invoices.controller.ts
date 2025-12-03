/**
 * BILLING INVOICES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as billingInvoicesService from './billing-invoices.service.js';
import type {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  RecordPaymentRequest,
} from './billing-invoices.types.js';

export async function handleListInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      status: req.query.status as any,
      tenantId: req.query.tenantId as string,
      fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
      toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      minTotal: req.query.minTotal ? parseFloat(req.query.minTotal as string) : undefined,
      maxTotal: req.query.maxTotal ? parseFloat(req.query.maxTotal as string) : undefined,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    };

    const result = await billingInvoicesService.listInvoices(filters);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const invoice = await billingInvoicesService.getInvoiceById(id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.json(invoice);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateInvoiceRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const invoice = await billingInvoicesService.createDraftInvoice(data, actorId);
    return res.status(201).json(invoice);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleIssueInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const invoice = await billingInvoicesService.issueInvoice(id, actorId);
    return res.json(invoice);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRecordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: RecordPaymentRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const payment = await billingInvoicesService.recordPayment(id, data, actorId);
    return res.json(payment);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleVoidInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const invoice = await billingInvoicesService.voidInvoice(id, actorId);
    return res.json(invoice);
  } catch (error) {
    return next(error);
    next(error);
  }
}
