import db from '../db/index.js';
import logger from '../config/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import fetch from 'node-fetch';

const execAsync = promisify(exec);

/**
 * One-Click Installer Service
 * Automated installation of popular CMS and applications
 */
class OneClickInstallerService {
  constructor() {
    this.installers = {
      wordpress: {
        name: 'WordPress',
        version: '6.4.2',
        category: 'cms',
        requirements: { php: '7.4', mysql: '5.7', disk: '100MB' }
      },
      woocommerce: {
        name: 'WooCommerce (WordPress + WooCommerce)',
        version: '8.4.0',
        category: 'ecommerce',
        requirements: { php: '7.4', mysql: '5.7', disk: '150MB' }
      },
      joomla: {
        name: 'Joomla',
        version: '5.0.1',
        category: 'cms',
        requirements: { php: '8.0', mysql: '5.7', disk: '100MB' }
      },
      drupal: {
        name: 'Drupal',
        version: '10.1.7',
        category: 'cms',
        requirements: { php: '8.1', mysql: '5.7', disk: '120MB' }
      },
      prestashop: {
        name: 'PrestaShop',
        version: '8.1.2',
        category: 'ecommerce',
        requirements: { php: '7.4', mysql: '5.7', disk: '200MB' }
      },
      magento: {
        name: 'Magento',
        version: '2.4.6',
        category: 'ecommerce',
        requirements: { php: '8.1', mysql: '8.0', disk: '500MB' }
      },
      moodle: {
        name: 'Moodle',
        version: '4.3',
        category: 'education',
        requirements: { php: '8.0', mysql: '5.7', disk: '200MB' }
      },
      nextcloud: {
        name: 'Nextcloud',
        version: '28.0.0',
        category: 'cloud',
        requirements: { php: '8.0', mysql: '5.7', disk: '150MB' }
      },
      ghost: {
        name: 'Ghost',
        version: '5.75.0',
        category: 'blog',
        requirements: { nodejs: '18', mysql: '8.0', disk: '100MB' }
      }
    };
  }

