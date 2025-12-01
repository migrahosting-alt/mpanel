/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * SSL Certificate Worker - Issues SSL certificates via Let's Encrypt.
 * 
 * P0.3 FIX (Enterprise Hardening):
 * - ALL user-derived inputs are validated before shell commands
 * - Uses runSshCommand with argument arrays, NOT string interpolation
 * - Audit logging for rejected inputs
 * 
 * SCHEMA ALIGNMENT (from prisma/schema.prisma SslCertificate model):
 * - id, tenantId, domainId (links to Domain, not CloudPod)
 * - commonName (the domain name)
 * - issuer, validFrom, validTo (not expiresAt)
 * - autoRenew, status, certPath, keyPath, chainPath
 * 
 * CloudPod model:
 * - Has 'ip' field (not 'ipv4')
 * - No 'server' relation - server is selected at provisioning time
 * - Has 'hostname' for the container hostname
 * 
 * SSL for CloudPods:
 * - Domain is looked up via domainId
 * - IP comes from CloudPod.ip or needs to be passed in job payload
 */

import { prisma } from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';
import { getServerSshCommand } from '../serverSelectionService.js';
import type { IssueSslJobPayload } from '../queue.js';
import {
  validateDomainName,
  validateVmid,
  runSshCommand,
} from './inputValidation.js';

// ============================================
// TYPES - Schema-aligned
// ============================================

interface SslCertificateRecord {
  id: string;
  tenantId: string | null;
  domainId: string;
  commonName: string;
  issuer: string | null;
  validFrom: Date;
  validTo: Date;
  autoRenew: boolean;
  status: string;
  certPath: string | null;
  keyPath: string | null;
  chainPath: string | null;
}

// ============================================
// CONFIGURATION
// ============================================

// SSH settings from environment
const PROXMOX_HOST = process.env.PROXMOX_HOST ?? 'proxmox.local';

// ============================================
// MAIN WORKER
// ============================================

/**
 * Process an ISSUE_SSL job.
 * 
 * Flow:
 * 1. Get CloudPod and Domain details
 * 2. Validate domain ownership (DNS pointing to CloudPod IP)
 * 3. Request certificate from Let's Encrypt
 * 4. Deploy certificate to container
 * 5. Update database record
 * 
 * IDEMPOTENT: Checks if valid certificate already exists.
 */
