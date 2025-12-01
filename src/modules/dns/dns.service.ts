/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * DNS Service - Manages DNS records for CloudPods and domains.
 * 
 * Uses PowerDNS as the DNS backend. All configuration comes from environment.
 * 
 * SCHEMA ALIGNMENT (2025-01):
 * - Domain model: id, tenantId, name (unique), status, autoDns, autoMail
 * - DnsZone model: id, tenantId, domainId (FK to Domain), pdnsId, soaSerial, isSynced
 * - DnsRecord model: id, zoneId (FK), name, type, content, ttl, priority
 * - CloudPod model: has hostname/ip but NO domain relation
 * 
 * Key functions:
 * - ensureDomain: Idempotent domain creation (upsert by name)
 * - applyDnsTemplateForCloudPod: Apply standard DNS template for a CloudPod
 * - provisionDnsZone: Create a new DNS zone for a domain
 * - deleteDnsRecordsForCloudPod: Remove DNS records when CloudPod is destroyed
 * 
 * All operations are:
 * - Multi-tenant safe (always filter by tenantId)
 * - Idempotent (upsert, never duplicate)
 * - Audit-logged
 */

import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { getPowerDnsClient, type DnsRrset } from '../../config/powerdns.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import type { Domain, DnsZone as PrismaDnsZone, DnsRecord as PrismaDnsRecord } from '@prisma/client';

// ============================================
// TYPES
// ============================================

/** Input for ensureDomain - idempotent domain creation */
export interface EnsureDomainInput {
  tenantId: string;
  name: string;
  autoDns?: boolean;
  autoMail?: boolean;
}

/** Result from ensureDomain */
export interface EnsureDomainResult {
  domain: Domain;
  created: boolean;
}

/** Input for applyDnsTemplateForCloudPod */
export interface ApplyDnsTemplateInput {
  tenantId: string;
  cloudPodId: string;
  /** Domain name (e.g., "example.com") */
  domain: string;
  /** CloudPod or Server IP (fetched if not provided) */
  server?: {
    ip: string;
  };
  includeEmail?: boolean;
}

/** Input for provisionDnsZone */
export interface ProvisionDnsZoneParams {
  tenantId: string;
  domainId: string;
  /** Domain name - will be looked up from Domain record */
  domainName?: string;
}

/** DNS record type union */
export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV';

// ============================================
// DNS RECORD TEMPLATES
// ============================================

/**
 * Standard DNS records for a CloudPod.
 * IP addresses come from the server info, not hard-coded.
 */
function getCloudPodDnsTemplate(domain: string, ipv4: string): Omit<DnsRrset, 'changetype'>[] {
  return [
    // Root domain A record
    {
      name: domain,
      type: 'A',
      ttl: 3600,
      records: [{ content: ipv4, disabled: false }],
    },
    // WWW subdomain
    {
      name: `www.${domain}`,
      type: 'A',
      ttl: 3600,
      records: [{ content: ipv4, disabled: false }],
    },
  ];
}

/**
 * Email DNS records (MX, SPF, DKIM).
 * Mail server hostname comes from environment.
 */
function getEmailDnsTemplate(domain: string): Omit<DnsRrset, 'changetype'>[] {
  const mailServer = env.SMTP_HOST || 'mail.migrahosting.com';
  
  return [
    // MX record
    {
      name: domain,
      type: 'MX',
      ttl: 3600,
      records: [{ content: `10 ${mailServer}.`, disabled: false }],
    },
    // SPF record
    {
      name: domain,
      type: 'TXT',
      ttl: 3600,
      records: [{ content: '"v=spf1 mx a ~all"', disabled: false }],
    },
    // DMARC record
    {
      name: `_dmarc.${domain}`,
      type: 'TXT',
      ttl: 3600,
      records: [{ content: '"v=DMARC1; p=none"', disabled: false }],
    },
  ];
}

// ============================================
// CORE DNS SERVICE CLASS
// ============================================

export class DnsService {
  private pdns = getPowerDnsClient();

  // ============================================
  // DOMAIN MANAGEMENT
  // ============================================

