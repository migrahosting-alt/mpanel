/**
 * Provisioning Service - WHMCS-like automated service provisioning
 * 
 * This is the core of the hosting automation system.
 * When a customer purchases a service, this automatically:
 * - Creates hosting account (cPanel/Plesk/DirectAdmin)
 * - Sets up DNS zones
 * - Installs SSL certificates
 * - Creates email accounts
 * - Sets up databases
 * - Sends welcome emails
 */

import logger from '../config/logger.js';
import pool from '../db/index.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

class ProvisioningService {
  constructor() {
    this.provisioningQueue = [];
    this.processingTasks = new Map();
  }

  /**
   * Main provisioning entry point
   * Called when a service is purchased
   */
  async provisionService(serviceId, customerId, productId, domain) {
    try {
      logger.info(`Starting provisioning for service ${serviceId}`, {
        serviceId,
        customerId,
        productId,
        domain
      });

      // Create provisioning task
      const taskId = await this.createProvisioningTask(serviceId, customerId);

      // Get product configuration
      const product = await this.getProductConfig(productId);
      
      // Get customer details
      const customer = await this.getCustomerDetails(customerId);

      // Update task status
      await this.updateTaskStatus(taskId, 'processing');

      // Execute provisioning steps in sequence
      const results = {
        taskId,
        serviceId,
        steps: []
      };

      try {
        // Step 1: Create hosting account
        logger.info(`Step 1/6: Creating hosting account for ${domain}`);
        const accountResult = await this.createHostingAccount({
          domain,
          customer,
          product,
          serviceId
        });
        results.steps.push({ step: 'account', status: 'success', data: accountResult });

        // Step 2: Configure DNS
        logger.info(`Step 2/6: Configuring DNS for ${domain}`);
        const dnsResult = await this.configureDNS({
          domain,
          serviceId,
          product
        });
        results.steps.push({ step: 'dns', status: 'success', data: dnsResult });

        // Step 3: Install SSL
        logger.info(`Step 3/6: Installing SSL for ${domain}`);
        const sslResult = await this.installSSL({
          domain,
          serviceId
        });
        results.steps.push({ step: 'ssl', status: 'success', data: sslResult });

        // Step 4: Setup email
        logger.info(`Step 4/6: Setting up email for ${domain}`);
        const emailResult = await this.setupEmail({
          domain,
          customer,
          serviceId,
          product
        });
        results.steps.push({ step: 'email', status: 'success', data: emailResult });

        // Step 5: Create databases
        logger.info(`Step 5/6: Creating databases for ${domain}`);
        const dbResult = await this.createDatabases({
          domain,
          serviceId,
          product
        });
        results.steps.push({ step: 'database', status: 'success', data: dbResult });

        // Step 6: Send welcome email
        logger.info(`Step 6/6: Sending welcome email to ${customer.email}`);
        const emailSent = await this.sendWelcomeEmail({
          customer,
          domain,
          accountResult,
          product
        });
        results.steps.push({ step: 'welcome_email', status: 'success', data: { sent: emailSent } });

        // Mark task as completed
        await this.updateTaskStatus(taskId, 'completed', results);
        
        // Update service status to active
        await this.updateServiceStatus(serviceId, 'active');

        logger.info(`Provisioning completed successfully for service ${serviceId}`);
        return results;

      } catch (stepError) {
        logger.error(`Provisioning step failed for service ${serviceId}:`, stepError);
        results.error = stepError.message;
        results.failedAt = stepError.step || 'unknown';
        
        await this.updateTaskStatus(taskId, 'failed', results);
        
        // Don't activate service if provisioning failed
        await this.updateServiceStatus(serviceId, 'pending', stepError.message);
        
        throw stepError;
      }

    } catch (error) {
      logger.error(`Provisioning failed for service ${serviceId}:`, error);
      throw error;
    }
  }

