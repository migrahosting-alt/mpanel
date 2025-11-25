import express from 'express';
const router = express.Router();
import kubernetesService from '../services/kubernetesService.js';
import auth from '../middleware/auth.js';

/**
 * Kubernetes Auto-Scaling Routes
 */

// Create cluster
router.post('/clusters', auth, async (req, res) => {
  try {
    const cluster = await kubernetesService.createCluster({
      ...req.body,
      tenantId: req.user.tenantId,
      userId: req.user.id
    });

    res.json(cluster);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get clusters
router.get('/clusters', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      'SELECT * FROM k8s_clusters WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get cluster health
router.get('/clusters/:id/health', auth, async (req, res) => {
  try {
    const health = await kubernetesService.getClusterHealth(parseInt(req.params.id));
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deploy application
router.post('/deployments', auth, async (req, res) => {
  try {
    const deployment = await kubernetesService.deployApplication({
      ...req.body,
      tenantId: req.user.tenantId
    });

    res.json(deployment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployments
router.get('/deployments', auth, async (req, res) => {
  try {
    const result = await require('../config/database').query(
      `SELECT d.*, c.name as cluster_name, c.region
       FROM k8s_deployments d
       JOIN k8s_clusters c ON d.cluster_id = c.id
       WHERE d.tenant_id = $1 AND d.status != 'deleted'
       ORDER BY d.created_at DESC`,
      [req.user.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get deployment metrics
router.get('/deployments/:id/metrics', auth, async (req, res) => {
  try {
    const metrics = await kubernetesService.getDeploymentMetrics(parseInt(req.params.id));
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Scale deployment
router.post('/deployments/:id/scale', auth, async (req, res) => {
  try {
    const { replicas } = req.body;
    const result = await kubernetesService.scaleDeployment(
      parseInt(req.params.id),
      replicas
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rollout update
router.post('/deployments/:id/rollout', auth, async (req, res) => {
  try {
    const { image, strategy = 'RollingUpdate' } = req.body;
    const result = await kubernetesService.rolloutUpdate(
      parseInt(req.params.id),
      image,
      strategy
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Failover to region
router.post('/deployments/:id/failover', auth, async (req, res) => {
  try {
    const { targetRegion } = req.body;
    const result = await kubernetesService.failoverToRegion(
      parseInt(req.params.id),
      targetRegion
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete deployment
router.delete('/deployments/:id', auth, async (req, res) => {
  try {
    const result = await kubernetesService.deleteDeployment(parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


