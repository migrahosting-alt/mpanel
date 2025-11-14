// src/services/pdfService.js
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

/**
 * Generate invoice PDF
 * @param {Object} invoice - Invoice object with line items
 * @param {Object} customer - Customer information
 * @param {Object} company - Company information
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateInvoicePDF(invoice, customer, company = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Company header
      doc
        .fontSize(20)
        .text(company.name || 'MigraHosting', 50, 50)
        .fontSize(10)
        .text(company.address || '123 Hosting Street', 50, 80)
        .text(company.city || 'San Francisco, CA 94102', 50, 95)
        .text(company.email || 'billing@migrahosting.com', 50, 110);

      // Invoice title and number
      doc
        .fontSize(20)
        .text('INVOICE', 400, 50)
        .fontSize(10)
        .text(`Invoice #: ${invoice.invoice_number}`, 400, 80)
        .text(`Date: ${new Date(invoice.created_at).toLocaleDateString()}`, 400, 95)
        .text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString()}`, 400, 110)
        .text(`Status: ${invoice.status.toUpperCase()}`, 400, 125);

      // Customer information
      doc
        .fontSize(12)
        .text('Bill To:', 50, 160)
        .fontSize(10)
        .text(customer.email, 50, 180)
        .text(customer.first_name && customer.last_name 
          ? `${customer.first_name} ${customer.last_name}` 
          : 'Customer', 50, 195);

      // Line items table
      const tableTop = 250;
      doc.fontSize(10);

      // Table headers
      doc
        .font('Helvetica-Bold')
        .text('Description', 50, tableTop)
        .text('Quantity', 300, tableTop, { width: 50, align: 'right' })
        .text('Price', 370, tableTop, { width: 70, align: 'right' })
        .text('Amount', 450, tableTop, { width: 90, align: 'right' });

      // Draw line under headers
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(540, tableTop + 15)
        .stroke();

      // Line items
      doc.font('Helvetica');
      let yPosition = tableTop + 25;

      if (invoice.line_items && invoice.line_items.length > 0) {
        invoice.line_items.forEach((item, index) => {
          const amount = item.amount || (item.quantity * item.unit_price);
          
          doc
            .text(item.description || item.product_name || 'Item', 50, yPosition, { width: 230 })
            .text(item.quantity || 1, 300, yPosition, { width: 50, align: 'right' })
            .text(`$${(item.unit_price || item.amount).toFixed(2)}`, 370, yPosition, { width: 70, align: 'right' })
            .text(`$${amount.toFixed(2)}`, 450, yPosition, { width: 90, align: 'right' });

          yPosition += 25;
        });
      }

      // Totals section
      yPosition += 20;
      
      // Draw line before totals
      doc
        .moveTo(350, yPosition)
        .lineTo(540, yPosition)
        .stroke();

      yPosition += 10;

      // Subtotal
      const subtotal = invoice.subtotal || invoice.amount;
      doc
        .text('Subtotal:', 370, yPosition, { width: 100, align: 'right' })
        .text(`$${subtotal.toFixed(2)}`, 480, yPosition, { width: 60, align: 'right' });

      yPosition += 20;

      // Tax
      if (invoice.tax_amount && invoice.tax_amount > 0) {
        doc
          .text(`Tax (${invoice.tax_rate || 0}%):`, 370, yPosition, { width: 100, align: 'right' })
          .text(`$${invoice.tax_amount.toFixed(2)}`, 480, yPosition, { width: 60, align: 'right' });
        yPosition += 20;
      }

      // Total
      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('Total:', 370, yPosition, { width: 100, align: 'right' })
        .text(`$${invoice.total.toFixed(2)}`, 480, yPosition, { width: 60, align: 'right' });

      // Amount paid
      if (invoice.amount_paid && invoice.amount_paid > 0) {
        yPosition += 20;
        doc
          .font('Helvetica')
          .fontSize(10)
          .text('Amount Paid:', 370, yPosition, { width: 100, align: 'right' })
          .text(`-$${invoice.amount_paid.toFixed(2)}`, 480, yPosition, { width: 60, align: 'right' });
      }

      // Amount due
      const amountDue = invoice.total - (invoice.amount_paid || 0);
      if (amountDue > 0) {
        yPosition += 20;
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text('Amount Due:', 370, yPosition, { width: 100, align: 'right' })
          .text(`$${amountDue.toFixed(2)}`, 480, yPosition, { width: 60, align: 'right' });
      }

      // Payment instructions
      if (invoice.status === 'unpaid' || invoice.status === 'overdue') {
        yPosition += 50;
        doc
          .font('Helvetica')
          .fontSize(10)
          .text('Payment Instructions:', 50, yPosition)
          .fontSize(9)
          .text(invoice.payment_instructions || 'Please pay online through your customer portal.', 50, yPosition + 15, { width: 500 });
      }

      // Footer
      doc
        .fontSize(8)
        .text('Thank you for your business!', 50, 700, { align: 'center', width: 500 })
        .text(company.website || 'https://migrahosting.com', 50, 715, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate payment receipt PDF
 */
export async function generateReceiptPDF(payment, invoice, customer) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Receipt header
      doc
        .fontSize(24)
        .text('PAYMENT RECEIPT', 50, 50, { align: 'center' });

      doc
        .fontSize(12)
        .text(`Receipt #: ${payment.id}`, 50, 100)
        .text(`Date: ${new Date(payment.created_at).toLocaleDateString()}`, 50, 120)
        .text(`Payment Method: ${payment.payment_method || 'Credit Card'}`, 50, 140);

      // Customer info
      doc
        .fontSize(12)
        .text('Customer:', 50, 180)
        .fontSize(10)
        .text(customer.email, 50, 200)
        .text(customer.first_name && customer.last_name
          ? `${customer.first_name} ${customer.last_name}`
          : 'Customer', 50, 215);

      // Payment details
      doc
        .fontSize(14)
        .text('Payment Details', 50, 260)
        .fontSize(10)
        .text(`Invoice #: ${invoice.invoice_number}`, 50, 285)
        .text(`Amount Paid: $${payment.amount.toFixed(2)}`, 50, 305, { font: 'Helvetica-Bold', fontSize: 12 });

      // Thank you message
      doc
        .fontSize(10)
        .text('Thank you for your payment!', 50, 400, { align: 'center', width: 500 });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export default {
  generateInvoicePDF,
  generateReceiptPDF,
};
