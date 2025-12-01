/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * SSL Certificate Worker - Issues SSL certificates via Let's Encrypt.
 * 
 * Uses Caddy or certbot for certificate issuance.
 */

import { prisma } from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';
import { getServerSshCommand } from '../serverSelectionService.js';
import type { IssueSslJobPayload } from '../queue.js';

// ============================================
// TYPES
// ============================================

interface SslCertificate {
  id: string;
  cloudPodId: string;
  domain: string;
  issuer: string;
  status: string;
  expiresAt: Date | null;
}

// ============================================
// MAIN WORKER
// ============================================

/**
 * Process an ISSUE_SSL job.
 * 
 * Flow:
 * 1. Validate domain ownership (DNS pointing to our IP)
 * 2. Request certificate from Let's Encrypt
 * 3. Deploy certificate to container
 * 4. Update database record
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
      include: {
        server: {
          select: { hostname: true, ipv4: true },
        },
      },
    });

    if (!cloudPod) {
      throw new Error(`CloudPod not found: ${cloudPodId}`);
    }

    if (!cloudPod.server) {
      throw new Error(`CloudPod ${cloudPodId} has no associated server`);
    }

    // 2) Check if certificate already exists and is valid
    const existingCert = await prisma.sslCertificate.findFirst({
      where: {
        cloudPodId,
        domain,
        status: 'ACTIVE',
        expiresAt: { gt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, // 7 days buffer
      },
    });

    if (existingCert) {
      logger.info('Valid SSL certificate already exists', {
        jobId,
        domain,
        certificateId: existingCert.id,
        expiresAt: existingCert.expiresAt,
      });
      return;
    }

    // 3) Validate DNS is pointing to correct IP
    const dnsValid = await validateDnsForSsl(domain, cloudPod.ipv4 ?? cloudPod.server.ipv4);
    
    if (!dnsValid) {
      logger.warn('DNS validation failed for SSL', {
        jobId,
        domain,
        expectedIp: cloudPod.ipv4 ?? cloudPod.server.ipv4,
      });
      
      // Don't throw - DNS might propagate later
      // Mark as pending and let retry handle it
      await createOrUpdateCertRecord({
        cloudPodId,
        domain,
        tenantId,
        status: 'PENDING_DNS',
      });
      
      throw new Error(`DNS not pointing to expected IP for ${domain}`);
    }

    // 4) Request certificate
    const sshCmd = await getServerSshCommand(cloudPod.server.hostname);
    
    await issueCertificateViaCaddy({
      sshCmd,
      domain,
      vmid: cloudPod.vmid,
    });

    // 5) Update certificate record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // Let's Encrypt certs valid for 90 days

    await createOrUpdateCertRecord({
      cloudPodId,
      domain,
      tenantId,
      status: 'ACTIVE',
      issuer: "Let's Encrypt",
      expiresAt,
    });

    // 6) Audit success
    await writeAuditEvent({
      actorUserId: null,
      tenantId,
      type: 'SSL_CERTIFICATE_ISSUED',
      metadata: {
        jobId,
        cloudPodId,
        domain,
        expiresAt,
      },
    });

    logger.info('SSL certificate issued successfully', {
      jobId,
      domain,
      cloudPodId,
      expiresAt,
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
 */
async function issueCertificateViaCaddy(params: {
  sshCmd: string;
  domain: string;
  vmid: number;
}): Promise<void> {
  const { sshCmd, domain, vmid } = params;
  const { execSync } = await import('child_process');

  // Caddy automatically obtains certificates when you add a site
  // This updates the Caddyfile and reloads
  const caddyCommand = `
    cat >> /etc/caddy/sites/${vmid}.conf << 'EOF'
${domain} {
    reverse_proxy localhost:${8000 + vmid}
    tls {
        on_demand
    }
}
EOF
    caddy reload --config /etc/caddy/Caddyfile
  `.trim();

  try {
    execSync(`${sshCmd} '${caddyCommand}'`, {
      timeout: 180_000, // 3 minutes for cert issuance
      encoding: 'utf-8',
    });
  } catch (error) {
    // Try certbot as fallback
    await issueCertificateViaCertbot({ sshCmd, domain });
  }
}

/**
 * Issue certificate using certbot (fallback).
 */
async function issueCertificateViaCertbot(params: {
  sshCmd: string;
  domain: string;
}): Promise<void> {
  const { sshCmd, domain } = params;
  const { execSync } = await import('child_process');

  const certbotCommand = `
    certbot certonly \\
      --webroot \\
      --webroot-path /var/www/html \\
      --domain ${domain} \\
      --non-interactive \\
      --agree-tos \\
      --email ssl@migra.cloud \\
      --quiet
  `.trim();

  try {
    execSync(`${sshCmd} '${certbotCommand}'`, {
      timeout: 180_000,
      encoding: 'utf-8',
    });
  } catch (error) {
    throw new Error(`Certificate issuance failed for ${domain}: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
}

/**
 * Create or update SSL certificate record.
 */
async function createOrUpdateCertRecord(params: {
  cloudPodId: string;
  domain: string;
  tenantId: string;
  status: string;
  issuer?: string;
  expiresAt?: Date;
}): Promise<SslCertificate> {
  const { cloudPodId, domain, tenantId, status, issuer, expiresAt } = params;

  const existing = await prisma.sslCertificate.findFirst({
    where: { cloudPodId, domain },
  });

  if (existing) {
    const updated = await prisma.sslCertificate.update({
      where: { id: existing.id },
      data: {
        status,
        issuer: issuer ?? existing.issuer,
        expiresAt: expiresAt ?? existing.expiresAt,
        updatedAt: new Date(),
      },
    });
    return updated as SslCertificate;
  }

  const created = await prisma.sslCertificate.create({
    data: {
      cloudPodId,
      domain,
      tenantId,
      status,
      issuer: issuer ?? 'pending',
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return created as SslCertificate;
}

/**
 * Check for certificates expiring soon and renew them.
 * Called by a scheduled job.
 */
export async function renewExpiringCertificates(): Promise<void> {
  const expiringThreshold = new Date();
  expiringThreshold.setDate(expiringThreshold.getDate() + 14); // Renew 14 days before expiry

  const expiringCerts = await prisma.sslCertificate.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { lte: expiringThreshold },
    },
    include: {
      cloudPod: {
        select: { tenantId: true },
      },
    },
  });

  logger.info('Checking for expiring certificates', {
    count: expiringCerts.length,
  });

  const { enqueueIssueSslJob } = await import('../queue.js');

  for (const cert of expiringCerts) {
    await enqueueIssueSslJob({
      tenantId: cert.cloudPod.tenantId,
      cloudPodId: cert.cloudPodId,
      domain: cert.domain,
    });
  }
}

export default {
  processIssueSslJob,
  renewExpiringCertificates,
};
