// src/routes/cloudPodRoutes.js
// ============================================================================
// Cloud Pods API Routes
// Uses the single source of truth from src/config/cloudPods.js
// 
// Plans: Student ($0/mo) | Starter ($1.49/mo) | Premium ($2.49/mo) | Business ($3.99/mo)
// ============================================================================

import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import logger from '../config/logger.js';
import {
  checkTenantQuota,
  getQuotaSummary,
  getTenantQuota,
  getTenantUsage,
} from '../services/cloudPodQuotas.js';
import {
  CLOUD_INFRA,
  CLOUD_POD_PLANS,
  POD_BACKUP_TIERS,
  POD_EMAIL_PLANS,
  getPodPlan,
  getPodBackupTier,
  getPodEmailPlan,
  getEnabledPodPlans,
  isValidPodPlanCode,
  buildCloudPodProvisioningIntent,
  buildPublicPlans,
  buildCompareTable,
  getPodResourcesSummary,
} from '../config/cloudPods.js';

const router = express.Router();

// ============================================================================
// Public Routes (for marketing site / checkout)
// ============================================================================

/**
 * GET /api/cloud-pods/plans
 * Get all available Cloud Pod plans (public DTO format)
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = buildPublicPlans();

    res.json({
      success: true,
      plans,
      tagline: 'Your own private server, at shared hosting prices.',
      features: [
        'Isolated container - no noisy neighbors',
        'Full SSH & SFTP access',
        'Pre-installed NGINX, PHP, MySQL',
        'Automated backups',
        'Email hosting included',
      ],
    });
  } catch (error) {
    logger.error('Error fetching Cloud Pod plans:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/cloud-pods/plans/:code
 * Get details for a specific plan
 */
router.get('/plans/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    if (!isValidPodPlanCode(code)) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }
    
    const plan = getPodPlan(code);
    const backupTier = getPodBackupTier(plan.defaultBackupTier);
    const emailPlan = getPodEmailPlan(plan.emailPlan);
    const summary = getPodResourcesSummary(code);
    
    // Format bandwidth
    const bandwidth = plan.bandwidthMode === 'UNMETERED'
      ? 'Unmetered'
      : `${plan.bandwidthGb} GB/mo`;
    
    res.json({
      success: true,
      plan: {
        code: plan.code,
        name: plan.name,
        label: plan.marketingLabel,
        pricePerMonth: plan.effectiveMonthlyPriceUsd,
        billingCycle: plan.billingCycle,
        billingCycleMonths: plan.billingCycleMonths,
        chargePerCycleUsd: plan.chargePerCycleUsd,
        resources: {
          vcpu: plan.vcpu,
          ramGb: plan.ramGb,
          diskGb: plan.diskGb,
          bandwidth,
        },
        limits: {
          websites: plan.websitesLimit,
          databases: plan.mysqlDatabasesLimit,
          mailboxes: plan.mailboxesLimit,
        },
        includes: {
          freeSsl: plan.includesFreeSsl,
          dailyBackups: plan.includesDailyBackups,
          freeMigrations: plan.includesFreeMigrations,
          prioritySupport: plan.includesPrioritySupport,
        },
        stack: plan.stack,
        backupTier,
        emailPlan,
        mainFeatures: plan.featureBullets,
        tags: plan.tags || [],
      },
      summary,
    });
  } catch (error) {
    logger.error('Error fetching Cloud Pod plan:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plan' });
  }
});

/**
 * GET /api/cloud-pods/compare
 * Get comparison table data for all plans
 */
router.get('/compare', async (req, res) => {
  try {
    const compareRows = buildCompareTable();
    const plans = buildPublicPlans();
    
    res.json({
      success: true,
      plans: plans.map(p => ({
        code: p.code,
        name: p.name,
        label: p.label,
        pricePerMonth: p.pricePerMonth,
        billingCycle: p.billingCycle,
        chargePerCycleUsd: p.chargePerCycleUsd,
      })),
      compareRows,
      features: [
        { key: 'Monthly price', type: 'price' },
        { key: 'Billing term', type: 'text' },
        { key: 'CPU', type: 'text' },
        { key: 'RAM', type: 'text' },
        { key: 'Storage', type: 'text' },
        { key: 'Bandwidth', type: 'text' },
        { key: 'Websites', type: 'text' },
        { key: 'MySQL databases', type: 'text' },
        { key: 'Mailboxes', type: 'text' },
        { key: 'Free SSL', type: 'boolean' },
        { key: 'Daily backups', type: 'boolean' },
        { key: 'Free migrations', type: 'boolean' },
        { key: 'Priority support', type: 'boolean' },
      ],
    });
  } catch (error) {
    logger.error('Error fetching comparison:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch comparison' });
  }
});