export async function processIssueSslJob(
  job: { id: string; data: IssueSslJobPayload }
): Promise<void> {
  const { id: jobId, data } = job;
  const { tenantId, cloudPodId, domain } = data;

  logger.info('Processing ISSUE_SSL job', {
    jobId,
    tenantId,
    cloudPodId,
    domain,
  });

  try {
    // 1) Get CloudPod details
    const cloudPod = await prisma.cloudPod.findUnique({
      where: { id: cloudPodId },
      select: {
        id: true,
        tenantId: true,
        vmid: true,
        hostname: true,
        ip: true,
        status: true,
      },
    });

    if (!cloudPod) {
      throw new Error(`CloudPod not found: ${cloudPodId}`);
    }

    if (!cloudPod.ip) {
      throw new Error(`CloudPod ${cloudPodId} has no IP address assigned`);
    }

    // 2) Get or create Domain record
    let domainRecord = await prisma.domain.findFirst({
      where: {
        name: domain,
        tenantId,
      },
    });

    if (!domainRecord) {
      // Create domain record if it doesn't exist
      domainRecord = await prisma.domain.create({
        data: {
          tenantId,
          name: domain,
          status: 'active',
          autoDns: true,
          autoMail: false,
        },
      });
      logger.info('Created domain record', { domainId: domainRecord.id, domain });
    }

    // 3) Check if valid certificate already exists (idempotency)
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const existingCert = await prisma.sslCertificate.findFirst({
      where: {
        domainId: domainRecord.id,
        commonName: domain,
        status: 'active',
        validTo: { gt: sevenDaysFromNow }, // 7 days buffer
      },
    });

    if (existingCert) {
      logger.info('Valid SSL certificate already exists (idempotent skip)', {
        jobId,
        domain,
        certificateId: existingCert.id,
        validTo: existingCert.validTo,
      });
      return;
    }

    // 4) Validate DNS is pointing to correct IP
    const dnsValid = await validateDnsForSsl(domain, cloudPod.ip);
    
    if (!dnsValid) {
      logger.warn('DNS validation failed for SSL', {
        jobId,
        domain,
        expectedIp: cloudPod.ip,
      });
      
      // Mark as pending_dns and throw to trigger retry
      await createOrUpdateCertRecord({
        domainId: domainRecord.id,
        commonName: domain,
        tenantId,
        status: 'pending_dns',
      });
      
      throw new Error(`DNS not pointing to expected IP for ${domain}`);
    }

    // 5) Request certificate via SSH to Proxmox/container host
    const sshCmd = await getServerSshCommand(PROXMOX_HOST);
    
    await issueCertificateViaCaddy({
      sshCmd,
      domain,
      vmid: cloudPod.vmid,
      tenantId,
    });

    // 6) Update certificate record
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 90); // Let's Encrypt certs valid for 90 days

    await createOrUpdateCertRecord({
      domainId: domainRecord.id,
      commonName: domain,
      tenantId,
      status: 'active',
      issuer: "Let's Encrypt",
      validFrom,
      validTo,
    });

    // 7) Audit success
    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'SSL_CERTIFICATE_ISSUED',
      metadata: {
        jobId,
        cloudPodId,
        domain,
        validTo,
      },
    });

    logger.info('SSL certificate issued successfully', {
      jobId,
      domain,
      cloudPodId,
      validTo,
    });
  } catch (error) {
    logger.error('SSL certificate issuance failed', {
      jobId,
      cloudPodId,
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'SSL_ISSUE_FAILED',
      severity: 'error',
      metadata: {
        jobId,
        cloudPodId,
        domain,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Validate that domain DNS points to expected IP.
 */
async function validateDnsForSsl(domain: string, expectedIp: string): Promise<boolean> {
  const { promises: dns } = await import('dns');

  try {
    const addresses = await dns.resolve4(domain);
    return addresses.includes(expectedIp);
  } catch (error) {
    logger.debug('DNS lookup failed', { domain, error: (error as Error).message });
    return false;
  }
}

/**
 * Issue certificate using Caddy's automatic HTTPS.
 * P0.3 FIX: Uses runSshCommand with validated inputs.
 */
async function issueCertificateViaCaddy(params: {
  sshCmd: string;
  domain: string;
  vmid: number;
  tenantId: string;
}): Promise<void> {
  const { sshCmd, domain, vmid, tenantId } = params;

  // P0.3: Validate inputs
  const domainValidation = validateDomainName(domain);
  if (!domainValidation.valid) {
    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
      severity: 'error',
      metadata: { field: 'domain', error: domainValidation.error },
    });
    throw new Error(`Invalid domain: ${domainValidation.error}`);
  }

  const vmidValidation = validateVmid(vmid);
  if (!vmidValidation.valid) {
    throw new Error(`Invalid VMID: ${vmidValidation.error}`);
  }

  const proxmoxHost = process.env.PROXMOX_HOST ?? 'proxmox.local';
  const tailnetDomain = process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net';
  const targetHost = proxmoxHost.includes('.') ? proxmoxHost : `${proxmoxHost}.${tailnetDomain}`;
  const port = 8000 + vmid;

  // P0.3 FIX: Use a script or API instead of inline shell commands
  // Create Caddy config via a controlled script
  try {
    const result = await runSshCommand(
      targetHost,
      '/opt/migra-scripts/configure-caddy-ssl.sh',
      [domainValidation.sanitized!, vmidValidation.sanitized!, String(port)],
      { timeout: 180_000, tenantId }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Caddy SSL configuration failed: ${result.stderr}`);
    }
  } catch (error) {
    // Try certbot as fallback
    await issueCertificateViaCertbot({ sshCmd, domain: domainValidation.sanitized!, tenantId });
  }
}

/**
 * Issue certificate using certbot (fallback).
 * P0.3 FIX: Uses runSshCommand with validated inputs.
 */
async function issueCertificateViaCertbot(params: {
  sshCmd: string;
  domain: string;
  tenantId: string;
}): Promise<void> {
  const { sshCmd, domain, tenantId } = params;

  // P0.3: Validate domain
  const domainValidation = validateDomainName(domain);
  if (!domainValidation.valid) {
    throw new Error(`Invalid domain: ${domainValidation.error}`);
  }

  const proxmoxHost = process.env.PROXMOX_HOST ?? 'proxmox.local';
  const tailnetDomain = process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net';
  const targetHost = proxmoxHost.includes('.') ? proxmoxHost : `${proxmoxHost}.${tailnetDomain}`;
  const sslEmail = process.env.SSL_ADMIN_EMAIL ?? 'ssl@migra.cloud';

  // P0.3 FIX: Use argument array instead of string interpolation
  try {
    const result = await runSshCommand(
      targetHost,
      'certbot',
      [
        'certonly',
        '--webroot',
        '--webroot-path', '/var/www/html',
        '--domain', domainValidation.sanitized!,
        '--non-interactive',
        '--agree-tos',
        '--email', sslEmail,
        '--quiet',
      ],
      { timeout: 180_000, tenantId }
    );

    if (result.exitCode !== 0) {
      throw new Error(`Certificate issuance failed: ${result.stderr}`);
    }
  } catch (error) {
    throw new Error(`Certificate issuance failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Create or update SSL certificate record.
 * Schema-aligned: uses domainId, commonName, validFrom, validTo.
 */
async function createOrUpdateCertRecord(params: {
  domainId: string;
  commonName: string;
  tenantId: string;
  status: string;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
}): Promise<SslCertificateRecord> {
  const { domainId, commonName, tenantId, status, issuer, validFrom, validTo } = params;

  const existing = await prisma.sslCertificate.findFirst({
    where: { 
      domainId,
      commonName,
    },
  });

  if (existing) {
    const updated = await prisma.sslCertificate.update({
      where: { id: existing.id },
      data: {
        status,
        issuer: issuer ?? existing.issuer,
        validFrom: validFrom ?? existing.validFrom,
        validTo: validTo ?? existing.validTo,
      },
    });
    return updated;
  }

  const created = await prisma.sslCertificate.create({
    data: {
      domainId,
      commonName,
      tenantId,
      status,
      issuer: issuer ?? 'pending',
      validFrom: validFrom ?? new Date(),
      validTo: validTo ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  return created;
}

/**
 * Check for certificates expiring soon and renew them.
 * Called by a scheduled job.
 */
export async function renewExpiringCertificates(): Promise<void> {
  const renewalThreshold = new Date();
  renewalThreshold.setDate(renewalThreshold.getDate() + 14); // Renew 14 days before expiry

  const expiringCerts = await prisma.sslCertificate.findMany({
    where: {
      status: 'active',
      autoRenew: true,
      validTo: { lte: renewalThreshold },
    },
  });

  logger.info('Checking for expiring certificates', {
    count: expiringCerts.length,
  });

  const { enqueueIssueSslJob } = await import('../queue.js');

  for (const cert of expiringCerts) {
    // Look up Domain to get tenantId
    const domain = await prisma.domain.findUnique({
      where: { id: cert.domainId },
    });

    if (!domain) {
      logger.warn('Domain not found for expiring certificate', {
        certId: cert.id,
        domainId: cert.domainId,
      });
      continue;
    }

    // Find CloudPod for this domain/tenant (by hostname matching or other logic)
    // This is a simplified approach - in production you'd have proper linking
    const cloudPod = await prisma.cloudPod.findFirst({
      where: {
        tenantId: domain.tenantId,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!cloudPod) {
      logger.warn('No active CloudPod found for certificate renewal', {
        certId: cert.id,
        tenantId: domain.tenantId,
      });
      continue;
    }

    await enqueueIssueSslJob({
      tenantId: domain.tenantId,
      cloudPodId: cloudPod.id,
      domain: cert.commonName,
    });
  }
}

export default {
  processIssueSslJob,
  renewExpiringCertificates,
};
