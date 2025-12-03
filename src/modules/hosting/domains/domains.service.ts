/**
 * MODULE_DOMAINS Service
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type { Domain, ImportDomainRequest, RegisterDomainRequest } from './domains.types.js';

export async function listDomains(actorTenantId: string): Promise<Domain[]> {
  try {
    // @ts-ignore
    const domains = await prisma.domain.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return domains;
  } catch {
    return [];
  }
}

export async function getDomainById(id: string, actorTenantId: string): Promise<Domain | null> {
  try {
    // @ts-ignore
    const domain = await prisma.domain.findFirst({
      where: { id, tenantId: actorTenantId },
    });
    return domain;
  } catch {
    return null;
  }
}

export async function importDomain(
  data: ImportDomainRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ domain: Domain; dnsZoneId?: string }> {
  const { name, nameservers, dnsHostedHere } = data;

  // @ts-ignore
  const domain = await prisma.domain.create({
    data: {
      tenantId: actorTenantId,
      name,
      type: 'EXTERNAL',
      registrar: 'UNKNOWN',
      nameservers: nameservers || [],
      status: 'ACTIVE',
      autoRenew: false,
    },
  });

  let dnsZoneId: string | undefined;

  if (dnsHostedHere) {
    // TODO: Create DNS zone via DNS module
    logger.info('DNS zone creation requested', { domainId: domain.id });
  }

  return { domain, dnsZoneId };
}

export async function registerDomain(
  data: RegisterDomainRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ domain: Domain; jobId: string }> {
  const { name, years, contact, nameservers } = data;

  // @ts-ignore
  const domain = await prisma.domain.create({
    data: {
      tenantId: actorTenantId,
      name,
      type: 'INTERNAL_REGISTRAR',
      registrar: 'NAMESILO',
      nameservers: nameservers || ['ns1.migrahosting.com', 'ns2.migrahosting.com'],
      status: 'PENDING_TRANSFER',
      autoRenew: true,
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'domain.register',
      status: 'pending',
      payload: { domainId: domain.id, years, contact, nameservers },
      createdBy: actorId,
    },
  });

  return { domain, jobId: job.id };
}