  /**
   * Install WordPress with one click
   * @param {Object} config - Installation configuration
   * @returns {Promise<Object>} Installation result
   */
  async installWordPress(config) {
    try {
      const {
        websiteId,
        databaseId,
        adminUser,
        adminPassword,
        adminEmail,
        siteTitle,
        siteUrl,
        locale = 'en_US'
      } = config;

      logger.info(`Installing WordPress for website ${websiteId}`);

      // Get website and database details
      const websiteQuery = await db.query('SELECT * FROM websites WHERE id = $1', [websiteId]);
      const databaseQuery = await db.query('SELECT * FROM databases WHERE id = $1', [databaseId]);

      if (websiteQuery.rows.length === 0 || databaseQuery.rows.length === 0) {
        throw new Error('Website or database not found');
      }

      const website = websiteQuery.rows[0];
      const database = databaseQuery.rows[0];
      const installPath = website.document_root;

      // Create installation record
      const installQuery = `
        INSERT INTO one_click_installations (
          website_id,
          database_id,
          application,
          version,
          install_path,
          config,
          status,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *
      `;

      const installResult = await db.query(installQuery, [
        websiteId,
        databaseId,
        'wordpress',
        this.installers.wordpress.version,
        installPath,
        JSON.stringify({ siteTitle, adminUser, siteUrl, locale }),
        'installing'
      ]);

      const installationId = installResult.rows[0].id;

      // Download WordPress
      const wpDownloadUrl = `https://wordpress.org/wordpress-${this.installers.wordpress.version}.tar.gz`;
      const downloadPath = `/tmp/wordpress-${installationId}.tar.gz`;

      logger.info('Downloading WordPress...');
      const response = await fetch(wpDownloadUrl);
      const buffer = await response.buffer();
      await fs.writeFile(downloadPath, buffer);

      // Extract WordPress
      logger.info('Extracting WordPress...');
      await execAsync(`tar -xzf ${downloadPath} -C ${installPath} --strip-components=1`);

      // Create wp-config.php
      logger.info('Configuring WordPress...');
      const wpConfig = `<?php
define('DB_NAME', '${database.name}');
define('DB_USER', '${database.username}');
define('DB_PASSWORD', '${database.password}');
define('DB_HOST', '${database.host || 'localhost'}');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

define('AUTH_KEY',         '${this.generateSalt()}');
define('SECURE_AUTH_KEY',  '${this.generateSalt()}');
define('LOGGED_IN_KEY',    '${this.generateSalt()}');
define('NONCE_KEY',        '${this.generateSalt()}');
define('AUTH_SALT',        '${this.generateSalt()}');
define('SECURE_AUTH_SALT', '${this.generateSalt()}');
define('LOGGED_IN_SALT',   '${this.generateSalt()}');
define('NONCE_SALT',       '${this.generateSalt()}');

$table_prefix = 'wp_';

define('WP_DEBUG', false);

if ( ! defined( 'ABSPATH' ) ) {
  define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
`;

      await fs.writeFile(path.join(installPath, 'wp-config.php'), wpConfig);

      // Run WordPress installation via WP-CLI (if available) or HTTP
      logger.info('Running WordPress installation...');
      try {
        const wpCliCommand = `wp core install --path="${installPath}" --url="${siteUrl}" --title="${siteTitle}" --admin_user="${adminUser}" --admin_password="${adminPassword}" --admin_email="${adminEmail}" --locale="${locale}"`;
        await execAsync(wpCliCommand);
      } catch (cliError) {
        logger.warn('WP-CLI not available, using HTTP installation');
        // Fallback to HTTP installation
        const installUrl = `${siteUrl}/wp-admin/install.php`;
        const installData = {
          weblog_title: siteTitle,
          user_name: adminUser,
          admin_password: adminPassword,
          admin_password2: adminPassword,
          admin_email: adminEmail
        };

        await fetch(installUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(installData)
        });
      }

      // Update installation status
      await db.query(
        'UPDATE one_click_installations SET status = $1, installed_at = NOW() WHERE id = $2',
        ['installed', installationId]
      );

      // Clean up
      await fs.unlink(downloadPath);

      logger.info(`WordPress installed successfully for website ${websiteId}`);

      return {
        success: true,
        installationId,
        application: 'wordpress',
        version: this.installers.wordpress.version,
        siteUrl,
        adminUrl: `${siteUrl}/wp-admin`,
        credentials: {
          adminUser,
          adminEmail
        }
      };
    } catch (error) {
      logger.error('Error installing WordPress:', error);
      
      // Update installation status to failed
      await db.query(
        'UPDATE one_click_installations SET status = $1, error_message = $2 WHERE website_id = $3 AND status = $4',
        ['failed', error.message, config.websiteId, 'installing']
      );

      throw new Error(`Failed to install WordPress: ${error.message}`);
    }
  }

  /**
   * Install any supported application
   * @param {string} app - Application name
   * @param {Object} config - Installation configuration
   * @returns {Promise<Object>} Installation result
   */
  async installApplication(app, config) {
    try {
      if (!this.installers[app]) {
        throw new Error(`Application ${app} is not supported`);
      }

      // Special handling for specific applications
      switch (app) {
        case 'wordpress':
        case 'woocommerce':
          return await this.installWordPress(config);
        
        default:
          // Generic installation process
          return await this.genericInstall(app, config);
      }
    } catch (error) {
      logger.error(`Error installing ${app}:`, error);
      throw error;
    }
  }

  /**
   * Generic installation process
   * @private
   */
  async genericInstall(app, config) {
    const installer = this.installers[app];
    
    logger.info(`Installing ${installer.name}...`);

    // Create installation record
    const installQuery = `
      INSERT INTO one_click_installations (
        website_id,
        database_id,
        application,
        version,
        install_path,
        config,
        status,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `;

    const result = await db.query(installQuery, [
      config.websiteId,
      config.databaseId,
      app,
      installer.version,
      config.installPath || '/var/www/html',
      JSON.stringify(config),
      'pending'
    ]);

    return {
      success: true,
      installationId: result.rows[0].id,
      application: app,
      version: installer.version,
      message: `${installer.name} installation queued`
    };
  }

  /**
   * Get available installers
   * @returns {Object} Available installers
   */
  getAvailableInstallers() {
    return Object.entries(this.installers).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Get installation status
   * @param {number} installationId - Installation ID
   * @returns {Promise<Object>} Installation status
   */
  async getInstallationStatus(installationId) {
    try {
      const query = `
        SELECT * FROM one_click_installations
        WHERE id = $1
      `;

      const result = await db.query(query, [installationId]);

      if (result.rows.length === 0) {
        throw new Error('Installation not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting installation status:', error);
      throw new Error('Failed to retrieve installation status');
    }
  }

  /**
   * Get all installations for a website
   * @param {number} websiteId - Website ID
   * @returns {Promise<Array>} Installations
   */
  async getInstallations(websiteId) {
    try {
      const query = `
        SELECT * FROM one_click_installations
        WHERE website_id = $1
        ORDER BY created_at DESC
      `;

      const result = await db.query(query, [websiteId]);
      return result.rows;
    } catch (error) {
      logger.error('Error getting installations:', error);
      throw new Error('Failed to retrieve installations');
    }
  }

  /**
   * Generate salt for WordPress
   * @private
   */
  generateSalt(length = 64) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?';
    let salt = '';
    for (let i = 0; i < length; i++) {
      salt += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return salt;
  }
}

export default new OneClickInstallerService();
