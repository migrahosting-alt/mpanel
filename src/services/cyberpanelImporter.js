import axios from 'axios';
import mysql from 'mysql2/promise';
import pool from '../db/index.js';
import logger from '../config/logger.js';

/**
 * CyberPanel Importer
 * Imports websites, databases, emails, and DNS from CyberPanel via API and MySQL
 */
class CyberPanelImporter {
  constructor(config) {
    this.config = config;
    this.apiUrl = `https://${config.host}:8090/api`;
    this.adminUser = config.adminUser;
    this.adminPass = config.adminPass;
    this.dbConnection = null;
    this.stats = {
      websites: 0,
      databases: 0,
      emails: 0,
      dnsZones: 0,
      ftpAccounts: 0
    };
  }

  /**
   * Connect to CyberPanel MySQL database
   */
  async connectDB() {
    try {
      this.dbConnection = await mysql.createConnection({
        host: this.config.dbHost || this.config.host,
        port: this.config.dbPort || 3306,
        user: this.config.dbUser,
        password: this.config.dbPassword,
        database: 'cyberpanel'
      });
      logger.info('Connected to CyberPanel database');
      return true;
    } catch (error) {
      logger.error('Failed to connect to CyberPanel database:', error);
      throw error;
    }
  }

  /**
   * Verify CyberPanel API connection
   */
  async verifyLogin() {
    try {
      const response = await axios.post(`${this.apiUrl}/verifyLogin`, {
        adminUser: this.adminUser,
        adminPass: this.adminPass
      }, {
        httpsAgent: new (await import('https')).Agent({ rejectUnauthorized: false })
      });

      if (response.data.verifyLogin === 1) {
        logger.info('CyberPanel API authentication successful');
        return true;
      }
      throw new Error('CyberPanel authentication failed');
    } catch (error) {
      logger.error('CyberPanel API verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Import all data from CyberPanel
   */
  async importAll(tenantId = null) {
    try {
      await this.verifyLogin();
      await this.connectDB();

      logger.info('Starting CyberPanel import...');

      await this.importWebsites(tenantId);
      await this.importDatabases(tenantId);
      await this.importEmails(tenantId);
      await this.importDNSZones(tenantId);
      await this.importFTPAccounts(tenantId);

      await this.disconnectDB();

      logger.info('CyberPanel import completed', this.stats);
      return this.stats;
    } catch (error) {
      logger.error('CyberPanel import failed:', error);
      throw error;
    }
  }

  /**
   * Import websites from CyberPanel
   */
  async importWebsites(tenantId) {
    try {
      // Query CyberPanel database directly
      const [websites] = await this.dbConnection.query(`
        SELECT 
          w.id, w.domain, w.adminEmail as admin_email, w.package_id,
          w.diskUsed as disk_used, w.bandwidth as bandwidth_used,
          w.state as status, w.externalApp as app_type,
          p.name as package_name, p.diskSpace as disk_quota,
          p.bandwidth as bandwidth_quota, p.ftpAccounts as ftp_limit,
          p.dataBases as db_limit, p.emails as email_limit
        FROM websiteFunctions_websites w
        LEFT JOIN websiteFunctions_package p ON w.package_id = p.id
        WHERE w.state = 1
      `);

      logger.info(`Found ${websites.length} CyberPanel websites to import`);

      for (const website of websites) {
        try {
          // Find or create customer
          let customerId = null;
          const existingCustomer = await pool.query(
            'SELECT id FROM customers WHERE email = $1',
            [website.admin_email]
          );

          if (existingCustomer.rows.length > 0) {
            customerId = existingCustomer.rows[0].id;
          } else {
            // Create customer from website admin email
            const newCustomer = await pool.query(`
              INSERT INTO customers (
                tenant_id, email, status, metadata, created_at
              ) VALUES ($1, $2, $3, $4, NOW())
              RETURNING id
            `, [
              tenantId,
              website.admin_email,
              'active',
              JSON.stringify({
                imported_from: 'cyberpanel',
                package: website.package_name
              })
            ]);
            customerId = newCustomer.rows[0].id;
          }

          // Import website
          await pool.query(`
            INSERT INTO websites (
              tenant_id, customer_id, domain_name, status,
              disk_used_mb, disk_quota_mb, bandwidth_used_mb, bandwidth_quota_mb,
              app_type, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (domain_name) DO UPDATE SET
              disk_used_mb = EXCLUDED.disk_used_mb,
              bandwidth_used_mb = EXCLUDED.bandwidth_used_mb,
              updated_at = NOW()
          `, [
            tenantId,
            customerId,
            website.domain,
            website.status === 1 ? 'active' : 'suspended',
            Math.round(website.disk_used || 0),
            Math.round(website.disk_quota || 5000),
            Math.round(website.bandwidth_used || 0),
            Math.round(website.bandwidth_quota || 50000),
            website.app_type || 'php',
            JSON.stringify({
              cyberpanel_id: website.id,
              package_name: website.package_name,
              ftp_limit: website.ftp_limit,
              db_limit: website.db_limit,
              email_limit: website.email_limit,
              imported_from: 'cyberpanel'
            })
          ]);

          this.stats.websites++;
        } catch (error) {
          logger.error(`Failed to import website ${website.domain}:`, error.message);
        }
      }

      logger.info(`Imported ${this.stats.websites} websites`);
    } catch (error) {
      logger.error('Failed to import websites:', error);
      throw error;
    }
  }

  /**
   * Import databases from CyberPanel
   */
  async importDatabases(tenantId) {
    try {
      const [databases] = await this.dbConnection.query(`
        SELECT 
          d.id, d.dbName as database_name, d.dbUser as username,
          w.domain as website_domain
        FROM databases_databases d
        JOIN websiteFunctions_websites w ON d.website_id = w.id
      `);

      logger.info(`Found ${databases.length} CyberPanel databases to import`);

      for (const db of databases) {
        try {
          // Find website
          const website = await pool.query(
            'SELECT id, customer_id FROM websites WHERE domain_name = $1',
            [db.website_domain]
          );

          if (website.rows.length === 0) {
            logger.debug(`Website ${db.website_domain} not found, skipping database`);
            continue;
          }

          await pool.query(`
            INSERT INTO databases (
              tenant_id, customer_id, website_id, database_name, username,
              status, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            ON CONFLICT (database_name) DO NOTHING
          `, [
            tenantId,
            website.rows[0].customer_id,
            website.rows[0].id,
            db.database_name,
            db.username,
            'active',
            JSON.stringify({
              cyberpanel_id: db.id,
              imported_from: 'cyberpanel'
            })
          ]);

          this.stats.databases++;
        } catch (error) {
          logger.error(`Failed to import database ${db.database_name}:`, error.message);
        }
      }

      logger.info(`Imported ${this.stats.databases} databases`);
    } catch (error) {
      logger.error('Failed to import databases:', error);
      throw error;
    }
  }

  /**
   * Import email accounts from CyberPanel
   */
  async importEmails(tenantId) {
    try {
      const [emails] = await this.dbConnection.query(`
        SELECT 
          e.id, e.email, e.emailOwner_id,
          w.domain as website_domain
        FROM e_EMailAccounts e
        JOIN websiteFunctions_websites w ON e.emailOwner_id = w.id
      `);

      logger.info(`Found ${emails.length} CyberPanel email accounts to import`);

      for (const email of emails) {
        try {
          // Find website
          const website = await pool.query(
            'SELECT id, customer_id FROM websites WHERE domain_name = $1',
            [email.website_domain]
          );

          if (website.rows.length === 0) continue;

          await pool.query(`
            INSERT INTO mailboxes (
              tenant_id, customer_id, email_address, quota_mb,
              status, metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (email_address) DO NOTHING
          `, [
            tenantId,
            website.rows[0].customer_id,
            email.email,
            5000, // Default 5GB quota
            'active',
            JSON.stringify({
              cyberpanel_id: email.id,
              website_domain: email.website_domain,
              imported_from: 'cyberpanel'
            })
          ]);

          this.stats.emails++;
        } catch (error) {
          logger.error(`Failed to import email ${email.email}:`, error.message);
        }
      }

      logger.info(`Imported ${this.stats.emails} email accounts`);
    } catch (error) {
      logger.error('Failed to import emails:', error);
      throw error;
    }
  }

  /**
   * Import DNS zones from CyberPanel
   */
  async importDNSZones(tenantId) {
    try {
      const [zones] = await this.dbConnection.query(`
        SELECT 
          z.id, z.name as domain, z.type,
          w.domain as website_domain
        FROM dns_zones z
        LEFT JOIN websiteFunctions_websites w ON z.name = w.domain
      `);

      logger.info(`Found ${zones.length} CyberPanel DNS zones to import`);

      for (const zone of zones) {
        try {
          // Get DNS records for this zone
          const [records] = await this.dbConnection.query(`
            SELECT name, type, content, ttl, prio as priority
            FROM dns_records
            WHERE zone_id = ?
          `, [zone.id]);

          // Find website or use tenant
          let customerId = null;
          if (zone.website_domain) {
            const website = await pool.query(
              'SELECT customer_id FROM websites WHERE domain_name = $1',
              [zone.website_domain]
            );
            if (website.rows.length > 0) {
              customerId = website.rows[0].customer_id;
            }
          }

          // Import DNS zone
          const zoneResult = await pool.query(`
            INSERT INTO dns_zones (
              tenant_id, customer_id, domain, type, status,
              metadata, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (domain) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `, [
            tenantId,
            customerId,
            zone.domain,
            zone.type || 'NATIVE',
            'active',
            JSON.stringify({
              cyberpanel_id: zone.id,
              imported_from: 'cyberpanel'
            })
          ]);

          const dnsZoneId = zoneResult.rows[0].id;

          // Import DNS records
          for (const record of records) {
            try {
              await pool.query(`
                INSERT INTO dns_records (
                  zone_id, name, type, content, ttl, priority, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT DO NOTHING
              `, [
                dnsZoneId,
                record.name,
                record.type,
                record.content,
                record.ttl || 3600,
                record.priority || 0
              ]);
            } catch (err) {
              logger.debug(`Failed to import DNS record: ${err.message}`);
            }
          }

          this.stats.dnsZones++;
        } catch (error) {
          logger.error(`Failed to import DNS zone ${zone.domain}:`, error.message);
        }
      }

      logger.info(`Imported ${this.stats.dnsZones} DNS zones`);
    } catch (error) {
      logger.error('Failed to import DNS zones:', error);
      throw error;
    }
  }

  /**
   * Import FTP accounts from CyberPanel
   */
  async importFTPAccounts(tenantId) {
    try {
      const [ftpAccounts] = await this.dbConnection.query(`
        SELECT 
          f.id, f.user as username, f.path as home_directory,
          w.domain as website_domain
        FROM ftp_FTPAccounts f
        JOIN websiteFunctions_websites w ON f.owner_id = w.id
      `);

      logger.info(`Found ${ftpAccounts.length} CyberPanel FTP accounts`);
      this.stats.ftpAccounts = ftpAccounts.length;

      // Note: mPanel doesn't have an FTP accounts table yet
      // This data is logged for reference
    } catch (error) {
      logger.error('Failed to import FTP accounts:', error);
    }
  }

  /**
   * Disconnect from database
   */
  async disconnectDB() {
    if (this.dbConnection) {
      await this.dbConnection.end();
      logger.info('Disconnected from CyberPanel database');
    }
  }
}

export default CyberPanelImporter;