  /**
   * Idempotent domain creation.
   * If domain already exists for tenant, returns existing.
   * If domain exists for DIFFERENT tenant, throws error.
   * 
   * @param input - tenantId and domain name
   * @returns Domain record and whether it was created
   */
  async ensureDomain(input: EnsureDomainInput): Promise<EnsureDomainResult> {
    const { tenantId, name, autoDns = true, autoMail = true } = input;
    const normalizedName = name.toLowerCase().trim();

    logger.info('Ensuring domain exists', { tenantId, name: normalizedName });

    // Check if domain already exists (globally unique by name)
    const existing = await prisma.domain.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      // Verify tenant ownership
      if (existing.tenantId !== tenantId) {
        logger.warn('Domain exists but belongs to different tenant', {
          domain: normalizedName,
          requestedTenantId: tenantId,
          actualTenantId: existing.tenantId,
        });
        throw new Error(`Domain ${normalizedName} is already registered to another tenant`);
      }

      // Already exists for this tenant - idempotent success
      logger.info('Domain already exists for tenant', {
        domainId: existing.id,
        domain: normalizedName,
      });

      await writeAuditEvent({
        actorUserId: null,
        tenantId,
        type: 'DOMAIN_VERIFIED',
        metadata: { domainId: existing.id, domain: normalizedName, action: 'ensureDomain_existing' },
      });

      return { domain: existing, created: false };
    }

    // Create new domain
    const domain = await prisma.domain.create({
      data: {
        tenantId,
        name: normalizedName,
        status: 'active',
        autoDns,
        autoMail,
      },
    });

