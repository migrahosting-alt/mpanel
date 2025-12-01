# CloudPods Health Monitoring & Auto-Healing

## Overview

Real-time health monitoring for CloudPods with automatic detection of failures and optional auto-healing capabilities. This system provides observability into pod health status and can automatically restart or migrate unhealthy pods based on configurable policies.

---

## Prisma Schema

```prisma
// Health check configuration per pod
model CloudPodHealthCheck {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  checkType       String    @map("check_type") // 'ping', 'tcp', 'http', 'agent'
  target          String?   // Port number or URL path
  intervalSeconds Int       @default(60) @map("interval_seconds")
  timeoutSeconds  Int       @default(10) @map("timeout_seconds")
  failureThreshold Int      @default(3) @map("failure_threshold")
  successThreshold Int      @default(1) @map("success_threshold")
  enabled         Boolean   @default(true)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@unique([podId, checkType])
  @@map("cloud_pod_health_checks")
}

// Health check results history
model CloudPodHealthResult {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  checkType       String    @map("check_type")
  status          String    // 'healthy', 'unhealthy', 'unknown'
  latencyMs       Int?      @map("latency_ms")
  errorMessage    String?   @map("error_message")
  rawResponse     Json?     @map("raw_response")
  checkedAt       DateTime  @default(now()) @map("checked_at")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@index([podId, checkedAt])
  @@index([checkedAt])
  @@map("cloud_pod_health_results")
}

// Current health status (aggregated view)
model CloudPodHealthStatus {
  id                    Int       @id @default(autoincrement())
  podId                 Int       @unique @map("pod_id")
  status                String    @default("unknown") // 'healthy', 'unhealthy', 'degraded', 'unknown'
  consecutiveFailures   Int       @default(0) @map("consecutive_failures")
  consecutiveSuccesses  Int       @default(0) @map("consecutive_successes")
  lastCheckAt           DateTime? @map("last_check_at")
  lastHealthyAt         DateTime? @map("last_healthy_at")
  lastUnhealthyAt       DateTime? @map("last_unhealthy_at")
  autoHealAttempts      Int       @default(0) @map("auto_heal_attempts")
  lastAutoHealAt        DateTime? @map("last_auto_heal_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  pod                   CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@map("cloud_pod_health_status")
}

// Auto-healing policy configuration
model CloudPodAutoHealPolicy {
  id                    Int       @id @default(autoincrement())
  tenantId              Int       @map("tenant_id")
  name                  String
  enabled               Boolean   @default(true)
  triggerAfterFailures  Int       @default(3) @map("trigger_after_failures")
  action                String    // 'restart', 'stop', 'notify_only', 'migrate'
  cooldownMinutes       Int       @default(10) @map("cooldown_minutes")
  maxAttempts           Int       @default(3) @map("max_attempts")
  notifyOnTrigger       Boolean   @default(true) @map("notify_on_trigger")
  escalateAfterAttempts Int?      @map("escalate_after_attempts")
  escalationAction      String?   @map("escalation_action")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("cloud_pod_auto_heal_policies")
}

// Auto-healing events log
model CloudPodAutoHealEvent {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  policyId        Int?      @map("policy_id")
  action          String    // 'restart', 'stop', 'migrate', 'escalate'
  reason          String
  result          String    // 'success', 'failed', 'skipped'
  errorMessage    String?   @map("error_message")
  previousStatus  String?   @map("previous_status")
  newStatus       String?   @map("new_status")
  triggeredAt     DateTime  @default(now()) @map("triggered_at")
  completedAt     DateTime? @map("completed_at")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@index([podId, triggeredAt])
  @@index([triggeredAt])
  @@map("cloud_pod_auto_heal_events")
}
```

---

## Check Types

| Type | Description | Target Format |
|------|-------------|---------------|
| `ping` | ICMP ping to pod IP | None |
| `tcp` | TCP port connectivity | Port number (e.g., "22", "80") |
| `http` | HTTP/HTTPS endpoint check | URL path (e.g., "/health", "/api/status") |
| `agent` | MigraAgent heartbeat | None (agent reports in) |

