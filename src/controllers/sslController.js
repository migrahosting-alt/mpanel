// src/controllers/sslController.js
/**
 * SSL Certificate Controller
 * Manages SSL certificate operations
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import acme from 'acme-client';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get all SSL certificates for user
 */
export const getCertificates = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT 
        c.*,
        u.email as user_email,
        EXTRACT(DAY FROM (c.expires_at - NOW())) as days_until_expiry
      FROM ssl_certificates c
      LEFT JOIN users u ON c.user_id = u.id
    `;

    const params = [];
    if (!isAdmin) {
      query += ` WHERE c.user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ certificates: result.rows });
  } catch (error) {
    logger.error('Error fetching SSL certificates:', error);
    res.status(500).json({ error: 'Failed to fetch SSL certificates' });
  }
};

/**
 * Get single SSL certificate
 */
export const getCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT * FROM ssl_certificates WHERE id = $1`
      : `SELECT * FROM ssl_certificates WHERE id = $1 AND user_id = $2`;

    const params = isAdmin ? [id] : [id, userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching SSL certificate:', error);
    res.status(500).json({ error: 'Failed to fetch SSL certificate' });
  }
};

/**
 * Issue Let's Encrypt SSL certificate
 */
export const issueCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { domain, email } = req.body;

    if (!domain || !email) {
      return res.status(400).json({ error: 'Domain and email are required' });
    }

    // Check if certificate already exists
    const existing = await pool.query(
      `SELECT id FROM ssl_certificates WHERE domain = $1 AND status = 'active'`,
      [domain]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Active certificate already exists for this domain' });
    }

    // Initialize ACME client
    const certDir = process.env.SSL_CERT_DIR || '/etc/mpanel/ssl';
    await fs.mkdir(certDir, { recursive: true });

    const accountKeyPath = path.join(certDir, 'account.key');
    let accountKey;

    try {
      accountKey = await fs.readFile(accountKeyPath, 'utf8');
    } catch (error) {
      accountKey = await acme.forge.createPrivateKey();
      await fs.writeFile(accountKeyPath, accountKey);
    }

    const client = new acme.Client({
      directoryUrl: acme.directory.letsencrypt.production,
      accountKey,
    });

    // Create CSR
    const [key, csr] = await acme.forge.createCsr({
      commonName: domain,
      altNames: [`www.${domain}`],
    });

    // Issue certificate
    const cert = await client.auto({
      csr,
      email,
      termsOfServiceAgreed: true,
      challengeCreateFn: async (authz, challenge, keyAuthorization) => {
        // HTTP-01 challenge
        if (challenge.type === 'http-01') {
          const challengeDir = path.join(
            process.env.WEBROOT || '/var/www/html',
            domain,
            '.well-known/acme-challenge'
          );
          await fs.mkdir(challengeDir, { recursive: true });
          await fs.writeFile(path.join(challengeDir, challenge.token), keyAuthorization);
        }
      },
      challengeRemoveFn: async (authz, challenge, keyAuthorization) => {
        if (challenge.type === 'http-01') {
          try {
            const challengePath = path.join(
              process.env.WEBROOT || '/var/www/html',
              domain,
              '.well-known/acme-challenge',
              challenge.token
            );
            await fs.unlink(challengePath);
          } catch (error) {
            logger.warn('Failed to remove challenge file:', error);
          }
        }
      },
    });

    // Parse certificate to get expiry
    const certInfo = acme.forge.readCertificateInfo(cert);
    const expiresAt = certInfo.notAfter;

    // Save to database
    const result = await pool.query(
      `INSERT INTO ssl_certificates 
       (user_id, domain, certificate, private_key, issued_at, expires_at, status, auto_renew, type)
       VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
       RETURNING *`,
      [userId, domain, cert, key, expiresAt, 'active', true, 'letsencrypt']
    );

    // Save to filesystem
    const domainDir = path.join(certDir, domain);
    await fs.mkdir(domainDir, { recursive: true });
    await fs.writeFile(path.join(domainDir, 'fullchain.pem'), cert);
    await fs.writeFile(path.join(domainDir, 'privkey.pem'), key);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'ssl_issued', `SSL certificate issued for ${domain}`]
    );

    logger.info(`SSL certificate issued for ${domain}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error issuing SSL certificate:', error);
    res.status(500).json({ error: 'Failed to issue SSL certificate: ' + error.message });
  }
};

/**
 * Upload custom SSL certificate
 */
