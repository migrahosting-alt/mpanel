/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * PowerDNS Client - Abstracts all DNS operations via PowerDNS API.
 * 
 * All configuration comes from environment variables - NO hard-coded values.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { env } from './env.js';
import logger from './logger.js';

// ============================================
// TYPES
// ============================================

export interface DnsRrset {
  name: string;        // Fully qualified domain name with trailing dot
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV' | 'SOA' | 'PTR';
  ttl: number;
  changetype?: 'REPLACE' | 'DELETE';
  records: {
    content: string;
    disabled: boolean;
  }[];
  comments?: {
    content: string;
    account: string;
    modified_at?: number;
  }[];
}

export interface DnsZoneResponse {
  id: string;
  name: string;
  kind: 'Native' | 'Master' | 'Slave';
  serial: number;
  notified_serial: number;
  masters: string[];
  dnssec: boolean;
  nsec3param: string;
  nsec3narrow: boolean;
  presigned: boolean;
  soa_edit: string;
  soa_edit_api: string;
  api_rectify: boolean;
  account: string;
  nameservers: string[];
  rrsets?: DnsRrset[];
}

export interface CreateZoneParams {
  name: string;        // Domain name (will be normalized to have trailing dot)
  kind?: 'Native' | 'Master' | 'Slave';
  nameservers?: string[];
  masters?: string[];
  account?: string;
}

// ============================================
// POWERDNS CLIENT CLASS
// ============================================

export class PowerDnsClient {
  private client: AxiosInstance;
  private serverId: string;

