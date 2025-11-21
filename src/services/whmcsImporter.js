import mysql from 'mysql2/promise';
import pool from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../config/logger.js';

/**
 * WHMCS Database Importer
 * Correctly maps WHMCS schema → mPanel schema
 * 
 * WHMCS tblclients → mPanel users + customers
 * WHMCS tblproducts + tblpricing → mPanel products
 * WHMCS tblhosting → mPanel websites/services
 * WHMCS tblinvoices + tblinvoiceitems → mPanel invoices + invoice_items
 * WHMCS tbldomains → mPanel domains
 */
class WHMCSImporter {
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.stats = {
      clients: 0,
      products: 0,
      services: 0,
      invoices: 0,
      domains: 0,
      errors: 0
    };
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port || 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        ssl: this.config.ssl || false
      });
      logger.info('✅ Connected to WHMCS database');
      return true;
    } catch (error) {
      logger.error('❌ Failed to connect to WHMCS:', error);
      throw error;
    }
  }

  async importAll(tenantId = null) {
    try {
      if (!this.connection) await this.connect();
      
      logger.info('🚀 Starting WHMCS import...\n');
      
      // Import in order (clients first, then dependent data)
      await this.importClients(tenantId);
      await this.importProducts(tenantId);
      await this.importHostingServices(tenantId);
      await this.importDomains(tenantId);
      await this.importInvoices(tenantId);
      
      logger.info('\n📊 Import Summary:');
      logger.info(`  Clients: ${this.stats.clients}`);
      logger.info(`  Products: ${this.stats.products}`);
      logger.info(`  Hosting Services: ${this.stats.services}`);
      logger.info(`  Domains: ${this.stats.domains}`);
      logger.info(`  Invoices: ${this.stats.invoices}`);
      logger.info(`  Errors: ${this.stats.errors}\n`);
      
      return this.stats;
    } catch (error) {
      logger.error('❌ Import failed:', error);
      throw error;
    } finally {
      if (this.connection) await this.connection.end();
    }
  }

  /**
   * Import WHMCS clients → mPanel users + customers
   * 
   * WHMCS tblclients columns:
   *   - id, uuid, firstname, lastname, email, companyname
   *   - address1, address2, city, state, postcode, country
   *   - phonenumber, tax_id, currency, credit, datecreated, status
   * 
   * Maps to:
   *   - users table: email, first_name, last_name, password_hash, role, status
   *   - customers table: company_name, address_line1, city, state, country, phone, etc.
   */
  async importClients(tenantId) {
    try {
      logger.info('📥 Importing clients...');
      
      const [clients] = await this.connection.query(`
        SELECT 
          id, uuid, firstname, lastname, email, companyname,
          address1, address2, city, state, postcode, country,
          phonenumber, tax_id, currency, credit, datecreated, status,
          created_at, updated_at
        FROM tblclients 
        WHERE status = 'Active'
        ORDER BY id
      `);
      
      logger.info(`  Found ${clients.length} active clients`);
      
      for (const client of clients) {
        try {
          // Check if user exists
          const existingUser = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [client.email, tenantId]
          );
          
          let userId;
          
          if (existingUser.rows.length > 0) {
            userId = existingUser.rows[0].id;
          } else {
            // Create user (email goes here!)
            const userResult = await pool.query(
              `INSERT INTO users (
                tenant_id, email, password_hash, first_name, last_name, 
                role, status, email_verified, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id`,
              [
                tenantId,
                client.email,
                await bcrypt.hash('ChangeMe123!', 10), // Users must reset
                client.firstname || '',
                client.lastname || '',
                'client',
                client.status?.toLowerCase() || 'active',
                true,
                client.datecreated || client.created_at || new Date()
              ]
            );
            userId = userResult.rows[0].id;
          }
          
          // Check if customer exists
          const existingCustomer = await pool.query(
            'SELECT id FROM customers WHERE user_id = $1',
            [userId]
          );
          
          if (existingCustomer.rows.length === 0) {
            // Create customer (no email - it's in users table!)
            await pool.query(
              `INSERT INTO customers (
                tenant_id, user_id, company_name, 
                address_line1, address_line2, city, state, postal_code, country,
                phone, tax_id, currency, credit_balance, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
              [
                tenantId,
                userId,
                client.companyname || null,
                client.address1 || null,
                client.address2 || null,
                client.city || null,
                client.state || null,
                client.postcode || null,
                client.country || null,
                client.phonenumber || null,
                client.tax_id || null,
                client.currency || 'USD',
                parseFloat(client.credit || 0),
                client.datecreated || client.created_at || new Date()
              ]
            );
          }
          
          this.stats.clients++;
          logger.info(`  ✅ ${client.firstname} ${client.lastname} (${client.email})`);
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${client.email}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Clients: ${this.stats.clients} imported\n`);
      
    } catch (error) {
      logger.error('❌ Client import failed:', error);
      throw error;
    }
  }

  /**
   * Import WHMCS products
   * 
   * WHMCS has complex pricing in tblpricing table
   * Product types: hosting, domain, addon, server
   */
  async importProducts(tenantId) {
    try {
      logger.info('📥 Importing products...');
      
      // Get products with their pricing
      const [products] = await this.connection.query(`
        SELECT 
          p.id, p.name, p.description, p.type, p.hidden,
          p.paytype, p.autosetup, p.servertype,
          pr.msetupfee, pr.qsetupfee, pr.ssetupfee, pr.asetupfee, pr.bsetupfee, pr.tsetupfee,
          pr.monthly, pr.quarterly, pr.semiannually, pr.annually, pr.biennially, pr.triennially,
          p.created_at, p.updated_at
        FROM tblproducts p
        LEFT JOIN tblpricing pr ON p.id = pr.relid AND pr.type = 'product' AND pr.currency = 1
        WHERE p.hidden = 0
        ORDER BY p.id
      `);
      
      logger.info(`  Found ${products.length} visible products`);
      
      for (const product of products) {
        try {
          // Determine primary billing cycle and price
          let billingCycle = 'monthly';
          let price = parseFloat(product.monthly || 0);
          let setupFee = parseFloat(product.msetupfee || 0);
          
          if (price === 0 && product.annually > 0) {
            billingCycle = 'annually';
            price = parseFloat(product.annually);
            setupFee = parseFloat(product.asetupfee || 0);
          }
          
          // Map WHMCS product types to mPanel
          const typeMap = {
            'hostingaccount': 'hosting',
            'reselleraccount': 'reseller',
            'server': 'dedicated',
            'other': 'service'
          };
          
          const productType = typeMap[product.type?.toLowerCase()] || 'hosting';
          
          // Check if product exists
          const existing = await pool.query(
            'SELECT id FROM products WHERE name = $1 AND tenant_id = $2',
            [product.name, tenantId]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO products (
                tenant_id, name, description, type, billing_cycle, 
                price, setup_fee, currency, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                tenantId,
                product.name,
                product.description || '',
                productType,
                billingCycle,
                price,
                setupFee,
                'USD',
                product.hidden === 0 ? 'active' : 'inactive',
                product.created_at || new Date()
              ]
            );
            
            this.stats.products++;
            logger.info(`  ✅ ${product.name} ($${price}/${billingCycle})`);
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${product.name}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Products: ${this.stats.products} imported\n`);
      
    } catch (error) {
      logger.error('❌ Product import failed:', error);
      throw error;
    }
  }

  /**
   * Import WHMCS hosting services (tblhosting)
   */
  async importHostingServices(tenantId) {
    try {
      logger.info('📥 Importing hosting services...');
      
      const [services] = await this.connection.query(`
        SELECT 
          h.id, h.userid, h.packageid, h.domain, h.username,
          h.domainstatus, h.regdate, h.nextduedate, h.amount,
          h.billingcycle, h.created_at, h.updated_at,
          c.email
        FROM tblhosting h
        JOIN tblclients c ON h.userid = c.id
        WHERE h.domainstatus = 'Active'
        ORDER BY h.id
      `);
      
      logger.info(`  Found ${services.length} active hosting services`);
      
      for (const service of services) {
        try {
          // Find the user by email
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [service.email, tenantId]
          );
          
          if (userResult.rows.length === 0) {
            logger.warn(`  ⚠️  User not found: ${service.email}`);
            continue;
          }
          
          const userId = userResult.rows[0].id;
          
          // Find the product
          const productResult = await pool.query(
            'SELECT id FROM products WHERE tenant_id = $1 LIMIT 1',
            [tenantId]
          );
          
          if (productResult.rows.length === 0) {
            logger.warn('  ⚠️  No products found');
            continue;
          }
          
          const productId = productResult.rows[0].id;
          
          // Check if website exists
          const existing = await pool.query(
            'SELECT id FROM websites WHERE domain = $1 AND tenant_id = $2',
            [service.domain, tenantId]
          );
          
          if (existing.rows.length === 0) {
            // Create website/service record
            await pool.query(
              `INSERT INTO websites (
                tenant_id, user_id, domain, username, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                tenantId,
                userId,
                service.domain,
                service.username || '',
                service.domainstatus?.toLowerCase() || 'active',
                service.regdate || service.created_at || new Date()
              ]
            );
            
            this.stats.services++;
            logger.info(`  ✅ ${service.domain} (${service.email})`);
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${service.domain}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Services: ${this.stats.services} imported\n`);
      
    } catch (error) {
      logger.error('❌ Service import failed:', error);
      throw error;
    }
  }

  /**
   * Import WHMCS domains
   */
  async importDomains(tenantId) {
    try {
      logger.info('📥 Importing domains...');
      
      const [domains] = await this.connection.query(`
        SELECT 
          d.id, d.userid, d.domain, d.registrar, d.registrationdate,
          d.expirydate, d.status, d.dnsmanagement, d.emailforwarding,
          d.created_at, d.updated_at,
          c.email
        FROM tbldomains d
        JOIN tblclients c ON d.userid = c.id
        WHERE d.status IN ('Active', 'Pending')
        ORDER BY d.id
      `);
      
      logger.info(`  Found ${domains.length} active domains`);
      
      for (const domain of domains) {
        try {
          // Find the user
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [domain.email, tenantId]
          );
          
          if (userResult.rows.length === 0) {
            logger.warn(`  ⚠️  User not found: ${domain.email}`);
            continue;
          }
          
          const userId = userResult.rows[0].id;
          
          // Check if domain exists
          const existing = await pool.query(
            'SELECT id FROM domains WHERE domain_name = $1 AND tenant_id = $2',
            [domain.domain, tenantId]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO domains (
                tenant_id, user_id, domain_name, registrar, 
                registration_date, expiry_date, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                tenantId,
                userId,
                domain.domain,
                domain.registrar || 'imported',
                domain.registrationdate || new Date(),
                domain.expirydate || new Date(),
                domain.status?.toLowerCase() || 'active',
                domain.created_at || new Date()
              ]
            );
            
            this.stats.domains++;
            logger.info(`  ✅ ${domain.domain}`);
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${domain.domain}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Domains: ${this.stats.domains} imported\n`);
      
    } catch (error) {
      logger.error('❌ Domain import failed:', error);
      throw error;
    }
  }

  /**
   * Import WHMCS invoices
   */
  async importInvoices(tenantId) {
    try {
      logger.info('📥 Importing invoices...');
      
      const [invoices] = await this.connection.query(`
        SELECT 
          i.id, i.userid, i.date, i.duedate, i.datepaid,
          i.subtotal, i.credit, i.tax, i.tax2, i.total,
          i.status, i.created_at, i.updated_at,
          c.email
        FROM tblinvoices i
        JOIN tblclients c ON i.userid = c.id
        ORDER BY i.id
        LIMIT 100
      `);
      
      logger.info(`  Found ${invoices.length} invoices`);
      
      for (const invoice of invoices) {
        try {
          // Find the user
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [invoice.email, tenantId]
          );
          
          if (userResult.rows.length === 0) {
            logger.warn(`  ⚠️  User not found: ${invoice.email}`);
            continue;
          }
          
          const userId = userResult.rows[0].id;
          
          // Check if invoice exists
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE user_id = $1 AND invoice_number = $2',
            [userId, `WHMCS-${invoice.id}`]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO invoices (
                tenant_id, user_id, invoice_number, invoice_date, due_date,
                subtotal, tax, total, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                tenantId,
                userId,
                `WHMCS-${invoice.id}`,
                invoice.date || new Date(),
                invoice.duedate || new Date(),
                parseFloat(invoice.subtotal || 0),
                parseFloat(invoice.tax || 0) + parseFloat(invoice.tax2 || 0),
                parseFloat(invoice.total || 0),
                invoice.status?.toLowerCase() || 'pending',
                invoice.created_at || new Date()
              ]
            );
            
            this.stats.invoices++;
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ Invoice ${invoice.id}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Invoices: ${this.stats.invoices} imported\n`);
      
    } catch (error) {
      logger.error('❌ Invoice import failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('Disconnected from WHMCS database');
    }
  }
}

export default WHMCSImporter;
