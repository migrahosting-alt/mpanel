/**
 * Domain Registration Service - NameSilo API Integration
 * Handles domain registration, transfers, and DNS management
 */

import axios from 'axios';
import logger from '../config/logger.js';
import pool from '../db/index.js';

const NAMESILO_API_URL = process.env.NAMESILO_API_URL || 'https://www.namesilo.com/api';
const NAMESILO_API_KEY = process.env.NAMESILO_API_KEY;
const NAMESILO_SANDBOX = process.env.NAMESILO_SANDBOX === 'true';

class DomainRegistrationService {
  /**
   * Register a new domain
   */
  async registerDomain({ domain, years = 1, customerId, tenantId }) {
    try {
      if (!NAMESILO_API_KEY) {
        logger.warn('NameSilo API key not configured, skipping domain registration');
        return { success: false, error: 'NameSilo not configured', skipped: true };
      }

      logger.info(`Registering domain: ${domain} for ${years} year(s)`);

      // Get customer details for WHOIS
      const customerResult = await pool.query(
        `SELECT u.email, u.first_name, u.last_name, c.billing_address, c.billing_city, 
                c.billing_state, c.billing_postal_code, c.billing_country, c.phone
         FROM customers c
         JOIN users u ON c.user_id = u.id
         WHERE c.id = $1`,
        [customerId]
      );

      if (customerResult.rows.length === 0) {
        throw new Error('Customer not found');
      }

      const customer = customerResult.rows[0];

      // NameSilo API request
      const response = await axios.get(`${NAMESILO_API_URL}/registerDomain`, {
        params: {
          version: 1,
          type: 'xml',
          key: NAMESILO_API_KEY,
          domain,
          years,
          private: 1, // Enable WHOIS privacy
          auto_renew: 1,
          // Contact information
          fn: customer.first_name || 'Domain',
          ln: customer.last_name || 'Owner',
          em: customer.email,
          ad: customer.billing_address || '123 Main St',
          cy: customer.billing_city || 'New York',
          st: customer.billing_state || 'NY',
          zp: customer.billing_postal_code || '10001',
          ct: customer.billing_country || 'US',
          ph: customer.phone || '+1.5555555555'
        }
      });

      logger.info(`NameSilo registration response for ${domain}:`, response.data);

      // Parse XML response (simple check for success)
      const isSuccess = response.data.includes('<reply code="300">');

      if (isSuccess) {
        // Update domain record
        await pool.query(
          `UPDATE domains 
           SET status = 'active',
               registration_date = NOW(),
               expiry_date = NOW() + INTERVAL '${years} year',
               auto_renew = true,
               whois_privacy = true,
               metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{registrar}', '"NameSilo"')
           WHERE domain_name = $1 AND tenant_id = $2`,
          [domain, tenantId]
        );

        logger.info(`Domain ${domain} registered successfully`);

        return {
          success: true,
          domain,
          registrar: 'NameSilo',
          expiryDate: new Date(Date.now() + years * 365 * 24 * 60 * 60 * 1000),
          whoisPrivacy: true,
          autoRenew: true
        };
      } else {
        throw new Error('NameSilo registration failed: ' + response.data);
      }

    } catch (error) {
      logger.error(`Domain registration failed for ${domain}:`, error);
      return {
        success: false,
        error: error.message,
        domain
      };
    }
  }

  /**
   * Update nameservers for a domain
   */
  async updateNameservers({ domain, nameservers }) {
    try {
      if (!NAMESILO_API_KEY) {
        logger.warn('NameSilo API key not configured, skipping nameserver update');
        return { success: false, error: 'NameSilo not configured', skipped: true };
      }

      const ns1 = nameservers[0] || process.env.NS1 || 'ns1.migrahosting.com';
      const ns2 = nameservers[1] || process.env.NS2 || 'ns2.migrahosting.com';

      logger.info(`Updating nameservers for ${domain}: ${ns1}, ${ns2}`);

      const response = await axios.get(`${NAMESILO_API_URL}/changeNameServers`, {
        params: {
          version: 1,
          type: 'xml',
          key: NAMESILO_API_KEY,
          domain,
          ns1,
          ns2
        }
      });

      const isSuccess = response.data.includes('<reply code="300">');

      if (isSuccess) {
        logger.info(`Nameservers updated for ${domain}`);
        return { success: true, nameservers: [ns1, ns2] };
      } else {
        throw new Error('NameSilo nameserver update failed');
      }

    } catch (error) {
      logger.error(`Nameserver update failed for ${domain}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check domain availability
   */
  async checkAvailability(domain) {
    try {
      if (!NAMESILO_API_KEY) {
        return { available: false, error: 'NameSilo not configured' };
      }

      const response = await axios.get(`${NAMESILO_API_URL}/checkRegisterAvailability`, {
        params: {
          version: 1,
          type: 'xml',
          key: NAMESILO_API_KEY,
          domains: domain
        }
      });

      const isAvailable = response.data.includes('available="yes"');

      return {
        available: isAvailable,
        domain
      };

    } catch (error) {
      logger.error(`Domain availability check failed for ${domain}:`, error);
      return { available: false, error: error.message };
    }
  }

  /**
   * Get domain info
   */
  async getDomainInfo(domain) {
    try {
      if (!NAMESILO_API_KEY) {
        return { success: false, error: 'NameSilo not configured' };
      }

      const response = await axios.get(`${NAMESILO_API_URL}/getDomainInfo`, {
        params: {
          version: 1,
          type: 'xml',
          key: NAMESILO_API_KEY,
          domain
        }
      });

      // Parse XML and extract info (simplified)
      return {
        success: true,
        domain,
        data: response.data
      };

    } catch (error) {
      logger.error(`Get domain info failed for ${domain}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new DomainRegistrationService();