  constructor() {
    const apiUrl = env.POWERDNS_API_URL;
    const apiKey = env.POWERDNS_API_KEY;
    this.serverId = env.POWERDNS_SERVER_ID || 'localhost';

    if (!apiUrl) {
      throw new Error('POWERDNS_API_URL environment variable is not set');
    }

    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'X-API-Key': apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        logger.error('PowerDNS API error', {
          status: error.response?.status,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });
        throw error;
      }
    );
  }

  /**
   * Normalize domain name to have trailing dot for PowerDNS.
   */
  private normalizeDomain(domain: string): string {
    return domain.endsWith('.') ? domain : `${domain}.`;
  }

  /**
   * Strip trailing dot from domain name.
   */
  private stripTrailingDot(domain: string): string {
    return domain.endsWith('.') ? domain.slice(0, -1) : domain;
  }

  // ============================================
  // ZONE OPERATIONS
  // ============================================

  /**
   * Create a new DNS zone.
   */
  async createZone(params: CreateZoneParams): Promise<DnsZoneResponse> {
    const normalizedName = this.normalizeDomain(params.name);
    
    const zoneData = {
      name: normalizedName,
      kind: params.kind || 'Native',
      nameservers: params.nameservers || [
        'ns1.migrahosting.com.',
        'ns2.migrahosting.com.',
      ],
      masters: params.masters || [],
      account: params.account || '',
    };

    logger.info('Creating PowerDNS zone', { zone: normalizedName });

    const response = await this.client.post<DnsZoneResponse>(
      `/servers/${this.serverId}/zones`,
      zoneData
    );

    logger.info('PowerDNS zone created', {
      zone: normalizedName,
      id: response.data.id,
    });

    return response.data;
  }

  /**
   * Get zone details.
   */
  async getZone(domain: string): Promise<DnsZoneResponse | null> {
    const normalizedName = this.normalizeDomain(domain);

    try {
      const response = await this.client.get<DnsZoneResponse>(
        `/servers/${this.serverId}/zones/${normalizedName}`
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if zone exists.
   */
  async zoneExists(domain: string): Promise<boolean> {
    const zone = await this.getZone(domain);
    return zone !== null;
  }

  /**
   * Delete a DNS zone.
   */
  async deleteZone(domain: string): Promise<void> {
    const normalizedName = this.normalizeDomain(domain);

    logger.info('Deleting PowerDNS zone', { zone: normalizedName });

    await this.client.delete(`/servers/${this.serverId}/zones/${normalizedName}`);

    logger.info('PowerDNS zone deleted', { zone: normalizedName });
  }

  // ============================================
  // RECORD OPERATIONS
  // ============================================

  /**
   * Add or update DNS records in a zone.
   * Uses PATCH with changetype: REPLACE to upsert records.
   */
  async upsertRecords(domain: string, rrsets: Omit<DnsRrset, 'changetype'>[]): Promise<void> {
    const normalizedZone = this.normalizeDomain(domain);

    const patchData = {
      rrsets: rrsets.map(rrset => ({
        ...rrset,
        name: this.normalizeDomain(rrset.name),
        changetype: 'REPLACE' as const,
      })),
    };

    logger.debug('Upserting DNS records', {
      zone: normalizedZone,
      recordCount: rrsets.length,
    });

    await this.client.patch(
      `/servers/${this.serverId}/zones/${normalizedZone}`,
      patchData
    );

    logger.info('DNS records upserted', {
      zone: normalizedZone,
      recordCount: rrsets.length,
    });
  }

  /**
   * Delete DNS records from a zone.
   */
  async deleteRecords(domain: string, rrsets: Pick<DnsRrset, 'name' | 'type'>[]): Promise<void> {
    const normalizedZone = this.normalizeDomain(domain);

    const patchData = {
      rrsets: rrsets.map(rrset => ({
        name: this.normalizeDomain(rrset.name),
        type: rrset.type,
        changetype: 'DELETE' as const,
        records: [],
      })),
    };

    logger.debug('Deleting DNS records', {
      zone: normalizedZone,
      recordCount: rrsets.length,
    });

    await this.client.patch(
      `/servers/${this.serverId}/zones/${normalizedZone}`,
      patchData
    );

    logger.info('DNS records deleted', {
      zone: normalizedZone,
      recordCount: rrsets.length,
    });
  }

  /**
   * Get all records for a zone.
   */
  async getRecords(domain: string): Promise<DnsRrset[]> {
    const zone = await this.getZone(domain);
    return zone?.rrsets || [];
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Add an A record.
   */
  async addARecord(domain: string, name: string, ip: string, ttl = 3600): Promise<void> {
    const recordName = name === '@' ? domain : `${name}.${domain}`;
    
    await this.upsertRecords(domain, [{
      name: recordName,
      type: 'A',
      ttl,
      records: [{ content: ip, disabled: false }],
    }]);
  }

  /**
   * Add a CNAME record.
   */
  async addCnameRecord(domain: string, name: string, target: string, ttl = 3600): Promise<void> {
    const recordName = `${name}.${domain}`;
    const normalizedTarget = this.normalizeDomain(target);
    
    await this.upsertRecords(domain, [{
      name: recordName,
      type: 'CNAME',
      ttl,
      records: [{ content: normalizedTarget, disabled: false }],
    }]);
  }

  /**
   * Add an MX record.
   */
  async addMxRecord(domain: string, priority: number, mailServer: string, ttl = 3600): Promise<void> {
    const normalizedMailServer = this.normalizeDomain(mailServer);
    
    await this.upsertRecords(domain, [{
      name: domain,
      type: 'MX',
      ttl,
      records: [{ content: `${priority} ${normalizedMailServer}`, disabled: false }],
    }]);
  }

  /**
   * Add a TXT record.
   */
  async addTxtRecord(domain: string, name: string, content: string, ttl = 3600): Promise<void> {
    const recordName = name === '@' ? domain : `${name}.${domain}`;
    // TXT records need to be quoted
    const quotedContent = content.startsWith('"') ? content : `"${content}"`;
    
    await this.upsertRecords(domain, [{
      name: recordName,
      type: 'TXT',
      ttl,
      records: [{ content: quotedContent, disabled: false }],
    }]);
  }
}

// Singleton instance
let powerDnsClient: PowerDnsClient | null = null;

/**
 * Get the PowerDNS client singleton.
 */
export function getPowerDnsClient(): PowerDnsClient {
  if (!powerDnsClient) {
    powerDnsClient = new PowerDnsClient();
  }
  return powerDnsClient;
}

export default getPowerDnsClient;
