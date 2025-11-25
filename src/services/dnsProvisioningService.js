/**
 * DNS Provisioning Service - PowerDNS Integration
 * Automatically creates DNS zones with all required records
 */

import axios from 'axios';
import logger from '../config/logger.js';
import pool from '../db/index.js';

const POWERDNS_API_URL = process.env.POWERDNS_API_URL || 'http://10.1.10.102:8081/api/v1';
const POWERDNS_API_KEY = process.env.POWERDNS_API_KEY || 'pdns-api-key';
const POWERDNS_SERVER_ID = process.env.POWERDNS_SERVER_ID || 'localhost';

class DNSProvisioningService {
  /**
   * Create complete DNS zone for a domain
   */
  async createDNSZone({ domain, serverIp, tenantId }) {
    try {
      logger.info(`Creating DNS zone for ${domain}`);

      const ip = serverIp || process.env.DEFAULT_SERVER_IP || '73.139.18.218';
      const mailServer = process.env.MAIL_SERVER || 'mail.migrahosting.com';
      const ns1 = process.env.NS1 || 'ns1.migrahosting.com';
      const ns2 = process.env.NS2 || 'ns2.migrahosting.com';

      // Create zone in database first
      const zoneResult = await pool.query(
        `INSERT INTO dns_zones (tenant_id, domain_name, type, status)
         VALUES ($1, $2, 'master', 'active')
         ON CONFLICT (tenant_id, domain_name) DO UPDATE
         SET status = 'active', updated_at = NOW()
         RETURNING id`,
        [tenantId, domain]
      );

      const zoneId = zoneResult.rows[0].id;

      // DNS Records to create
      const records = [
        // A record - Main domain
        { name: domain, type: 'A', content: ip, ttl: 3600 },
        
        // A record - WWW subdomain
        { name: `www.${domain}`, type: 'A', content: ip, ttl: 3600 },
        
        // MX record - Mail server
        { name: domain, type: 'MX', content: `10 ${mailServer}.`, ttl: 3600 },
        
        // TXT record - SPF
        { name: domain, type: 'TXT', content: `"v=spf1 include:${mailServer} ~all"`, ttl: 3600 },
        
        // TXT record - DMARC
        { name: `_dmarc.${domain}`, type: 'TXT', content: '"v=DMARC1; p=quarantine; rua=mailto:postmaster@migrahosting.com"', ttl: 3600 },
        
        // CNAME - Mail (points to mail server)
        { name: `mail.${domain}`, type: 'CNAME', content: `${mailServer}.`, ttl: 3600 },
        
        // CNAME - Webmail
        { name: `webmail.${domain}`, type: 'CNAME', content: `${mailServer}.`, ttl: 3600 },
        
        // CNAME - FTP
        { name: `ftp.${domain}`, type: 'CNAME', content: `${domain}.`, ttl: 3600 },
        
        // NS records
        { name: domain, type: 'NS', content: `${ns1}.`, ttl: 3600 },
        { name: domain, type: 'NS', content: `${ns2}.`, ttl: 3600 }
      ];

      // Insert records into database
      for (const record of records) {
        await pool.query(
          `INSERT INTO dns_records (zone_id, tenant_id, name, type, content, ttl, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (zone_id, name, type) DO UPDATE
           SET content = EXCLUDED.content, ttl = EXCLUDED.ttl, updated_at = NOW()`,
          [
            zoneId,
            tenantId,
            record.name,
            record.type,
            record.content,
            record.ttl,
            record.type === 'MX' ? 10 : null
          ]
        );
      }

      // If PowerDNS API is configured, create zone there too
      if (POWERDNS_API_URL && POWERDNS_API_KEY) {
        try {
          await this.createPowerDNSZone(domain, records);
        } catch (error) {
          logger.warn('PowerDNS API creation failed, but database zone created:', error.message);
        }
      }

      logger.info(`DNS zone created successfully for ${domain} with ${records.length} records`);

      return {
        success: true,
        domain,
        zoneId,
        recordsCreated: records.length,
        nameservers: [ns1, ns2]
      };

    } catch (error) {
      logger.error(`DNS zone creation failed for ${domain}:`, error);
      return {
        success: false,
        error: error.message,
        domain
      };
    }
  }

  /**
   * Create zone in PowerDNS via API
   */
  async createPowerDNSZone(domain, records) {
    try {
      // Convert records to PowerDNS format
      const rrsets = records.map(record => ({
        name: record.name.endsWith('.') ? record.name : `${record.name}.`,
        type: record.type,
        ttl: record.ttl,
        records: [{
          content: record.content,
          disabled: false
        }]
      }));

      const response = await axios.post(
        `${POWERDNS_API_URL}/servers/${POWERDNS_SERVER_ID}/zones`,
        {
          name: `${domain}.`,
          kind: 'Master',
          masters: [],
          nameservers: [
            `${process.env.NS1 || 'ns1.migrahosting.com'}.`,
            `${process.env.NS2 || 'ns2.migrahosting.com'}.`
          ],
          rrsets
        },
        {
          headers: {
            'X-API-Key': POWERDNS_API_KEY
          }
        }
      );

      logger.info(`PowerDNS zone created for ${domain}`);
      return response.data;

    } catch (error) {
      if (error.response?.status === 409) {
        logger.info(`PowerDNS zone already exists for ${domain}`);
        return { exists: true };
      }
      throw error;
    }
  }

  /**
   * Add DKIM record
   */
  async addDKIMRecord({ domain, selector = 'default', publicKey, tenantId }) {
    try {
      const dkimName = `${selector}._domainkey.${domain}`;
      const dkimValue = `"v=DKIM1; k=rsa; p=${publicKey}"`;

      const zoneResult = await pool.query(
        `SELECT id FROM dns_zones WHERE domain_name = $1 AND tenant_id = $2`,
        [domain, tenantId]
      );

      if (zoneResult.rows.length === 0) {
        throw new Error('DNS zone not found');
      }

      await pool.query(
        `INSERT INTO dns_records (zone_id, tenant_id, name, type, content, ttl)
         VALUES ($1, $2, $3, 'TXT', $4, 3600)
         ON CONFLICT (zone_id, name, type) DO UPDATE
         SET content = EXCLUDED.content, updated_at = NOW()`,
        [zoneResult.rows[0].id, tenantId, dkimName, dkimValue]
      );

      logger.info(`DKIM record added for ${domain}`);
      return { success: true };

    } catch (error) {
      logger.error(`DKIM record creation failed:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Add custom DNS record
   */
  async addRecord({ domain, name, type, content, ttl = 3600, priority = null, tenantId }) {
    try {
      const zoneResult = await pool.query(
        `SELECT id FROM dns_zones WHERE domain_name = $1 AND tenant_id = $2`,
        [domain, tenantId]
      );

      if (zoneResult.rows.length === 0) {
        throw new Error('DNS zone not found');
      }

      await pool.query(
        `INSERT INTO dns_records (zone_id, tenant_id, name, type, content, ttl, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (zone_id, name, type) DO UPDATE
         SET content = EXCLUDED.content, ttl = EXCLUDED.ttl, updated_at = NOW()`,
        [zoneResult.rows[0].id, tenantId, name, type, content, ttl, priority]
      );

      logger.info(`DNS record added: ${name} ${type} ${content}`);
      return { success: true };

    } catch (error) {
      logger.error(`DNS record creation failed:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new DNSProvisioningService();
