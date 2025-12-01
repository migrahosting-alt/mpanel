import axios from 'axios';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import logger from '../../config/logger.js';

export interface ProvisionDnsZoneParams {
  domain: string;
  domainId: string;
  tenantId: string;
}

export class DnsService {
  private pdnsApiUrl: string;
  private pdnsApiKey: string;

  constructor() {
    this.pdnsApiUrl = env.POWERDNS_API_URL;
    this.pdnsApiKey = env.POWERDNS_API_KEY || '';
  }

  /**
   * Provision DNS zone in PowerDNS
   */
  async provisionDnsZone(params: ProvisionDnsZoneParams): Promise<void> {
    const { domain, domainId, tenantId } = params;

    logger.info('Provisioning DNS zone', { domain, domainId });

    try {
      // Get web server IP from environment
      const webServerIp = env.SRV1_WEB_IP || '10.1.10.10';
      
      // Create zone in PowerDNS
      const zoneData = {
        name: `${domain}.`,
        kind: 'Native',
        nameservers: ['ns1.migrahosting.com.', 'ns2.migrahosting.com.'],
        rrsets: [
          {
            name: `${domain}.`,
            type: 'A',
            ttl: 3600,
            records: [
              {
                content: webServerIp,
                disabled: false,
              },
            ],
          },
          {
            name: `www.${domain}.`,
            type: 'A',
            ttl: 3600,
            records: [
              {
                content: webServerIp,
                disabled: false,
              },
            ],
          },
        ],
      };

      const response = await axios.post(
        `${this.pdnsApiUrl}/servers/localhost/zones`,
        zoneData,
        {
          headers: {
            'X-API-Key': this.pdnsApiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      logger.info('PowerDNS zone created', {
        domain,
        pdnsResponse: response.status,
      });

      // Create DNS zone record in mPanel database
      const dnsZone = await prisma.dnsZone.create({
        data: {
          tenantId,
          domainId,
          isSynced: true,
          lastSyncAt: new Date(),
        },
      });

      // Create DNS records in mPanel database
      await prisma.dnsRecord.createMany({
        data: [
          {
            zoneId: dnsZone.id,
            name: domain,
            type: 'A',
            content: webServerIp,
            ttl: 3600,
          },
          {
            zoneId: dnsZone.id,
            name: `www.${domain}`,
            type: 'A',
            content: webServerIp,
            ttl: 3600,
          },
        ],
      });

      logger.info('DNS zone provisioned successfully', {
        domain,
        zoneId: dnsZone.id,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('PowerDNS API error', {
          domain,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
      }

      throw new Error(`Failed to provision DNS zone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get DNS zone for domain
   */
  async getDnsZone(domainId: string): Promise<any> {
    return prisma.dnsZone.findFirst({
      where: { domainId },
      include: {
        records: true,
      },
    });
  }
}

export default new DnsService();