---

## Service Layer

```javascript
// src/services/cloudPodHealth.js

import { prisma } from '../database.js';
import { auditLog } from './cloudPodAudit.js';

/**
 * Health check service for CloudPods
 */
class CloudPodHealthService {
  
  // ─────────────────────────────────────────────────────────────────
  // Health Check Configuration
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Configure health check for a pod
   */
  async configureHealthCheck(podId, config, actorUserId) {
    const { checkType, target, intervalSeconds, timeoutSeconds, failureThreshold, successThreshold, enabled } = config;
    
    const healthCheck = await prisma.cloudPodHealthCheck.upsert({
      where: { podId_checkType: { podId, checkType } },
      create: {
        podId,
        checkType,
        target,
        intervalSeconds: intervalSeconds || 60,
        timeoutSeconds: timeoutSeconds || 10,
        failureThreshold: failureThreshold || 3,
        successThreshold: successThreshold || 1,
        enabled: enabled !== false
      },
      update: {
        target,
        intervalSeconds,
        timeoutSeconds,
        failureThreshold,
        successThreshold,
        enabled
      }
    });
    
    await auditLog(podId, actorUserId, 'health_check_configured', {
      checkType,
      target,
      intervalSeconds,
      failureThreshold
    });
    
    return healthCheck;
  }

  /**
   * Get health check configuration for a pod
   */
  async getHealthCheckConfig(podId) {
    return prisma.cloudPodHealthCheck.findMany({
      where: { podId, enabled: true }
    });
  }

  /**
   * Disable health check
   */
  async disableHealthCheck(podId, checkType, actorUserId) {
    const result = await prisma.cloudPodHealthCheck.update({
      where: { podId_checkType: { podId, checkType } },
      data: { enabled: false }
    });
    
    await auditLog(podId, actorUserId, 'health_check_disabled', { checkType });
    
    return result;
  }

  // ─────────────────────────────────────────────────────────────────
  // Health Check Execution (Called by Worker)
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Record health check result
   */
  async recordHealthResult(podId, checkType, result) {
    const { status, latencyMs, errorMessage, rawResponse } = result;
    
    // Record the result
    await prisma.cloudPodHealthResult.create({
      data: {
        podId,
        checkType,
        status,
        latencyMs,
        errorMessage,
        rawResponse
      }
    });
    
    // Update aggregated status
    await this.updateHealthStatus(podId, status);
    
    // Check auto-heal trigger
    if (status === 'unhealthy') {
      await this.checkAutoHealTrigger(podId);
    }
    
    return { recorded: true };
  }

  /**
   * Update aggregated health status
   */
  async updateHealthStatus(podId, checkResult) {
    const current = await prisma.cloudPodHealthStatus.findUnique({
      where: { podId }
    });
    
    const now = new Date();
    
    if (!current) {
      // Create initial status
      await prisma.cloudPodHealthStatus.create({
        data: {
          podId,
          status: checkResult,
          consecutiveFailures: checkResult === 'unhealthy' ? 1 : 0,
          consecutiveSuccesses: checkResult === 'healthy' ? 1 : 0,
          lastCheckAt: now,
          lastHealthyAt: checkResult === 'healthy' ? now : null,
          lastUnhealthyAt: checkResult === 'unhealthy' ? now : null
        }
      });
      return;
    }
    
    // Update counters based on result
    const updates = {
      lastCheckAt: now
    };
    
    if (checkResult === 'healthy') {
      updates.consecutiveSuccesses = current.consecutiveSuccesses + 1;
      updates.consecutiveFailures = 0;
      updates.lastHealthyAt = now;
      
      // Get config for success threshold
      const config = await prisma.cloudPodHealthCheck.findFirst({
        where: { podId, enabled: true }
      });
      const successThreshold = config?.successThreshold || 1;
      
      if (updates.consecutiveSuccesses >= successThreshold) {
        updates.status = 'healthy';
      }
    } else if (checkResult === 'unhealthy') {
      updates.consecutiveFailures = current.consecutiveFailures + 1;
      updates.consecutiveSuccesses = 0;
      updates.lastUnhealthyAt = now;
      
      // Get config for failure threshold
      const config = await prisma.cloudPodHealthCheck.findFirst({
        where: { podId, enabled: true }
      });
      const failureThreshold = config?.failureThreshold || 3;
      
      if (updates.consecutiveFailures >= failureThreshold) {
        updates.status = 'unhealthy';
      } else if (updates.consecutiveFailures >= 1) {
        updates.status = 'degraded';
      }
    }
    
    await prisma.cloudPodHealthStatus.update({
      where: { podId },
      data: updates
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Health Status Queries
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Get current health status for a pod
   */
  async getHealthStatus(podId) {
    const status = await prisma.cloudPodHealthStatus.findUnique({
      where: { podId },
      include: {
        pod: {
          select: { name: true, ipAddress: true, status: true }
        }
      }
    });
    
    // Get recent results
    const recentResults = await prisma.cloudPodHealthResult.findMany({
      where: { podId },
      orderBy: { checkedAt: 'desc' },
      take: 10
    });
    
    return {
      ...status,
      recentResults
    };
  }

  /**
   * Get health status for all tenant pods
   */
  async getTenantHealthOverview(tenantId) {
    const pods = await prisma.cloudPod.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        healthStatus: true
      }
    });
    
    const summary = {
      total: pods.length,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0
    };
    
    const podStatuses = pods.map(pod => {
      const status = pod.healthStatus?.status || 'unknown';
      summary[status]++;
      
      return {
        podId: pod.id,
        name: pod.name,
        status,
        consecutiveFailures: pod.healthStatus?.consecutiveFailures || 0,
        lastCheckAt: pod.healthStatus?.lastCheckAt,
        lastHealthyAt: pod.healthStatus?.lastHealthyAt
      };
    });
    
    return {
      summary,
      pods: podStatuses
    };
  }

  /**
   * Get health history for a pod
   */
  async getHealthHistory(podId, options = {}) {
    const { hours = 24, checkType } = options;
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const results = await prisma.cloudPodHealthResult.findMany({
      where: {
        podId,
        checkedAt: { gte: since },
        ...(checkType && { checkType })
      },
      orderBy: { checkedAt: 'desc' }
    });
    
    // Calculate uptime percentage
    const totalChecks = results.length;
    const healthyChecks = results.filter(r => r.status === 'healthy').length;
    const uptimePercentage = totalChecks > 0 ? (healthyChecks / totalChecks) * 100 : null;
    
    // Calculate average latency
    const latencies = results.filter(r => r.latencyMs != null).map(r => r.latencyMs);
    const avgLatency = latencies.length > 0 
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length 
      : null;
    
    return {
      podId,
      period: `${hours}h`,
      uptimePercentage: uptimePercentage?.toFixed(2),
      avgLatencyMs: avgLatency?.toFixed(0),
      totalChecks,
      healthyChecks,
      unhealthyChecks: totalChecks - healthyChecks,
      results
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Auto-Healing
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Create or update auto-heal policy
   */
  async setAutoHealPolicy(tenantId, policy, actorUserId) {
    const { name, triggerAfterFailures, action, cooldownMinutes, maxAttempts, notifyOnTrigger } = policy;
    
    const result = await prisma.cloudPodAutoHealPolicy.upsert({
      where: { id: policy.id || 0 },
      create: {
        tenantId,
        name,
        triggerAfterFailures: triggerAfterFailures || 3,
        action: action || 'restart',
        cooldownMinutes: cooldownMinutes || 10,
        maxAttempts: maxAttempts || 3,
        notifyOnTrigger: notifyOnTrigger !== false,
        enabled: true
      },
      update: {
        name,
        triggerAfterFailures,
        action,
        cooldownMinutes,
        maxAttempts,
        notifyOnTrigger
      }
    });
    
    return result;
  }

  /**
   * Get auto-heal policies for tenant
   */
  async getAutoHealPolicies(tenantId) {
    return prisma.cloudPodAutoHealPolicy.findMany({
      where: { tenantId }
    });
  }

  /**
   * Check if auto-heal should be triggered
   */
  async checkAutoHealTrigger(podId) {
    const status = await prisma.cloudPodHealthStatus.findUnique({
      where: { podId },
      include: {
        pod: {
          include: {
            tenant: {
              include: {
                autoHealPolicies: { where: { enabled: true } }
              }
            }
          }
        }
      }
    });
    
    if (!status || !status.pod) return;
    
    const policy = status.pod.tenant?.autoHealPolicies?.[0];
    if (!policy) return;
    
    // Check if we've hit the failure threshold
    if (status.consecutiveFailures < policy.triggerAfterFailures) return;
    
    // Check cooldown
    if (status.lastAutoHealAt) {
      const cooldownMs = policy.cooldownMinutes * 60 * 1000;
      if (Date.now() - status.lastAutoHealAt.getTime() < cooldownMs) {
        console.log(`[AutoHeal] Pod ${podId} in cooldown, skipping`);
        return;
      }
    }
    
    // Check max attempts
    if (status.autoHealAttempts >= policy.maxAttempts) {
      console.log(`[AutoHeal] Pod ${podId} exceeded max attempts (${policy.maxAttempts})`);
      
      // Check for escalation
      if (policy.escalateAfterAttempts && status.autoHealAttempts >= policy.escalateAfterAttempts) {
        await this.triggerAutoHeal(podId, policy.escalationAction || 'notify_only', policy.id, 'Escalation after max attempts');
      }
      return;
    }
    
    // Trigger auto-heal
    await this.triggerAutoHeal(podId, policy.action, policy.id, `${status.consecutiveFailures} consecutive failures`);
  }

  /**
   * Execute auto-heal action
   */
  async triggerAutoHeal(podId, action, policyId, reason) {
    console.log(`[AutoHeal] Triggering ${action} for pod ${podId}: ${reason}`);
    
    // Get current status
    const status = await prisma.cloudPodHealthStatus.findUnique({
      where: { podId }
    });
    
    // Create event record
    const event = await prisma.cloudPodAutoHealEvent.create({
      data: {
        podId,
        policyId,
        action,
        reason,
        result: 'pending',
        previousStatus: status?.status
      }
    });
    
    try {
      let result = 'success';
      let newStatus = null;
      
      switch (action) {
        case 'restart':
          // Import the provisioning service
          const { restartPod } = await import('./cloudPodProvisioning.js');
          await restartPod(podId);
          newStatus = 'restarting';
          break;
          
        case 'stop':
          const { stopPod } = await import('./cloudPodProvisioning.js');
          await stopPod(podId);
          newStatus = 'stopped';
          break;
          
        case 'migrate':
          // Queue migration job
          const { cloudPodQueue } = await import('../workers/cloudPodQueues.js');
          await cloudPodQueue.add('migratePod', { podId, reason: 'auto-heal' });
          newStatus = 'migrating';
          break;
          
        case 'notify_only':
          // Just send notification, no action
          await this.sendAutoHealNotification(podId, reason);
          break;
          
        default:
          console.warn(`[AutoHeal] Unknown action: ${action}`);
          result = 'skipped';
      }
      
      // Update event
      await prisma.cloudPodAutoHealEvent.update({
        where: { id: event.id },
        data: {
          result,
          newStatus,
          completedAt: new Date()
        }
      });
      
      // Update health status
      await prisma.cloudPodHealthStatus.update({
        where: { podId },
        data: {
          autoHealAttempts: { increment: 1 },
          lastAutoHealAt: new Date()
        }
      });
      
      // Send notification if enabled
      const policy = policyId ? await prisma.cloudPodAutoHealPolicy.findUnique({ where: { id: policyId } }) : null;
      if (policy?.notifyOnTrigger) {
        await this.sendAutoHealNotification(podId, reason, action);
      }
      
    } catch (error) {
      console.error(`[AutoHeal] Failed for pod ${podId}:`, error);
      
      await prisma.cloudPodAutoHealEvent.update({
        where: { id: event.id },
        data: {
          result: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        }
      });
    }
  }

  /**
   * Send notification about auto-heal event
   */
  async sendAutoHealNotification(podId, reason, action = null) {
    const pod = await prisma.cloudPod.findUnique({
      where: { id: podId },
      include: {
        tenant: {
          include: {
            users: { take: 1 }
          }
        }
      }
    });
    
    if (!pod) return;
    
    const message = action
      ? `CloudPod "${pod.name}" triggered auto-heal action (${action}): ${reason}`
      : `CloudPod "${pod.name}" health alert: ${reason}`;
    
    // TODO: Integrate with notification system (email, webhook, etc.)
    console.log(`[AutoHeal Notification] ${message}`);
  }

  /**
   * Get auto-heal event history
   */
  async getAutoHealHistory(podId, limit = 20) {
    return prisma.cloudPodAutoHealEvent.findMany({
      where: { podId },
      orderBy: { triggeredAt: 'desc' },
      take: limit
    });
  }

  /**
   * Reset auto-heal attempts (manual recovery)
   */
  async resetAutoHealAttempts(podId, actorUserId) {
    await prisma.cloudPodHealthStatus.update({
      where: { podId },
      data: {
        autoHealAttempts: 0,
        consecutiveFailures: 0
      }
    });
    
    await auditLog(podId, actorUserId, 'auto_heal_reset', {
      reason: 'Manual reset by user'
    });
    
    return { reset: true };
  }
}

export const cloudPodHealth = new CloudPodHealthService();
```

