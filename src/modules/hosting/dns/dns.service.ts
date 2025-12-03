/**
 * MODULE_DNS Service
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type { DnsZone, DnsRecord, CreateZoneRequest, CreateRecordRequest } from './dns.types.js';

export async function listZones(
  domainId: string | undefined,
  actorTenantId: string
): Promise<DnsZone[]> {
  try {
    const where: any = { tenantId: actorTenantId };
    if (domainId) where.domainId = domainId;

    // @ts-ignore
    const zones = await prisma.dnsZone.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return zones;
  } catch {
    return [];
  }
}

export async function getZoneRecords(zoneId: string, actorTenantId: string): Promise<DnsRecord[]> {
  try {
    // Verify zone access
    // @ts-ignore
    const zone = await prisma.dnsZone.findFirst({
      where: { id: zoneId, tenantId: actorTenantId },
    });

    if (!zone) throw new Error('Zone not found');

    // @ts-ignore
    const records = await prisma.dnsRecord.findMany({
      where: { zoneId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return records;
  } catch {
    return [];
  }
}

export async function createZone(
  data: CreateZoneRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ zone: DnsZone; jobId: string }> {
  const { domainId, name, preset } = data;

  // @ts-ignore
  const zone = await prisma.dnsZone.create({
    data: {
      tenantId: actorTenantId,
      domainId: domainId || 'placeholder',
      name: name || 'example.com.',
      type: 'MASTER',
      status: 'SYNCING',
      soa: null,
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'dns.zone.create',
      status: 'pending',
      payload: { zoneId: zone.id, preset: preset || 'STANDARD_MIGRAHOSTING' },
      createdBy: actorId,
    },
  });

  return { zone, jobId: job.id };
}

export async function createRecord(
  zoneId: string,
  data: CreateRecordRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ record: DnsRecord; jobId: string }> {
  // Verify zone access
  // @ts-ignore
  const zone = await prisma.dnsZone.findFirst({
    where: { id: zoneId, tenantId: actorTenantId },
  });

  if (!zone) throw new Error('Zone not found');

  // @ts-ignore
  const record = await prisma.dnsRecord.create({
    data: {
      zoneId,
      name: data.name,
      type: data.type,
      content: data.content,
      ttl: data.ttl || 3600,
      priority: data.priority || null,
      flags: [],
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'dns.record.create',
      status: 'pending',
      payload: { recordId: record.id, zoneId },
      createdBy: actorId,
    },
  });

  return { record, jobId: job.id };
}
