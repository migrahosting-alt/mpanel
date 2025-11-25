/**
 * SSL Certificate Provisioning Service
 * Handles Let's Encrypt certificate issuance and installation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../config/logger.js';
import pool from '../db/index.js';

const execAsync = promisify(exec);

const CERTBOT_PATH = process.env.CERTBOT_PATH || '/usr/bin/certbot';
const ACME_WEBROOT = process.env.ACME_WEBROOT || '/var/www/html/.well-known/acme-challenge';

class SSLProvisioningService {
  /**
   * Issue Let's Encrypt SSL certificate
   */
  async issueSSL({ domain, email, tenantId, websiteId }) {
    try {
      logger.info(`Issuing SSL certificate for ${domain}`);

      // Check if certbot is available
      try {
        await execAsync('which certbot');
      } catch {
        logger.warn('Certbot not installed, skipping SSL certificate issuance');
        return { success: false, error: 'Certbot not installed', skipped: true };
      }

      // Issue certificate using certbot webroot method
      const command = `${CERTBOT_PATH} certonly --webroot \
        -w ${ACME_WEBROOT} \
        -d ${domain} \
        -d www.${domain} \
        --email ${email} \
        --agree-tos \
        --non-interactive \
        --expand`;

      logger.info(`Running certbot command for ${domain}`);

      try {
        const { stdout, stderr } = await execAsync(command);
        logger.info(`Certbot output for ${domain}:`, stdout);

        if (stderr && !stderr.includes('Saving debug log')) {
          logger.warn(`Certbot warnings for ${domain}:`, stderr);
        }

        // Get certificate paths
        const certPath = `/etc/letsencrypt/live/${domain}/fullchain.pem`;
        const keyPath = `/etc/letsencrypt/live/${domain}/privkey.pem`;

        // Store SSL certificate info in database
        await pool.query(
          `INSERT INTO ssl_certificates (
            tenant_id, domain_name, certificate_type, issuer, status,
            certificate_path, private_key_path, issue_date, expiry_date
          ) VALUES ($1, $2, 'letsencrypt', 'Let''s Encrypt', 'active', $3, $4, NOW(), NOW() + INTERVAL '90 days')
          ON CONFLICT (tenant_id, domain_name) DO UPDATE
          SET status = 'active',
              issue_date = NOW(),
              expiry_date = NOW() + INTERVAL '90 days',
              certificate_path = EXCLUDED.certificate_path,
              private_key_path = EXCLUDED.private_key_path,
              updated_at = NOW()`,
          [tenantId, domain, certPath, keyPath]
        );

        // Link to website if provided
        if (websiteId) {
          await pool.query(
            `UPDATE websites SET ssl_enabled = true, ssl_force_https = true WHERE id = $1`,
            [websiteId]
          );
        }

        logger.info(`SSL certificate issued successfully for ${domain}`);

        return {
          success: true,
          domain,
          issuer: 'Let\'s Encrypt',
          expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          certPath,
          keyPath
        };

      } catch (certbotError) {
        // Check if it's a renewal (certificate already exists)
        if (certbotError.message.includes('Certificate not yet due for renewal')) {
          logger.info(`SSL certificate already exists for ${domain}`);
          return {
            success: true,
            domain,
            message: 'Certificate already exists',
            existing: true
          };
        }
        throw certbotError;
      }

    } catch (error) {
      logger.error(`SSL certificate issuance failed for ${domain}:`, error);
      return {
        success: false,
        error: error.message,
        domain
      };
    }
  }

  /**
   * Renew SSL certificate
   */
  async renewSSL({ domain }) {
    try {
      logger.info(`Renewing SSL certificate for ${domain}`);

      const command = `${CERTBOT_PATH} renew --cert-name ${domain} --non-interactive`;

      const { stdout } = await execAsync(command);
      logger.info(`Certbot renewal output:`, stdout);

      await pool.query(
        `UPDATE ssl_certificates 
         SET expiry_date = NOW() + INTERVAL '90 days', updated_at = NOW()
         WHERE domain_name = $1`,
        [domain]
      );

      logger.info(`SSL certificate renewed for ${domain}`);
      return { success: true };

    } catch (error) {
      logger.error(`SSL renewal failed for ${domain}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Revoke SSL certificate
   */
  async revokeSSL({ domain }) {
    try {
      logger.info(`Revoking SSL certificate for ${domain}`);

      const command = `${CERTBOT_PATH} revoke --cert-name ${domain} --non-interactive`;

      await execAsync(command);

      await pool.query(
        `UPDATE ssl_certificates SET status = 'revoked', updated_at = NOW() WHERE domain_name = $1`,
        [domain]
      );

      logger.info(`SSL certificate revoked for ${domain}`);
      return { success: true };

    } catch (error) {
      logger.error(`SSL revocation failed for ${domain}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Install SSL certificate to cPanel (if using WHM API)
   */
  async installToCPanel({ domain, username, certPath, keyPath }) {
    try {
      // This would use WHM API to install certificate
      // For now, we'll just log it
      logger.info(`Would install SSL to cPanel for ${domain} (user: ${username})`);
      return { success: true, message: 'cPanel SSL installation not implemented' };

    } catch (error) {
      logger.error(`cPanel SSL installation failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new SSLProvisioningService();