// ============================================================================
// Authenticated Routes (Customer Portal)
// ============================================================================

/**
 * GET /api/cloud-pods/my-pods
 * Get all Cloud Pods for the logged-in customer
 */
router.get('/my-pods', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cps.*, 
              c.email as customer_email, 
              c.full_name as customer_name
       FROM cloud_pod_subscriptions cps
       JOIN customers c ON cps.customer_id = c.id
       WHERE c.user_id = $1
       ORDER BY cps.created_at DESC`,
      [req.user.id]
    );
    
    const pods = result.rows.map(pod => ({
      id: pod.id,
      planCode: pod.plan_code,
      planName: pod.plan_name,
      primaryDomain: pod.primary_domain,
      status: pod.status,
      statusMessage: pod.status_message,
      resources: {
        vcpu: pod.vcpu,
        ramGb: pod.ram_gb,
        diskGb: pod.disk_gb,
      },
      vmId: pod.pod_vm_id,
      internalIp: pod.pod_internal_ip,
      publicIp: pod.pod_public_ip,
      backupTier: pod.backup_tier_code,
      emailPlan: pod.email_plan_code,
      provisionedAt: pod.provisioned_at,
      createdAt: pod.created_at,
    }));
    
    res.json({ success: true, pods });
  } catch (error) {
    logger.error('Error fetching customer pods:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pods' });
  }
});

/**
 * GET /api/cloud-pods/:podId
 * Get details for a specific Cloud Pod
 */
router.get('/:podId', authenticateToken, async (req, res) => {
  try {
    const { podId } = req.params;
    
    const result = await pool.query(
      `SELECT cps.*, 
              c.email as customer_email,
              c.user_id
       FROM cloud_pod_subscriptions cps
       JOIN customers c ON cps.customer_id = c.id
       WHERE cps.id = $1`,
      [podId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pod not found' });
    }
    
    const pod = result.rows[0];
    
    // Authorization check
    if (pod.user_id !== req.user.id && !['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    
    // Get recent events
    const eventsResult = await pool.query(
      `SELECT * FROM cloud_pod_events 
       WHERE cloud_pod_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [podId]
    );
    
    // Get recent backups
    const backupsResult = await pool.query(
      `SELECT * FROM cloud_pod_backups 
       WHERE cloud_pod_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [podId]
    );
    
    res.json({
      success: true,
      pod: {
        id: pod.id,
        planCode: pod.plan_code,
        planName: pod.plan_name,
        primaryDomain: pod.primary_domain,
        status: pod.status,
        statusMessage: pod.status_message,
        resources: {
          vcpu: pod.vcpu,
          ramGb: pod.ram_gb,
          diskGb: pod.disk_gb,
        },
        stack: pod.stack,
        vmId: pod.pod_vm_id,
        nodeName: pod.pod_node_name,
        internalIp: pod.pod_internal_ip,
        internalHostname: pod.pod_internal_hostname,
        publicIp: pod.pod_public_ip,
        backupTier: POD_BACKUP_TIERS[pod.backup_tier_code] || null,
        emailPlan: POD_EMAIL_PLANS[pod.email_plan_code] || null,
        provisionedAt: pod.provisioned_at,
        createdAt: pod.created_at,
      },
      events: eventsResult.rows,
      backups: backupsResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching pod details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pod details' });
  }
});

/**
 * POST /api/cloud-pods/order
 * Create a new Cloud Pod order (triggers provisioning)
 */
router.post('/order', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { planCode, primaryDomain } = req.body;
    
    // Validate plan
    if (!isValidPodPlanCode(planCode)) {
      return res.status(400).json({ success: false, error: 'Invalid plan code' });
    }
    
    const plan = getPodPlan(planCode);
    if (!plan.enabled) {
      return res.status(400).json({ success: false, error: 'Plan is not available' });
    }
    
    // Check tenant quota before creating the pod
    const tenantId = req.user.tenantId;
    if (tenantId) {
      const quotaResult = await checkTenantQuota({
        tenantId,
        requested: {
          pods: 1,
          cpuCores: plan.vcpu,
          memoryMb: plan.ramGb * 1024,
          diskGb: plan.diskGb,
        },
      });
      
      if (!quotaResult.allowed) {
        logger.warn('Cloud Pod order rejected: quota exceeded', {
          userId: req.user.id,
          tenantId,
          planCode,
          quotaDetails: quotaResult.details,
        });
        return res.status(403).json({
          success: false,
          error: 'QUOTA_EXCEEDED',
          message: quotaResult.message,
          details: quotaResult.details,
        });
      }
    }
    
    await client.query('BEGIN');
    
    // Get or create customer
    const customerResult = await client.query(
      `SELECT c.id FROM customers c WHERE c.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    
    let customerId;
    if (customerResult.rows.length === 0) {
      const newCustomer = await client.query(
        `INSERT INTO customers (user_id, email, full_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [req.user.id, req.user.email, req.user.full_name || req.user.email]
      );
      customerId = newCustomer.rows[0].id;
    } else {
      customerId = customerResult.rows[0].id;
    }
    
    // Create cloud pod subscription with new schema
    const podResult = await client.query(
      `INSERT INTO cloud_pod_subscriptions (
        customer_id, plan_code, plan_name, primary_domain,
        vcpu, ram_gb, disk_gb, bandwidth_mode, bandwidth_gb,
        stack, backup_tier_code, email_plan_code, status,
        billing_cycle, billing_cycle_months, charge_per_cycle_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PROVISIONING', $13, $14, $15)
      RETURNING *`,
      [
        customerId,
        plan.code,
        plan.marketingLabel,
        primaryDomain || null,
        plan.vcpu,
        plan.ramGb,
        plan.diskGb,
        plan.bandwidthMode,
        plan.bandwidthGb || null,
        JSON.stringify(plan.stack),
        plan.defaultBackupTier,
        plan.emailPlan,
        plan.billingCycle,
        plan.billingCycleMonths,
        plan.chargePerCycleUsd,
      ]
    );
    
    const pod = podResult.rows[0];
    
    // Build provisioning intent
    const intent = buildCloudPodProvisioningIntent({
      id: pod.id,
      customerId,
      planCode,
      primaryDomain,
    });
    
    // Create provisioning task
    await client.query(
      `INSERT INTO cloud_pod_provisioning_tasks (
        cloud_pod_id, task_type, intent, priority
      ) VALUES ($1, 'CREATE_CONTAINER', $2, 10)`,
      [pod.id, JSON.stringify(intent)]
    );
    
    // Log event
    await client.query(
      `INSERT INTO cloud_pod_events (cloud_pod_id, event_type, payload, triggered_by)
       VALUES ($1, 'CREATED', $2, $3)`,
      [pod.id, JSON.stringify({ planCode, primaryDomain }), req.user.id]
    );
    
    await client.query('COMMIT');
    
    logger.info(`Cloud Pod ordered: ${pod.id}`, {
      userId: req.user.id,
      planCode,
      primaryDomain,
    });
    
    res.status(201).json({
      success: true,
      message: 'Cloud Pod order created! Provisioning will begin shortly.',
      pod: {
        id: pod.id,
        planCode: pod.plan_code,
        planName: pod.plan_name,
        primaryDomain: pod.primary_domain,
        status: pod.status,
        pricePerMonth: plan.effectiveMonthlyPriceUsd,
        billingCycle: plan.billingCycle,
        chargePerCycleUsd: plan.chargePerCycleUsd,
        resources: {
          vcpu: pod.vcpu,
          ramGb: pod.ram_gb,
          diskGb: pod.disk_gb,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating Cloud Pod order:', error);
    res.status(500).json({ success: false, error: 'Failed to create order' });
  } finally {
    client.release();
  }
});

// ============================================================================
// Admin Routes
// ============================================================================

/**
 * GET /api/cloud-pods/admin/all
 * Get all Cloud Pods (admin only)
 */
router.get('/admin/all', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { status, planCode, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT cps.*, 
             c.email as customer_email,
             c.full_name as customer_name
      FROM cloud_pod_subscriptions cps
      JOIN customers c ON cps.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      query += ` AND cps.status = $${paramIndex++}`;
      params.push(status);
    }
    
    if (planCode) {
      query += ` AND cps.plan_code = $${paramIndex++}`;
      params.push(planCode);
    }
    
    query += ` ORDER BY cps.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM cloud_pod_subscriptions`
    );
    
    res.json({
      success: true,
      pods: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
      },
    });
  } catch (error) {
    logger.error('Error fetching all pods:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pods' });
  }
});

/**
 * GET /api/cloud-pods/admin/stats
 * Get Cloud Pod statistics - MRR calculated from new pricing
 */
router.get('/admin/stats', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    // Pods by status
    const statusStats = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM cloud_pod_subscriptions
      GROUP BY status
    `);
    
    // Pods by plan
    const planStats = await pool.query(`
      SELECT plan_code, COUNT(*) as count
      FROM cloud_pod_subscriptions
      WHERE status = 'ACTIVE'
      GROUP BY plan_code
    `);
    
    // MRR calculation with new pricing
    // Student: $0, Starter: $1.49, Premium: $2.49, Business: $3.99
    const mrrResult = await pool.query(`
      SELECT 
        SUM(CASE 
          WHEN plan_code = 'CLOUD_POD_STUDENT' THEN 0.00
          WHEN plan_code = 'CLOUD_POD_STARTER' THEN 1.49
          WHEN plan_code = 'CLOUD_POD_PREMIUM' THEN 2.49
          WHEN plan_code = 'CLOUD_POD_BUSINESS' THEN 3.99
          ELSE 0 
        END) as mrr
      FROM cloud_pod_subscriptions
      WHERE status = 'ACTIVE'
    `);
    
    // Recent provisioning
    const provisioningStats = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM cloud_pod_provisioning_tasks
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `);
    
    // Resource utilization
    const resourceStats = await pool.query(`
      SELECT 
        SUM(vcpu) as total_vcpu,
        SUM(ram_gb) as total_ram_gb,
        SUM(disk_gb) as total_disk_gb
      FROM cloud_pod_subscriptions
      WHERE status = 'ACTIVE'
    `);
    
    res.json({
      success: true,
      stats: {
        byStatus: statusStats.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        byPlan: planStats.rows.reduce((acc, row) => {
          acc[row.plan_code] = parseInt(row.count);
          return acc;
        }, {}),
        mrr: parseFloat(mrrResult.rows[0]?.mrr || 0),
        provisioning24h: provisioningStats.rows.reduce((acc, row) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        }, {}),
        resources: {
          totalVcpu: parseInt(resourceStats.rows[0]?.total_vcpu || 0),
          totalRamGb: parseInt(resourceStats.rows[0]?.total_ram_gb || 0),
          totalDiskGb: parseInt(resourceStats.rows[0]?.total_disk_gb || 0),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching pod stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * POST /api/cloud-pods/admin/:podId/suspend
 * Suspend a Cloud Pod
 */
router.post('/admin/:podId/suspend', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { podId } = req.params;
    const { reason } = req.body;
    
    const result = await pool.query(
      `UPDATE cloud_pod_subscriptions 
       SET status = 'SUSPENDED', status_message = $2, suspended_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [podId, reason || 'Suspended by admin']
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pod not found' });
    }
    
    // Log event
    await pool.query(
      `INSERT INTO cloud_pod_events (cloud_pod_id, event_type, payload, triggered_by)
       VALUES ($1, 'SUSPENDED', $2, $3)`,
      [podId, JSON.stringify({ reason }), req.user.id]
    );
    
    logger.info(`Cloud Pod suspended: ${podId}`, { userId: req.user.id, reason });
    
    res.json({ success: true, message: 'Pod suspended', pod: result.rows[0] });
  } catch (error) {
    logger.error('Error suspending pod:', error);
    res.status(500).json({ success: false, error: 'Failed to suspend pod' });
  }
});

