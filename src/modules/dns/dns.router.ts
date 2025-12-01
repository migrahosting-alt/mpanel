/**
 * DNS Router - Enterprise-grade DNS Management Routes
 * 
 * P0.2 FIX (Enterprise Hardening):
 * - ALL routes require authentication (authMiddleware)
 * - RBAC enforced: OWNER/ADMIN = full access, BILLING = read-only, MEMBER/VIEWER = no access
 * - Multi-tenant safety: ALL queries filter by tenantId from JWT
 * - No cross-tenant DNS access
 * 
 * RBAC Rules:
 * - dns:read  → BILLING, ADMIN, OWNER (GET routes)
 * - dns:write → ADMIN, OWNER (POST, PUT, DELETE routes)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../auth/index.js';
import dnsService from './dns.service.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';
import { prisma } from '../../config/database.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';

const router = Router();

// ============================================
// ALL DNS ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authMiddleware);

// ============================================
// HELPER MIDDLEWARE
// ============================================

/**
 * Middleware to extract tenant context from authenticated request.
 */
function extractTenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.user?.tenantId) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'No tenant context available',
    });
    return;
  }
  
  // Attach tenantId for easy access
  (req as any).tenantId = authReq.user.tenantId;
  (req as any).userId = authReq.user.userId;
  
  next();
}

// Apply tenant context extraction to all routes
router.use(extractTenantContext);

// ============================================
// READ ROUTES (BILLING+ can access)
// ============================================

/**
 * GET /api/v1/dns/domains
 * 
 * List all domains for the current tenant.
 * Requires: BILLING role or above
 */
