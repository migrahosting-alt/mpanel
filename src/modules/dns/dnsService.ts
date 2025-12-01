/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * DNS Service - Manages DNS records for CloudPods.
 * 
 * Currently integrates with Cloudflare API.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

// ============================================
// TYPES
// ============================================

interface DnsRecord {
  id: string;
  zoneId: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV';
  content: string;
  ttl: number;
  proxied: boolean;
  externalRecordId: string | null;
}

interface DnsZone {
  id: string;
  domain: string;
  provider: string;
  externalZoneId: string;
}

interface ApplyDnsTemplateInput {
  cloudPodId: string;
  domain: string;
  ipv4: string;
  includeEmail?: boolean;
}

// ============================================
// DNS RECORD TEMPLATES
// ============================================

/**
 * Standard DNS records for a CloudPod.
 */
function getCloudPodDnsTemplate(domain: string, ipv4: string): Omit<DnsRecord, 'id' | 'zoneId' | 'externalRecordId'>[] {
  return [
    // Root domain
    { name: '@', type: 'A', content: ipv4, ttl: 300, proxied: true },
    // WWW subdomain
    { name: 'www', type: 'A', content: ipv4, ttl: 300, proxied: true },
    // cpod subdomain (direct access)
    { name: 'cpod', type: 'A', content: ipv4, ttl: 300, proxied: false },
  ];
}

/**
 * Email DNS records (MX, SPF, DKIM).
 */
