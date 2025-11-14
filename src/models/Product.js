import pool from '../config/database.js';

class Product {
  static async create(productData) {
    const {
      tenantId,
      name,
      description,
      type,
      billingCycle,
      price,
      setupFee = 0,
      currency = 'USD',
      taxable = true,
      metadata = {}
    } = productData;

    const result = await pool.query(
      `INSERT INTO products (
        tenant_id, name, description, type, billing_cycle,
        price, setup_fee, currency, taxable, metadata, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
      RETURNING *`,
      [tenantId, name, description, type, billingCycle, price, setupFee, currency, taxable, metadata]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM products WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByTenant(tenantId, type = null) {
    let query = 'SELECT * FROM products WHERE tenant_id = $1 AND status = $2';
    const params = [tenantId, 'active'];
    
    if (type) {
      query += ' AND type = $3';
      params.push(type);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    return result.rows;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(id);
    
    const result = await pool.query(
      `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query(
      'UPDATE products SET status = $1 WHERE id = $2',
      ['deleted', id]
    );
  }

  // TLD-specific methods
  static async addTLD(productId, tldData) {
    const {
      tld,
      registerPrice,
      renewPrice,
      transferPrice,
      icannFee = 0.18,
      minYears = 1,
      maxYears = 10,
      autoRenew = true
    } = tldData;

    const result = await pool.query(
      `INSERT INTO product_tlds (
        product_id, tld, register_price, renew_price, transfer_price,
        icann_fee, min_years, max_years, auto_renew
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [productId, tld, registerPrice, renewPrice, transferPrice, icannFee, minYears, maxYears, autoRenew]
    );
    return result.rows[0];
  }

  static async getTLDs(productId) {
    const result = await pool.query(
      'SELECT * FROM product_tlds WHERE product_id = $1',
      [productId]
    );
    return result.rows;
  }
}

export default Product;
