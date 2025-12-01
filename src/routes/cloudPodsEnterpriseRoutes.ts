/**
 * CloudPods Enterprise Routes
 * API endpoints for enterprise CloudPods features:
 * - Audit Log
 * - Security Groups
 * - Health Monitoring
 * - Usage Metrics
 * - Backups
 * - Webhooks
 */

import { Router, Request, Response } from 'express';
import { CloudPodsAuditService, createAuditContext } from '../services/cloudPodsAuditService';
import { CloudPodsSecurityGroupsService } from '../services/cloudPodsSecurityGroupsService';
import { CloudPodsHealthService } from '../services/cloudPodsHealthService';
import { CloudPodsMetricsService } from '../services/cloudPodsMetricsService';
import { CloudPodsBackupService } from '../services/cloudPodsBackupService';
import { CloudPodsWebhookService } from '../services/cloudPodsWebhookService';
import { sshExec } from '../services/proxmoxSsh';
import type { CloudPodAuditCategory, CloudPodAuditAction } from '../services/cloudPodsEnterpriseTypes';

const router = Router();

// Extend Express Request to include tenant info
interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userId?: string;
}

// Helper to extract tenant context from request
function getTenantId(req: AuthenticatedRequest): string {
  const tenantId = req.tenantId || req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    throw new Error('Tenant ID required');
  }
  return tenantId;
}

// Helper to build audit context from request
function buildAuditContext(req: AuthenticatedRequest, podId?: string, vmid?: number) {
  return createAuditContext(
    getTenantId(req),
    {
      userId: req.userId,
      ip: req.ip,
      headers: req.headers as Record<string, string | string[] | undefined>,
    },
    podId,
    vmid
  );
}

// ============================================
// AUDIT LOG ROUTES
// ============================================

/**
 * GET /cloud-pods/audit
 * List audit log entries for tenant
 */
router.get('/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const {
      podId,
      category,
      action,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query;

    const result = await CloudPodsAuditService.list({
      tenantId,
      podId: podId as string | undefined,
      category: category as CloudPodAuditCategory | undefined,
      action: action as CloudPodAuditAction | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Audit list error:', err);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

/**
 * GET /cloud-pods/:podId/audit
 * List audit log for a specific pod
 */
router.get('/:podId/audit', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { podId } = req.params;
    const { limit, offset } = req.query;

    const result = await CloudPodsAuditService.getPodAuditLog(
      tenantId,
      podId,
      {
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      }
    );

    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod audit error:', err);
    res.status(500).json({ error: 'Failed to fetch pod audit log' });
  }
});

// ============================================
// SECURITY GROUPS ROUTES
// ============================================

/**
 * GET /cloud-pods/security-groups
 * List all security groups for tenant
 */
router.get('/security-groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const securityGroups = await CloudPodsSecurityGroupsService.listSecurityGroups(tenantId);
    res.json(securityGroups);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Security groups list error:', err);
    res.status(500).json({ error: 'Failed to fetch security groups' });
  }
});

/**
 * POST /cloud-pods/security-groups
 * Create a new security group
 */
router.post('/security-groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { name, description, isDefault, rules } = req.body;

    const securityGroup = await CloudPodsSecurityGroupsService.createSecurityGroup(
      { tenantId, name, description, isDefault, rules },
      buildAuditContext(req)
    );

    res.status(201).json(securityGroup);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Security group create error:', err);
    res.status(500).json({ error: 'Failed to create security group' });
  }
});

/**
 * GET /cloud-pods/security-groups/:id
 * Get a specific security group
 */
router.get('/security-groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const securityGroup = await CloudPodsSecurityGroupsService.getSecurityGroup(id, tenantId);
    if (!securityGroup) {
      return res.status(404).json({ error: 'Security group not found' });
    }

    res.json(securityGroup);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Security group get error:', err);
    res.status(500).json({ error: 'Failed to fetch security group' });
  }
});

/**
 * PUT /cloud-pods/security-groups/:id
 * Update a security group
 */
router.put('/security-groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { name, description, isDefault, rules } = req.body;

    const securityGroup = await CloudPodsSecurityGroupsService.updateSecurityGroup(
      id,
      tenantId,
      { name, description, isDefault, rules },
      buildAuditContext(req)
    );

    res.json(securityGroup);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Security group update error:', err);
    res.status(500).json({ error: 'Failed to update security group' });
  }
});

/**
 * DELETE /cloud-pods/security-groups/:id
 * Delete a security group
 */
router.delete('/security-groups/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    await CloudPodsSecurityGroupsService.deleteSecurityGroup(id, tenantId, buildAuditContext(req));
    res.json({ success: true });
  } catch (err) {
    console.error('[CloudPodsEnterprise] Security group delete error:', err);
    res.status(500).json({ error: 'Failed to delete security group' });
  }
});