  /**
   * Step 1: Create hosting account
   * Creates cPanel/Plesk/DirectAdmin account via API or shell
   */
  async createHostingAccount({ domain, customer, product, serviceId }) {
    try {
      const username = this.generateUsername(domain);
      const password = this.generateSecurePassword();
      
      // Get server for this service
      const server = await this.assignServer(product);
      
      const accountData = {
        username,
        password,
        domain,
        email: customer.email,
        package: product.cpanel_package || 'default',
        quota: product.disk_space || 10240, // MB
        ip: server.ip_address,
        serverId: server.id
      };

      // Check server type and call appropriate API
      if (server.control_panel === 'cpanel') {
        const result = await this.createCPanelAccount(server, accountData);
        accountData.cpanel_url = result.cpanel_url;
      } else if (server.control_panel === 'plesk') {
        const result = await this.createPleskAccount(server, accountData);
        accountData.plesk_url = result.plesk_url;
      } else if (server.control_panel === 'directadmin') {
        const result = await this.createDirectAdminAccount(server, accountData);
        accountData.da_url = result.da_url;
      } else {
        // Generic/manual provisioning
        accountData.manual = true;
      }

      // Store account credentials in database (encrypted)
      await this.storeAccountCredentials(serviceId, accountData);

      // Create website record
      await this.createWebsiteRecord(serviceId, domain, accountData);

      logger.info(`Hosting account created: ${username} on server ${server.hostname}`);
      
      return {
        username,
        server: server.hostname,
        control_panel: server.control_panel,
        ip: server.ip_address,
        created: true
      };

    } catch (error) {
      error.step = 'create_account';
      throw error;
    }
  }

