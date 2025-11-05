import pool from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

class Invoice {
  static async create(invoiceData) {
    const {
      tenantId,
      customerId,
      invoiceNumber,
      items,
      taxRate,
      currency = 'USD',
      dueDate,
      notes
    } = invoiceData;

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = items.reduce((sum, item) => {
        return sum + (item.taxable ? item.amount * taxRate : 0);
      }, 0);
      const total = subtotal + taxAmount;

      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (
          tenant_id, customer_id, invoice_number, subtotal,
          tax_rate, tax_amount, total, currency, due_date, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
        RETURNING *`,
        [tenantId, customerId, invoiceNumber, subtotal, taxRate, taxAmount, total, currency, dueDate, notes]
      );

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (
            invoice_id, subscription_id, product_id, description,
            quantity, unit_price, amount, taxable
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            invoice.id,
            item.subscriptionId,
            item.productId,
            item.description,
            item.quantity,
            item.unitPrice,
            item.amount,
            item.taxable
          ]
        );
      }

      await client.query('COMMIT');
      return invoice;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT i.*, 
        json_agg(
          json_build_object(
            'id', ii.id,
            'description', ii.description,
            'quantity', ii.quantity,
            'unit_price', ii.unit_price,
            'amount', ii.amount,
            'taxable', ii.taxable
          )
        ) as items
      FROM invoices i
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE i.id = $1
      GROUP BY i.id`,
      [id]
    );
    return result.rows[0];
  }

  static async findByCustomer(customerId, limit = 10, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM invoices 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );
    return result.rows;
  }

  static async updateStatus(id, status, paidDate = null) {
    const result = await pool.query(
      `UPDATE invoices 
       SET status = $1, paid_date = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [status, paidDate, id]
    );
    return result.rows[0];
  }

  static async generateInvoiceNumber(tenantId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM invoices WHERE tenant_id = $1`,
      [tenantId]
    );
    const count = parseInt(result.rows[0].count) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count).padStart(6, '0')}`;
  }

  static async getDueInvoices(tenantId) {
    const result = await pool.query(
      `SELECT * FROM invoices 
       WHERE tenant_id = $1 
       AND status IN ('sent', 'draft')
       AND due_date <= CURRENT_DATE
       ORDER BY due_date ASC`,
      [tenantId]
    );
    return result.rows;
  }
}

export default Invoice;