/**
 * GET /cloud-pods/:podId/security-groups
 * Get security groups assigned to a pod
 */
router.get('/:podId/security-groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { podId } = req.params;

    const securityGroups = await CloudPodsSecurityGroupsService.getPodSecurityGroups(podId, tenantId);
    res.json(securityGroups);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod security groups error:', err);
    res.status(500).json({ error: 'Failed to fetch pod security groups' });
  }
});

/**
 * PUT /cloud-pods/:podId/security-groups
 * Set security groups for a pod
 */
router.put('/:podId/security-groups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { podId } = req.params;
    const { securityGroupIds } = req.body;

    const securityGroups = await CloudPodsSecurityGroupsService.setPodSecurityGroups(
      podId,
      tenantId,
      securityGroupIds,
      buildAuditContext(req, podId)
    );

    res.json(securityGroups);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Set pod security groups error:', err);
    res.status(500).json({ error: 'Failed to set pod security groups' });
  }
});

// ============================================
// HEALTH MONITORING ROUTES
// ============================================

/**
 * GET /cloud-pods/:podId/health
 * Get health status for a pod
 */
router.get('/:podId/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const health = await CloudPodsHealthService.getPodHealth(podId);

    if (!health) {
      return res.status(404).json({ error: 'Health status not found' });
    }

    res.json(health);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod health error:', err);
    res.status(500).json({ error: 'Failed to fetch pod health' });
  }
});

/**
 * GET /cloud-pods/health
 * Get health status for all tenant pods
 */
router.get('/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const health = await CloudPodsHealthService.getTenantPodsHealth(tenantId);
    res.json(health);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Tenant health error:', err);
    res.status(500).json({ error: 'Failed to fetch tenant health' });
  }
});

// ============================================
// METRICS ROUTES
// ============================================

/**
 * GET /cloud-pods/:podId/metrics
 * Get metrics for a pod
 */
router.get('/:podId/metrics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const { limit, startDate, endDate } = req.query;

    const metrics = await CloudPodsMetricsService.getPodMetrics(podId, {
      limit: limit ? parseInt(limit as string, 10) : 100,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(metrics);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch pod metrics' });
  }
});

/**
 * GET /cloud-pods/:podId/metrics/daily
 * Get daily aggregated metrics for a pod
 */
router.get('/:podId/metrics/daily', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const { startDate, endDate } = req.query;

    const metrics = await CloudPodsMetricsService.getPodDailyMetrics(podId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });

    res.json(metrics);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod daily metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch pod daily metrics' });
  }
});

/**
 * GET /cloud-pods/usage-summary
 * Get usage summary for tenant
 */
router.get('/usage-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const summary = await CloudPodsMetricsService.getTenantUsageSummary(tenantId, start, end);
    res.json(summary);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Usage summary error:', err);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

// ============================================
// BACKUP ROUTES
// ============================================

/**
 * GET /cloud-pods/:podId/backups
 * List backups for a pod
 */
router.get('/:podId/backups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const backups = await CloudPodsBackupService.listBackupsForPod(podId);
    res.json(backups);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod backups error:', err);
    res.status(500).json({ error: 'Failed to fetch pod backups' });
  }
});

/**
 * POST /cloud-pods/:podId/backup
 * Trigger a backup for a pod
 */
router.post('/:podId/backup', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { podId } = req.params;
    const { policyId, backupType = 'snapshot' } = req.body;

    const backup = await CloudPodsBackupService.triggerBackup(
      podId,
      tenantId,
      policyId,
      backupType,
      sshExec,
      buildAuditContext(req, podId)
    );

    res.status(201).json(backup);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Trigger backup error:', err);
    res.status(500).json({ error: 'Failed to trigger backup' });
  }
});

/**
 * POST /cloud-pods/backups/:backupId/restore
 * Restore from a backup
 */
router.post('/backups/:backupId/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backupId } = req.params;
    const result = await CloudPodsBackupService.restoreBackup(
      backupId,
      sshExec,
      buildAuditContext(req)
    );

    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Restore backup error:', err);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

/**
 * DELETE /cloud-pods/backups/:backupId
 * Delete a backup
 */
router.delete('/backups/:backupId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { backupId } = req.params;
    const result = await CloudPodsBackupService.deleteBackup(
      backupId,
      sshExec,
      buildAuditContext(req)
    );

    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Delete backup error:', err);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
});

/**
 * GET /cloud-pods/:podId/backup-policies
 * List backup policies for a pod
 */