/**
 * POST /api/cloud-pods/admin/:podId/resume
 * Resume a suspended Cloud Pod
 */
router.post('/admin/:podId/resume', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { podId } = req.params;
    
    const result = await pool.query(
      `UPDATE cloud_pod_subscriptions 
       SET status = 'ACTIVE', status_message = NULL, suspended_at = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'SUSPENDED'
       RETURNING *`,
      [podId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pod not found or not suspended' });
    }
    
    // Log event
    await pool.query(
      `INSERT INTO cloud_pod_events (cloud_pod_id, event_type, triggered_by)
       VALUES ($1, 'RESUMED', $2)`,
      [podId, req.user.id]
    );
    
    logger.info(`Cloud Pod resumed: ${podId}`, { userId: req.user.id });
    
    res.json({ success: true, message: 'Pod resumed', pod: result.rows[0] });
  } catch (error) {
    logger.error('Error resuming pod:', error);
    res.status(500).json({ success: false, error: 'Failed to resume pod' });
  }
});

/**
 * GET /api/cloud-pods/admin/provisioning-queue
 * Get provisioning queue status
 */
router.get('/admin/provisioning-queue', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, cps.plan_code, cps.primary_domain
      FROM cloud_pod_provisioning_tasks t
      JOIN cloud_pod_subscriptions cps ON t.cloud_pod_id = cps.id
      WHERE t.status IN ('PENDING', 'IN_PROGRESS', 'RETRYING')
      ORDER BY t.priority ASC, t.created_at ASC
      LIMIT 50
    `);
    
    const failedResult = await pool.query(`
      SELECT t.*, cps.plan_code, cps.primary_domain
      FROM cloud_pod_provisioning_tasks t
      JOIN cloud_pod_subscriptions cps ON t.cloud_pod_id = cps.id
      WHERE t.status = 'FAILED'
      ORDER BY t.updated_at DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      queue: result.rows,
      failed: failedResult.rows,
    });
  } catch (error) {
    logger.error('Error fetching provisioning queue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch queue' });
  }
});

