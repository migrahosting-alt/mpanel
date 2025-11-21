/**
 * Domain Registration Controller
 * Handles domain registration, renewal, transfer, and management via NameSilo
 */

import logger from '../config/logger.js';
import pool from '../db/index.js';
import namesiloService from '../services/namesiloService.js';

/**
 * Check domain availability (authenticated)
 */
export const checkDomainAvailability = async (req, res) => {
  try {
    const { domains } = req.body;

    if (!domains || (Array.isArray(domains) && domains.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'At least one domain is required',
      });
    }

    logger.info('Checking domain availability', { domains });

    const result = await namesiloService.checkAvailability(domains);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error checking domain availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check domain availability',
      message: error.message,
    });
  }
};

/**
 * Check domain availability (public endpoint for marketing site)
 */
export const checkDomainAvailabilityPublic = async (req, res) => {
  try {
    const { domains } = req.body;

    if (!domains || (Array.isArray(domains) && domains.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'At least one domain is required',
      });
    }

    // Limit to 20 domains per request to prevent abuse
    if (domains.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 20 domains per request',
      });
    }

    logger.info('Public domain availability check', { count: domains.length });

    const result = await namesiloService.checkAvailability(domains);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error checking domain availability (public):', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check domain availability',
    });
  }
};

/**
 * Register a new domain
 */
export const registerDomain = async (req, res) => {
  try {
    const { tenant_id, id: user_id } = req.user;
    const {
      domain,
      years = 1,
      auto_renew = false,
      enable_privacy = true,
      customer_id,
      contact_info,
    } = req.body;

    if (!domain) {
      return res.status(400).json({
        success: false,
        error: 'Domain is required',
      });
    }

    logger.info(`Registering domain: ${domain}`, { userId: user_id });

    // Check if domain is already registered in our system
    const existingDomain = await pool.query(
      'SELECT id FROM domains WHERE domain_name = $1',
      [domain]
    );

    if (existingDomain.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Domain already exists in system',
      });
    }

    // Prepare registration options
    const registrationOptions = {
      domain,
      years,
      auto_renew: auto_renew ? 1 : 0,
      private: enable_privacy ? 1 : 0,
      ...contact_info,
    };

    // Register domain with NameSilo
    const registrationResult = await namesiloService.registerDomain(registrationOptions);

    // Extract TLD
    const tld = domain.split('.').pop();

    // Save domain to database
    const query = `
      INSERT INTO domains (
        tenant_id, user_id, customer_id, domain_name, tld, 
        type, status, auto_renew, privacy_enabled,
        registration_date, expiration_date
      ) VALUES ($1, $2, $3, $4, $5, 'registered', 'active', $6, $7, NOW(), NOW() + INTERVAL '${years} years')
      RETURNING *
    `;

    const result = await pool.query(query, [
      tenant_id,
      user_id,
      customer_id || null,
      domain,
      tld,
      auto_renew,
      enable_privacy,
    ]);

    const savedDomain = result.rows[0];

    logger.info(`Domain registered successfully: ${domain}`, {
      userId: user_id,
      domainId: savedDomain.id,
    });

    res.status(201).json({
      success: true,
      domain: savedDomain,
      registration: registrationResult,
      message: `Domain ${domain} registered successfully for ${years} year(s)`,
    });
  } catch (error) {
    logger.error('Error registering domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register domain',
      message: error.message,
    });
  }
};

/**
 * Renew a domain
 */
