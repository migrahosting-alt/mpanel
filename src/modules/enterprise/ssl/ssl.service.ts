/**
 * ENTERPRISE SSL CERTIFICATES Service
 * Job-based SSL issuance with ACME and custom upload
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  SslCertificate,
  IssueCertificateRequest,
  UploadCustomCertificateRequest,
} from './ssl.types.js';

export async function listCertificates(actorTenantId: string): Promise<SslCertificate[]> {
  try {
    // @ts-ignore - SslCertificate table may not exist yet
    const certs = await prisma.sslCertificate.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return certs;
  } catch {
    return [];
  }
}

export async function getCertificateById(
  id: string,
  actorTenantId: string
): Promise<SslCertificate | null> {
  try {
    // @ts-ignore
    const cert = await prisma.sslCertificate.findFirst({
      where: { id, tenantId: actorTenantId },
    });
    return cert;
  } catch {
    return null;
  }
}

export async function issueCertificate(
  data: IssueCertificateRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ certificate: SslCertificate; jobId: string }> {
  const { domains, challengeType, targetServerId, autoRenew } = data;

  // Validate domain ownership (TODO: check Domain table)
  const commonName = domains[0];
  const altNames = domains.slice(1);

  // Create certificate in PENDING state
  // @ts-ignore
  const certificate = await prisma.sslCertificate.create({
    data: {
      tenantId: actorTenantId,
      type: 'LETS_ENCRYPT',
      commonName,
      altNames,
      status: 'PENDING',
      managedBy: autoRenew ? 'AUTO' : 'MANUAL',
      issuedAt: null,
      expiresAt: null,
      storageKey: null,
      attachedServers: targetServerId ? { [targetServerId]: true } : null,
      lastError: null,
    },
  });

  // Create challenge records
  for (const domain of domains) {
    // @ts-ignore
    await prisma.sslChallenge.create({
      data: {
        certificateId: certificate.id,
        method: challengeType,
        token: `challenge_${Math.random().toString(36).slice(2)}`,
        value: `validation_${Math.random().toString(36).slice(2)}`,
        status: 'PENDING',
        validatedAt: null,
      },
    });
  }

  // Enqueue issue job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'ssl.certificate.issue',
      status: 'pending',
      payload: {
        certificateId: certificate.id,
        domains,
        challengeType,
        targetServerId,
      },
      createdBy: actorId,
    },
  });

  logger.info('SSL certificate issuance initiated', {
    certificateId: certificate.id,
    jobId: job.id,
  });

  return { certificate, jobId: job.id };
}

export async function uploadCustomCertificate(
  data: UploadCustomCertificateRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ certificate: SslCertificate; jobId: string }> {
  const { commonName, certificate: certPem, privateKey, chain, targetServerId } = data;

  // TODO: Validate PEM format and parse expiry from certificate

  // Create certificate record
  // @ts-ignore
  const certificate = await prisma.sslCertificate.create({
    data: {
      tenantId: actorTenantId,
      type: 'CUSTOM',
      commonName,
      altNames: [],
      status: 'PENDING',
      managedBy: 'MANUAL',
      issuedAt: new Date(),
      expiresAt: null, // Parse from cert
      storageKey: null,
      attachedServers: targetServerId ? { [targetServerId]: true } : null,
      lastError: null,
    },
  });

  // Enqueue upload job (stores cert+key in MinIO)
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'ssl.certificate.upload',
      status: 'pending',
      payload: {
        certificateId: certificate.id,
        certPem,
        privateKey,
        chain,
        targetServerId,
      },
      createdBy: actorId,
    },
  });

  logger.info('Custom SSL certificate upload initiated', {
    certificateId: certificate.id,
    jobId: job.id,
  });

  return { certificate, jobId: job.id };
}

export async function renewCertificate(
  id: string,
  actorTenantId: string,
  actorId: string,
  force: boolean = false
): Promise<{ jobId: string }> {
  // Verify certificate exists and belongs to tenant
  // @ts-ignore
  const certificate = await prisma.sslCertificate.findFirst({
    where: { id, tenantId: actorTenantId },
  });

  if (!certificate) {
    throw new Error('Certificate not found');
  }

  if (certificate.type !== 'LETS_ENCRYPT') {
    throw new Error('Only Let\'s Encrypt certificates can be renewed');
  }

  // Enqueue renewal job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'ssl.certificate.renew',
      status: 'pending',
      payload: {
        certificateId: id,
        force,
      },
      createdBy: actorId,
    },
  });

  logger.info('SSL certificate renewal initiated', { certificateId: id, jobId: job.id });

  return { jobId: job.id };
}

export async function deleteCertificate(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  // Mark as deleting
  // @ts-ignore
  const certificate = await prisma.sslCertificate.findFirst({
    where: { id, tenantId: actorTenantId },
  });

  if (!certificate) {
    throw new Error('Certificate not found');
  }

  // Enqueue deletion job (removes from MinIO and servers)
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'ssl.certificate.delete',
      status: 'pending',
      payload: { certificateId: id },
      createdBy: actorId,
    },
  });

  logger.info('SSL certificate deletion initiated', { certificateId: id, jobId: job.id });

  return { jobId: job.id };
}