router.get('/:podId/backup-policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { podId } = req.params;
    const policies = await CloudPodsBackupService.listPoliciesForPod(podId);
    res.json(policies);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Pod backup policies error:', err);
    res.status(500).json({ error: 'Failed to fetch backup policies' });
  }
});

/**
 * GET /cloud-pods/backup-policies
 * List all backup policies for tenant
 */
router.get('/backup-policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const policies = await CloudPodsBackupService.listPoliciesForTenant(tenantId);
    res.json(policies);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Backup policies error:', err);
    res.status(500).json({ error: 'Failed to fetch backup policies' });
  }
});

/**
 * POST /cloud-pods/backup-policies
 * Create a backup policy
 */
router.post('/backup-policies', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { podId, name, schedule, retentionCount, type, isActive } = req.body;

    const policy = await CloudPodsBackupService.createPolicy(
      { tenantId, podId, name, schedule, retentionCount, type, isActive },
      buildAuditContext(req, podId)
    );

    res.status(201).json(policy);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Create backup policy error:', err);
    res.status(500).json({ error: 'Failed to create backup policy' });
  }
});

/**
 * PUT /cloud-pods/backup-policies/:id
 * Update a backup policy
 */
router.put('/backup-policies/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, schedule, retentionCount, type, isActive } = req.body;

    const policy = await CloudPodsBackupService.updatePolicy(
      id,
      { name, schedule, retentionCount, type, isActive },
      buildAuditContext(req)
    );

    res.json(policy);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Update backup policy error:', err);
    res.status(500).json({ error: 'Failed to update backup policy' });
  }
});

/**
 * DELETE /cloud-pods/backup-policies/:id
 * Delete a backup policy
 */
router.delete('/backup-policies/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await CloudPodsBackupService.deletePolicy(id, buildAuditContext(req));
    res.json({ success: true });
  } catch (err) {
    console.error('[CloudPodsEnterprise] Delete backup policy error:', err);
    res.status(500).json({ error: 'Failed to delete backup policy' });
  }
});

// ============================================
// WEBHOOK ROUTES
// ============================================

/**
 * GET /cloud-pods/webhooks
 * List webhooks for tenant
 */
router.get('/webhooks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const webhooks = await CloudPodsWebhookService.listWebhooks(tenantId);
    res.json(webhooks);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Webhooks list error:', err);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

/**
 * POST /cloud-pods/webhooks
 * Create a webhook
 */
router.post('/webhooks', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { name, url, secret, events, isActive } = req.body;

    const webhook = await CloudPodsWebhookService.createWebhook({
      tenantId,
      name,
      url,
      secret,
      events,
      isActive,
    });

    res.status(201).json(webhook);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Create webhook error:', err);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

/**
 * GET /cloud-pods/webhooks/:id
 * Get a webhook with delivery history
 */
router.get('/webhooks/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const webhook = await CloudPodsWebhookService.getWebhook(id, tenantId);
    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json(webhook);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Get webhook error:', err);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

/**
 * PUT /cloud-pods/webhooks/:id
 * Update a webhook
 */
router.put('/webhooks/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const { name, url, secret, events, isActive } = req.body;

    const webhook = await CloudPodsWebhookService.updateWebhook(id, tenantId, {
      tenantId,
      name,
      url,
      secret,
      events,
      isActive,
    });

    res.json(webhook);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Update webhook error:', err);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

/**
 * DELETE /cloud-pods/webhooks/:id
 * Delete a webhook
 */
router.delete('/webhooks/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    await CloudPodsWebhookService.deleteWebhook(id, tenantId);
    res.json({ success: true });
  } catch (err) {
    console.error('[CloudPodsEnterprise] Delete webhook error:', err);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

/**
 * POST /cloud-pods/webhooks/:id/test
 * Test a webhook
 */
router.post('/webhooks/:id/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;

    const result = await CloudPodsWebhookService.testWebhook(id, tenantId);
    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Test webhook error:', err);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

/**
 * GET /cloud-pods/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get('/webhooks/:id/deliveries', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = req.query;

    const history = await CloudPodsWebhookService.getDeliveryHistory(id, {
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json(history);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Webhook deliveries error:', err);
    res.status(500).json({ error: 'Failed to fetch delivery history' });
  }
});

/**
 * POST /cloud-pods/webhook-deliveries/:deliveryId/retry
 * Retry a failed webhook delivery
 */
router.post('/webhook-deliveries/:deliveryId/retry', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { deliveryId } = req.params;
    const result = await CloudPodsWebhookService.retryDelivery(deliveryId);
    res.json(result);
  } catch (err) {
    console.error('[CloudPodsEnterprise] Retry delivery error:', err);
    res.status(500).json({ error: 'Failed to retry delivery' });
  }
});

export default router;
