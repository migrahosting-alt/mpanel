import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import logger from '../config/logger.js';

dotenv.config();

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify transporter configuration
if (process.env.NODE_ENV !== 'test') {
  transporter.verify((error, success) => {
    if (error) {
      logger.error('SMTP configuration error:', error);
    } else {
      logger.info('SMTP server is ready to send emails');
    }
  });
}

/**
 * Send invoice email
 */
export async function sendInvoiceEmail(invoice, customer) {
  const subject = `Invoice ${invoice.invoice_number} - ${invoice.total} ${invoice.currency}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Invoice ${invoice.invoice_number}</h2>
      <p>Dear ${customer.first_name || 'Customer'},</p>
      <p>Please find your invoice details below:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Invoice Number</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${invoice.total} ${invoice.currency}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Due Date</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${new Date(invoice.due_date).toLocaleDateString()}</td>
        </tr>
      </table>
      <p>You can view and pay this invoice online at: <a href="${process.env.CORS_ORIGIN}/invoices/${invoice.id}">View Invoice</a></p>
      <p>Thank you for your business!</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: customer.email,
      subject,
      html,
    });

    logger.info(`Invoice email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending invoice email:', error);
    throw error;
  }
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(payment, invoice, customer) {
  const subject = `Payment Confirmation - ${payment.amount} ${payment.currency}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payment Confirmed</h2>
      <p>Dear ${customer.first_name || 'Customer'},</p>
      <p>Your payment has been successfully processed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Invoice Number</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${invoice.invoice_number}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount Paid</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${payment.amount} ${payment.currency}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Method</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${payment.payment_method}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Transaction ID</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${payment.transaction_id}</td>
        </tr>
      </table>
      <p>Thank you for your payment!</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: customer.email,
      subject,
      html,
    });

    logger.info(`Payment confirmation email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending payment confirmation email:', error);
    throw error;
  }
}

/**
 * Send subscription renewal reminder
 */
export async function sendRenewalReminderEmail(subscription, customer) {
  const subject = `Subscription Renewal Reminder`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Subscription Renewal Reminder</h2>
      <p>Dear ${customer.first_name || 'Customer'},</p>
      <p>This is a reminder that your subscription will renew soon.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f5f5f5;">
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Service</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${subscription.product_name}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Amount</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${subscription.price} ${customer.currency || 'USD'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border: 1px solid #ddd;"><strong>Next Billing Date</strong></td>
          <td style="padding: 10px; border: 1px solid #ddd;">${new Date(subscription.next_billing_date).toLocaleDateString()}</td>
        </tr>
      </table>
      <p>Your subscription will automatically renew. If you wish to cancel, please visit your account settings.</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: customer.email,
      subject,
      html,
    });

    logger.info(`Renewal reminder email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending renewal reminder email:', error);
    throw error;
  }
}

export default {
  sendInvoiceEmail,
  sendPaymentConfirmationEmail,
  sendRenewalReminderEmail,
};
