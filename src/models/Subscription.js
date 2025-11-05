import pool from '../config/database.js';

class Subscription {
  static async create(subscriptionData) {
    const {
      tenantId,
      customerId,
      productId,
      billingCycle,
      price,
      nextBillingDate,
      autoRenew = true,
      metadata = {}
    } = subscriptionData;

    const result = await pool.query(
      `INSERT INTO subscriptions (
        tenant_id, customer_id, product_id, billing_cycle,
        price, next_billing_date, next_due_date, auto_renew,
        metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, 'active')
      RETURNING *`,
      [tenantId, customerId, productId, billingCycle, price, nextBillingDate, autoRenew, metadata]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      `SELECT s.*, p.name as product_name, p.type as product_type
       FROM subscriptions s
       LEFT JOIN products p ON s.product_id = p.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  static async findByCustomer(customerId, status = null) {
    let query = `
      SELECT s.*, p.name as product_name, p.type as product_type
      FROM subscriptions s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.customer_id = $1
    `;
    const params = [customerId];
    
    if (status) {
      query += ' AND s.status = $2';
      params.push(status);
    }
    
    query += ' ORDER BY s.created_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE subscriptions 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  static async updateNextBillingDate(id, nextBillingDate) {
    const result = await pool.query(
      `UPDATE subscriptions 
       SET next_billing_date = $1, next_due_date = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [nextBillingDate, id]
    );
    return result.rows[0];
  }

  static async getDueForBilling(tenantId) {
    const result = await pool.query(
      `SELECT s.*, c.user_id, c.currency, p.name as product_name
       FROM subscriptions s
       JOIN customers c ON s.customer_id = c.id
       JOIN products p ON s.product_id = p.id
       WHERE s.tenant_id = $1 
       AND s.status = 'active'
       AND s.auto_renew = true
       AND s.next_billing_date <= CURRENT_DATE
       ORDER BY s.next_billing_date ASC`,
      [tenantId]
    );
    return result.rows;
  }

  static async cancel(id) {
    return this.updateStatus(id, 'cancelled');
  }

  static async suspend(id) {
    return this.updateStatus(id, 'suspended');
  }

  static async reactivate(id) {
    return this.updateStatus(id, 'active');
  }
}

export default Subscription;
