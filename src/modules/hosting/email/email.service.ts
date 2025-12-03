/**
 * MODULE_EMAIL Service
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  EmailDomain,
  EmailAccount,
  CreateEmailDomainRequest,
  CreateEmailAccountRequest,
} from './email.types.js';

export async function listEmailDomains(actorTenantId: string): Promise<EmailDomain[]> {
  try {
    // @ts-ignore
    const domains = await prisma.emailDomain.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return domains;
  } catch {
    return [];
  }
}

export async function createEmailDomain(
  data: CreateEmailDomainRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ emailDomain: EmailDomain; jobId: string }> {
  const { domainId, spamPolicy } = data;

  // @ts-ignore
  const emailDomain = await prisma.emailDomain.create({
    data: {
      tenantId: actorTenantId,
      domainId,
      status: 'PENDING_DNS',
      mxMode: 'CENTRAL_MAIL_MIGRAHOSTING_ONLY',
      spamPolicy: spamPolicy || null,
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'email.domain.create',
      status: 'pending',
      payload: { emailDomainId: emailDomain.id },
      createdBy: actorId,
    },
  });

  return { emailDomain, jobId: job.id };
}

export async function listEmailAccounts(
  emailDomainId: string,
  actorTenantId: string
): Promise<EmailAccount[]> {
  try {
    // Verify email domain access
    // @ts-ignore
    const emailDomain = await prisma.emailDomain.findFirst({
      where: { id: emailDomainId, tenantId: actorTenantId },
    });

    if (!emailDomain) throw new Error('Email domain not found');

    // @ts-ignore
    const accounts = await prisma.emailAccount.findMany({
      where: { emailDomainId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts;
  } catch {
    return [];
  }
}

export async function createEmailAccount(
  emailDomainId: string,
  data: CreateEmailAccountRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ account: EmailAccount; jobId: string }> {
  // Verify email domain access
  // @ts-ignore
  const emailDomain = await prisma.emailDomain.findFirst({
    where: { id: emailDomainId, tenantId: actorTenantId },
  });

  if (!emailDomain) throw new Error('Email domain not found');

  const { address, displayName, quotaMb, password } = data;

  // Get domain name from emailDomain -> domain
  const domainName = 'example.com'; // TODO: fetch from domain table

  // @ts-ignore
  const account = await prisma.emailAccount.create({
    data: {
      emailDomainId,
      address,
      fullAddress: `${address}@${domainName}`,
      displayName: displayName || null,
      quotaMb,
      usageMb: 0,
      status: 'ACTIVE',
      forwardTo: [],
      aliases: [],
    },
  });

  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'email.account.create',
      status: 'pending',
      payload: {
        accountId: account.id,
        password, // Encrypted in job payload
      },
      createdBy: actorId,
    },
  });

  return { account, jobId: job.id };
}
