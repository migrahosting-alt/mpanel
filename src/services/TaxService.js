import pool from '../config/database.js';
import logger from '../config/logger.js';

class TaxService {
  /**
   * Calculate tax rate for a customer based on location
   */
  static async calculateTaxRate(customer) {
    try {
      if (!process.env.TAX_ENABLED || process.env.TAX_ENABLED === 'false') {
        return 0;
      }

      // Find applicable tax rules
      const result = await pool.query(
        `SELECT tax_rate, is_compound, priority
         FROM tax_rules
         WHERE tenant_id = $1
         AND active = true
         AND (country = $2 OR country IS NULL)
         AND (state = $3 OR state IS NULL)
         ORDER BY priority DESC, tax_rate DESC
         LIMIT 1`,
        [customer.tenant_id, customer.country, customer.state]
      );

      if (result.rows.length > 0) {
        return parseFloat(result.rows[0].tax_rate);
      }

      // Return default tax rate if no rule found
      return parseFloat(process.env.DEFAULT_TAX_RATE || 0);

    } catch (error) {
      logger.error('Error calculating tax rate:', error);
      return 0;
    }
  }

  /**
   * Create a tax rule
   */
  static async createTaxRule(ruleData) {
    const {
      tenantId,
      country,
      state,
      taxName,
      taxRate,
      isCompound = false,
      priority = 0
    } = ruleData;

    const result = await pool.query(
      `INSERT INTO tax_rules (
        tenant_id, country, state, tax_name, tax_rate,
        is_compound, priority, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      RETURNING *`,
      [tenantId, country, state, taxName, taxRate, isCompound, priority]
    );
    return result.rows[0];
  }

  /**
   * Get all tax rules for a tenant
   */
  static async getTaxRules(tenantId) {
    const result = await pool.query(
      `SELECT * FROM tax_rules 
       WHERE tenant_id = $1 
       AND active = true
       ORDER BY priority DESC, country, state`,
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Update tax rule
   */
  static async updateTaxRule(id, updates) {
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
      `UPDATE tax_rules SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Deactivate tax rule
   */
  static async deactivateTaxRule(id) {
    await pool.query(
      'UPDATE tax_rules SET active = false WHERE id = $1',
      [id]
    );
  }
}

export default TaxService;
