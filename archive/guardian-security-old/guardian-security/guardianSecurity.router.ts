import express from 'express';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireTenantRole } from '../../middleware/rbac.middleware.js';
import * as controller from './guardianSecurity.controller.js';

const router = express.Router();

// Agent ingestion route (uses shared secret auth)
router.post('/agent-events', controller.ingestGuardianAgentEvent);

router.use(authMiddleware);

// Instance management
router.get(
  '/instances',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER', 'BILLING']),
  controller.listSecurityInstances
);

router.post(
  '/instances',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.createSecurityInstance
);

router.get(
  '/instances/:id',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER', 'BILLING', 'VIEWER']),
  controller.getSecurityInstance
);

router.patch(
  '/instances/:id',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.updateSecurityInstance
);

router.post(
  '/instances/:id/archive',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.archiveSecurityInstance
);

router.get(
  '/overview',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER', 'BILLING']),
  controller.getSecurityOverview
);

// Scan management
router.get(
  '/scans',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER']),
  controller.listSecurityScans
);

router.post(
  '/instances/:instanceId/scans',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.createSecurityScan
);

router.patch(
  '/scans/:scanId',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.updateSecurityScan
);

// Findings
router.get(
  '/findings',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER']),
  controller.listSecurityFindings
);

router.post(
  '/scans/:scanId/findings',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.createFindingForScan
);

router.patch(
  '/findings/:findingId',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.updateSecurityFinding
);

// Remediation tasks
router.get(
  '/remediation-tasks',
  requireTenantRole(['OWNER', 'ADMIN', 'MEMBER']),
  controller.listRemediationTasks
);

router.post(
  '/findings/:findingId/remediation-tasks',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.createRemediationTask
);

router.patch(
  '/remediation-tasks/:taskId',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.updateRemediationTask
);

// Audit events
router.get(
  '/audit-events',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.listSecurityAuditEvents
);

router.post(
  '/audit-events',
  requireTenantRole(['OWNER', 'ADMIN']),
  controller.recordSecurityAuditEvent
);

export default router;
