/**
 * BILLING INVOICES Types
 * Immutable invoice system with payments and credit notes
 */

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  SENT = 'SENT',
  PAID = 'PAID',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
}

export enum InvoiceSource {
  MANUAL = 'MANUAL',
  SUBSCRIPTION = 'SUBSCRIPTION',
  USAGE = 'USAGE',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum LineType {
  ITEM = 'ITEM',
  DISCOUNT = 'DISCOUNT',
  TAX = 'TAX',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  status: InvoiceStatus;
  issueDate: Date | null;
  dueDate: Date | null;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  balanceDue: number;
  currency: string;
  source: InvoiceSource;
  billTo: Record<string, any> | null;
  notes: string | null;
  termsAndConditions: string | null;
  pdfUrl: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
  createdById: string | null;
  updatedById: string | null;
}

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  lineType: LineType;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  productId: string | null;
  subscriptionId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  metadata: Record<string, any> | null;
  sortOrder: number;
  createdAt: Date;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string; // stripe, bank_transfer, credit, manual
  transactionId: string | null;
  gatewayResponse: Record<string, any> | null;
  notes: string | null;
  processedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  creditNoteNumber: string;
  amount: number;
  currency: string;
  reason: string | null;
  status: string;
  issueDate: Date;
  appliedToInvoiceId: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  createdById: string | null;
}

export interface CreateInvoiceRequest {
  tenantId: string;
  currency?: string;
  dueInDays?: number;
  billTo?: Record<string, any>;
  notes?: string;
  lines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    productId?: string;
    taxPercent?: number;
  }>;
}

export interface UpdateInvoiceRequest {
  notes?: string;
  dueDate?: Date;
  lines?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    productId?: string;
    taxPercent?: number;
  }>;
}

export interface RecordPaymentRequest {
  amount: number;
  method: string;
  transactionId?: string;
  notes?: string;
  processedAt?: Date;
}
