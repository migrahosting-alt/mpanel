import express from 'express';
const router = express.Router();
import complianceService from '../services/complianceService.js';
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * Compliance & Audit System Routes
 * 
 * Endpoints for SOC2, ISO27001, GDPR, HIPAA, PCI DSS compliance
 */

// Middleware - all routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/compliance/audit-log
 * @desc    Log audit event
 * @access  Private
 */
router.post('/audit-log', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const eventData = {
      tenantId,
      userId,
      ...req.body,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };

    const auditEntry = await complianceService.logAuditEvent(eventData);
    res.json(auditEntry);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/audit-integrity
 * @desc    Verify audit trail integrity
 * @access  Admin only
 */
router.get('/audit-integrity', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const verification = await complianceService.verifyAuditIntegrity(tenantId);
    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/compliance/data-lineage
 * @desc    Track data lineage (GDPR requirement)
 * @access  Private
 */
router.post('/data-lineage', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const lineageData = {
      tenantId,
      userId,
      ...req.body
    };

    const lineage = await complianceService.trackDataLineage(lineageData);
    res.json(lineage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/data-lineage/:dataType/:dataId
 * @desc    Get data lineage history
 * @access  Private
 */
router.get('/data-lineage/:dataType/:dataId', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { dataType, dataId } = req.params;

    const lineage = await complianceService.getDataLineage(tenantId, dataType, dataId);
    res.json(lineage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/encryption-status
 * @desc    Verify encryption at rest compliance
 * @access  Admin only
 */
router.get('/encryption-status', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const status = await complianceService.verifyEncryption(tenantId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/compliance/reports
 * @desc    Generate compliance report
 * @access  Admin only
 */
router.post('/reports', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { framework, startDate, endDate } = req.body;

    if (!['SOC2', 'ISO27001', 'GDPR', 'HIPAA', 'PCI_DSS'].includes(framework)) {
      return res.status(400).json({ error: 'Invalid framework' });
    }

    const report = await complianceService.generateComplianceReport(
      tenantId,
      framework,
      new Date(startDate),
      new Date(endDate)
    );

    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/reports
 * @desc    List compliance reports
 * @access  Admin only
 */
router.get('/reports', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { framework, limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT id, framework, start_date, end_date, status, created_at
       FROM compliance_reports
       WHERE tenant_id = $1 ${framework ? 'AND framework = $2' : ''}
       ORDER BY created_at DESC
       LIMIT $${framework ? '3' : '2'}`,
      framework ? [tenantId, framework, limit] : [tenantId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/reports/:id
 * @desc    Get compliance report by ID
 * @access  Admin only
 */
router.get('/reports/:id', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM compliance_reports 
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/compliance/evidence
 * @desc    Collect evidence for auditors
 * @access  Admin only
 */
router.post('/evidence', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { framework, startDate, endDate } = req.body;

    const evidence = await complianceService.collectEvidence(
      tenantId,
      framework,
      new Date(startDate),
      new Date(endDate)
    );

    res.json(evidence);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/compliance/evidence
 * @desc    List evidence packages
 * @access  Admin only
 */
router.get('/evidence', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { framework, limit = 50 } = req.query;

    const result = await pool.query(
      `SELECT id, framework, start_date, end_date, created_at
       FROM compliance_evidence
       WHERE tenant_id = $1 ${framework ? 'AND framework = $2' : ''}
       ORDER BY created_at DESC
       LIMIT $${framework ? '3' : '2'}`,
      framework ? [tenantId, framework, limit] : [tenantId, limit]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


