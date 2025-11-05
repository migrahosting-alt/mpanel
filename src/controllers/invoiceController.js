import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import BillingService from '../services/BillingService.js';
import StripeService from '../services/StripeService.js';
import logger from '../config/logger.js';

export const createInvoice = async (req, res) => {
  try {
    const invoiceData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const invoice = await Invoice.create(invoiceData);
    logger.info(`Invoice created: ${invoice.invoice_number}`, { userId: req.user.id });
    res.status(201).json(invoice);
  } catch (error) {
    logger.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const { customerId } = req.query;
    const { limit = 10, offset = 0 } = req.query;

    const invoices = await Invoice.findByCustomer(
      customerId, 
      parseInt(limit), 
      parseInt(offset)
    );
    res.json(invoices);
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
};

export const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    logger.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
};

export const payInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice already paid' });
    }

    const { paymentMethod, paymentToken } = req.body;

    let transactionId;
    if (paymentMethod === 'stripe') {
      // Process Stripe payment
      const paymentIntent = await StripeService.createPaymentIntent(
        invoice.total,
        invoice.currency,
        { invoiceId: invoice.id }
      );
      transactionId = paymentIntent.id;
    } else {
      transactionId = `manual-${Date.now()}`;
    }

    const payment = await BillingService.processPayment(invoice, {
      method: paymentMethod,
      transactionId,
      metadata: { paymentToken }
    });

    logger.info(`Invoice paid: ${invoice.invoice_number}`, { userId: req.user.id });
    res.json({ invoice, payment });
  } catch (error) {
    logger.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
};

export const getDueInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.getDueInvoices(req.user.tenantId);
    res.json(invoices);
  } catch (error) {
    logger.error('Error fetching due invoices:', error);
    res.status(500).json({ error: 'Failed to fetch due invoices' });
  }
};
