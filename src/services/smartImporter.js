import mysql from 'mysql2/promise';
import pool from '../db/index.js';
import bcrypt from 'bcryptjs';
import logger from '../config/logger.js';

/**
 * Smart WHMCS Importer
 * Automatically creates missing tables and columns during import
 * Maps WHMCS schema → mPanel schema with improvements
 */
class SmartImporter {
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.stats = {
      clients: 0,
      products: 0,
      services: 0,
      invoices: 0,
      domains: 0,
      servers: 0,
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
      logger.error('❌ Failed to connect:', error);
      throw error;
    }
  }

  /**
   * Ensure a table exists, create if missing
   */
  async ensureTable(tableName, schema) {
    try {
      const checkQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `;
      
      const result = await pool.query(checkQuery, [tableName]);
      const exists = result.rows[0].exists;
      
      if (!exists) {
        logger.info(`📝 Creating table: ${tableName}`);
        await pool.query(schema);
        logger.info(`✅ Table created: ${tableName}`);
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Error ensuring table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * Ensure required tables exist
   */
  async ensureSchema(tenantId) {
    logger.info('🔍 Checking database schema...\n');
    
    // Ensure hosting_services table (better than just websites)
    await this.ensureTable('hosting_services', `
      CREATE TABLE hosting_services (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id),
        user_id UUID REFERENCES users(id),
        product_id UUID REFERENCES products(id),
        domain VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        server_id UUID REFERENCES servers(id),
        package_name VARCHAR(255),
        disk_limit BIGINT,
        bandwidth_limit BIGINT,
        email_accounts_limit INT,
        database_limit INT,
        subdomain_limit INT,
        ftp_accounts_limit INT,
        status VARCHAR(50) DEFAULT 'active',
        billing_cycle VARCHAR(50),
        next_due_date TIMESTAMP,
        registration_date TIMESTAMP,
        termination_date TIMESTAMP,
        notes TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_hosting_services_tenant ON hosting_services(tenant_id);
      CREATE INDEX idx_hosting_services_user ON hosting_services(user_id);
      CREATE INDEX idx_hosting_services_domain ON hosting_services(domain);
      CREATE INDEX idx_hosting_services_status ON hosting_services(status);
    `);

    // Ensure invoice_items table
    await this.ensureTable('invoice_items', `
      CREATE TABLE invoice_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id),
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
    `);

    // Ensure support_tickets table (WHMCS has this!)
    await this.ensureTable('support_tickets', `
      CREATE TABLE support_tickets (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id),
        user_id UUID REFERENCES users(id),
        ticket_number VARCHAR(50) UNIQUE NOT NULL,
        department VARCHAR(100),
        subject VARCHAR(500) NOT NULL,
        status VARCHAR(50) DEFAULT 'open',
        priority VARCHAR(50) DEFAULT 'medium',
        last_reply TIMESTAMP,
        assigned_to UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_tickets_tenant ON support_tickets(tenant_id);
      CREATE INDEX idx_tickets_user ON support_tickets(user_id);
      CREATE INDEX idx_tickets_status ON support_tickets(status);
    `);

    // Ensure ticket_replies table
    await this.ensureTable('ticket_replies', `
      CREATE TABLE ticket_replies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        message TEXT NOT NULL,
        is_staff_reply BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_ticket_replies_ticket ON ticket_replies(ticket_id);
    `);

    // Ensure transactions table (payment history)
    await this.ensureTable('transactions', `
      CREATE TABLE transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID REFERENCES tenants(id),
        user_id UUID REFERENCES users(id),
        invoice_id UUID REFERENCES invoices(id),
        transaction_id VARCHAR(255) UNIQUE,
        gateway VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        fee DECIMAL(10,2) DEFAULT 0,
        currency VARCHAR(3) DEFAULT 'USD',
        status VARCHAR(50) DEFAULT 'completed',
        payment_method VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
      CREATE INDEX idx_transactions_user ON transactions(user_id);
      CREATE INDEX idx_transactions_invoice ON transactions(invoice_id);
    `);

    logger.info('✅ Schema check complete\n');
  }

  async importAll(tenantId = null) {
    try {
      if (!this.connection) await this.connect();
      
      // Ensure schema exists first
      await this.ensureSchema(tenantId);
      
      logger.info('🚀 Starting Smart Import...\n');
      
      // Import in dependency order
      await this.importClients(tenantId);
      await this.importProducts(tenantId);
      await this.importServers(tenantId);
      await this.importHostingServices(tenantId);
      await this.importDomains(tenantId);
      await this.importInvoices(tenantId);
      await this.importTransactions(tenantId);
      await this.importTickets(tenantId);
      
      logger.info('\n📊 Import Summary:');
      logger.info(`  ✅ Clients: ${this.stats.clients}`);
      logger.info(`  ✅ Products: ${this.stats.products}`);
      logger.info(`  ✅ Servers: ${this.stats.servers}`);
      logger.info(`  ✅ Hosting Services: ${this.stats.services}`);
      logger.info(`  ✅ Domains: ${this.stats.domains}`);
      logger.info(`  ✅ Invoices: ${this.stats.invoices}`);
      logger.info(`  ❌ Errors: ${this.stats.errors}\n`);
      
      return this.stats;
    } catch (error) {
      logger.error('❌ Import failed:', error);
      throw error;
    } finally {
      if (this.connection) await this.connection.end();
    }
  }

  /**
   * Import clients from WHMCS tblclients
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
        ORDER BY id
      `);
      
      logger.info(`  Found ${clients.length} total clients`);
      
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
            // Create user account
            const userResult = await pool.query(
              `INSERT INTO users (
                tenant_id, email, password_hash, first_name, last_name, 
                role, status, email_verified, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              RETURNING id`,
              [
                tenantId,
                client.email,
                await bcrypt.hash('ChangeMe123!', 10),
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
            // Create customer profile
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
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${client.email}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Imported ${this.stats.clients} clients\n`);
      
    } catch (error) {
      logger.error('❌ Client import failed:', error);
      throw error;
    }
  }

  /**
   * Import products with pricing from tblpricing
   */
  async importProducts(tenantId) {
    try {
      logger.info('📥 Importing products...');
      
      const [products] = await this.connection.query(`
        SELECT 
          p.id, p.name, p.description, p.type, p.hidden,
          p.paytype, p.autosetup, p.servertype,
          pr.msetupfee, pr.monthly, pr.quarterly, 
          pr.semiannually, pr.annually, pr.biennially, pr.triennially,
          p.created_at, p.updated_at
        FROM tblproducts p
        LEFT JOIN tblpricing pr ON p.id = pr.relid AND pr.type = 'product' AND pr.currency = 1
        ORDER BY p.id
      `);
      
      logger.info(`  Found ${products.length} products`);
      
      for (const product of products) {
        try {
          // Determine pricing
          let billingCycle = 'monthly';
          let price = parseFloat(product.monthly || 0);
          let setupFee = parseFloat(product.msetupfee || 0);
          
          if (price === 0 && product.annually > 0) {
            billingCycle = 'annually';
            price = parseFloat(product.annually);
          }
          
          // Check if exists
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
                'hosting',
                billingCycle,
                price,
                setupFee,
                'USD',
                product.hidden === 0 ? 'active' : 'inactive',
                product.created_at || new Date()
              ]
            );
            
            this.stats.products++;
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${product.name}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Imported ${this.stats.products} products\n`);
      
    } catch (error) {
      logger.error('❌ Product import failed:', error);
      throw error;
    }
  }

  /**
   * Import servers from tblservers
   */
  async importServers(tenantId) {
    try {
      logger.info('📥 Importing servers...');
      
      const [servers] = await this.connection.query(`
        SELECT 
          id, name, ipaddress, hostname, type, 
          active, maxaccounts, nameserver1, nameserver2
        FROM tblservers
        WHERE active = 1
      `);
      
      logger.info(`  Found ${servers.length} active servers`);
      
      for (const server of servers) {
        try {
          const existing = await pool.query(
            'SELECT id FROM servers WHERE hostname = $1 AND tenant_id = $2',
            [server.hostname, tenantId]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO servers (
                tenant_id, name, hostname, ip_address, type, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                tenantId,
                server.name,
                server.hostname,
                server.ipaddress,
                server.type || 'cpanel',
                'active',
                server.created_at || new Date()
              ]
            );
            
            this.stats.servers++;
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${server.name}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Imported ${this.stats.servers} servers\n`);
      
    } catch (error) {
      logger.error('❌ Server import failed:', error);
    }
  }

  /**
   * Import hosting services
   */
  async importHostingServices(tenantId) {
    try {
      logger.info('📥 Importing hosting services...');
      
      const [services] = await this.connection.query(`
        SELECT 
          h.id, h.userid, h.packageid, h.domain, h.username,
          h.domainstatus, h.regdate, h.nextduedate, h.amount,
          h.billingcycle, h.created_at,
          c.email, p.name as package_name
        FROM tblhosting h
        JOIN tblclients c ON h.userid = c.id
        LEFT JOIN tblproducts p ON h.packageid = p.id
        ORDER BY h.id
      `);
      
      logger.info(`  Found ${services.length} hosting services`);
      
      for (const service of services) {
        try {
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [service.email, tenantId]
          );
          
          if (userResult.rows.length === 0) continue;
          
          const userId = userResult.rows[0].id;
          
          const existing = await pool.query(
            'SELECT id FROM websites WHERE domain = $1 AND tenant_id = $2',
            [service.domain, tenantId]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO websites (
                tenant_id, user_id, domain, username, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, NOW())`,
              [
                tenantId,
                userId,
                service.domain,
                service.username || '',
                service.domainstatus?.toLowerCase() || 'active'
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
      
      logger.info(`✅ Imported ${this.stats.services} hosting services\n`);
      
    } catch (error) {
      logger.error('❌ Service import failed:', error);
    }
  }

  /**
   * Import domains
   */
  async importDomains(tenantId) {
    try {
      logger.info('📥 Importing domains...');
      
      const [domains] = await this.connection.query(`
        SELECT 
          d.id, d.userid, d.domain, d.registrar, d.registrationdate,
          d.expirydate, d.status, d.created_at,
          c.email
        FROM tbldomains d
        JOIN tblclients c ON d.userid = c.id
        ORDER BY d.id
      `);
      
      logger.info(`  Found ${domains.length} domains`);
      
      for (const domain of domains) {
        try {
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [domain.email, tenantId]
          );
          
          if (userResult.rows.length === 0) continue;
          
          const userId = userResult.rows[0].id;
          
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
          }
          
        } catch (error) {
          this.stats.errors++;
          logger.error(`  ❌ ${domain.domain}: ${error.message}`);
        }
      }
      
      logger.info(`✅ Imported ${this.stats.domains} domains\n`);
      
    } catch (error) {
      logger.error('❌ Domain import failed:', error);
    }
  }

  /**
   * Import invoices
   */
  async importInvoices(tenantId) {
    try {
      logger.info('📥 Importing invoices...');
      
      const [invoices] = await this.connection.query(`
        SELECT 
          i.id, i.userid, i.date, i.duedate, i.datepaid,
          i.subtotal, i.tax, i.tax2, i.total, i.status,
          i.created_at, c.email
        FROM tblinvoices i
        JOIN tblclients c ON i.userid = c.id
        ORDER BY i.id
      `);
      
      logger.info(`  Found ${invoices.length} invoices`);
      
      for (const invoice of invoices) {
        try {
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [invoice.email, tenantId]
          );
          
          if (userResult.rows.length === 0) continue;
          
          const userId = userResult.rows[0].id;
          
          const existing = await pool.query(
            'SELECT id FROM invoices WHERE invoice_number = $1',
            [`WHMCS-${invoice.id}`]
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
      
      logger.info(`✅ Imported ${this.stats.invoices} invoices\n`);
      
    } catch (error) {
      logger.error('❌ Invoice import failed:', error);
    }
  }

  /**
   * Import payment transactions
   */
  async importTransactions(tenantId) {
    try {
      logger.info('📥 Importing transactions...');
      
      const [transactions] = await this.connection.query(`
        SELECT 
          t.id, t.userid, t.invoiceid, t.transid, t.gateway,
          t.date, t.amountin, t.fees, t.created_at,
          c.email
        FROM tblaccounts t
        JOIN tblclients c ON t.userid = c.id
        WHERE t.amountin > 0
        ORDER BY t.id
        LIMIT 1000
      `);
      
      logger.info(`  Found ${transactions.length} transactions`);
      
      let imported = 0;
      
      for (const trans of transactions) {
        try {
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [trans.email, tenantId]
          );
          
          if (userResult.rows.length === 0) continue;
          
          await pool.query(
            `INSERT INTO transactions (
              tenant_id, user_id, transaction_id, gateway, amount, fee, status, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (transaction_id) DO NOTHING`,
            [
              tenantId,
              userResult.rows[0].id,
              `WHMCS-${trans.id}`,
              trans.gateway || 'imported',
              parseFloat(trans.amountin || 0),
              parseFloat(trans.fees || 0),
              'completed',
              trans.date || trans.created_at || new Date()
            ]
          );
          
          imported++;
          
        } catch (error) {
          // Ignore duplicates
        }
      }
      
      logger.info(`✅ Imported ${imported} transactions\n`);
      
    } catch (error) {
      logger.error('❌ Transaction import failed (non-critical):', error.message);
    }
  }

  /**
   * Import support tickets
   */
  async importTickets(tenantId) {
    try {
      logger.info('📥 Importing support tickets...');
      
      const [tickets] = await this.connection.query(`
        SELECT 
          t.id, t.userid, t.title, t.status, t.urgency,
          t.date, t.lastreply, t.created_at,
          c.email
        FROM tbltickets t
        JOIN tblclients c ON t.userid = c.id
        ORDER BY t.id
        LIMIT 500
      `);
      
      logger.info(`  Found ${tickets.length} tickets`);
      
      let imported = 0;
      
      for (const ticket of tickets) {
        try {
          const userResult = await pool.query(
            'SELECT id FROM users WHERE email = $1 AND tenant_id = $2',
            [ticket.email, tenantId]
          );
          
          if (userResult.rows.length === 0) continue;
          
          await pool.query(
            `INSERT INTO support_tickets (
              tenant_id, user_id, ticket_number, subject, status, priority, last_reply, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              tenantId,
              userResult.rows[0].id,
              `WHMCS-${ticket.id}`,
              ticket.title || 'Imported Ticket',
              ticket.status?.toLowerCase() || 'closed',
              ticket.urgency?.toLowerCase() || 'medium',
              ticket.lastreply,
              ticket.date || ticket.created_at || new Date()
            ]
          );
          
          imported++;
          
        } catch (error) {
          // Ignore errors
        }
      }
      
      logger.info(`✅ Imported ${imported} support tickets\n`);
      
    } catch (error) {
      logger.error('❌ Ticket import failed (non-critical):', error.message);
    }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      logger.info('Disconnected from WHMCS');
    }
  }
}

export default SmartImporter;
