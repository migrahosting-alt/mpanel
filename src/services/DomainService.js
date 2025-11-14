import pool from '../config/database.js';
import logger from '../config/logger.js';

class DomainService {
  /**
   * Register a new domain
   */
  static async registerDomain(domainData) {
    const {
      tenantId,
      customerId,
      subscriptionId,
      domainName,
      registrar = 'internal',
      years = 1,
      nameservers = [],
      metadata = {}
    } = domainData;

    try {
      // Extract TLD
      const parts = domainName.split('.');
      const tld = parts.slice(-1)[0];

      // Calculate dates
      const registrationDate = new Date();
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + years);

      const result = await pool.query(
        `INSERT INTO domains (
          tenant_id, customer_id, subscription_id, domain_name,
          tld, registrar, registration_date, expiry_date,
          nameservers, metadata, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')
        RETURNING *`,
        [
          tenantId,
          customerId,
          subscriptionId,
          domainName,
          tld,
          registrar,
          registrationDate,
          expiryDate,
          JSON.stringify(nameservers),
          metadata
        ]
      );

      // Create ICANN fee record if enabled
      if (process.env.ICANN_ENABLED === 'true') {
        const icannFee = parseFloat(process.env.ICANN_FEE_PER_YEAR || 0.18);
        await this.createICANNFee(tenantId, result.rows[0].id, icannFee, years);
      }

      logger.info(`Domain ${domainName} registered successfully`);
      return result.rows[0];

    } catch (error) {
      logger.error('Error registering domain:', error);
      throw error;
    }
  }

  /**
   * Create ICANN fee record
   */
  static async createICANNFee(tenantId, domainId, feeAmount, years) {
    const totalFee = feeAmount * years;
    
    await pool.query(
      `INSERT INTO icann_fees (
        tenant_id, domain_id, fee_amount, fee_year, status
      ) VALUES ($1, $2, $3, $4, 'pending')`,
      [tenantId, domainId, totalFee, years]
    );
  }

  /**
   * Renew domain
   */
  static async renewDomain(domainId, years = 1) {
    try {
      const domain = await this.findById(domainId);
      if (!domain) {
        throw new Error('Domain not found');
      }

      const newExpiryDate = new Date(domain.expiry_date);
      newExpiryDate.setFullYear(newExpiryDate.getFullYear() + years);

      const result = await pool.query(
        `UPDATE domains 
         SET expiry_date = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [newExpiryDate, domainId]
      );

      // Create ICANN fee for renewal
      if (process.env.ICANN_ENABLED === 'true') {
        const icannFee = parseFloat(process.env.ICANN_FEE_PER_YEAR || 0.18);
        await this.createICANNFee(domain.tenant_id, domainId, icannFee, years);
      }

      logger.info(`Domain ${domain.domain_name} renewed for ${years} year(s)`);
      return result.rows[0];

    } catch (error) {
      logger.error('Error renewing domain:', error);
      throw error;
    }
  }

  /**
   * Find domain by ID
   */
  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM domains WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  /**
   * Find domains by customer
   */
  static async findByCustomer(customerId) {
    const result = await pool.query(
      'SELECT * FROM domains WHERE customer_id = $1 ORDER BY created_at DESC',
      [customerId]
    );
    return result.rows;
  }

  /**
   * Get expiring domains (within 30 days)
   */
  static async getExpiringDomains(tenantId, days = 30) {
    const result = await pool.query(
      `SELECT * FROM domains 
       WHERE tenant_id = $1 
       AND status = 'active'
       AND expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
       AND expiry_date > CURRENT_DATE
       ORDER BY expiry_date ASC`,
      [tenantId]
    );
    return result.rows;
  }

  /**
   * Update nameservers
   */
  static async updateNameservers(domainId, nameservers) {
    const result = await pool.query(
      `UPDATE domains 
       SET nameservers = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [JSON.stringify(nameservers), domainId]
    );
    return result.rows[0];
  }

  /**
   * Transfer domain
   */
  static async transferDomain(domainId, newCustomerId) {
    const result = await pool.query(
      `UPDATE domains 
       SET customer_id = $1, status = 'transferred', updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newCustomerId, domainId]
    );
    return result.rows[0];
  }
}

export default DomainService;
