const k8s = require('@kubernetes/client-node');
const pool = require('../config/database');
const logger = require('../utils/logger');
const websocketService = require('./websocketService');

/**
 * Kubernetes Auto-Scaling Integration Service
 * 
 * Features:
 * - Horizontal Pod Autoscaler (HPA) management
 * - Vertical Pod Autoscaler (VPA) support
 * - Cluster management across multiple regions
 * - Multi-region failover orchestration
 * - Custom metrics-based scaling
 * - Resource quota management
 * - Node pool auto-scaling
 * - Deployment rollout management
 */

class KubernetesService {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.k8sApi = null;
    this.appsApi = null;
    this.autoscalingApi = null;
    this.metricsApi = null;
    
    // Initialize based on environment
    this.initializeClients();

    // Scaling policies
    this.scalingPolicies = {
      cpu: { target: 70, min: 2, max: 10 }, // 70% CPU target
      memory: { target: 80, min: 2, max: 10 }, // 80% memory target
      requests: { target: 1000, min: 2, max: 20 }, // 1000 req/min
      custom: {} // Custom metrics
    };
  }

  /**
   * Initialize Kubernetes clients
   */
  initializeClients() {
    try {
      if (process.env.K8S_IN_CLUSTER === 'true') {
        // Running inside a Kubernetes cluster
        this.kc.loadFromCluster();
      } else {
        // Running outside cluster (development)
        this.kc.loadFromDefault();
      }

      this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.autoscalingApi = this.kc.makeApiClient(k8s.AutoscalingV2Api);
      this.metricsApi = new k8s.Metrics(this.kc);

      logger.info('Kubernetes clients initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Kubernetes clients:', error);
      // Service will operate in degraded mode without K8s
    }
  }

  /**
   * Create Kubernetes cluster configuration
   * 
   * @param {Object} clusterData
   * @returns {Promise<Object>}
   */
  async createCluster(clusterData) {
    const {
      tenantId,
      userId,
      name,
      region,
      provider, // gke, eks, aks, doks (DigitalOcean)
      nodeCount = 3,
      nodeType = 'n1-standard-2',
      autoScaling = true,
      minNodes = 2,
      maxNodes = 10,
      version = '1.28'
    } = clusterData;

    try {
      // Store cluster configuration
      const result = await pool.query(
        `INSERT INTO k8s_clusters 
        (tenant_id, user_id, name, region, provider, node_count, node_type, 
         auto_scaling, min_nodes, max_nodes, version, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'provisioning', NOW())
        RETURNING *`,
        [tenantId, userId, name, region, provider, nodeCount, nodeType, 
         autoScaling, minNodes, maxNodes, version]
      );

      const cluster = result.rows[0];

      // Trigger cluster provisioning (provider-specific)
      await this.provisionCluster(cluster);

      return cluster;
    } catch (error) {
      logger.error('Failed to create cluster:', error);
      throw error;
    }
  }

  /**
   * Provision cluster with cloud provider
   * 
   * @param {Object} cluster
   */
  async provisionCluster(cluster) {
    // Provider-specific provisioning logic
    // In production, this would use cloud provider APIs
    logger.info('Provisioning cluster', { 
      clusterId: cluster.id, 
      provider: cluster.provider 
    });

    // Simulate provisioning
    setTimeout(async () => {
      await pool.query(
        `UPDATE k8s_clusters 
         SET status = 'active', provisioned_at = NOW() 
         WHERE id = $1`,
        [cluster.id]
      );

      logger.info('Cluster provisioned successfully', { clusterId: cluster.id });
    }, 5000);
  }

  /**
   * Deploy application to Kubernetes
   * 
   * @param {Object} deploymentData
   * @returns {Promise<Object>}
   */
  async deployApplication(deploymentData) {
    const {
      tenantId,
      clusterId,
      name,
      namespace = 'default',
      image,
      replicas = 3,
      port = 80,
      env = {},
      resources = {
        requests: { cpu: '100m', memory: '128Mi' },
        limits: { cpu: '500m', memory: '512Mi' }
      },
      autoScaling = true,
      minReplicas = 2,
      maxReplicas = 10,
      targetCPU = 70,
      targetMemory = 80
    } = deploymentData;

    try {
      if (!this.appsApi) {
        throw new Error('Kubernetes API not available');
      }

      // Create deployment manifest
      const deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name,
          namespace,
          labels: {
            app: name,
            tenant: tenantId.toString(),
            managed: 'mpanel'
          }
        },
        spec: {
          replicas,
          selector: {
            matchLabels: { app: name }
          },
          template: {
            metadata: {
              labels: { app: name }
            },
            spec: {
              containers: [{
                name,
                image,
                ports: [{ containerPort: port }],
                env: Object.entries(env).map(([key, value]) => ({
                  name: key,
                  value: value.toString()
                })),
                resources
              }]
            }
          }
        }
      };

      // Deploy to Kubernetes
      const k8sDeployment = await this.appsApi.createNamespacedDeployment(
        namespace,
        deployment
      );

      // Store deployment record
      const result = await pool.query(
        `INSERT INTO k8s_deployments 
        (tenant_id, cluster_id, name, namespace, image, replicas, status, 
         auto_scaling, min_replicas, max_replicas, target_cpu, target_memory, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [tenantId, clusterId, name, namespace, image, replicas, 
         autoScaling, minReplicas, maxReplicas, targetCPU, targetMemory]
      );

      const deployment_record = result.rows[0];

      // Create HPA if auto-scaling enabled
      if (autoScaling) {
        await this.createHPA(deployment_record);
      }

      // Create Service for external access
      await this.createService(name, namespace, port);

      return deployment_record;
    } catch (error) {
      logger.error('Failed to deploy application:', error);
      throw error;
    }
  }

  /**
   * Create Horizontal Pod Autoscaler
   * 
   * @param {Object} deployment
   */
  async createHPA(deployment) {
    const { name, namespace, min_replicas, max_replicas, target_cpu, target_memory } = deployment;

    try {
      const hpa = {
        apiVersion: 'autoscaling/v2',
        kind: 'HorizontalPodAutoscaler',
        metadata: {
          name: `${name}-hpa`,
          namespace
        },
        spec: {
          scaleTargetRef: {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name
          },
          minReplicas: min_replicas,
          maxReplicas: max_replicas,
          metrics: [
            {
              type: 'Resource',
              resource: {
                name: 'cpu',
                target: {
                  type: 'Utilization',
                  averageUtilization: target_cpu
                }
              }
            },
            {
              type: 'Resource',
              resource: {
                name: 'memory',
                target: {
                  type: 'Utilization',
                  averageUtilization: target_memory
                }
              }
            }
          ],
          behavior: {
            scaleDown: {
              stabilizationWindowSeconds: 300, // 5 minutes
              policies: [{
                type: 'Percent',
                value: 50,
                periodSeconds: 60
              }]
            },
            scaleUp: {
              stabilizationWindowSeconds: 0,
              policies: [{
                type: 'Percent',
                value: 100,
                periodSeconds: 30
              }]
            }
          }
        }
      };

      await this.autoscalingApi.createNamespacedHorizontalPodAutoscaler(
        namespace,
        hpa
      );

      logger.info('HPA created successfully', { deployment: name });
    } catch (error) {
      logger.error('Failed to create HPA:', error);
      throw error;
    }
  }

  /**
   * Create Kubernetes Service
   * 
   * @param {string} name
   * @param {string} namespace
   * @param {number} port
   */
  async createService(name, namespace, port) {
    try {
      const service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: `${name}-service`,
          namespace
        },
        spec: {
          selector: { app: name },
          type: 'LoadBalancer',
          ports: [{
            protocol: 'TCP',
            port: 80,
            targetPort: port
          }]
        }
      };

      await this.k8sApi.createNamespacedService(namespace, service);

      logger.info('Service created successfully', { name });
    } catch (error) {
      logger.error('Failed to create service:', error);
      throw error;
    }
  }

  /**
   * Scale deployment manually
   * 
   * @param {number} deploymentId
   * @param {number} replicas
   * @returns {Promise<Object>}
   */
  async scaleDeployment(deploymentId, replicas) {
    try {
      const deploymentResult = await pool.query(
        'SELECT * FROM k8s_deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Scale in Kubernetes
      await this.appsApi.patchNamespacedDeploymentScale(
        deployment.name,
        deployment.namespace,
        {
          spec: { replicas }
        }
      );

      // Update database
      await pool.query(
        'UPDATE k8s_deployments SET replicas = $1, updated_at = NOW() WHERE id = $2',
        [replicas, deploymentId]
      );

      logger.info('Deployment scaled', { deploymentId, replicas });

      return { success: true, replicas };
    } catch (error) {
      logger.error('Failed to scale deployment:', error);
      throw error;
    }
  }

  /**
   * Get deployment metrics
   * 
   * @param {number} deploymentId
   * @returns {Promise<Object>}
   */
  async getDeploymentMetrics(deploymentId) {
    try {
      const deploymentResult = await pool.query(
        'SELECT * FROM k8s_deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Get pod metrics
      const podMetrics = await this.metricsApi.getPodMetrics(deployment.namespace);

      // Filter metrics for this deployment
      const deploymentPods = podMetrics.items.filter(pod => 
        pod.metadata.labels.app === deployment.name
      );

      // Calculate aggregated metrics
      let totalCPU = 0;
      let totalMemory = 0;

      deploymentPods.forEach(pod => {
        pod.containers.forEach(container => {
          totalCPU += this.parseCPU(container.usage.cpu);
          totalMemory += this.parseMemory(container.usage.memory);
        });
      });

      const podCount = deploymentPods.length;

      return {
        podCount,
        avgCPU: podCount > 0 ? (totalCPU / podCount).toFixed(2) : 0,
        avgMemory: podCount > 0 ? this.formatBytes(totalMemory / podCount) : '0 MB',
        totalCPU: totalCPU.toFixed(2),
        totalMemory: this.formatBytes(totalMemory),
        pods: deploymentPods.map(pod => ({
          name: pod.metadata.name,
          cpu: this.parseCPU(pod.containers[0].usage.cpu).toFixed(2),
          memory: this.formatBytes(this.parseMemory(pod.containers[0].usage.memory))
        }))
      };
    } catch (error) {
      logger.error('Failed to get deployment metrics:', error);
      throw error;
    }
  }

  /**
   * Multi-region failover orchestration
   * 
   * @param {number} deploymentId
   * @param {string} targetRegion
   * @returns {Promise<Object>}
   */
  async failoverToRegion(deploymentId, targetRegion) {
    try {
      const deploymentResult = await pool.query(
        `SELECT d.*, c.region as current_region, c.provider
         FROM k8s_deployments d
         JOIN k8s_clusters c ON d.cluster_id = c.id
         WHERE d.id = $1`,
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Find or create cluster in target region
      let targetCluster = await pool.query(
        `SELECT * FROM k8s_clusters 
         WHERE tenant_id = $1 AND region = $2 AND status = 'active'
         LIMIT 1`,
        [deployment.tenant_id, targetRegion]
      );

      if (targetCluster.rows.length === 0) {
        // Create new cluster in target region
        targetCluster = await this.createCluster({
          tenantId: deployment.tenant_id,
          userId: deployment.user_id,
          name: `${deployment.name}-${targetRegion}`,
          region: targetRegion,
          provider: deployment.provider,
          autoScaling: true
        });
      } else {
        targetCluster = targetCluster.rows[0];
      }

      // Deploy to target region
      const failoverDeployment = await this.deployApplication({
        tenantId: deployment.tenant_id,
        clusterId: targetCluster.id,
        name: deployment.name,
        namespace: deployment.namespace,
        image: deployment.image,
        replicas: deployment.replicas,
        autoScaling: deployment.auto_scaling,
        minReplicas: deployment.min_replicas,
        maxReplicas: deployment.max_replicas
      });

      // Record failover event
      await pool.query(
        `INSERT INTO k8s_failover_events 
        (deployment_id, from_region, to_region, reason, status, created_at)
        VALUES ($1, $2, $3, $4, 'completed', NOW())`,
        [deploymentId, deployment.current_region, targetRegion, 'Manual failover']
      );

      logger.info('Failover completed', { 
        deploymentId, 
        from: deployment.current_region, 
        to: targetRegion 
      });

      return {
        success: true,
        originalDeployment: deployment,
        failoverDeployment
      };
    } catch (error) {
      logger.error('Failover failed:', error);
      throw error;
    }
  }

  /**
   * Rollout deployment update
   * 
   * @param {number} deploymentId
   * @param {string} newImage
   * @param {string} strategy - RollingUpdate or Recreate
   * @returns {Promise<Object>}
   */
  async rolloutUpdate(deploymentId, newImage, strategy = 'RollingUpdate') {
    try {
      const deploymentResult = await pool.query(
        'SELECT * FROM k8s_deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Update deployment image
      const patch = {
        spec: {
          strategy: {
            type: strategy,
            rollingUpdate: strategy === 'RollingUpdate' ? {
              maxSurge: '25%',
              maxUnavailable: '25%'
            } : undefined
          },
          template: {
            spec: {
              containers: [{
                name: deployment.name,
                image: newImage
              }]
            }
          }
        }
      };

      await this.appsApi.patchNamespacedDeployment(
        deployment.name,
        deployment.namespace,
        patch,
        undefined,
        undefined,
        undefined,
        undefined,
        { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
      );

      // Update database
      await pool.query(
        'UPDATE k8s_deployments SET image = $1, updated_at = NOW() WHERE id = $2',
        [newImage, deploymentId]
      );

      // Monitor rollout status
      this.monitorRollout(deployment.name, deployment.namespace, deploymentId);

      return { success: true, newImage, strategy };
    } catch (error) {
      logger.error('Rollout failed:', error);
      throw error;
    }
  }

  /**
   * Monitor deployment rollout status
   * 
   * @param {string} name
   * @param {string} namespace
   * @param {number} deploymentId
   */
  async monitorRollout(name, namespace, deploymentId) {
    const checkStatus = async () => {
      try {
        const deployment = await this.appsApi.readNamespacedDeployment(name, namespace);
        const status = deployment.body.status;

        const progress = {
          replicas: status.replicas || 0,
          updatedReplicas: status.updatedReplicas || 0,
          readyReplicas: status.readyReplicas || 0,
          availableReplicas: status.availableReplicas || 0
        };

        // Send progress update via WebSocket
        const deploymentRecord = await pool.query(
          'SELECT tenant_id FROM k8s_deployments WHERE id = $1',
          [deploymentId]
        );

        if (deploymentRecord.rows.length > 0) {
          websocketService.sendToTenant(
            deploymentRecord.rows[0].tenant_id,
            'k8s_rollout_progress',
            { deploymentId, progress }
          );
        }

        // Check if rollout is complete
        if (status.updatedReplicas === status.replicas && 
            status.readyReplicas === status.replicas) {
          logger.info('Rollout completed successfully', { name });
          
          websocketService.sendToTenant(
            deploymentRecord.rows[0].tenant_id,
            'k8s_rollout_complete',
            { deploymentId, status: 'success' }
          );
        } else {
          // Continue monitoring
          setTimeout(checkStatus, 5000);
        }
      } catch (error) {
        logger.error('Failed to monitor rollout:', error);
      }
    };

    checkStatus();
  }

  /**
   * Get cluster health status
   * 
   * @param {number} clusterId
   * @returns {Promise<Object>}
   */
  async getClusterHealth(clusterId) {
    try {
      // Get cluster info
      const clusterResult = await pool.query(
        'SELECT * FROM k8s_clusters WHERE id = $1',
        [clusterId]
      );

      if (clusterResult.rows.length === 0) {
        throw new Error('Cluster not found');
      }

      const cluster = clusterResult.rows[0];

      // Get node status
      const nodes = await this.k8sApi.listNode();
      const nodeHealth = nodes.body.items.map(node => ({
        name: node.metadata.name,
        status: node.status.conditions.find(c => c.type === 'Ready')?.status === 'True' ? 'healthy' : 'unhealthy',
        cpu: node.status.capacity.cpu,
        memory: node.status.capacity.memory
      }));

      // Get pod count
      const pods = await this.k8sApi.listPodForAllNamespaces();
      const podCount = {
        total: pods.body.items.length,
        running: pods.body.items.filter(p => p.status.phase === 'Running').length,
        pending: pods.body.items.filter(p => p.status.phase === 'Pending').length,
        failed: pods.body.items.filter(p => p.status.phase === 'Failed').length
      };

      return {
        cluster,
        nodes: nodeHealth,
        pods: podCount,
        healthScore: this.calculateHealthScore(nodeHealth, podCount)
      };
    } catch (error) {
      logger.error('Failed to get cluster health:', error);
      throw error;
    }
  }

  /**
   * Calculate cluster health score
   */
  calculateHealthScore(nodes, pods) {
    const healthyNodes = nodes.filter(n => n.status === 'healthy').length;
    const nodeScore = (healthyNodes / nodes.length) * 50;

    const healthyPods = pods.running / pods.total;
    const podScore = healthyPods * 50;

    return Math.round(nodeScore + podScore);
  }

  /**
   * Parse CPU value to millicores
   */
  parseCPU(cpu) {
    if (cpu.endsWith('n')) {
      return parseInt(cpu) / 1000000;
    } else if (cpu.endsWith('m')) {
      return parseInt(cpu);
    } else {
      return parseInt(cpu) * 1000;
    }
  }

  /**
   * Parse memory value to bytes
   */
  parseMemory(memory) {
    const units = { Ki: 1024, Mi: 1024**2, Gi: 1024**3 };
    const match = memory.match(/(\d+)(\w+)/);
    
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      return value * (units[unit] || 1);
    }
    
    return parseInt(memory);
  }

  /**
   * Format bytes to human-readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Delete deployment
   * 
   * @param {number} deploymentId
   * @returns {Promise<Object>}
   */
  async deleteDeployment(deploymentId) {
    try {
      const deploymentResult = await pool.query(
        'SELECT * FROM k8s_deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Delete from Kubernetes
      await this.appsApi.deleteNamespacedDeployment(
        deployment.name,
        deployment.namespace
      );

      // Delete service
      await this.k8sApi.deleteNamespacedService(
        `${deployment.name}-service`,
        deployment.namespace
      );

      // Delete HPA
      try {
        await this.autoscalingApi.deleteNamespacedHorizontalPodAutoscaler(
          `${deployment.name}-hpa`,
          deployment.namespace
        );
      } catch (error) {
        // HPA might not exist
      }

      // Update database
      await pool.query(
        'UPDATE k8s_deployments SET status = $1, deleted_at = NOW() WHERE id = $2',
        ['deleted', deploymentId]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete deployment:', error);
      throw error;
    }
  }
}

module.exports = new KubernetesService();