router.get(
  '/domains',
  requireRole('BILLING'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;

      const domains = await prisma.domain.findMany({
        where: {
          tenantId,
        },
        orderBy: { name: 'asc' },
      });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_DOMAINS_LISTED',
        metadata: { count: domains.length },
      });

      res.json({
        success: true,
        data: domains,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/dns/domains/:domainId
 * 
 * Get a specific domain with its DNS zone.
 * Requires: BILLING role or above
 */
router.get(
  '/domains/:domainId',
  requireRole('BILLING'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { domainId } = req.params;

      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          tenantId, // CRITICAL: Tenant isolation
        },
        include: {
          dnsZones: {
            include: {
              records: true,
            },
          },
        },
      });

      if (!domain) {
        res.status(404).json({
          error: 'Not found',
          message: 'Domain not found or access denied',
        });
        return;
      }

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_DOMAIN_VIEWED',
        metadata: { domainId, domainName: domain.name },
      });

      res.json({
        success: true,
        data: domain,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/dns/domains/:domainId/records
 * 
 * Get DNS records for a domain.
 * Requires: BILLING role or above
 */
router.get(
  '/domains/:domainId/records',
  requireRole('BILLING'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const { domainId } = req.params;

      // Verify domain belongs to tenant
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!domain) {
        res.status(404).json({
          error: 'Not found',
          message: 'Domain not found or access denied',
        });
        return;
      }

      const records = await dnsService.getDnsRecordsForDomain(tenantId, domain.name);

      res.json({
        success: true,
        data: records,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/dns/zones/:zoneId
 * 
 * Get a specific DNS zone.
 * Requires: BILLING role or above
 */
router.get(
  '/zones/:zoneId',
  requireRole('BILLING'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const { zoneId } = req.params;

      const zone = await prisma.dnsZone.findFirst({
        where: {
          id: zoneId,
          tenantId, // CRITICAL: Tenant isolation
        },
        include: {
          domain: true,
          records: {
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
          },
        },
      });

      if (!zone) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS zone not found or access denied',
        });
        return;
      }

      res.json({
        success: true,
        data: zone,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// WRITE ROUTES (ADMIN+ only)
// ============================================

/**
 * POST /api/v1/dns/domains
 * 
 * Create a new domain.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - name: string (required)
 * - autoDns: boolean (default: true)
 * - autoMail: boolean (default: false)
 */
router.post(
  '/domains',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { name, autoDns = true, autoMail = false } = req.body;

      if (!name || typeof name !== 'string') {
        res.status(400).json({
          error: 'Bad request',
          message: 'Domain name is required',
        });
        return;
      }

      const result = await dnsService.ensureDomain({
        tenantId,
        name,
        autoDns,
        autoMail,
      });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: result.created ? 'DNS_DOMAIN_CREATED' : 'DNS_DOMAIN_VERIFIED',
        metadata: {
          domainId: result.domain.id,
          domainName: result.domain.name,
          created: result.created,
        },
      });

      res.status(result.created ? 201 : 200).json({
        success: true,
        data: result.domain,
        created: result.created,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already registered')) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message,
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * POST /api/v1/dns/domains/:domainId/zones
 * 
 * Provision a DNS zone for a domain.
 * Requires: ADMIN role or above
 */
router.post(
  '/domains/:domainId/zones',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { domainId } = req.params;

      // Verify domain belongs to tenant
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!domain) {
        res.status(404).json({
          error: 'Not found',
          message: 'Domain not found or access denied',
        });
        return;
      }

      await dnsService.provisionDnsZone({
        tenantId,
        domainId,
        domainName: domain.name,
      });

      // Fetch the created zone
      const zone = await dnsService.getDnsZone(tenantId, domainId);

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_ZONE_PROVISIONED',
        metadata: {
          domainId,
          domainName: domain.name,
          zoneId: zone?.id,
        },
      });

      logger.info('DNS zone provisioned', {
        domainId,
        domainName: domain.name,
        userId,
      });

      res.status(201).json({
        success: true,
        data: zone,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/dns/zones/:zoneId/records
 * 
 * Create a DNS record in a zone.
 * Requires: ADMIN role or above
 * 
 * Body:
 * - name: string (required)
 * - type: string (required) - A, AAAA, CNAME, MX, TXT, NS, SRV
 * - content: string (required)
 * - ttl: number (default: 3600)
 * - priority: number (for MX records)
 */
router.post(
  '/zones/:zoneId/records',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { zoneId } = req.params;
      const { name, type, content, ttl = 3600, priority } = req.body;

      // Verify zone belongs to tenant
      const zone = await prisma.dnsZone.findFirst({
        where: {
          id: zoneId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!zone) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS zone not found or access denied',
        });
        return;
      }

      // Validate required fields
      if (!name || !type || !content) {
        res.status(400).json({
          error: 'Bad request',
          message: 'name, type, and content are required',
        });
        return;
      }

      // Validate record type
      const validTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV'];
      if (!validTypes.includes(type.toUpperCase())) {
        res.status(400).json({
          error: 'Bad request',
          message: `Invalid record type. Valid types: ${validTypes.join(', ')}`,
        });
        return;
      }

      const record = await prisma.dnsRecord.create({
        data: {
          zoneId,
          name,
          type: type.toUpperCase(),
          content,
          ttl,
          priority: type.toUpperCase() === 'MX' ? priority : null,
        },
      });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_RECORD_CREATED',
        metadata: {
          zoneId,
          recordId: record.id,
          name,
          type,
          content,
        },
      });

      logger.info('DNS record created', {
        zoneId,
        recordId: record.id,
        userId,
      });

      res.status(201).json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/dns/zones/:zoneId/records/:recordId
 * 
 * Update a DNS record.
 * Requires: ADMIN role or above
 */
router.put(
  '/zones/:zoneId/records/:recordId',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { zoneId, recordId } = req.params;
      const { name, type, content, ttl, priority } = req.body;

      // Verify zone belongs to tenant
      const zone = await prisma.dnsZone.findFirst({
        where: {
          id: zoneId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!zone) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS zone not found or access denied',
        });
        return;
      }

      // Verify record belongs to zone
      const existingRecord = await prisma.dnsRecord.findFirst({
        where: {
          id: recordId,
          zoneId,
        },
      });

      if (!existingRecord) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS record not found',
        });
        return;
      }

      const record = await prisma.dnsRecord.update({
        where: { id: recordId },
        data: {
          name: name ?? existingRecord.name,
          type: type ? type.toUpperCase() : existingRecord.type,
          content: content ?? existingRecord.content,
          ttl: ttl ?? existingRecord.ttl,
          priority: priority ?? existingRecord.priority,
        },
      });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_RECORD_UPDATED',
        metadata: {
          zoneId,
          recordId,
          changes: { name, type, content, ttl, priority },
        },
      });

      logger.info('DNS record updated', {
        zoneId,
        recordId,
        userId,
      });

      res.json({
        success: true,
        data: record,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/dns/zones/:zoneId/records/:recordId
 * 
 * Delete a DNS record.
 * Requires: ADMIN role or above
 */
router.delete(
  '/zones/:zoneId/records/:recordId',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { zoneId, recordId } = req.params;

      // Verify zone belongs to tenant
      const zone = await prisma.dnsZone.findFirst({
        where: {
          id: zoneId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!zone) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS zone not found or access denied',
        });
        return;
      }

      // Verify record belongs to zone
      const existingRecord = await prisma.dnsRecord.findFirst({
        where: {
          id: recordId,
          zoneId,
        },
      });

      if (!existingRecord) {
        res.status(404).json({
          error: 'Not found',
          message: 'DNS record not found',
        });
        return;
      }

      await prisma.dnsRecord.delete({
        where: { id: recordId },
      });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_RECORD_DELETED',
        metadata: {
          zoneId,
          recordId,
          name: existingRecord.name,
          type: existingRecord.type,
        },
      });

      logger.info('DNS record deleted', {
        zoneId,
        recordId,
        userId,
      });

      res.json({
        success: true,
        message: 'DNS record deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/dns/domains/:domainId
 * 
 * Delete a domain and all its DNS data.
 * Requires: OWNER role (destructive operation)
 */
router.delete(
  '/domains/:domainId',
  requireRole('OWNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenantId;
      const userId = (req as any).userId;
      const { domainId } = req.params;

      // Verify domain belongs to tenant
      const domain = await prisma.domain.findFirst({
        where: {
          id: domainId,
          tenantId, // CRITICAL: Tenant isolation
        },
      });

      if (!domain) {
        res.status(404).json({
          error: 'Not found',
          message: 'Domain not found or access denied',
        });
        return;
      }

      // Delete DNS records, zones, then domain (cascade)
      const zones = await prisma.dnsZone.findMany({
        where: { domainId },
        select: { id: true },
      });

      for (const zone of zones) {
        await prisma.dnsRecord.deleteMany({ where: { zoneId: zone.id } });
      }

      await prisma.dnsZone.deleteMany({ where: { domainId } });
      await prisma.domain.delete({ where: { id: domainId } });

      await writeAuditEvent({
        actorUserId: userId,
        tenantId,
        type: 'DNS_DOMAIN_DELETED',
        metadata: {
          domainId,
          domainName: domain.name,
          zonesDeleted: zones.length,
        },
      });

      logger.info('Domain deleted', {
        domainId,
        domainName: domain.name,
        userId,
      });

      res.json({
        success: true,
        message: 'Domain and all DNS data deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
