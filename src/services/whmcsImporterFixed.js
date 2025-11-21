import mysql from 'mysql2/promise';
import pool from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../config/logger.js';

/**
 * Fixed WHMCS Importer matching actual schemas
 */
class WHMCSImporter {
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.stats = {
      clients: 0,
      products: 0,
      servers: 0,
      hosting: 0,
      invoices: 0,
      domains: 0,
      tickets: 0
    };
  }

  async connect() {
    this.connection = await mysql.createConnection({
      host: this.config.host,
      port: this.config.port || 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });
    logger.info('Connected to WHMCS database');
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('Disconnected from WHMCS database');
    }
  }

  async importAll(tenantId = null) {
    try {
      await this.connect();
      
      logger.info('Starting WHMCS import...');
      
      await this.importClients(tenantId);
      await this.importProducts(tenantId);
      await this.importServers(tenantId);
      await this.importHosting(tenantId);
      await this.importInvoices(tenantId);
      await this.importDomains(tenantId);
      
      await this.disconnect();
      
      logger.info('WHMCS import completed', this.stats);
      return this.stats;
    } catch (error) {
      logger.error('WHMCS import failed:', error);
      throw error;
    }
  }

  /**
   * Import clients - creates both user and customer records
   */
  async importClients(tenantId) {
    try {
      const [clients] = await this.connection.query(`
        SELECT 
          id, firstname, lastname, companyname, email, address1, address2,
          city, state, postcode, country, phonenumber, 
          status, datecreated, currency
        FROM tblclients
        WHERE status = 'Active'
      `);

      logger.info(`Found ${clients.length} WHMCS clients`);

      for (const client of clients) {
        try {
          // Create user account
          const hashedPassword = await bcrypt.hash('Welcome123!', 10);
          
          const userResult = await pool.query(`
            INSERT INTO users (
              tenant_id, email, password_hash, first_name, last_name, role, status, email_verified
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (tenant_id, email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
            RETURNING id
          `, [
            tenantId,
            client.email.toLowerCase(),
            hashedPassword,
            client.firstname || '',
            client.lastname || '',
            'customer',
            client.status === 'Active' ? 'active' : 'inactive',
            true
          ]);

          const userId = userResult.rows[0].id;

          // Create customer record
          await pool.query(`
            INSERT INTO customers (
              tenant_id, user_id, company_name,
              address_line1, address_line2, city, state, postal_code,
              country, phone, currency, credit_balance
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            userId,
            client.companyname || `${client.firstname} ${client.lastname}`,
            client.address1 || '',
            client.address2 || '',
            client.city || '',
            client.state || '',
            client.postcode || '',
            client.country || 'US',
            client.phonenumber || '',
            client.currency || 'USD',
            0
          ]);

          this.stats.clients++;
          logger.info(`Imported client: ${client.email}`);
        } catch (error) {
          logger.warn(`Skipped client ${client.email}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.clients} clients`);
    } catch (error) {
      logger.error('Client import failed:', error);
      throw error;
    }
  }

  /**
   * Import products with pricing
   */
  async importProducts(tenantId) {
    try {
      const [products] = await this.connection.query(`
        SELECT 
          p.id, p.type, p.name, p.description, p.hidden,
          p.paytype, p.tax, p.created_at, p.updated_at
        FROM tblproducts p
        WHERE p.hidden = 0 AND p.retired = 0
      `);

      logger.info(`Found ${products.length} WHMCS products`);

      for (const product of products) {
        try {
          // Get pricing
          const [pricing] = await this.connection.query(`
            SELECT currency, msetupfee, monthly, quarterly, 
                   semiannually, annually, biennially, triennially
            FROM tblpricing
            WHERE type = 'product' AND relid = ? LIMIT 1
          `, [product.id]);

          const price = pricing[0] || {};
          const monthlyPrice = parseFloat(price.monthly || 0);
          const annualPrice = parseFloat(price.annually || monthlyPrice * 12);

          await pool.query(`
            INSERT INTO products (
              tenant_id, name, description, type, billing_cycle,
              price, setup_fee, currency, taxable, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            product.name,
            product.description || '',
            this.mapProductType(product.type),
            product.paytype === 'free' ? 'free' : 'monthly',
            monthlyPrice,
            parseFloat(price.msetupfee || 0),
            price.currency || 'USD',
            product.tax === 1,
            'active'
          ]);

          this.stats.products++;
          logger.info(`Imported product: ${product.name}`);
        } catch (error) {
          logger.warn(`Skipped product ${product.name}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.products} products`);
    } catch (error) {
      logger.error('Product import failed:', error);
      throw error;
    }
  }

  /**
   * Import servers
   */
  async importServers(tenantId) {
    try {
      const [servers] = await this.connection.query(`
        SELECT 
          id, name, ipaddress, hostname, type, username, 
          password, accesshash, port, secure, active
        FROM tblservers
        WHERE active = 1
      `);

      logger.info(`Found ${servers.length} WHMCS servers`);

      for (const server of servers) {
        try {
          await pool.query(`
            INSERT INTO servers (
              tenant_id, name, hostname, ip_address, type, port,
              username, password, api_token, ssl_enabled, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            server.name,
            server.hostname || server.ipaddress,
            server.ipaddress,
            this.mapServerType(server.type),
            server.port || 2087,
            server.username || '',
            server.password || '',
            server.accesshash || '',
            server.secure === 'on',
            server.active === 1 ? 'active' : 'inactive'
          ]);

          this.stats.servers++;
          logger.info(`Imported server: ${server.name}`);
        } catch (error) {
          logger.warn(`Skipped server ${server.name}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.servers} servers`);
    } catch (error) {
      logger.error('Server import failed:', error);
      throw error;
    }
  }

  /**
   * Import hosting accounts (websites)
   */
  async importHosting(tenantId) {
    try {
      const [hosting] = await this.connection.query(`
        SELECT 
          h.id, h.userid, h.packageid, h.server, h.regdate, h.domain,
          h.username, h.password, h.domainstatus, h.billingcycle,
          h.amount, h.nextduedate
        FROM tblhosting h
        WHERE h.domainstatus = 'Active'
      `);

      logger.info(`Found ${hosting.length} WHMCS hosting accounts`);

      for (const account of hosting) {
        try {
          // Get customer by WHMCS client ID
          const [clientEmail] = await this.connection.query(
            'SELECT email FROM tblclients WHERE id = ?',
            [account.userid]
          );

          if (!clientEmail.length) continue;

          const customerResult = await pool.query(
            `SELECT c.id FROM customers c 
             JOIN users u ON c.user_id = u.id 
             WHERE u.email = $1 AND c.tenant_id = $2`,
            [clientEmail[0].email, tenantId]
          );

          if (!customerResult.rows.length) continue;

          const customerId = customerResult.rows[0].id;

          // Create website record
          await pool.query(`
            INSERT INTO websites (
              tenant_id, customer_id, domain, username, password,
              server_id, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            customerId,
            account.domain,
            account.username || '',
            account.password || '',
            account.server || 1,
            account.domainstatus === 'Active' ? 'active' : 'suspended',
            account.regdate
          ]);

          this.stats.hosting++;
          logger.info(`Imported hosting: ${account.domain}`);
        } catch (error) {
          logger.warn(`Skipped hosting ${account.domain}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.hosting} hosting accounts`);
    } catch (error) {
      logger.error('Hosting import failed:', error);
      throw error;
    }
  }

  /**
   * Import invoices
   */
  async importInvoices(tenantId) {
    try {
      const [invoices] = await this.connection.query(`
        SELECT 
          i.id, i.userid, i.invoicenum, i.date, i.duedate, 
          i.datepaid, i.subtotal, i.tax, i.total, i.status
        FROM tblinvoices i
        WHERE i.status IN ('Paid', 'Unpaid')
        LIMIT 100
      `);

      logger.info(`Found ${invoices.length} WHMCS invoices`);

      for (const invoice of invoices) {
        try {
          // Get customer
          const [clientEmail] = await this.connection.query(
            'SELECT email FROM tblclients WHERE id = ?',
            [invoice.userid]
          );

          if (!clientEmail.length) continue;

          const customerResult = await pool.query(
            `SELECT c.id FROM customers c 
             JOIN users u ON c.user_id = u.id 
             WHERE u.email = $1 AND c.tenant_id = $2`,
            [clientEmail[0].email, tenantId]
          );

          if (!customerResult.rows.length) continue;

          const customerId = customerResult.rows[0].id;

          await pool.query(`
            INSERT INTO invoices (
              tenant_id, customer_id, invoice_number, subtotal, tax, total,
              status, due_date, paid_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            customerId,
            invoice.invoicenum,
            parseFloat(invoice.subtotal),
            parseFloat(invoice.tax),
            parseFloat(invoice.total),
            invoice.status === 'Paid' ? 'paid' : 'pending',
            invoice.duedate,
            invoice.datepaid,
            invoice.date
          ]);

          this.stats.invoices++;
        } catch (error) {
          logger.warn(`Skipped invoice ${invoice.invoicenum}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.invoices} invoices`);
    } catch (error) {
      logger.error('Invoice import failed:', error);
      throw error;
    }
  }

  /**
   * Import domains
   */
  async importDomains(tenantId) {
    try {
      const [domains] = await this.connection.query(`
        SELECT 
          d.id, d.userid, d.domain, d.registrationdate, d.expirydate,
          d.status, d.registrar
        FROM tbldomains d
        WHERE d.status = 'Active'
        LIMIT 100
      `);

      logger.info(`Found ${domains.length} WHMCS domains`);

      for (const domain of domains) {
        try {
          // Get customer
          const [clientEmail] = await this.connection.query(
            'SELECT email FROM tblclients WHERE id = ?',
            [domain.userid]
          );

          if (!clientEmail.length) continue;

          const customerResult = await pool.query(
            `SELECT c.id FROM customers c 
             JOIN users u ON c.user_id = u.id 
             WHERE u.email = $1 AND c.tenant_id = $2`,
            [clientEmail[0].email, tenantId]
          );

          if (!customerResult.rows.length) continue;

          const customerId = customerResult.rows[0].id;

          await pool.query(`
            INSERT INTO domains (
              tenant_id, customer_id, domain_name, registrar,
              registration_date, expiry_date, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT DO NOTHING
          `, [
            tenantId,
            customerId,
            domain.domain,
            domain.registrar || 'namesilo',
            domain.registrationdate,
            domain.expirydate,
            domain.status === 'Active' ? 'active' : 'expired'
          ]);

          this.stats.domains++;
        } catch (error) {
          logger.warn(`Skipped domain ${domain.domain}: ${error.message}`);
        }
      }

      logger.info(`✅ Imported ${this.stats.domains} domains`);
    } catch (error) {
      logger.error('Domain import failed:', error);
      throw error;
    }
  }

  mapProductType(whmcsType) {
    const map = {
      'hostingaccount': 'hosting',
      'reselleraccount': 'reseller',
      'server': 'vps',
      'other': 'addon'
    };
    return map[whmcsType] || 'hosting';
  }

  mapServerType(whmcsType) {
    const map = {
      'cpanel': 'cpanel',
      'directadmin': 'directadmin',
      'plesk': 'plesk',
      'cyberpanel': 'cyberpanel'
    };
    return map[whmcsType] || 'cpanel';
  }
}

export default WHMCSImporter;
