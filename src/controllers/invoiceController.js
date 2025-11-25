import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import BillingService from '../services/BillingService.js';
import StripeService from '../services/StripeService.js';
import logger from '../config/logger.js';
import { generateInvoicePDF } from '../services/pdfService.js';
import pool from '../db/index.js';
import { stripe } from '../config/stripeConfig.js';
import emailService from '../services/email.js';
import { shouldSendEmail } from '../controllers/emailPreferencesController.js';


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

/**
 * Get invoice PDF
 * GET /api/invoices/:id/pdf
 */
export const downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get invoice with customer details
    const result = await pool.query(
      `SELECT 
        i.*,
        u.email as customer_email,
        u.first_name,
        u.last_name
      FROM invoices i
      LEFT JOIN users u ON i.user_id = u.id
      WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    const customer = {
      email: invoice.customer_email,
      first_name: invoice.first_name,
      last_name: invoice.last_name,
    };

    const company = {
      name: 'MigraHosting',
      address: '123 Hosting Street',
      city: 'San Francisco, CA 94102',
      email: 'billing@migrahosting.com',
      website: 'https://migrahosting.com',
    };

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(invoice, customer, company);

    // Send email with PDF attachment if preferences allow
    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [invoice.user_id]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const shouldSend = await shouldSendEmail(user.id, 'invoice');
        
        if (shouldSend) {
          await emailService.sendInvoiceEmail(user, invoice, pdfBuffer);
          logger.info(`Invoice email sent to ${user.email}`, { invoiceId: invoice.id });
        }
      }
    } catch (emailError) {
      logger.error('Failed to send invoice email:', emailError);
      // Don't fail the request if email fails
    }

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoice_number}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
};

/**
 * Create Stripe payment intent for invoice
 * POST /api/invoices/:id/payment-intent
 */
export const createPaymentIntent = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const amountDue = invoice.total - (invoice.amount_paid || 0);

    if (amountDue <= 0) {
      return res.status(400).json({ error: 'No amount due' });
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountDue * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: amountDue,
    });
  } catch (error) {
    logger.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

/**
 * Mark invoice as paid (admin only)
 * POST /api/invoices/:id/mark-paid
 */
export const markInvoicePaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, notes } = req.body;

    const result = await pool.query(
      `UPDATE invoices 
       SET status = 'paid', 
           amount_paid = total,
           paid_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    // Send payment receipt email
    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [invoice.user_id]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const shouldSend = await shouldSendEmail(user.id, 'payment');
        
        if (shouldSend) {
          const payment = {
            amount: invoice.total,
            payment_method: payment_method || 'manual',
            created_at: new Date(),
          };
          await emailService.sendPaymentReceiptEmail(user, payment, invoice);
          logger.info(`Payment receipt sent to ${user.email}`, { invoiceId: invoice.id });
        }
      }
    } catch (emailError) {
      logger.error('Failed to send payment receipt:', emailError);
    }

    logger.info(`Invoice marked as paid: ${invoice.invoice_number}`, { userId: req.user.id });
    res.json({ invoice, message: 'Invoice marked as paid' });
  } catch (error) {
    logger.error('Error marking invoice as paid:', error);
    res.status(500).json({ error: 'Failed to mark invoice as paid' });
  }
};