export const renewDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { years = 1 } = req.body;
    const { tenant_id, id: user_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    logger.info(`Renewing domain: ${domain.domain_name}`, { userId: user_id });

    // Renew domain with NameSilo
    const renewalResult = await namesiloService.renewDomain(domain.domain_name, years);

    // Update expiration date in database
    await pool.query(
      `UPDATE domains 
       SET expiration_date = expiration_date + INTERVAL '${years} years',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    logger.info(`Domain renewed successfully: ${domain.domain_name}`, {
      userId: user_id,
      years,
    });

    res.json({
      success: true,
      renewal: renewalResult,
      message: `Domain ${domain.domain_name} renewed for ${years} year(s)`,
    });
  } catch (error) {
    logger.error('Error renewing domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to renew domain',
      message: error.message,
    });
  }
};

/**
 * Transfer domain to NameSilo
 */
export const transferDomain = async (req, res) => {
  try {
    const { tenant_id, id: user_id } = req.user;
    const {
      domain,
      auth_code,
      enable_privacy = true,
      auto_renew = false,
      customer_id,
    } = req.body;

    if (!domain || !auth_code) {
      return res.status(400).json({
        success: false,
        error: 'Domain and auth code are required',
      });
    }

    logger.info(`Transferring domain: ${domain}`, { userId: user_id });

    // Transfer domain with NameSilo
    const transferResult = await namesiloService.transferDomain({
      domain,
      auth: auth_code,
      private: enable_privacy ? 1 : 0,
      auto_renew: auto_renew ? 1 : 0,
    });

    // Extract TLD
    const tld = domain.split('.').pop();

    // Save domain to database
    const query = `
      INSERT INTO domains (
        tenant_id, user_id, customer_id, domain_name, tld, 
        type, status, auto_renew, privacy_enabled,
        registration_date
      ) VALUES ($1, $2, $3, $4, $5, 'transferred', 'pending', $6, $7, NOW())
      RETURNING *
    `;

    const result = await pool.query(query, [
      tenant_id,
      user_id,
      customer_id || null,
      domain,
      tld,
      auto_renew,
      enable_privacy,
    ]);

    const savedDomain = result.rows[0];

    logger.info(`Domain transfer initiated: ${domain}`, {
      userId: user_id,
      domainId: savedDomain.id,
    });

    res.status(201).json({
      success: true,
      domain: savedDomain,
      transfer: transferResult,
      message: `Domain ${domain} transfer initiated`,
    });
  } catch (error) {
    logger.error('Error transferring domain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to transfer domain',
      message: error.message,
    });
  }
};

/**
 * Update domain nameservers
 */
export const updateNameServers = async (req, res) => {
  try {
    const { id } = req.params;
    const { nameservers } = req.body;
    const { tenant_id, id: user_id } = req.user;

    if (!nameservers || !Array.isArray(nameservers) || nameservers.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 nameservers are required',
      });
    }

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    logger.info(`Updating nameservers for domain: ${domain.domain_name}`, {
      userId: user_id,
      nameservers,
    });

    // Update nameservers with NameSilo
    const updateResult = await namesiloService.updateNameServers(
      domain.domain_name,
      nameservers
    );

    logger.info(`Nameservers updated successfully for domain: ${domain.domain_name}`);

    res.json({
      success: true,
      update: updateResult,
      message: `Nameservers updated for ${domain.domain_name}`,
    });
  } catch (error) {
    logger.error('Error updating nameservers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update nameservers',
      message: error.message,
    });
  }
};

/**
 * Get domain info from NameSilo
 */
export const getDomainInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    // Get domain info from NameSilo
    const info = await namesiloService.getDomainInfo(domain.domain_name);

    res.json({
      success: true,
      domain: domain,
      registrar_info: info,
    });
  } catch (error) {
    logger.error('Error getting domain info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get domain info',
      message: error.message,
    });
  }
};

/**
 * Lock/Unlock domain
 */
export const toggleDomainLock = async (req, res) => {
  try {
    const { id } = req.params;
    const { locked } = req.body;
    const { tenant_id, id: user_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    logger.info(`${locked ? 'Locking' : 'Unlocking'} domain: ${domain.domain_name}`, {
      userId: user_id,
    });

    // Lock or unlock domain with NameSilo
    const result = locked
      ? await namesiloService.lockDomain(domain.domain_name)
      : await namesiloService.unlockDomain(domain.domain_name);

    res.json({
      success: true,
      ...result,
      message: `Domain ${domain.domain_name} ${locked ? 'locked' : 'unlocked'} successfully`,
    });
  } catch (error) {
    logger.error('Error toggling domain lock:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle domain lock',
      message: error.message,
    });
  }
};

/**
 * Get EPP/Auth code
 */
export const getAuthCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    // Get auth code from NameSilo
    const result = await namesiloService.getAuthCode(domain.domain_name);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting auth code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auth code',
      message: error.message,
    });
  }
};

/**
 * Toggle auto-renewal
 */
export const toggleAutoRenewal = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const { tenant_id, id: user_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    logger.info(`${enabled ? 'Enabling' : 'Disabling'} auto-renewal for: ${domain.domain_name}`, {
      userId: user_id,
    });

    // Toggle auto-renewal with NameSilo
    const result = await namesiloService.setAutoRenewal(domain.domain_name, enabled);

    // Update database
    await pool.query(
      'UPDATE domains SET auto_renew = $1, updated_at = NOW() WHERE id = $2',
      [enabled, id]
    );

    res.json({
      success: true,
      ...result,
      message: `Auto-renewal ${enabled ? 'enabled' : 'disabled'} for ${domain.domain_name}`,
    });
  } catch (error) {
    logger.error('Error toggling auto-renewal:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle auto-renewal',
      message: error.message,
    });
  }
};

/**
 * Toggle WHOIS privacy
 */
export const togglePrivacy = async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    const { tenant_id, id: user_id } = req.user;

    // Get domain from database
    const domainResult = await pool.query(
      'SELECT * FROM domains WHERE id = $1 AND tenant_id = $2',
      [id, tenant_id]
    );

    if (domainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Domain not found',
      });
    }

    const domain = domainResult.rows[0];

    logger.info(`${enabled ? 'Enabling' : 'Disabling'} privacy for: ${domain.domain_name}`, {
      userId: user_id,
    });

    // Toggle privacy with NameSilo
    const result = await namesiloService.setPrivacy(domain.domain_name, enabled);

    // Update database
    await pool.query(
      'UPDATE domains SET privacy_enabled = $1, updated_at = NOW() WHERE id = $2',
      [enabled, id]
    );

    res.json({
      success: true,
      ...result,
      message: `Privacy ${enabled ? 'enabled' : 'disabled'} for ${domain.domain_name}`,
    });
  } catch (error) {
    logger.error('Error toggling privacy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle privacy',
      message: error.message,
    });
  }
};

/**
 * Get TLD pricing from NameSilo
 */
export const getPricing = async (req, res) => {
  try {
    const pricing = await namesiloService.getPricing();

    res.json({
      success: true,
      ...pricing,
    });
  } catch (error) {
    logger.error('Error getting pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pricing',
      message: error.message,
    });
  }
};
