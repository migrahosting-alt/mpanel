/**
 * BILLING INVOICES Service
 * Invoice lifecycle with immutable amounts after issue
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import {
  InvoiceStatus,
  type Invoice,
  type InvoiceLine,
  type Payment,
  type CreateInvoiceRequest,
  type UpdateInvoiceRequest,
  type RecordPaymentRequest,
} from './billing-invoices.types.js';

// Generate unique invoice number
async function generateInvoiceNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  
  try {
    // @ts-ignore
    const count = await prisma.invoice.count({
      where: { tenantId, invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    
    const sequence = (count + 1).toString().padStart(6, '0');
    return `INV-${year}-${sequence}`;
  } catch {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `INV-${year}-${random}`;
  }
}

// Calculate invoice totals
function calculateTotals(lines: InvoiceLine[]): {
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
} {
  let subtotal = 0;
  let taxTotal = 0;
  let discountTotal = 0;

  for (const line of lines) {
    subtotal += line.subtotal;
    taxTotal += line.taxAmount;
    if (line.lineType === 'DISCOUNT') {
      discountTotal += Math.abs(line.total);
    }
  }

  const total = subtotal + taxTotal - discountTotal;

  return { subtotal, taxTotal, discountTotal, total };
}

export async function listInvoices(filters: {
  status?: InvoiceStatus;
  tenantId?: string;
  fromDate?: Date;
  toDate?: Date;
  minTotal?: number;
  maxTotal?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Invoice[]; total: number }> {
  const { status, tenantId, fromDate, toDate, minTotal, maxTotal, search, page = 1, pageSize = 50 } = filters;

  const where: any = {};
  
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (fromDate) where.issueDate = { gte: fromDate };
  if (toDate) where.issueDate = { ...where.issueDate, lte: toDate };
  if (minTotal) where.total = { gte: minTotal };
  if (maxTotal) where.total = { ...where.total, lte: maxTotal };
  if (search) {
    where.OR = [
      { invoiceNumber: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    // @ts-ignore
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return { items, total };
  } catch (error) {
    logger.error('Failed to list invoices', { error });
    return { items: [], total: 0 };
  }
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  try {
    // @ts-ignore
    const invoice = await prisma.invoice.findFirst({
      where: { id },
    });
    return invoice;
  } catch {
    return null;
  }
}

export async function createDraftInvoice(
  data: CreateInvoiceRequest,
  actorId: string
): Promise<Invoice> {
  const { tenantId, currency = 'USD', dueInDays = 30, billTo, notes, lines = [] } = data;

  // Create invoice in DRAFT status
  // @ts-ignore
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: '', // Generated on issue
      tenantId,
      status: 'DRAFT',
      issueDate: null,
      dueDate: null,
      subtotal: 0,
      taxTotal: 0,
      discountTotal: 0,
      total: 0,
      balanceDue: 0,
      currency,
      source: 'MANUAL',
      billTo: billTo || null,
      notes: notes || null,
      termsAndConditions: null,
      pdfUrl: null,
      metadata: null,
      createdById: actorId,
      updatedById: null,
    },
  });

  // Add lines if provided
  if (lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const subtotal = line.quantity * line.unitPrice;
      const taxAmount = subtotal * (line.taxPercent || 0) / 100;
      
      // @ts-ignore
      await prisma.invoiceLine.create({
        data: {
          invoiceId: invoice.id,
          lineType: 'ITEM',
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: 0,
          taxPercent: line.taxPercent || 0,
          subtotal,
          taxAmount,
          total: subtotal + taxAmount,
          productId: line.productId || null,
          subscriptionId: null,
          periodStart: null,
          periodEnd: null,
          metadata: null,
          sortOrder: i,
        },
      });
    }

    // Recalculate totals
    // @ts-ignore
    const invoiceLines = await prisma.invoiceLine.findMany({
      where: { invoiceId: invoice.id },
    });
    
    const totals = calculateTotals(invoiceLines);
    
    // @ts-ignore
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        discountTotal: totals.discountTotal,
        total: totals.total,
        balanceDue: totals.total,
      },
    });
  }

  logger.info('Draft invoice created', { invoiceId: invoice.id, tenantId });

  return await getInvoiceById(invoice.id) as Invoice;
}

export async function issueInvoice(id: string, actorId: string): Promise<Invoice> {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (invoice.status !== 'DRAFT') {
    throw new Error('Only draft invoices can be issued');
  }

  const invoiceNumber = await generateInvoiceNumber(invoice.tenantId);
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30); // Default 30 days

  // @ts-ignore
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      invoiceNumber,
      issueDate,
      dueDate,
      status: 'SENT',
      updatedById: actorId,
    },
  });

  logger.info('Invoice issued', { invoiceId: id, invoiceNumber });

  return updated;
}

export async function recordPayment(
  invoiceId: string,
  data: RecordPaymentRequest,
  actorId: string
): Promise<Payment> {
  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const { amount, method, transactionId, notes, processedAt } = data;

  // Create payment record
  // @ts-ignore
  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      currency: invoice.currency,
      status: 'SUCCESS',
      method,
      transactionId: transactionId || null,
      gatewayResponse: null,
      notes: notes || null,
      processedAt: processedAt || new Date(),
      createdBy: actorId,
    },
  });

  // Update invoice balance
  const newBalance = invoice.balanceDue - amount;
  let newStatus = invoice.status;

  if (newBalance <= 0) {
    newStatus = InvoiceStatus.PAID;
  } else if (newBalance < invoice.total) {
    newStatus = InvoiceStatus.PARTIALLY_PAID;
  }

  // @ts-ignore
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      balanceDue: Math.max(0, newBalance),
      status: newStatus,
      updatedById: actorId,
    },
  });

  logger.info('Payment recorded', { invoiceId, paymentId: payment.id, amount });

  return payment;
}

export async function voidInvoice(id: string, actorId: string): Promise<Invoice> {
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (!['DRAFT', 'PENDING', 'SENT'].includes(invoice.status)) {
    throw new Error('Cannot void invoice in current status');
  }

  // Check for successful payments
  try {
    // @ts-ignore
    const payments = await prisma.payment.findMany({
      where: { invoiceId: id, status: 'SUCCESS' },
    });

    if (payments.length > 0) {
      throw new Error('Cannot void invoice with successful payments');
    }
  } catch (error: any) {
    if (error.message.includes('Cannot void')) throw error;
  }

  // @ts-ignore
  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: 'VOID',
      balanceDue: 0,
      updatedById: actorId,
    },
  });

  logger.info('Invoice voided', { invoiceId: id });

  return updated;
}