function getEmailDnsTemplate(domain: string): Omit<DnsRecord, 'id' | 'zoneId' | 'externalRecordId'>[] {
  return [
    // MX record pointing to mail server
    { name: '@', type: 'MX', content: `mail.${domain}`, ttl: 3600, proxied: false },
    // SPF record
    { name: '@', type: 'TXT', content: `v=spf1 mx a ~all`, ttl: 3600, proxied: false },
    // DMARC record
    { name: '_dmarc', type: 'TXT', content: 'v=DMARC1; p=none; rua=mailto:dmarc@migra.cloud', ttl: 3600, proxied: false },
  ];
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Apply standard DNS template for a CloudPod.
 * Creates all necessary DNS records for the domain.
 * 
 * @example
 * await applyDnsTemplateForCloudPod({
 *   cloudPodId: 'cpod_xxx',
 *   domain: 'example.com',
 *   ipv4: '10.1.1.100',
 * });
 */
export async function applyDnsTemplateForCloudPod(
  input: ApplyDnsTemplateInput
): Promise<void> {
  const { cloudPodId, domain, ipv4, includeEmail = false } = input;

  logger.info('Applying DNS template for CloudPod', {
    cloudPodId,
    domain,
    ipv4,
    includeEmail,
  });

  // Get or create DNS zone for this domain
  const zone = await getOrCreateDnsZone(domain);

  // Build records list
  const records = [
    ...getCloudPodDnsTemplate(domain, ipv4),
    ...(includeEmail ? getEmailDnsTemplate(domain) : []),
  ];

  // Apply each record
  for (const record of records) {
    await upsertDnsRecord({
      zoneId: zone.id,
      externalZoneId: zone.externalZoneId,
      ...record,
    });
  }

  // Link records to CloudPod
  await prisma.cloudPodDnsRecord.createMany({
    data: records.map(r => ({
      cloudPodId,
      zoneId: zone.id,
      recordName: r.name === '@' ? domain : `${r.name}.${domain}`,
      recordType: r.type,
      createdAt: new Date(),
    })),
    skipDuplicates: true,
  });

  // Get CloudPod for tenant ID
  const cloudPod = await prisma.cloudPod.findUnique({
    where: { id: cloudPodId },
    select: { tenantId: true },
  });

  await writeAuditEvent({
    actorUserId: null,
    tenantId: cloudPod?.tenantId ?? null,
    type: 'DNS_RECORDS_CREATED',
    metadata: {
      cloudPodId,
      domain,
      ipv4,
      recordCount: records.length,
    },
  });

  logger.info('DNS template applied successfully', {
    cloudPodId,
    domain,
    recordCount: records.length,
  });
}

/**
 * Get or create a DNS zone for a domain.
 */
async function getOrCreateDnsZone(domain: string): Promise<DnsZone> {
  // Extract root domain (e.g., sub.example.com → example.com)
  const parts = domain.split('.');
  const rootDomain = parts.length > 2 
    ? parts.slice(-2).join('.')
    : domain;

  // Check if zone exists
  const existingZone = await prisma.dnsZone.findFirst({
    where: { domain: rootDomain },
  });

  if (existingZone) {
    return existingZone as DnsZone;
  }

  // Create zone in Cloudflare
  const externalZoneId = await createCloudflareZone(rootDomain);

  // Create local record
  const zone = await prisma.dnsZone.create({
    data: {
      domain: rootDomain,
      provider: 'cloudflare',
      externalZoneId,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  logger.info('DNS zone created', {
    zoneId: zone.id,
    domain: rootDomain,
    externalZoneId,
  });

  return zone as DnsZone;
}

/**
 * Create or update a DNS record.
 */
async function upsertDnsRecord(params: {
  zoneId: string;
  externalZoneId: string;
  name: string;
  type: DnsRecord['type'];
  content: string;
  ttl: number;
  proxied: boolean;
}): Promise<void> {
  const { zoneId, externalZoneId, name, type, content, ttl, proxied } = params;

  // Check for existing record
  const existingRecord = await prisma.dnsRecord.findFirst({
    where: {
      zoneId,
      name,
      type,
    },
  });

  if (existingRecord) {
    // Update existing record
    if (existingRecord.content !== content || existingRecord.ttl !== ttl) {
      await updateCloudflareRecord({
        zoneId: externalZoneId,
        recordId: existingRecord.externalRecordId!,
        name,
        type,
        content,
        ttl,
        proxied,
      });

      await prisma.dnsRecord.update({
        where: { id: existingRecord.id },
        data: {
          content,
          ttl,
          proxied,
          updatedAt: new Date(),
        },
      });
    }
  } else {
    // Create new record
    const externalRecordId = await createCloudflareRecord({
      zoneId: externalZoneId,
      name,
      type,
      content,
      ttl,
      proxied,
    });

    await prisma.dnsRecord.create({
      data: {
        zoneId,
        name,
        type,
        content,
        ttl,
        proxied,
        externalRecordId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }
}

/**
 * Delete DNS records for a CloudPod.
 */
export async function deleteDnsRecordsForCloudPod(cloudPodId: string): Promise<void> {
  const linkedRecords = await prisma.cloudPodDnsRecord.findMany({
    where: { cloudPodId },
    include: {
      zone: true,
    },
  });

  for (const link of linkedRecords) {
    const record = await prisma.dnsRecord.findFirst({
      where: {
        zoneId: link.zoneId,
        name: link.recordName,
        type: link.recordType,
      },
    });

    if (record && record.externalRecordId) {
      await deleteCloudflareRecord({
        zoneId: link.zone.externalZoneId,
        recordId: record.externalRecordId,
      });

      await prisma.dnsRecord.delete({
        where: { id: record.id },
      });
    }
  }

  await prisma.cloudPodDnsRecord.deleteMany({
    where: { cloudPodId },
  });

  logger.info('DNS records deleted for CloudPod', {
    cloudPodId,
    recordCount: linkedRecords.length,
  });
}

/**
 * Get DNS records for a domain.
 */
export async function getDnsRecordsForDomain(domain: string): Promise<DnsRecord[]> {
  const zone = await prisma.dnsZone.findFirst({
    where: { domain },
  });

  if (!zone) {
    return [];
  }

  const records = await prisma.dnsRecord.findMany({
    where: { zoneId: zone.id },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  return records as DnsRecord[];
}

// ============================================
// CLOUDFLARE API
// ============================================

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

function getCloudflareHeaders(): HeadersInit {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error('CLOUDFLARE_API_TOKEN not configured');
  }
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

async function createCloudflareZone(domain: string): Promise<string> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  
  const response = await fetch(`${CLOUDFLARE_API}/zones`, {
    method: 'POST',
    headers: getCloudflareHeaders(),
    body: JSON.stringify({
      name: domain,
      account: { id: accountId },
      jump_start: true,
    }),
  });

  const data = await response.json() as { success: boolean; result?: { id: string }; errors?: { message: string }[] };

  if (!data.success) {
    throw new Error(`Failed to create Cloudflare zone: ${data.errors?.[0]?.message}`);
  }

  return data.result!.id;
}

async function createCloudflareRecord(params: {
  zoneId: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
}): Promise<string> {
  const { zoneId, name, type, content, ttl, proxied } = params;

  const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records`, {
    method: 'POST',
    headers: getCloudflareHeaders(),
    body: JSON.stringify({
      name,
      type,
      content,
      ttl: proxied ? 1 : ttl, // Auto TTL when proxied
      proxied: ['A', 'AAAA', 'CNAME'].includes(type) ? proxied : false,
    }),
  });

  const data = await response.json() as { success: boolean; result?: { id: string }; errors?: { message: string }[] };

  if (!data.success) {
    throw new Error(`Failed to create DNS record: ${data.errors?.[0]?.message}`);
  }

  return data.result!.id;
}

async function updateCloudflareRecord(params: {
  zoneId: string;
  recordId: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  proxied: boolean;
}): Promise<void> {
  const { zoneId, recordId, name, type, content, ttl, proxied } = params;

  const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PATCH',
    headers: getCloudflareHeaders(),
    body: JSON.stringify({
      name,
      type,
      content,
      ttl: proxied ? 1 : ttl,
      proxied: ['A', 'AAAA', 'CNAME'].includes(type) ? proxied : false,
    }),
  });

  const data = await response.json() as { success: boolean; errors?: { message: string }[] };

  if (!data.success) {
    throw new Error(`Failed to update DNS record: ${data.errors?.[0]?.message}`);
  }
}

async function deleteCloudflareRecord(params: {
  zoneId: string;
  recordId: string;
}): Promise<void> {
  const { zoneId, recordId } = params;

  const response = await fetch(`${CLOUDFLARE_API}/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'DELETE',
    headers: getCloudflareHeaders(),
  });

  const data = await response.json() as { success: boolean; errors?: { message: string }[] };

  if (!data.success) {
    logger.warn('Failed to delete DNS record', {
      zoneId,
      recordId,
      error: data.errors?.[0]?.message,
    });
  }
}

export default {
  applyDnsTemplateForCloudPod,
  deleteDnsRecordsForCloudPod,
  getDnsRecordsForDomain,
};
