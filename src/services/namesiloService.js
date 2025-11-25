/**
 * NameSilo Domain Registrar Integration Service
 * API Documentation: https://www.namesilo.com/api-reference
 */

import axios from 'axios';
import logger from '../config/logger.js';

const NAMESILO_API_URL = process.env.NAMESILO_API_URL || 'https://www.namesilo.com/api';
const NAMESILO_API_KEY = process.env.NAMESILO_API_KEY;
const NAMESILO_SANDBOX = process.env.NAMESILO_SANDBOX === 'true';

class NameSiloService {
  constructor() {
    this.apiKey = NAMESILO_API_KEY;
    this.baseUrl = NAMESILO_API_URL;
    this.isSandbox = NAMESILO_SANDBOX;
    
    if (!this.apiKey) {
      logger.warn('NameSilo API key not configured. Domain registration features will be unavailable.');
    }
  }

  /**
   * Make API request to NameSilo
   */
  async makeRequest(operation, params = {}) {
    if (!this.apiKey) {
      throw new Error('NameSilo API key not configured');
    }

    try {
      const url = `${this.baseUrl}/${operation}`;
      const requestParams = {
        version: 1,
        type: 'xml',
        key: this.apiKey,
        ...params,
      };

      logger.info(`NameSilo API Request: ${operation}`, { params: Object.keys(params) });

      const response = await axios.get(url, {
        params: requestParams,
        timeout: 30000,
      });

      // NameSilo returns XML, parse response
      const result = this.parseXMLResponse(response.data);
      
      if (result.reply.code !== '300') {
        throw new Error(result.reply.detail || 'NameSilo API error');
      }

      logger.info(`NameSilo API Success: ${operation}`);
      return result;
    } catch (error) {
      logger.error(`NameSilo API Error: ${operation}`, {
        message: error.message,
        response: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Parse XML response from NameSilo
   * Simple parser for NameSilo's predictable XML format
   */
  parseXMLResponse(xml) {
    // Basic XML parsing - you may want to use a proper XML parser library
    // like 'xml2js' for production
    const codeMatch = xml.match(/<code>(\d+)<\/code>/);
    const detailMatch = xml.match(/<detail>(.*?)<\/detail>/);
    
    return {
      reply: {
        code: codeMatch ? codeMatch[1] : null,
        detail: detailMatch ? detailMatch[1] : null,
      },
      rawXml: xml,
    };
  }

  /**
   * Check domain availability
   */
  async checkAvailability(domains) {
    if (!Array.isArray(domains)) {
      domains = [domains];
    }

    const result = await this.makeRequest('checkRegisterAvailability', {
      domains: domains.join(','),
    });

    // Parse availability from XML response
    return {
      available: result.rawXml.includes('available'),
      domains,
      response: result,
    };
  }

  /**
   * Register a domain
   */
  async registerDomain(options) {
    const {
      domain,
      years = 1,
      auto_renew = 0,
      private: enablePrivacy = 1, // WHOIS privacy
      contact_id, // Required if not using default contact
      // Contact information if creating new contact
      fn, // First name
      ln, // Last name
      ad, // Address
      cy, // City
      st, // State
      zp, // Zip
      ct, // Country (2-letter code)
      em, // Email
      ph, // Phone
    } = options;

    const params = {
      domain,
      years,
      auto_renew,
      private: enablePrivacy,
    };

    // Add contact information
    if (contact_id) {
      params.contact_id = contact_id;
    } else if (fn && ln && ad && cy && st && zp && ct && em && ph) {
      params.fn = fn;
      params.ln = ln;
      params.ad = ad;
      params.cy = cy;
      params.st = st;
      params.zp = zp;
      params.ct = ct;
      params.em = em;
      params.ph = ph;
    } else {
      throw new Error('Either contact_id or full contact information is required');
    }

    const result = await this.makeRequest('registerDomain', params);
    
    return {
      success: true,
      domain,
      years,
      response: result,
    };
  }

  /**
   * Renew a domain
   */
  async renewDomain(domain, years = 1) {
    const result = await this.makeRequest('renewDomain', {
      domain,
      years,
    });

    return {
      success: true,
      domain,
      years,
      response: result,
    };
  }

  /**
   * Transfer domain to NameSilo
   */
  async transferDomain(options) {
    const {
      domain,
      auth, // EPP/Auth code
      private: enablePrivacy = 1,
      auto_renew = 0,
      contact_id,
    } = options;

    if (!auth) {
      throw new Error('EPP/Auth code is required for domain transfer');
    }

    const params = {
      domain,
      auth,
      private: enablePrivacy,
      auto_renew,
    };

    if (contact_id) {
      params.contact_id = contact_id;
    }

    const result = await this.makeRequest('transferDomain', params);

    return {
      success: true,
      domain,
      response: result,
    };
  }

  /**
   * Get domain information
   */
  async getDomainInfo(domain) {
    const result = await this.makeRequest('getDomainInfo', { domain });
    
    return {
      domain,
      info: result,
    };
  }

  /**
   * List all domains in account
   */
  async listDomains() {
    const result = await this.makeRequest('listDomains');
    
    return {
      domains: result,
    };
  }

  /**
   * Update nameservers for a domain
   */
  async updateNameServers(domain, nameservers) {
    if (!Array.isArray(nameservers) || nameservers.length < 2) {
      throw new Error('At least 2 nameservers are required');
    }

    if (nameservers.length > 13) {
      throw new Error('Maximum 13 nameservers allowed');
    }

    const params = { domain };
    nameservers.forEach((ns, index) => {
      params[`ns${index + 1}`] = ns;
    });

    const result = await this.makeRequest('changeNameServers', params);

    return {
      success: true,
      domain,
      nameservers,
      response: result,
    };
  }

  /**
   * Get DNS records for a domain
   */
  async listDNSRecords(domain) {
    const result = await this.makeRequest('dnsListRecords', { domain });
    
    return {
      domain,
      records: result,
    };
  }

  /**
   * Add DNS record
   */
  async addDNSRecord(domain, recordType, hostname, value, ttl = 7207, priority = 0) {
    const params = {
      domain,
      rrtype: recordType, // A, AAAA, CNAME, MX, TXT, etc.
      rrhost: hostname,
      rrvalue: value,
      rrttl: ttl,
    };

    if (recordType === 'MX') {
      params.rrdistance = priority;
    }

    const result = await this.makeRequest('dnsAddRecord', params);

    return {
      success: true,
      domain,
      recordType,
      hostname,
      response: result,
    };
  }

  /**
   * Update DNS record
   */
  async updateDNSRecord(domain, recordId, hostname, value, ttl = 7207, priority = 0) {
    const params = {
      domain,
      rrid: recordId,
      rrhost: hostname,
      rrvalue: value,
      rrttl: ttl,
    };

    if (priority > 0) {
      params.rrdistance = priority;
    }

    const result = await this.makeRequest('dnsUpdateRecord', params);

    return {
      success: true,
      domain,
      recordId,
      response: result,
    };
  }

  /**
   * Delete DNS record
   */
  async deleteDNSRecord(domain, recordId) {
    const result = await this.makeRequest('dnsDeleteRecord', {
      domain,
      rrid: recordId,
    });

    return {
      success: true,
      domain,
      recordId,
      response: result,
    };
  }

  /**
   * Lock domain (prevent transfer)
   */
  async lockDomain(domain) {
    const result = await this.makeRequest('domainLock', { domain });

    return {
      success: true,
      domain,
      locked: true,
      response: result,
    };
  }

  /**
   * Unlock domain (allow transfer)
   */
  async unlockDomain(domain) {
    const result = await this.makeRequest('domainUnlock', { domain });

    return {
      success: true,
      domain,
      locked: false,
      response: result,
    };
  }

  /**
   * Get EPP/Auth code for domain transfer
   */
  async getAuthCode(domain) {
    const result = await this.makeRequest('retrieveAuthCode', { domain });

    return {
      domain,
      authCode: result,
    };
  }

  /**
   * Enable/Disable auto-renewal
   */
  async setAutoRenewal(domain, enabled = true) {
    const operation = enabled ? 'addAutoRenewal' : 'removeAutoRenewal';
    const result = await this.makeRequest(operation, { domain });

    return {
      success: true,
      domain,
      autoRenewal: enabled,
      response: result,
    };
  }

  /**
   * Enable/Disable WHOIS privacy
   */
  async setPrivacy(domain, enabled = true) {
    const operation = enabled ? 'addPrivacy' : 'removePrivacy';
    const result = await this.makeRequest(operation, { domain });

    return {
      success: true,
      domain,
      privacy: enabled,
      response: result,
    };
  }

  /**
   * Get pricing for TLDs
   */
  async getPricing() {
    const result = await this.makeRequest('getPrices');

    return {
      pricing: result,
    };
  }

  /**
   * Get account balance
   */
  async getAccountBalance() {
    const result = await this.makeRequest('getAccountBalance');

    return {
      balance: result,
    };
  }

  /**
   * Add account funds
   */
  async addAccountFunds(amount, paymentId) {
    const result = await this.makeRequest('addAccountFunds', {
      amount,
      payment_id: paymentId,
    });

    return {
      success: true,
      amount,
      response: result,
    };
  }

  /**
   * Get contact information
   */
  async listContacts() {
    const result = await this.makeRequest('contactList');

    return {
      contacts: result,
    };
  }

  /**
   * Add new contact
   */
  async addContact(contact) {
    const {
      fn, // First name
      ln, // Last name
      ad, // Address
      cy, // City
      st, // State
      zp, // Zip
      ct, // Country (2-letter code)
      em, // Email
      ph, // Phone
      nn = null, // Nickname (optional)
      cp = null, // Company (optional)
      fx = null, // Fax (optional)
    } = contact;

    if (!fn || !ln || !ad || !cy || !st || !zp || !ct || !em || !ph) {
      throw new Error('Missing required contact fields');
    }

    const params = { fn, ln, ad, cy, st, zp, ct, em, ph };
    if (nn) params.nn = nn;
    if (cp) params.cp = cp;
    if (fx) params.fx = fx;

    const result = await this.makeRequest('contactAdd', params);

    return {
      success: true,
      contact: result,
    };
  }

  /**
   * Update existing contact
   */
  async updateContact(contactId, updates) {
    const params = { contact_id: contactId, ...updates };
    const result = await this.makeRequest('contactUpdate', params);

    return {
      success: true,
      contactId,
      response: result,
    };
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId) {
    const result = await this.makeRequest('contactDelete', {
      contact_id: contactId,
    });

    return {
      success: true,
      contactId,
      response: result,
    };
  }
}

export default new NameSiloService();