  /**
   * Step 2: Configure DNS
   * Creates DNS zone and default records
   */
  async configureDNS({ domain, serviceId, product }) {
    try {
      // Get server IP
      const service = await this.getServiceDetails(serviceId);
      const server = await this.getServerById(service.server_id);

      // Create DNS zone
      const client = await pool.connect();
      try {
        const zoneResult = await client.query(
          `INSERT INTO dns_zones (domain, service_id, ttl, refresh, retry, expire, minimum)
           VALUES ($1, $2, 3600, 7200, 3600, 1209600, 3600)
           RETURNING id`,
          [domain, serviceId]
        );

        const zoneId = zoneResult.rows[0].id;

        // Create default DNS records
        const records = [
          { type: 'A', name: '@', value: server.ip_address, ttl: 3600 },
          { type: 'A', name: 'www', value: server.ip_address, ttl: 3600 },
          { type: 'CNAME', name: 'mail', value: domain, ttl: 3600 },
          { type: 'MX', name: '@', value: `mail.${domain}`, priority: 10, ttl: 3600 },
          { type: 'TXT', name: '@', value: 'v=spf1 a mx ~all', ttl: 3600 }
        ];

        for (const record of records) {
          await client.query(
            `INSERT INTO dns_records (zone_id, type, name, value, ttl, priority)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [zoneId, record.type, record.name, record.value, record.ttl, record.priority || null]
          );
        }

        client.release();

        logger.info(`DNS zone created for ${domain} with ${records.length} records`);
        
        return {
          zone_id: zoneId,
          records: records.length,
          nameservers: [`ns1.${process.env.COMPANY_DOMAIN}`, `ns2.${process.env.COMPANY_DOMAIN}`]
        };

      } catch (dbError) {
        client.release();
        throw dbError;
      }

    } catch (error) {
      error.step = 'configure_dns';
      throw error;
    }
  }

  /**
   * Step 3: Install SSL certificate
   * Requests Let's Encrypt SSL via Certbot or panel API
   */
  async installSSL({ domain, serviceId }) {
    try {
      const service = await this.getServiceDetails(serviceId);
      const server = await this.getServerById(service.server_id);

      let sslResult;

      if (server.control_panel === 'cpanel') {
        // Use cPanel AutoSSL
        sslResult = await this.installCPanelSSL(server, domain);
      } else {
        // Use Let's Encrypt directly
        sslResult = await this.installLetsEncryptSSL(domain, server);
      }

      // Store SSL certificate info
      await pool.query(
        `INSERT INTO ssl_certificates (domain, service_id, provider, status, issued_at, expires_at, auto_renew)
         VALUES ($1, $2, 'letsencrypt', 'active', NOW(), NOW() + INTERVAL '90 days', true)`,
        [domain, serviceId]
      );

      logger.info(`SSL certificate installed for ${domain}`);
      
      return {
        provider: 'letsencrypt',
        expires_in_days: 90,
        auto_renew: true
      };

    } catch (error) {
      // SSL is not critical - log but don't fail provisioning
      logger.warn(`SSL installation failed for ${domain}:`, error);
      return {
        provider: 'none',
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Step 4: Setup email
   * Creates default email account (e.g., admin@domain.com)
   */
  async setupEmail({ domain, customer, serviceId, product }) {
    try {
      const service = await this.getServiceDetails(serviceId);
      const server = await this.getServerById(service.server_id);

      const defaultEmail = `admin@${domain}`;
      const password = this.generateSecurePassword();

      // Create email account via panel API
      if (server.control_panel === 'cpanel') {
        await this.createCPanelEmailAccount(server, service.username, defaultEmail, password);
      } else if (server.control_panel === 'plesk') {
        await this.createPleskEmailAccount(server, domain, defaultEmail, password);
      }

      // Store email account
      await pool.query(
        `INSERT INTO email_accounts (domain, email, password_hash, quota_mb, service_id, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [domain, defaultEmail, password, product.email_quota || 1024, serviceId]
      );

      logger.info(`Email account created: ${defaultEmail}`);
      
      return {
        default_email: defaultEmail,
        password: password, // Will be sent in welcome email
        quota_mb: product.email_quota || 1024
      };

    } catch (error) {
      error.step = 'setup_email';
      throw error;
    }
  }

  /**
   * Step 5: Create databases
   * Creates MySQL/PostgreSQL databases based on package limits
   */
  async createDatabases({ domain, serviceId, product }) {
    try {
      const dbCount = product.database_limit || 1;
      if (dbCount === 0) {
        return { databases: 0, message: 'No databases included in package' };
      }

      const service = await this.getServiceDetails(serviceId);
      const server = await this.getServerById(service.server_id);

      const databases = [];
      const dbPrefix = domain.replace(/\./g, '_').substring(0, 10);

      // Create first database automatically
      const dbName = `${dbPrefix}_db`;
      const dbUser = `${dbPrefix}_user`;
      const dbPass = this.generateSecurePassword();

      if (server.control_panel === 'cpanel') {
        await this.createCPanelDatabase(server, service.username, dbName, dbUser, dbPass);
      }

      // Store database info
      await pool.query(
        `INSERT INTO databases (name, username, password_hash, type, service_id, domain, status)
         VALUES ($1, $2, $3, 'mysql', $4, $5, 'active')`,
        [dbName, dbUser, dbPass, serviceId, domain]
      );

      databases.push({
        name: dbName,
        user: dbUser,
        password: dbPass,
        host: server.db_host || 'localhost'
      });

      logger.info(`Database created: ${dbName} for ${domain}`);
      
      return {
        databases_created: databases.length,
        databases: databases,
        remaining: dbCount - databases.length
      };

    } catch (error) {
      error.step = 'create_databases';
      throw error;
    }
  }

  /**
   * Step 6: Send welcome email with login details
   */
  async sendWelcomeEmail({ customer, domain, accountResult, product }) {
    try {
      const emailService = (await import('./email.js')).default;

      const emailData = {
        to: customer.email,
        subject: `Welcome to ${process.env.COMPANY_NAME} - Your Hosting Account is Ready!`,
        template: 'welcome',
        data: {
          customer_name: customer.name,
          domain: domain,
          username: accountResult.username,
          control_panel_url: accountResult.cpanel_url || accountResult.plesk_url || accountResult.da_url,
          server: accountResult.server,
          package: product.name,
          login_url: `https://${accountResult.server}:2083`, // cPanel default
          company_name: process.env.COMPANY_NAME,
          support_email: process.env.SUPPORT_EMAIL || 'support@example.com'
        }
      };

      await emailService.sendTransactional(emailData);
      
      logger.info(`Welcome email sent to ${customer.email} for ${domain}`);
      return true;

    } catch (error) {
      logger.error(`Failed to send welcome email:`, error);
      return false;
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  async createProvisioningTask(serviceId, customerId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO provisioning_tasks (service_id, customer_id, status, created_at)
         VALUES ($1, $2, 'pending', NOW())
         RETURNING id`,
        [serviceId, customerId]
      );
      return result.rows[0].id;
    } finally {
      client.release();
    }
  }

  async updateTaskStatus(taskId, status, data = null) {
    await pool.query(
      `UPDATE provisioning_tasks 
       SET status = $1, updated_at = NOW(), result_data = $2
       WHERE id = $3`,
      [status, JSON.stringify(data), taskId]
    );
  }

  async updateServiceStatus(serviceId, status, error_message = null) {
    await pool.query(
      `UPDATE services 
       SET status = $1, provisioning_error = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, error_message, serviceId]
    );
  }

  generateUsername(domain) {
    // Create username from domain (max 16 chars for cPanel)
    const base = domain.replace(/\..+$/, '').replace(/[^a-z0-9]/g, '');
    const username = base.substring(0, 12) + Math.random().toString(36).substring(2, 6);
    return username.toLowerCase();
  }

  generateSecurePassword(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += chars[randomBytes[i] % chars.length];
    }
    
    return password;
  }

  async assignServer(product) {
    // Find server with lowest load that matches product requirements
    const result = await pool.query(
      `SELECT * FROM servers 
       WHERE status = 'active' AND control_panel IS NOT NULL
       ORDER BY (SELECT COUNT(*) FROM services WHERE server_id = servers.id) ASC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      throw new Error('No available servers for provisioning');
    }

    return result.rows[0];
  }

  async getProductConfig(productId) {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (result.rows.length === 0) {
      throw new Error(`Product not found: ${productId}`);
    }
    return result.rows[0];
  }

  async getCustomerDetails(customerId) {
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (result.rows.length === 0) {
      throw new Error(`Customer not found: ${customerId}`);
    }
    return result.rows[0];
  }

  async getServiceDetails(serviceId) {
    const result = await pool.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    if (result.rows.length === 0) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    return result.rows[0];
  }

  async getServerById(serverId) {
    const result = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
    if (result.rows.length === 0) {
      throw new Error(`Server not found: ${serverId}`);
    }
    return result.rows[0];
  }

  async storeAccountCredentials(serviceId, accountData) {
    // Encrypt sensitive data before storing
    const encrypted = this.encryptCredentials(accountData.password);
    
    await pool.query(
      `UPDATE services 
       SET username = $1, password_encrypted = $2, server_id = $3
       WHERE id = $4`,
      [accountData.username, encrypted, accountData.serverId, serviceId]
    );
  }

  async createWebsiteRecord(serviceId, domain, accountData) {
    await pool.query(
      `INSERT INTO websites (domain, service_id, username, status, created_at)
       VALUES ($1, $2, $3, 'active', NOW())`,
      [domain, serviceId, accountData.username]
    );
  }

  encryptCredentials(password) {
    // Use AES-256 encryption
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  // ========================================
  // Server Agent API Methods (mPanel Native - Low Level)
  // ========================================
  // These methods communicate with mPanel's own server agent
  // See: server-agent/ directory and SERVER_AGENT_ARCHITECTURE.md

  async provisionServerAccount(server, accountData) {
    try {
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      const response = await axios.post(`https://${server.hostname}:3100/api/accounts`, {
        username: accountData.username,
        password: accountData.password,
        domain: accountData.domain,
        quota_mb: accountData.quota || 10240,
        max_databases: accountData.max_databases || 10
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Server account created via mPanel agent: ${accountData.username} on ${server.hostname}`);
      return {
        success: true,
        agent_url: `https://${server.hostname}:3100`,
        username: accountData.username,
        data: response.data
      };
    } catch (error) {
      logger.error(`Failed to provision server account on ${server.hostname}:`, error.message);
      throw new Error(`Server agent provisioning failed: ${error.message}`);
    }
  }

  async provisionSSLCertificate(server, domain) {
    try {
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      const response = await axios.post(`https://${server.hostname}:3100/api/ssl/certificates`, {
        domain,
        provider: 'letsencrypt'
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 60000 // SSL issuance can take longer
      });
      
      logger.info(`SSL certificate installed for ${domain} via mPanel agent`);
      return { 
        success: true, 
        provider: 'letsencrypt',
        data: response.data
      };
    } catch (error) {
      logger.error(`Failed to provision SSL certificate for ${domain}:`, error.message);
      throw new Error(`SSL provisioning failed: ${error.message}`);
    }
  }

  async provisionEmailAccount(server, _username, email, password) {
    try {
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      const response = await axios.post(`https://${server.hostname}:3100/api/email/accounts`, {
        email,
        password,
        quota_mb: 1024,
        spam_filter_enabled: true
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Email account ${email} created via mPanel agent`);
      return { 
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error(`Failed to provision email account ${email}:`, error.message);
      throw new Error(`Email provisioning failed: ${error.message}`);
    }
  }

  async provisionDatabase(server, _username, dbName, dbUser, dbPass) {
    try {
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      const response = await axios.post(`https://${server.hostname}:3100/api/databases`, {
        name: dbName,
        user: dbUser,
        password: dbPass,
        type: 'mysql'
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Database ${dbName} created via mPanel agent`);
      return { 
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error(`Failed to provision database ${dbName}:`, error.message);
      throw new Error(`Database provisioning failed: ${error.message}`);
    }
  }
}

export default new ProvisioningService();