    logger.info('Domain created', { domainId: domain.id, domain: normalizedName, tenantId });

    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'DOMAIN_CREATED',
      metadata: { domainId: domain.id, domain: normalizedName },
    });

    return { domain, created: true };
  }

  // ============================================
  // DNS ZONE MANAGEMENT
  // ============================================

  /**
   * Ensure DNS zone exists for a domain.
   * Creates in both PowerDNS and database.
   * 
   * @param tenantId - Tenant ID
   * @param domainId - Domain ID (FK to Domain)
   * @param domainName - Domain name (for PowerDNS)
   */
  private async ensureDnsZone(tenantId: string, domainId: string, domainName: string): Promise<PrismaDnsZone> {
    // Check if zone already exists in DB
    const existingZone = await prisma.dnsZone.findFirst({
      where: { tenantId, domainId },
    });

    if (existingZone) {
      // Verify it exists in PowerDNS
      const zoneExists = await this.pdns.zoneExists(domainName);
      if (!zoneExists) {
        await this.pdns.createZone({ name: domainName });
        logger.info('Recreated missing PowerDNS zone', { domain: domainName });
      }
      return existingZone;
    }

    // Create zone in PowerDNS first
    const zoneExists = await this.pdns.zoneExists(domainName);
    let pdnsZone;
    if (!zoneExists) {
      pdnsZone = await this.pdns.createZone({ name: domainName });
      logger.info('Created PowerDNS zone', { domain: domainName });
    } else {
      pdnsZone = await this.pdns.getZone(domainName);
    }

    // Create zone record in database
    const zone = await prisma.dnsZone.create({
      data: {
        tenantId,
        domainId,
        pdnsId: null, // PowerDNS uses string IDs
        soaSerial: pdnsZone?.serial ?? null,
        isSynced: true,
        lastSyncAt: new Date(),
      },
    });

    logger.info('Created DNS zone in database', { zoneId: zone.id, domainId, domain: domainName });

    return zone;
  }

  // ============================================
  // CLOUDPOD DNS TEMPLATE
  // ============================================

  /**
   * Apply standard DNS template for a CloudPod.
   * 
   * Flow:
   * 1. Ensure domain exists (via ensureDomain)
   * 2. Ensure DNS zone exists for domain
   * 3. Get CloudPod IP (from input or fetch)
   * 4. Apply DNS records to PowerDNS
   * 5. Store records in database
   * 
   * This is IDEMPOTENT - safe to call multiple times.
   */
  async applyDnsTemplateForCloudPod(input: ApplyDnsTemplateInput): Promise<void> {
    const { tenantId, cloudPodId, domain, server, includeEmail = false } = input;

    logger.info('Applying DNS template for CloudPod', {
      tenantId,
      cloudPodId,
      domain,
      includeEmail,
    });

    try {
      // 1) Get CloudPod to find IP
      const cloudPod = await prisma.cloudPod.findUnique({
        where: { id: cloudPodId },
        select: { id: true, hostname: true, ip: true, tenantId: true },
      });

      if (!cloudPod) {
        throw new Error(`CloudPod not found: ${cloudPodId}`);
      }

      // Verify tenant ownership
      if (cloudPod.tenantId !== tenantId) {
        throw new Error(`CloudPod ${cloudPodId} does not belong to tenant ${tenantId}`);
      }

      // Determine IP address
      const ipv4 = server?.ip ?? cloudPod.ip;
      if (!ipv4) {
        throw new Error(`No IP address available for CloudPod ${cloudPodId}`);
      }

      // 2) Ensure domain exists for this tenant
      const { domain: domainRecord, created: domainCreated } = await this.ensureDomain({
        tenantId,
        name: domain,
        autoDns: true,
        autoMail: includeEmail,
      });

      // 3) Ensure DNS zone exists
      const zone = await this.ensureDnsZone(tenantId, domainRecord.id, domain);

      // 4) Build DNS records
      const records: Omit<DnsRrset, 'changetype'>[] = [
        ...getCloudPodDnsTemplate(domain, ipv4),
        ...(includeEmail ? getEmailDnsTemplate(domain) : []),
      ];

      // 5) Apply records to PowerDNS
      await this.pdns.upsertRecords(domain, records);

      // 6) Store records in database (upsert pattern)
      for (const record of records) {
        // Find existing record by zone + name + type
        const existingRecord = await prisma.dnsRecord.findFirst({
          where: {
            zoneId: zone.id,
            name: record.name,
            type: record.type,
          },
        });

        if (existingRecord) {
          // Update existing
          await prisma.dnsRecord.update({
            where: { id: existingRecord.id },
            data: {
              content: record.records[0].content,
              ttl: record.ttl,
            },
          });
        } else {
          // Create new
          await prisma.dnsRecord.create({
            data: {
              zoneId: zone.id,
              name: record.name,
              type: record.type,
              content: record.records[0].content,
              ttl: record.ttl,
              priority: record.type === 'MX' ? 10 : null,
            },
          });
        }
      }

      // 7) Audit event
      await writeAuditEvent({
        actorUserId: null,
        tenantId,
        type: 'DOMAIN_DNS_TEMPLATE_APPLIED',
        metadata: {
          cloudPodId,
          domainId: domainRecord.id,
          domain,
          ipv4,
          recordCount: records.length,
          zoneId: zone.id,
          domainCreated,
        },
      });

      logger.info('DNS template applied successfully', {
        cloudPodId,
        domain,
        recordCount: records.length,
      });
    } catch (error) {
      logger.error('Failed to apply DNS template', {
        cloudPodId,
        domain,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  /**
   * Provision a new DNS zone for a domain.
   * Used when registering new domains (without CloudPod).
   */
  async provisionDnsZone(params: ProvisionDnsZoneParams): Promise<void> {
    const { tenantId, domainId, domainName } = params;

    // Get domain record to find the name
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      select: { id: true, name: true, tenantId: true },
    });

    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }

    // Verify tenant ownership
    if (domain.tenantId !== tenantId) {
      throw new Error(`Domain ${domainId} does not belong to tenant ${tenantId}`);
    }

    const name = domainName ?? domain.name;

    logger.info('Provisioning DNS zone', { domain: name, domainId, tenantId });

    try {
      // Get web server IP from environment (no hard-coded values)
      const webServerIp = env.SRV1_WEB_IP;

      if (!webServerIp) {
        throw new Error('SRV1_WEB_IP environment variable not set');
      }

      // Ensure zone exists (creates in PowerDNS and DB)
      const zone = await this.ensureDnsZone(tenantId, domainId, name);

      // Add default A records
      const defaultRecords: Omit<DnsRrset, 'changetype'>[] = [
        {
          name: name,
          type: 'A',
          ttl: 3600,
          records: [{ content: webServerIp, disabled: false }],
        },
        {
          name: `www.${name}`,
          type: 'A',
          ttl: 3600,
          records: [{ content: webServerIp, disabled: false }],
        },
      ];

      await this.pdns.upsertRecords(name, defaultRecords);

      // Create DNS records in database
      for (const r of defaultRecords) {
        await prisma.dnsRecord.create({
          data: {
            zoneId: zone.id,
            name: r.name,
            type: r.type,
            content: r.records[0].content,
            ttl: r.ttl,
          },
        });
      }

      logger.info('DNS zone provisioned successfully', {
        domain: name,
        zoneId: zone.id,
      });
    } catch (error) {
      logger.error('Failed to provision DNS zone', {
        domain: name,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw new Error(`Failed to provision DNS zone: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Delete DNS records for a CloudPod.
   */
  async deleteDnsRecordsForCloudPod(cloudPodId: string, tenantId: string): Promise<void> {
    logger.info('Deleting DNS records for CloudPod', { cloudPodId, tenantId });

    try {
      // Get CloudPod details - use hostname as the domain
      const cloudPod = await prisma.cloudPod.findUnique({
        where: { id: cloudPodId },
        select: {
          hostname: true,
          tenantId: true,
        },
      });

      if (!cloudPod?.hostname) {
        logger.warn('CloudPod has no hostname, skipping DNS cleanup', { cloudPodId });
        return;
      }

      // Verify tenant ownership
      if (cloudPod.tenantId !== tenantId) {
        throw new Error(`CloudPod ${cloudPodId} does not belong to tenant ${tenantId}`);
      }

      const domainName = cloudPod.hostname;
      const rootDomain = this.extractRootDomain(domainName);

      // Find the domain record
      const domain = await prisma.domain.findUnique({
        where: { name: rootDomain },
      });

      if (domain && domain.tenantId === tenantId) {
        // Get zone from database
        const dbZone = await prisma.dnsZone.findFirst({
          where: { tenantId, domainId: domain.id },
        });

        if (dbZone) {
          // Delete records from database
          await prisma.dnsRecord.deleteMany({
            where: {
              zoneId: dbZone.id,
              name: { in: [domainName, `www.${domainName}`] },
            },
          });
        }
      }

      // Delete records from PowerDNS
      const zoneExists = await this.pdns.zoneExists(rootDomain);
      if (zoneExists) {
        await this.pdns.deleteRecords(rootDomain, [
          { name: domainName, type: 'A' },
          { name: `www.${domainName}`, type: 'A' },
        ]);
      }

      // Audit event
      await writeAuditEvent({
        actorUserId: null,
        tenantId,
        type: 'DNS_RECORDS_DELETED',
        metadata: {
          cloudPodId,
          domain: domainName,
        },
      });

      logger.info('DNS records deleted for CloudPod', { cloudPodId, domain: domainName });
    } catch (error) {
      logger.error('Failed to delete DNS records', {
        cloudPodId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // Don't throw - DNS cleanup failure shouldn't block CloudPod deletion
    }
  }

  /**
   * Get DNS zone for a domain by domain ID.
   */
  async getDnsZone(tenantId: string, domainId: string): Promise<PrismaDnsZone | null> {
    const zone = await prisma.dnsZone.findFirst({
      where: { tenantId, domainId },
      include: { records: true },
    });
    return zone;
  }

  /**
   * Get DNS records for a domain by name.
   */
  async getDnsRecordsForDomain(tenantId: string, domainName: string): Promise<PrismaDnsRecord[]> {
    const rootDomain = this.extractRootDomain(domainName);
    
    // Find domain by name (globally unique)
    const domain = await prisma.domain.findUnique({
      where: { name: rootDomain },
    });

    if (!domain || domain.tenantId !== tenantId) {
      return [];
    }

    const zone = await prisma.dnsZone.findFirst({
      where: { tenantId, domainId: domain.id },
    });

    if (!zone) {
      return [];
    }

    const records = await prisma.dnsRecord.findMany({
      where: { zoneId: zone.id },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return records;
  }

  /**
   * Extract root domain from a subdomain.
   * e.g., "www.example.com" → "example.com"
   */
  private extractRootDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length > 2) {
      // Check for common TLDs like .co.uk, .com.au
      const possibleTld = parts.slice(-2).join('.');
      const commonMultiPartTlds = ['co.uk', 'com.au', 'co.nz', 'com.br', 'co.za'];
      
      if (commonMultiPartTlds.includes(possibleTld)) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }
    return domain;
  }
}

// Export singleton instance
const dnsService = new DnsService();

// Export functions for direct import
export const ensureDomain = dnsService.ensureDomain.bind(dnsService);
export const applyDnsTemplateForCloudPod = dnsService.applyDnsTemplateForCloudPod.bind(dnsService);
export const provisionDnsZone = dnsService.provisionDnsZone.bind(dnsService);
export const deleteDnsRecordsForCloudPod = dnsService.deleteDnsRecordsForCloudPod.bind(dnsService);
export const getDnsRecordsForDomain = dnsService.getDnsRecordsForDomain.bind(dnsService);
export const getDnsZone = dnsService.getDnsZone.bind(dnsService);

export default dnsService;