---

## Health Check Worker

```javascript
// src/workers/healthCheckWorker.js

import { Worker } from 'bullmq';
import { prisma } from '../database.js';
import { cloudPodHealth } from '../services/cloudPodHealth.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import https from 'https';

const execAsync = promisify(exec);

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
};

/**
 * Health check executor
 */
async function executeHealthCheck(pod, config) {
  const startTime = Date.now();
  let result = {
    status: 'unknown',
    latencyMs: null,
    errorMessage: null,
    rawResponse: null
  };
  
  try {
    switch (config.checkType) {
      case 'ping':
        result = await executePingCheck(pod.ipAddress, config.timeoutSeconds);
        break;
        
      case 'tcp':
        result = await executeTcpCheck(pod.ipAddress, parseInt(config.target), config.timeoutSeconds);
        break;
        
      case 'http':
        result = await executeHttpCheck(pod.ipAddress, config.target, config.timeoutSeconds);
        break;
        
      case 'agent':
        result = await executeAgentCheck(pod.id, config.timeoutSeconds);
        break;
        
      default:
        result.errorMessage = `Unknown check type: ${config.checkType}`;
    }
  } catch (error) {
    result.status = 'unhealthy';
    result.errorMessage = error.message;
  }
  
  result.latencyMs = Date.now() - startTime;
  return result;
}

/**
 * ICMP ping check
 */
async function executePingCheck(ipAddress, timeout) {
  try {
    const { stdout } = await execAsync(`ping -c 1 -W ${timeout} ${ipAddress}`);
    
    // Parse latency from ping output
    const latencyMatch = stdout.match(/time=(\d+\.?\d*)/);
    const latencyMs = latencyMatch ? parseFloat(latencyMatch[1]) : null;
    
    return {
      status: 'healthy',
      latencyMs,
      rawResponse: { output: stdout.substring(0, 500) }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      errorMessage: 'Ping failed',
      rawResponse: { error: error.message }
    };
  }
}

/**
 * TCP port connectivity check
 */
async function executeTcpCheck(ipAddress, port, timeout) {
  return new Promise((resolve) => {
    const net = require('net');
    const startTime = Date.now();
    
    const socket = new net.Socket();
    socket.setTimeout(timeout * 1000);
    
    socket.on('connect', () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({
        status: 'healthy',
        latencyMs,
        rawResponse: { port, connected: true }
      });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        status: 'unhealthy',
        errorMessage: `TCP connection timeout (${timeout}s)`,
        rawResponse: { port, timeout: true }
      });
    });
    
    socket.on('error', (error) => {
      resolve({
        status: 'unhealthy',
        errorMessage: error.message,
        rawResponse: { port, error: error.code }
      });
    });
    
    socket.connect(port, ipAddress);
  });
}

/**
 * HTTP/HTTPS endpoint check
 */
async function executeHttpCheck(ipAddress, path, timeout) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const isHttps = path.startsWith('https://');
    const url = path.startsWith('http') ? path : `http://${ipAddress}${path}`;
    const protocol = isHttps ? https : http;
    
    const req = protocol.get(url, { timeout: timeout * 1000 }, (res) => {
      const latencyMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      
      // Consider 2xx and 3xx as healthy
      const isHealthy = statusCode >= 200 && statusCode < 400;
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          status: isHealthy ? 'healthy' : 'unhealthy',
          latencyMs,
          errorMessage: isHealthy ? null : `HTTP ${statusCode}`,
          rawResponse: { statusCode, body: body.substring(0, 500) }
        });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'unhealthy',
        errorMessage: `HTTP timeout (${timeout}s)`,
        rawResponse: { timeout: true }
      });
    });
    
    req.on('error', (error) => {
      resolve({
        status: 'unhealthy',
        errorMessage: error.message,
        rawResponse: { error: error.code }
      });
    });
  });
}