// ============================================================================
// Quota Routes
// ============================================================================

/**
 * GET /api/cloud-pods/my-quota
 * Get quota summary for the logged-in user's tenant
 */
router.get('/my-quota', authenticateToken, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant associated with your account',
      });
    }
    
    const quotaSummary = await getQuotaSummary(tenantId);
    
    res.json({
      success: true,
      quota: quotaSummary,
    });
  } catch (error) {
    logger.error('Error fetching user quota:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch quota' });
  }
});

/**
 * GET /api/cloud-pods/tenants/:tenantId/quota
 * Get quota for a specific tenant (admin only)
 */
router.get('/tenants/:tenantId/quota', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }
    
    const quotaSummary = await getQuotaSummary(tenantId);
    
    res.json({
      success: true,
      tenantId,
      quota: quotaSummary,
    });
  } catch (error) {
    logger.error('Error fetching tenant quota:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch quota' });
  }
});

/**
 * POST /api/cloud-pods/tenants/:tenantId/quota
 * Update quota limits for a tenant (admin only)
 */
router.post('/tenants/:tenantId/quota', authenticateToken, requireRole('admin', 'super_admin'), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { maxPods, maxCpuCores, maxMemoryMb, maxDiskGb } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID is required' });
    }
    
    // Import prisma for the upsert
    const { prisma } = await import('../config/database.js');
    
    // Get current usage
    const usage = await getTenantUsage(tenantId);
    
    // Upsert quota with new limits
    const quota = await prisma.cloudPodQuota.upsert({
      where: { tenantId },
      update: {
        maxCloudPods: maxPods ?? undefined,
        maxCpuCores: maxCpuCores ?? undefined,
        maxRamMb: maxMemoryMb ?? undefined,
        maxDiskGb: maxDiskGb ?? undefined,
      },
      create: {
        tenantId,
        maxCloudPods: maxPods ?? 2,
        maxCpuCores: maxCpuCores ?? 4,
        maxRamMb: maxMemoryMb ?? 8192,
        maxDiskGb: maxDiskGb ?? 200,
        usedCloudPods: usage.pods,
        usedCpuCores: usage.cpuCores,
        usedRamMb: usage.memoryMb,
        usedDiskGb: usage.diskGb,
      },
    });
    
    logger.info(`Quota updated for tenant ${tenantId}`, {
      adminId: req.user.id,
      newLimits: { maxPods, maxCpuCores, maxMemoryMb, maxDiskGb },
    });
    
    res.json({
      success: true,
      message: 'Quota updated successfully',
      quota: {
        tenantId,
        maxPods: quota.maxCloudPods,
        maxCpuCores: quota.maxCpuCores,
        maxMemoryMb: quota.maxRamMb,
        maxDiskGb: quota.maxDiskGb,
      },
    });
  } catch (error) {
    logger.error('Error updating tenant quota:', error);
    res.status(500).json({ success: false, error: 'Failed to update quota' });
  }
});

/**
 * GET /api/cloud-pods/check-quota
 * Check if the user can create a pod with the given plan
 */
router.get('/check-quota', authenticateToken, async (req, res) => {
  try {
    const { planCode } = req.query;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant associated with your account',
      });
    }
    
    if (!planCode || !isValidPodPlanCode(planCode)) {
      return res.status(400).json({
        success: false,
        error: 'Valid plan code is required',
      });
    }
    
    const plan = getPodPlan(planCode);
    
    const quotaResult = await checkTenantQuota({
      tenantId,
      requested: {
        pods: 1,
        cpuCores: plan.vcpu,
        memoryMb: plan.ramGb * 1024,
        diskGb: plan.diskGb,
      },
    });
    
    res.json({
      success: true,
      canCreate: quotaResult.allowed,
      message: quotaResult.message || null,
      details: quotaResult.details,
    });
  } catch (error) {
    logger.error('Error checking quota:', error);
    res.status(500).json({ success: false, error: 'Failed to check quota' });
  }
});

export default router;
