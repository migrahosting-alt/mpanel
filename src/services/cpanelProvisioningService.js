/**
 * cPanel/WHM Provisioning Service
 * Creates hosting accounts via WHM API
 */

import axios from 'axios';
import crypto from 'crypto';
import logger from '../config/logger.js';

const WHM_URL = process.env.CPANEL_WHM_URL || 'https://server1.migrahosting.com:2087';
const WHM_API_TOKEN = process.env.CPANEL_WHM_API_TOKEN;
const WHM_USERNAME = process.env.CPANEL_WHM_USERNAME || 'root';

class CpanelProvisioningService {
  /**
   * Create cPanel account
   */
  async createAccount({ domain, username, email, password, plan = 'default', diskQuota = 5120, tenantId }) {
    try {
      if (!WHM_API_TOKEN) {
        logger.warn('WHM API token not configured, skipping cPanel account creation');
        return { success: false, error: 'WHM not configured', skipped: true };
      }

      // Generate username from domain if not provided
      if (!username) {
        username = domain.replace(/[^a-z0-9]/gi, '').substring(0, 8).toLowerCase();
      }

      // Generate secure password if not provided
      if (!password) {
        password = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
      }

      logger.info(`Creating cPanel account for ${domain} (username: ${username})`);

      const params = {
        domain,
        username,
        contactemail: email,
        password,
        plan: plan || 'default',
        quota: diskQuota, // MB
        maxftp: 10,
        maxsql: 10,
        maxpop: 25,
        maxlst: 10,
        maxsub: 10,
        maxpark: 5,
        maxaddon: 5,
        bwlimit: 'unlimited',
        hasshell: 0,
        owner: 'root',
        ip: 'n', // Use shared IP
        cgi: 1,
        frontpage: 0,
        cpmod: 'paper_lantern'
      };

      const response = await axios.post(
        `${WHM_URL}/json-api/createacct`,
        null,
        {
          params,
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false // For self-signed SSL
          })
        }
      );

      if (response.data.metadata?.result === 1 || response.data.result?.[0]?.status === 1) {
        logger.info(`cPanel account created successfully for ${domain}`);

        return {
          success: true,
          domain,
          username,
          password,
          cpanelUrl: `https://${domain}:2083`,
          webmailUrl: `https://${domain}:2096`,
          serverIp: response.data.metadata?.output?.ip || null
        };
      } else {
        const errorMsg = response.data.metadata?.reason || response.data.result?.[0]?.statusmsg || 'Unknown error';
        throw new Error(`cPanel account creation failed: ${errorMsg}`);
      }

    } catch (error) {
      logger.error(`cPanel account creation failed for ${domain}:`, error);
      return {
        success: false,
        error: error.message,
        domain
      };
    }
  }

  /**
   * Suspend cPanel account
   */
  async suspendAccount({ username, reason = 'Payment overdue' }) {
    try {
      if (!WHM_API_TOKEN) {
        return { success: false, error: 'WHM not configured' };
      }

      const response = await axios.post(
        `${WHM_URL}/json-api/suspendacct`,
        null,
        {
          params: { user: username, reason },
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        }
      );

      if (response.data.metadata?.result === 1) {
        logger.info(`cPanel account suspended: ${username}`);
        return { success: true };
      } else {
        throw new Error(response.data.metadata?.reason || 'Suspend failed');
      }

    } catch (error) {
      logger.error(`cPanel account suspension failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsuspend cPanel account
   */
  async unsuspendAccount({ username }) {
    try {
      if (!WHM_API_TOKEN) {
        return { success: false, error: 'WHM not configured' };
      }

      const response = await axios.post(
        `${WHM_URL}/json-api/unsuspendacct`,
        null,
        {
          params: { user: username },
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        }
      );

      if (response.data.metadata?.result === 1) {
        logger.info(`cPanel account unsuspended: ${username}`);
        return { success: true };
      } else {
        throw new Error(response.data.metadata?.reason || 'Unsuspend failed');
      }

    } catch (error) {
      logger.error(`cPanel account unsuspension failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Terminate cPanel account
   */
  async terminateAccount({ username }) {
    try {
      if (!WHM_API_TOKEN) {
        return { success: false, error: 'WHM not configured' };
      }

      const response = await axios.post(
        `${WHM_URL}/json-api/removeacct`,
        null,
        {
          params: { user: username, keepdns: 0 },
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        }
      );

      if (response.data.metadata?.result === 1) {
        logger.info(`cPanel account terminated: ${username}`);
        return { success: true };
      } else {
        throw new Error(response.data.metadata?.reason || 'Termination failed');
      }

    } catch (error) {
      logger.error(`cPanel account termination failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Change account password
   */
  async changePassword({ username, newPassword }) {
    try {
      if (!WHM_API_TOKEN) {
        return { success: false, error: 'WHM not configured' };
      }

      const response = await axios.post(
        `${WHM_URL}/json-api/passwd`,
        null,
        {
          params: { user: username, password: newPassword },
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        }
      );

      if (response.data.metadata?.result === 1) {
        logger.info(`cPanel password changed for: ${username}`);
        return { success: true };
      } else {
        throw new Error(response.data.metadata?.reason || 'Password change failed');
      }

    } catch (error) {
      logger.error(`cPanel password change failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo({ username }) {
    try {
      if (!WHM_API_TOKEN) {
        return { success: false, error: 'WHM not configured' };
      }

      const response = await axios.get(
        `${WHM_URL}/json-api/accountsummary`,
        {
          params: { user: username },
          headers: {
            'Authorization': `WHM ${WHM_USERNAME}:${WHM_API_TOKEN}`
          },
          httpsAgent: new (await import('https')).Agent({
            rejectUnauthorized: false
          })
        }
      );

      if (response.data.metadata?.result === 1) {
        return {
          success: true,
          data: response.data.data?.acct?.[0] || {}
        };
      } else {
        throw new Error(response.data.metadata?.reason || 'Failed to get account info');
      }

    } catch (error) {
      logger.error(`Get cPanel account info failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new CpanelProvisioningService();