export const uploadCertificate = async (req, res) => {
  try {
    const userId = req.user.id;
    const { domain, certificate, private_key, chain } = req.body;

    if (!domain || !certificate || !private_key) {
      return res.status(400).json({ error: 'Domain, certificate, and private key are required' });
    }

    // Validate certificate
    try {
      const certInfo = acme.forge.readCertificateInfo(certificate);
      const expiresAt = certInfo.notAfter;

      // Save to database
      const result = await pool.query(
        `INSERT INTO ssl_certificates 
         (user_id, domain, certificate, private_key, chain, issued_at, expires_at, status, auto_renew, type)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9)
         RETURNING *`,
        [userId, domain, certificate, private_key, chain, expiresAt, 'active', false, 'custom']
      );

      // Save to filesystem
      const certDir = process.env.SSL_CERT_DIR || '/etc/mpanel/ssl';
      const domainDir = path.join(certDir, domain);
      await fs.mkdir(domainDir, { recursive: true });
      await fs.writeFile(path.join(domainDir, 'fullchain.pem'), certificate);
      await fs.writeFile(path.join(domainDir, 'privkey.pem'), private_key);
      if (chain) {
        await fs.writeFile(path.join(domainDir, 'chain.pem'), chain);
      }

      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
        [userId, 'ssl_uploaded', `Custom SSL certificate uploaded for ${domain}`]
      );

      logger.info(`Custom SSL certificate uploaded for ${domain}`);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid certificate or private key' });
    }
  } catch (error) {
    logger.error('Error uploading SSL certificate:', error);
    res.status(500).json({ error: 'Failed to upload SSL certificate' });
  }
};

/**
 * Renew SSL certificate
 */
export const renewCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Get existing certificate
    const query = isAdmin
      ? `SELECT * FROM ssl_certificates WHERE id = $1`
      : `SELECT * FROM ssl_certificates WHERE id = $1 AND user_id = $2`;

    const params = isAdmin ? [id] : [id, userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = result.rows[0];

    if (cert.type !== 'letsencrypt') {
      return res.status(400).json({ error: 'Only Let\'s Encrypt certificates can be auto-renewed' });
    }

    // Get user email
    const userResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [cert.user_id]);
    const email = userResult.rows[0]?.email;

    // Issue new certificate via background worker
    await pool.query(
      `UPDATE ssl_certificates SET status = 'renewing', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Queue renewal in background worker
    try {
      const { default: sslWorker } = await import('../workers/sslWorker.js');
      
      // Run renewal asynchronously
      sslWorker.renewCertificate(id, cert.domain, email).then(async () => {
        await pool.query(
          `UPDATE ssl_certificates SET 
           status = 'active', 
           expires_at = NOW() + INTERVAL '90 days',
           updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );
        logger.info(`SSL certificate ${id} renewed successfully`);
      }).catch(async (error) => {
        logger.error(`SSL renewal failed for certificate ${id}:`, error);
        await pool.query(
          `UPDATE ssl_certificates SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [id]
        );
      });
      
      logger.info(`SSL renewal queued for certificate ${id}`);
    } catch (error) {
      logger.error('Failed to queue SSL renewal:', error);
      // Fallback: mark as active and log error
      await pool.query(
        `UPDATE ssl_certificates SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [id]
      );
    }

    res.json({ message: 'Certificate renewal initiated', certificate: cert });
  } catch (error) {
    logger.error('Error renewing SSL certificate:', error);
    res.status(500).json({ error: 'Failed to renew SSL certificate' });
  }
};

/**
 * Delete/revoke SSL certificate
 */
export const deleteCertificate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT * FROM ssl_certificates WHERE id = $1`
      : `SELECT * FROM ssl_certificates WHERE id = $1 AND user_id = $2`;

    const params = isAdmin ? [id] : [id, userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const cert = result.rows[0];

    // Mark as revoked instead of deleting
    await pool.query(
      `UPDATE ssl_certificates SET status = 'revoked', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'ssl_revoked', `SSL certificate revoked for ${cert.domain}`]
    );

    logger.info(`SSL certificate revoked for ${cert.domain}`);
    res.json({ message: 'Certificate revoked successfully' });
  } catch (error) {
    logger.error('Error deleting SSL certificate:', error);
    res.status(500).json({ error: 'Failed to delete SSL certificate' });
  }
};

/**
 * Toggle auto-renewal
 */
export const toggleAutoRenew = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { auto_renew } = req.body;

    const result = await pool.query(
      `UPDATE ssl_certificates 
       SET auto_renew = $1, updated_at = NOW() 
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [auto_renew, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error toggling auto-renew:', error);
    res.status(500).json({ error: 'Failed to update auto-renew setting' });
  }
};

/**
 * Get SSL statistics (admin only)
 */
export const getSSLStats = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE type = 'letsencrypt') as letsencrypt,
        COUNT(*) FILTER (WHERE type = 'custom') as custom,
        COUNT(*) FILTER (WHERE expires_at < NOW() + INTERVAL '30 days') as expiring_soon
      FROM ssl_certificates
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    logger.error('Error fetching SSL stats:', error);
    res.status(500).json({ error: 'Failed to fetch SSL stats' });
  }
};
