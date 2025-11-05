import pool from '../config/database.js';

class Payment {
  static async create(paymentData) {
    const {
      tenantId,
      customerId,
      invoiceId,
      amount,
      currency = 'USD',
      paymentMethod,
      transactionId,
      metadata = {}
    } = paymentData;

    const result = await pool.query(
      `INSERT INTO payments (
        tenant_id, customer_id, invoice_id, amount,
        currency, payment_method, transaction_id, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
      RETURNING *`,
      [tenantId, customerId, invoiceId, amount, currency, paymentMethod, transactionId, metadata]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM payments WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByInvoice(invoiceId) {
    const result = await pool.query(
      'SELECT * FROM payments WHERE invoice_id = $1 ORDER BY created_at DESC',
      [invoiceId]
    );
    return result.rows;
  }

  static async findByCustomer(customerId, limit = 10, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM payments 
       WHERE customer_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [customerId, limit, offset]
    );
    return result.rows;
  }

  static async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE payments 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  static async markCompleted(id) {
    return this.updateStatus(id, 'completed');
  }

  static async markFailed(id) {
    return this.updateStatus(id, 'failed');
  }

  static async refund(id) {
    return this.updateStatus(id, 'refunded');
  }
}

export default Payment;