/**
 * MigraAgent heartbeat check
 */
async function executeAgentCheck(podId, timeout) {
  // Check last agent heartbeat from database
  const lastHeartbeat = await prisma.cloudPodAgentHeartbeat.findFirst({
    where: { podId },
    orderBy: { receivedAt: 'desc' }
  });
  
  if (!lastHeartbeat) {
    return {
      status: 'unhealthy',
      errorMessage: 'No agent heartbeat received'
    };
  }
  
  // Check if heartbeat is stale (more than 2x the expected interval)
  const maxAge = timeout * 2 * 1000;
  const age = Date.now() - lastHeartbeat.receivedAt.getTime();
  
  if (age > maxAge) {
    return {
      status: 'unhealthy',
      errorMessage: `Agent heartbeat stale (${Math.round(age / 1000)}s old)`,
      rawResponse: { lastHeartbeat: lastHeartbeat.receivedAt }
    };
  }
  
  return {
    status: 'healthy',
    latencyMs: age,
    rawResponse: { lastHeartbeat: lastHeartbeat.receivedAt }
  };
}

/**
 * BullMQ Worker for health checks
 */
export function startHealthCheckWorker() {
  const worker = new Worker(
    'cloudpod-health-checks',
    async (job) => {
      const { podId, checkType } = job.data;
      
      // Get pod and config
      const pod = await prisma.cloudPod.findUnique({
        where: { id: podId }
      });
      
      if (!pod || pod.status !== 'running' || pod.deletedAt) {
        return { skipped: true, reason: 'Pod not running' };
      }
      
      const config = await prisma.cloudPodHealthCheck.findUnique({
        where: { podId_checkType: { podId, checkType } }
      });
      
      if (!config || !config.enabled) {
        return { skipped: true, reason: 'Health check disabled' };
      }
      
      // Execute check
      const result = await executeHealthCheck(pod, config);
      
      // Record result
      await cloudPodHealth.recordHealthResult(podId, checkType, result);
      
      return result;
    },
    { connection: REDIS_CONNECTION }
  );
  
  worker.on('completed', (job, result) => {
    if (!result.skipped) {
      console.log(`[HealthCheck] Pod ${job.data.podId} ${job.data.checkType}: ${result.status}`);
    }
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[HealthCheck] Failed for pod ${job.data.podId}:`, error.message);
  });
  
  return worker;
}

/**
 * Scheduler to queue health checks
 */
export async function scheduleHealthChecks() {
  const { Queue } = await import('bullmq');
  const queue = new Queue('cloudpod-health-checks', { connection: REDIS_CONNECTION });
  
  // Get all active health checks
  const healthChecks = await prisma.cloudPodHealthCheck.findMany({
    where: { enabled: true },
    include: {
      pod: {
        select: { id: true, status: true, deletedAt: true }
      }
    }
  });
  
  for (const config of healthChecks) {
    // Skip if pod isn't running
    if (config.pod.status !== 'running' || config.pod.deletedAt) continue;
    
    // Add job with repeat
    await queue.add(
      'healthCheck',
      { podId: config.podId, checkType: config.checkType },
      {
        repeat: {
          every: config.intervalSeconds * 1000
        },
        jobId: `health-${config.podId}-${config.checkType}`,
        removeOnComplete: 100,
        removeOnFail: 50
      }
    );
  }
  
  console.log(`[HealthCheck] Scheduled ${healthChecks.length} health checks`);
}
```

---

## API Routes

```javascript
// Add to src/routes/cloudPodRoutes.js

import { cloudPodHealth } from '../services/cloudPodHealth.js';

// ─────────────────────────────────────────────────────────────────
// Health Monitoring Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/:id/health
 * Get current health status for a pod
 */
router.get('/:id/health', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const pod = await validatePodAccess(req, podId);
    
    const status = await cloudPodHealth.getHealthStatus(podId);
    res.json(status);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/:id/health/history
 * Get health check history for a pod
 */
router.get('/:id/health/history', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const hours = parseInt(req.query.hours) || 24;
    const checkType = req.query.checkType;
    
    await validatePodAccess(req, podId);
    
    const history = await cloudPodHealth.getHealthHistory(podId, { hours, checkType });
    res.json(history);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * PUT /api/cloud-pods/:id/health/config
 * Configure health checks for a pod
 */
router.put('/:id/health/config', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const config = await cloudPodHealth.configureHealthCheck(
      podId,
      req.body,
      req.user.id
    );
    
    res.json(config);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cloud-pods/:id/health/config/:checkType
 * Disable a specific health check
 */
router.delete('/:id/health/config/:checkType', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const { checkType } = req.params;
    
    await validatePodAccess(req, podId);
    
    await cloudPodHealth.disableHealthCheck(podId, checkType, req.user.id);
    res.json({ disabled: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/health/overview
 * Get health overview for all tenant pods
 */
router.get('/health/overview', requireAuth, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const overview = await cloudPodHealth.getTenantHealthOverview(tenantId);
    res.json(overview);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Auto-Heal Policy Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/auto-heal/policies
 * Get auto-heal policies for tenant
 */
router.get('/auto-heal/policies', requireAuth, async (req, res) => {
  try {
    const policies = await cloudPodHealth.getAutoHealPolicies(req.user.tenantId);
    res.json(policies);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/auto-heal/policies
 * Create or update auto-heal policy
 */
router.post('/auto-heal/policies', requireAuth, async (req, res) => {
  try {
    const policy = await cloudPodHealth.setAutoHealPolicy(
      req.user.tenantId,
      req.body,
      req.user.id
    );
    res.json(policy);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/:id/auto-heal/history
 * Get auto-heal event history for a pod
 */
router.get('/:id/auto-heal/history', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const history = await cloudPodHealth.getAutoHealHistory(podId);
    res.json(history);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/:id/auto-heal/reset
 * Reset auto-heal attempts for a pod
 */
router.post('/:id/auto-heal/reset', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const result = await cloudPodHealth.resetAutoHealAttempts(podId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
```

---

## API Reference

### Health Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/:id/health` | GET | Get current health status |
| `/api/cloud-pods/:id/health/history` | GET | Get health check history |
| `/api/cloud-pods/:id/health/config` | PUT | Configure health checks |
| `/api/cloud-pods/:id/health/config/:type` | DELETE | Disable health check |
| `/api/cloud-pods/health/overview` | GET | Tenant-wide health overview |

### Auto-Healing

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/auto-heal/policies` | GET | List auto-heal policies |
| `/api/cloud-pods/auto-heal/policies` | POST | Create/update policy |
| `/api/cloud-pods/:id/auto-heal/history` | GET | Get auto-heal events |
| `/api/cloud-pods/:id/auto-heal/reset` | POST | Reset auto-heal attempts |

---

## Health Status State Machine

```
                    ┌────────────────┐
                    │    unknown     │
                    │  (initial)     │
                    └───────┬────────┘
                            │
           first check      │
           result           │
                            ▼
        ┌───────────────────┬───────────────────┐
        │                   │                   │
   healthy              unhealthy           degraded
   check                check               check
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    healthy    │   │   unhealthy   │   │   degraded    │
│               │◄──┤               │◄──┤               │
│ consecutive   │   │ >= threshold  │   │ 1+ failures   │
│ successes     │   │ failures      │   │ < threshold   │
│ >= threshold  │   │               │   │               │
└───────┬───────┘   └───────┬───────┘   └───────────────┘
        │                   │
        │   healthy         │   triggers
        │   check           │   auto-heal
        │                   │
        ▼                   ▼
┌───────────────────────────────────────────────────────┐
│                    Auto-Heal Flow                     │
│  1. Check cooldown period                             │
│  2. Check max attempts                                │
│  3. Execute action (restart/stop/migrate/notify)      │
│  4. Record event                                      │
│  5. Send notification (if enabled)                    │
│  6. Escalate (if configured and max attempts hit)     │
└───────────────────────────────────────────────────────┘
```

---

## Retention Policy

```javascript
// Cleanup job (run daily)
async function cleanupOldHealthData() {
  const resultRetentionDays = 30;
  const eventRetentionDays = 90;
  
  const resultCutoff = new Date(Date.now() - resultRetentionDays * 24 * 60 * 60 * 1000);
  const eventCutoff = new Date(Date.now() - eventRetentionDays * 24 * 60 * 60 * 1000);
  
  // Delete old health results
  const deletedResults = await prisma.cloudPodHealthResult.deleteMany({
    where: { checkedAt: { lt: resultCutoff } }
  });
  
  // Delete old auto-heal events
  const deletedEvents = await prisma.cloudPodAutoHealEvent.deleteMany({
    where: { triggeredAt: { lt: eventCutoff } }
  });
  
  console.log(`[Cleanup] Deleted ${deletedResults.count} health results, ${deletedEvents.count} auto-heal events`);
}
```

---

## Implementation Notes

1. **Health Check Intervals**: Default 60 seconds, configurable per check. Consider load when setting intervals for large fleets.

2. **Worker Scaling**: The health check worker can be scaled horizontally. Use Redis-based job distribution to avoid duplicate checks.

3. **Proxmox Integration**: For `ping` checks, the worker needs network access to pod IPs. Consider running the health check worker on a node with direct access.

4. **Auto-Heal Safety**: 
   - Cooldown prevents rapid-fire restarts
   - Max attempts prevents infinite restart loops
   - Escalation path for persistent issues

5. **MigraAgent**: For best results, deploy the MigraAgent inside pods for heartbeat-based monitoring. This provides deeper health insights than network checks.

---

## Dashboard Integration

The health monitoring system integrates with the mPanel dashboard:

1. **Pod Status Badge**: Show health status indicator on pod cards
2. **Health Timeline**: Visual timeline of health check results
3. **Auto-Heal Events**: Log viewer for auto-heal actions
4. **Policy Configuration**: UI for managing auto-heal policies
5. **Alerts**: Real-time notifications for health state changes

---

## Next Steps

1. Run Prisma migration to create tables
2. Deploy health check worker alongside CloudPod workers
3. Integrate with notification system (email, Slack, webhooks)
4. Add dashboard UI components
5. Configure default health checks on pod creation
