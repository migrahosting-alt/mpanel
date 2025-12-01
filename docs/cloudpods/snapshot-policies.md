# CloudPods Snapshot Policies & Backup Management

## Overview

Automated snapshot management system for CloudPods that provides scheduled backups, configurable retention policies, and one-click restore capabilities. Integrates with Proxmox's native snapshot functionality for VM-level backups.

---

## Prisma Schema

```prisma
// Snapshot policy configuration
model CloudPodSnapshotPolicy {
  id                Int       @id @default(autoincrement())
  tenantId          Int       @map("tenant_id")
  name              String
  description       String?
  schedule          String    // Cron expression: '0 2 * * *' (daily at 2am)
  retentionCount    Int       @default(7) @map("retention_count") // Keep last N snapshots
  retentionDays     Int?      @map("retention_days") // Or keep for N days
  snapshotType      String    @default("full") @map("snapshot_type") // 'full', 'memory', 'disk_only'
  includeMemory     Boolean   @default(false) @map("include_memory")
  quiesce           Boolean   @default(true) // Pause VM briefly for consistency
  enabled           Boolean   @default(true)
  notifyOnFailure   Boolean   @default(true) @map("notify_on_failure")
  notifyOnSuccess   Boolean   @default(false) @map("notify_on_success")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assignments       CloudPodSnapshotPolicyAssignment[]
  snapshots         CloudPodSnapshot[]

  @@map("cloud_pod_snapshot_policies")
}

// Policy-to-pod assignment
model CloudPodSnapshotPolicyAssignment {
  id              Int       @id @default(autoincrement())
  policyId        Int       @map("policy_id")
  podId           Int       @map("pod_id")
  assignedAt      DateTime  @default(now()) @map("assigned_at")
  assignedBy      Int       @map("assigned_by")

  policy          CloudPodSnapshotPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@unique([policyId, podId])
  @@map("cloud_pod_snapshot_policy_assignments")
}

// Individual snapshots
model CloudPodSnapshot {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  policyId        Int?      @map("policy_id") // null = manual snapshot
  name            String
  description     String?
  proxmoxSnapId   String?   @map("proxmox_snap_id") // Proxmox snapshot ID
  status          String    @default("pending") // 'pending', 'creating', 'completed', 'failed', 'deleting', 'deleted'
  sizeBytes       BigInt?   @map("size_bytes")
  snapshotType    String    @map("snapshot_type") // 'full', 'memory', 'disk_only'
  includesMemory  Boolean   @default(false) @map("includes_memory")
  isManual        Boolean   @default(false) @map("is_manual")
  errorMessage    String?   @map("error_message")
  createdAt       DateTime  @default(now()) @map("created_at")
  completedAt     DateTime? @map("completed_at")
  expiresAt       DateTime? @map("expires_at")
  deletedAt       DateTime? @map("deleted_at")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)
  policy          CloudPodSnapshotPolicy? @relation(fields: [policyId], references: [id], onDelete: SetNull)
  restores        CloudPodSnapshotRestore[]

  @@index([podId, status])
  @@index([createdAt])
  @@index([expiresAt])
  @@map("cloud_pod_snapshots")
}

// Restore operations
model CloudPodSnapshotRestore {
  id              Int       @id @default(autoincrement())
  snapshotId      Int       @map("snapshot_id")
  podId           Int       @map("pod_id")
  initiatedBy     Int       @map("initiated_by")
  status          String    @default("pending") // 'pending', 'restoring', 'completed', 'failed'
  restoreType     String    @map("restore_type") // 'in_place', 'new_pod'
  targetPodId     Int?      @map("target_pod_id") // For 'new_pod' restore
  errorMessage    String?   @map("error_message")
  startedAt       DateTime  @default(now()) @map("started_at")
  completedAt     DateTime? @map("completed_at")

  snapshot        CloudPodSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@index([podId, startedAt])
  @@map("cloud_pod_snapshot_restores")
}

// Scheduled job tracking
model CloudPodSnapshotJob {
  id              Int       @id @default(autoincrement())
  policyId        Int       @map("policy_id")
  podId           Int       @map("pod_id")
  scheduledFor    DateTime  @map("scheduled_for")
  status          String    @default("scheduled") // 'scheduled', 'running', 'completed', 'failed', 'skipped'
  snapshotId      Int?      @map("snapshot_id")
  errorMessage    String?   @map("error_message")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")

  @@index([scheduledFor, status])
  @@index([policyId, scheduledFor])
  @@map("cloud_pod_snapshot_jobs")
}
```

---

## Snapshot Types

| Type | Description | Use Case |
|------|-------------|----------|
| `full` | Complete VM state including disk | Standard backup |
| `memory` | Full state + RAM contents | Live restore capability |
| `disk_only` | Only disk data, no VM state | Smaller backups |

---

## Service Layer

```javascript
// src/services/cloudPodSnapshots.js

import { prisma } from '../database.js';
import { auditLog } from './cloudPodAudit.js';
import { runProxmoxCommand } from './proxmoxSsh.js';

/**
 * Snapshot management service for CloudPods
 */
class CloudPodSnapshotService {
  
  // ─────────────────────────────────────────────────────────────────
  // Policy Management
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Create a snapshot policy
   */
  async createPolicy(tenantId, config, actorUserId) {
    const {
      name,
      description,
      schedule,
      retentionCount = 7,
      retentionDays,
      snapshotType = 'full',
      includeMemory = false,
      quiesce = true,
      notifyOnFailure = true,
      notifyOnSuccess = false
    } = config;
    
    // Validate cron expression
    if (!this.isValidCron(schedule)) {
      throw new Error('Invalid cron schedule expression');
    }
    
    const policy = await prisma.cloudPodSnapshotPolicy.create({
      data: {
        tenantId,
        name,
        description,
        schedule,
        retentionCount,
        retentionDays,
        snapshotType,
        includeMemory,
        quiesce,
        notifyOnFailure,
        notifyOnSuccess,
        enabled: true
      }
    });
    
    return policy;
  }

  /**
   * Update a snapshot policy
   */
  async updatePolicy(policyId, updates, actorUserId) {
    if (updates.schedule && !this.isValidCron(updates.schedule)) {
      throw new Error('Invalid cron schedule expression');
    }
    
    const policy = await prisma.cloudPodSnapshotPolicy.update({
      where: { id: policyId },
      data: updates
    });
    
    // Re-schedule jobs if schedule changed
    if (updates.schedule) {
      await this.rescheduleJobs(policyId);
    }
    
    return policy;
  }

  /**
   * Delete a snapshot policy
   */
  async deletePolicy(policyId, actorUserId) {
    // Cancel pending jobs
    await prisma.cloudPodSnapshotJob.updateMany({
      where: { policyId, status: 'scheduled' },
      data: { status: 'cancelled' }
    });
    
    await prisma.cloudPodSnapshotPolicy.delete({
      where: { id: policyId }
    });
    
    return { deleted: true };
  }

  /**
   * Get policies for a tenant
   */
  async getPolicies(tenantId) {
    return prisma.cloudPodSnapshotPolicy.findMany({
      where: { tenantId },
      include: {
        assignments: {
          include: {
            pod: { select: { id: true, name: true } }
          }
        },
        _count: { select: { snapshots: true } }
      }
    });
  }

  /**
   * Assign policy to pods
   */
  async assignPolicyToPods(policyId, podIds, actorUserId) {
    const assignments = await prisma.cloudPodSnapshotPolicyAssignment.createMany({
      data: podIds.map(podId => ({
        policyId,
        podId,
        assignedBy: actorUserId
      })),
      skipDuplicates: true
    });
    
    // Schedule initial jobs for newly assigned pods
    await this.scheduleJobsForPolicy(policyId, podIds);
    
    return { assigned: assignments.count };
  }

  /**
   * Remove policy from pods
   */
  async removePolicyFromPods(policyId, podIds) {
    await prisma.cloudPodSnapshotPolicyAssignment.deleteMany({
      where: {
        policyId,
        podId: { in: podIds }
      }
    });
    
    // Cancel pending jobs for these pods
    await prisma.cloudPodSnapshotJob.updateMany({
      where: {
        policyId,
        podId: { in: podIds },
        status: 'scheduled'
      },
      data: { status: 'cancelled' }
    });
    
    return { removed: podIds.length };
  }

  // ─────────────────────────────────────────────────────────────────
  // Snapshot Operations
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Create a manual snapshot
   */
  async createManualSnapshot(podId, options, actorUserId) {
    const { name, description, snapshotType = 'full', includeMemory = false } = options;
    
    const pod = await prisma.cloudPod.findUnique({
      where: { id: podId },
      select: { id: true, name: true, tenantId: true, proxmoxVmid: true, proxmoxNode: true }
    });
    
    if (!pod) throw new Error('Pod not found');
    
    const snapshot = await prisma.cloudPodSnapshot.create({
      data: {
        podId,
        name: name || `manual-${pod.name}-${Date.now()}`,
        description,
        snapshotType,
        includesMemory: includeMemory,
        isManual: true,
        status: 'pending'
      }
    });
    
    // Queue snapshot creation
    const { cloudPodQueue } = await import('../workers/cloudPodQueues.js');
    await cloudPodQueue.add('createSnapshot', {
      snapshotId: snapshot.id,
      podId,
      proxmoxVmid: pod.proxmoxVmid,
      proxmoxNode: pod.proxmoxNode,
      snapshotType,
      includeMemory
    });
    
    await auditLog(podId, actorUserId, 'snapshot_created', {
      snapshotId: snapshot.id,
      name: snapshot.name,
      type: snapshotType
    });
    
    return snapshot;
  }

  /**
   * Execute snapshot creation on Proxmox
   */
  async executeSnapshot(snapshotId) {
    const snapshot = await prisma.cloudPodSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        pod: {
          select: { proxmoxVmid: true, proxmoxNode: true }
        }
      }
    });
    
    if (!snapshot) throw new Error('Snapshot not found');
    
    await prisma.cloudPodSnapshot.update({
      where: { id: snapshotId },
      data: { status: 'creating' }
    });
    
    try {
      const vmid = snapshot.pod.proxmoxVmid;
      const node = snapshot.pod.proxmoxNode || 'pve';
      const snapName = `snap_${snapshotId}_${Date.now()}`;
      
      // Create snapshot via Proxmox API/SSH
      // qm snapshot <vmid> <snapname> [OPTIONS]
      const vmstate = snapshot.includesMemory ? 1 : 0;
      const cmd = `qm snapshot ${vmid} ${snapName} --vmstate ${vmstate} --description "${snapshot.name}"`;
      
      await runProxmoxCommand(cmd);
      
      // Get snapshot size
      const sizeOutput = await runProxmoxCommand(
        `qm listsnapshot ${vmid} | grep ${snapName}`
      );
      
      await prisma.cloudPodSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: 'completed',
          proxmoxSnapId: snapName,
          completedAt: new Date(),
          // Parse size from output if available
          sizeBytes: this.parseSizeFromOutput(sizeOutput)
        }
      });
      
      console.log(`[Snapshot] Created ${snapName} for pod ${snapshot.podId}`);
      return { success: true, proxmoxSnapId: snapName };
      
    } catch (error) {
      console.error(`[Snapshot] Failed for ${snapshotId}:`, error);
      
      await prisma.cloudPodSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: 'failed',
          errorMessage: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId, actorUserId) {
    const snapshot = await prisma.cloudPodSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        pod: { select: { proxmoxVmid: true, proxmoxNode: true } }
      }
    });
    
    if (!snapshot) throw new Error('Snapshot not found');
    
    // Mark as deleting
    await prisma.cloudPodSnapshot.update({
      where: { id: snapshotId },
      data: { status: 'deleting' }
    });
    
    try {
      if (snapshot.proxmoxSnapId) {
        const vmid = snapshot.pod.proxmoxVmid;
        await runProxmoxCommand(`qm delsnapshot ${vmid} ${snapshot.proxmoxSnapId}`);
      }
      
      await prisma.cloudPodSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });
      
      await auditLog(snapshot.podId, actorUserId, 'snapshot_deleted', {
        snapshotId,
        name: snapshot.name
      });
      
      return { deleted: true };
      
    } catch (error) {
      console.error(`[Snapshot] Delete failed for ${snapshotId}:`, error);
      
      await prisma.cloudPodSnapshot.update({
        where: { id: snapshotId },
        data: {
          status: 'failed',
          errorMessage: `Delete failed: ${error.message}`
        }
      });
      
      throw error;
    }
  }

  /**
   * Get snapshots for a pod
   */
  async getPodSnapshots(podId, options = {}) {
    const { includeDeleted = false, limit = 50 } = options;
    
    return prisma.cloudPodSnapshot.findMany({
      where: {
        podId,
        ...(includeDeleted ? {} : { status: { not: 'deleted' } })
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        policy: { select: { id: true, name: true } }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Restore Operations
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Restore from a snapshot (in-place)
   */
  async restoreSnapshot(snapshotId, actorUserId, options = {}) {
    const { restoreType = 'in_place' } = options;
    
    const snapshot = await prisma.cloudPodSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        pod: { select: { id: true, name: true, status: true, proxmoxVmid: true } }
      }
    });
    
    if (!snapshot) throw new Error('Snapshot not found');
    if (snapshot.status !== 'completed') {
      throw new Error('Cannot restore from incomplete snapshot');
    }
    
    // Create restore record
    const restore = await prisma.cloudPodSnapshotRestore.create({
      data: {
        snapshotId,
        podId: snapshot.podId,
        initiatedBy: actorUserId,
        restoreType,
        status: 'pending'
      }
    });
    
    // Queue restore job
    const { cloudPodQueue } = await import('../workers/cloudPodQueues.js');
    await cloudPodQueue.add('restoreSnapshot', {
      restoreId: restore.id,
      snapshotId,
      podId: snapshot.podId,
      proxmoxVmid: snapshot.pod.proxmoxVmid,
      proxmoxSnapId: snapshot.proxmoxSnapId,
      restoreType
    });
    
    await auditLog(snapshot.podId, actorUserId, 'snapshot_restore_initiated', {
      snapshotId,
      snapshotName: snapshot.name,
      restoreType
    });
    
    return restore;
  }

  /**
   * Execute snapshot restore on Proxmox
   */
  async executeRestore(restoreId) {
    const restore = await prisma.cloudPodSnapshotRestore.findUnique({
      where: { id: restoreId },
      include: {
        snapshot: true,
        pod: { select: { proxmoxVmid: true, status: true } }
      }
    });
    
    if (!restore) throw new Error('Restore record not found');
    
    await prisma.cloudPodSnapshotRestore.update({
      where: { id: restoreId },
      data: { status: 'restoring' }
    });
    
    try {
      const vmid = restore.pod.proxmoxVmid;
      const snapName = restore.snapshot.proxmoxSnapId;
      
      // Stop VM if running
      if (restore.pod.status === 'running') {
        await runProxmoxCommand(`qm stop ${vmid}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Rollback to snapshot
      await runProxmoxCommand(`qm rollback ${vmid} ${snapName}`);
      
      // Start VM
      await runProxmoxCommand(`qm start ${vmid}`);
      
      await prisma.cloudPodSnapshotRestore.update({
        where: { id: restoreId },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });
      
      // Update pod status
      await prisma.cloudPod.update({
        where: { id: restore.podId },
        data: { status: 'running' }
      });
      
      console.log(`[Snapshot] Restored pod ${restore.podId} from ${snapName}`);
      return { success: true };
      
    } catch (error) {
      console.error(`[Snapshot] Restore failed for ${restoreId}:`, error);
      
      await prisma.cloudPodSnapshotRestore.update({
        where: { id: restoreId },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date()
        }
      });
      
      throw error;
    }
  }

  /**
   * Get restore history for a pod
   */
  async getRestoreHistory(podId, limit = 20) {
    return prisma.cloudPodSnapshotRestore.findMany({
      where: { podId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        snapshot: { select: { id: true, name: true } }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Retention & Cleanup
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Apply retention policy - delete old snapshots
   */
  async applyRetentionPolicy(policyId) {
    const policy = await prisma.cloudPodSnapshotPolicy.findUnique({
      where: { id: policyId },
      include: {
        assignments: { select: { podId: true } }
      }
    });
    
    if (!policy) return;
    
    for (const assignment of policy.assignments) {
      await this.cleanupPodSnapshots(assignment.podId, policyId, {
        retentionCount: policy.retentionCount,
        retentionDays: policy.retentionDays
      });
    }
  }

  /**
   * Clean up old snapshots for a pod based on retention settings
   */
  async cleanupPodSnapshots(podId, policyId, retention) {
    const { retentionCount, retentionDays } = retention;
    
    // Get all completed snapshots for this policy
    const snapshots = await prisma.cloudPodSnapshot.findMany({
      where: {
        podId,
        policyId,
        status: 'completed',
        isManual: false
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const toDelete = [];
    
    // Keep by count
    if (retentionCount && snapshots.length > retentionCount) {
      toDelete.push(...snapshots.slice(retentionCount));
    }
    
    // Keep by days
    if (retentionDays) {
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      const expired = snapshots.filter(s => s.createdAt < cutoff);
      // Only add if not already in toDelete
      for (const snap of expired) {
        if (!toDelete.find(d => d.id === snap.id)) {
          toDelete.push(snap);
        }
      }
    }
    
    // Delete old snapshots
    for (const snapshot of toDelete) {
      try {
        await this.deleteSnapshot(snapshot.id, null); // System cleanup
        console.log(`[Retention] Deleted snapshot ${snapshot.id} for pod ${podId}`);
      } catch (error) {
        console.error(`[Retention] Failed to delete snapshot ${snapshot.id}:`, error);
      }
    }
    
    return { deleted: toDelete.length };
  }

  /**
   * Cleanup expired snapshots across all policies
   * Run daily via scheduler
   */
  async runGlobalRetentionCleanup() {
    const policies = await prisma.cloudPodSnapshotPolicy.findMany({
      where: { enabled: true }
    });
    
    let totalDeleted = 0;
    for (const policy of policies) {
      const result = await this.applyRetentionPolicy(policy.id);
      totalDeleted += result?.deleted || 0;
    }
    
    console.log(`[Retention] Global cleanup deleted ${totalDeleted} snapshots`);
    return { totalDeleted };
  }

  // ─────────────────────────────────────────────────────────────────
  // Scheduling
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Schedule snapshot jobs for a policy
   */
  async scheduleJobsForPolicy(policyId, podIds = null) {
    const policy = await prisma.cloudPodSnapshotPolicy.findUnique({
      where: { id: policyId },
      include: {
        assignments: { select: { podId: true } }
      }
    });
    
    if (!policy || !policy.enabled) return;
    
    const targetPods = podIds || policy.assignments.map(a => a.podId);
    const nextRun = this.getNextCronTime(policy.schedule);
    
    // Create scheduled jobs
    for (const podId of targetPods) {
      await prisma.cloudPodSnapshotJob.upsert({
        where: {
          // Compound unique on policyId + podId + scheduledFor
          id: 0 // This will always fail, forcing create
        },
        create: {
          policyId,
          podId,
          scheduledFor: nextRun,
          status: 'scheduled'
        },
        update: {}
      }).catch(() => {
        // Create if doesn't exist
        return prisma.cloudPodSnapshotJob.create({
          data: {
            policyId,
            podId,
            scheduledFor: nextRun,
            status: 'scheduled'
          }
        });
      });
    }
  }

  /**
   * Reschedule jobs after policy update
   */
  async rescheduleJobs(policyId) {
    // Cancel existing scheduled jobs
    await prisma.cloudPodSnapshotJob.updateMany({
      where: { policyId, status: 'scheduled' },
      data: { status: 'cancelled' }
    });
    
    // Create new scheduled jobs
    await this.scheduleJobsForPolicy(policyId);
  }

  /**
   * Process scheduled snapshot jobs
   * Run every minute via scheduler
   */
  async processScheduledJobs() {
    const now = new Date();
    
    // Get jobs that are due
    const dueJobs = await prisma.cloudPodSnapshotJob.findMany({
      where: {
        status: 'scheduled',
        scheduledFor: { lte: now }
      },
      include: {
        policy: true
      }
    });
    
    for (const job of dueJobs) {
      if (!job.policy || !job.policy.enabled) {
        await prisma.cloudPodSnapshotJob.update({
          where: { id: job.id },
          data: { status: 'skipped' }
        });
        continue;
      }
      
      // Mark as running
      await prisma.cloudPodSnapshotJob.update({
        where: { id: job.id },
        data: { status: 'running', startedAt: now }
      });
      
      try {
        // Create snapshot
        const snapshot = await prisma.cloudPodSnapshot.create({
          data: {
            podId: job.podId,
            policyId: job.policyId,
            name: `${job.policy.name}-${now.toISOString().slice(0, 10)}`,
            snapshotType: job.policy.snapshotType,
            includesMemory: job.policy.includeMemory,
            isManual: false,
            status: 'pending'
          }
        });
        
        // Execute snapshot
        await this.executeSnapshot(snapshot.id);
        
        // Update job
        await prisma.cloudPodSnapshotJob.update({
          where: { id: job.id },
          data: {
            status: 'completed',
            snapshotId: snapshot.id,
            completedAt: new Date()
          }
        });
        
        // Schedule next job
        const nextRun = this.getNextCronTime(job.policy.schedule);
        await prisma.cloudPodSnapshotJob.create({
          data: {
            policyId: job.policyId,
            podId: job.podId,
            scheduledFor: nextRun,
            status: 'scheduled'
          }
        });
        
        // Apply retention after successful snapshot
        await this.applyRetentionPolicy(job.policyId);
        
        // Send success notification if enabled
        if (job.policy.notifyOnSuccess) {
          await this.sendNotification(job, 'success');
        }
        
      } catch (error) {
        console.error(`[Snapshot Job] Failed for job ${job.id}:`, error);
        
        await prisma.cloudPodSnapshotJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date()
          }
        });
        
        // Send failure notification if enabled
        if (job.policy?.notifyOnFailure) {
          await this.sendNotification(job, 'failed', error.message);
        }
        
        // Schedule next job anyway
        if (job.policy) {
          const nextRun = this.getNextCronTime(job.policy.schedule);
          await prisma.cloudPodSnapshotJob.create({
            data: {
              policyId: job.policyId,
              podId: job.podId,
              scheduledFor: nextRun,
              status: 'scheduled'
            }
          });
        }
      }
    }
    
    return { processed: dueJobs.length };
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Validate cron expression
   */
  isValidCron(expression) {
    const parts = expression.split(' ');
    return parts.length === 5;
  }

  /**
   * Get next cron execution time
   */
  getNextCronTime(cronExpression) {
    // Simple implementation - in production use a library like cron-parser
    const now = new Date();
    // For simplicity, schedule 24 hours from now
    // TODO: Use cron-parser for accurate scheduling
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  /**
   * Parse size from Proxmox output
   */
  parseSizeFromOutput(output) {
    // Parse size from qm listsnapshot output
    // Example: "snap_1_123456789 ... 2.5G"
    const match = output?.match(/(\d+\.?\d*)\s*(G|M|K)/);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'G': return BigInt(Math.round(value * 1024 * 1024 * 1024));
      case 'M': return BigInt(Math.round(value * 1024 * 1024));
      case 'K': return BigInt(Math.round(value * 1024));
      default: return null;
    }
  }

  /**
   * Send notification about snapshot job
   */
  async sendNotification(job, status, error = null) {
    // TODO: Integrate with notification system
    const pod = await prisma.cloudPod.findUnique({
      where: { id: job.podId },
      select: { name: true }
    });
    
    const message = status === 'success'
      ? `Snapshot completed for CloudPod "${pod?.name}"`
      : `Snapshot failed for CloudPod "${pod?.name}": ${error}`;
    
    console.log(`[Snapshot Notification] ${message}`);
  }
}

export const cloudPodSnapshots = new CloudPodSnapshotService();
```

---

## API Routes

```javascript
// Add to src/routes/cloudPodRoutes.js

import { cloudPodSnapshots } from '../services/cloudPodSnapshots.js';

// ─────────────────────────────────────────────────────────────────
// Snapshot Policy Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/snapshot-policies
 * List snapshot policies for tenant
 */
router.get('/snapshot-policies', requireAuth, async (req, res) => {
  try {
    const policies = await cloudPodSnapshots.getPolicies(req.user.tenantId);
    res.json(policies);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/snapshot-policies
 * Create a new snapshot policy
 */
router.post('/snapshot-policies', requireAuth, async (req, res) => {
  try {
    const policy = await cloudPodSnapshots.createPolicy(
      req.user.tenantId,
      req.body,
      req.user.id
    );
    res.status(201).json(policy);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * PUT /api/cloud-pods/snapshot-policies/:id
 * Update a snapshot policy
 */
router.put('/snapshot-policies/:id', requireAuth, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const policy = await cloudPodSnapshots.updatePolicy(policyId, req.body, req.user.id);
    res.json(policy);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cloud-pods/snapshot-policies/:id
 * Delete a snapshot policy
 */
router.delete('/snapshot-policies/:id', requireAuth, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    await cloudPodSnapshots.deletePolicy(policyId, req.user.id);
    res.json({ deleted: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/snapshot-policies/:id/assign
 * Assign policy to pods
 */
router.post('/snapshot-policies/:id/assign', requireAuth, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const { podIds } = req.body;
    
    const result = await cloudPodSnapshots.assignPolicyToPods(policyId, podIds, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/snapshot-policies/:id/unassign
 * Remove policy from pods
 */
router.post('/snapshot-policies/:id/unassign', requireAuth, async (req, res) => {
  try {
    const policyId = parseInt(req.params.id);
    const { podIds } = req.body;
    
    const result = await cloudPodSnapshots.removePolicyFromPods(policyId, podIds);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Snapshot Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/:id/snapshots
 * List snapshots for a pod
 */
router.get('/:id/snapshots', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const snapshots = await cloudPodSnapshots.getPodSnapshots(podId);
    res.json(snapshots);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/:id/snapshots
 * Create a manual snapshot
 */
router.post('/:id/snapshots', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const snapshot = await cloudPodSnapshots.createManualSnapshot(
      podId,
      req.body,
      req.user.id
    );
    res.status(201).json(snapshot);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cloud-pods/:id/snapshots/:snapshotId
 * Delete a snapshot
 */
router.delete('/:id/snapshots/:snapshotId', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const snapshotId = parseInt(req.params.snapshotId);
    
    await validatePodAccess(req, podId);
    await cloudPodSnapshots.deleteSnapshot(snapshotId, req.user.id);
    
    res.json({ deleted: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/:id/snapshots/:snapshotId/restore
 * Restore from a snapshot
 */
router.post('/:id/snapshots/:snapshotId/restore', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const snapshotId = parseInt(req.params.snapshotId);
    
    await validatePodAccess(req, podId);
    
    const restore = await cloudPodSnapshots.restoreSnapshot(
      snapshotId,
      req.user.id,
      req.body
    );
    res.json(restore);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/:id/restore-history
 * Get restore history for a pod
 */
router.get('/:id/restore-history', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const history = await cloudPodSnapshots.getRestoreHistory(podId);
    res.json(history);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
```

---

## API Reference

### Snapshot Policies

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/snapshot-policies` | GET | List tenant policies |
| `/api/cloud-pods/snapshot-policies` | POST | Create policy |
| `/api/cloud-pods/snapshot-policies/:id` | PUT | Update policy |
| `/api/cloud-pods/snapshot-policies/:id` | DELETE | Delete policy |
| `/api/cloud-pods/snapshot-policies/:id/assign` | POST | Assign to pods |
| `/api/cloud-pods/snapshot-policies/:id/unassign` | POST | Remove from pods |

### Snapshots

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/:id/snapshots` | GET | List pod snapshots |
| `/api/cloud-pods/:id/snapshots` | POST | Create manual snapshot |
| `/api/cloud-pods/:id/snapshots/:snapId` | DELETE | Delete snapshot |
| `/api/cloud-pods/:id/snapshots/:snapId/restore` | POST | Restore from snapshot |
| `/api/cloud-pods/:id/restore-history` | GET | Restore history |

---

## Common Cron Schedules

| Schedule | Cron Expression | Description |
|----------|-----------------|-------------|
| Daily at 2am | `0 2 * * *` | Standard daily backup |
| Twice daily | `0 2,14 * * *` | 2am and 2pm |
| Weekly Sunday | `0 2 * * 0` | Weekly backup |
| Every 6 hours | `0 */6 * * *` | Frequent backups |
| Monthly 1st | `0 2 1 * *` | Monthly archival |

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Scheduled Snapshot Flow                       │
│                                                                 │
│   Policy Created ──▶ Jobs Scheduled ──▶ Cron Triggers           │
│                                               │                 │
│                                               ▼                 │
│                                        Process Jobs             │
│                                               │                 │
│                   ┌───────────────────────────┼─────────────┐   │
│                   │                           │             │   │
│                   ▼                           ▼             ▼   │
│            Create Snapshot            Apply Retention    Notify │
│                   │                           │                 │
│                   ▼                           ▼                 │
│            Execute on Proxmox         Delete Old Snaps          │
│                   │                                             │
│                   ▼                                             │
│            Schedule Next Job                                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Restore Flow                               │
│                                                                 │
│   Select Snapshot ──▶ Create Restore Record ──▶ Queue Job       │
│                                                      │          │
│                                                      ▼          │
│                                               Stop VM (if running)
│                                                      │          │
│                                                      ▼          │
│                                            qm rollback <vmid>   │
│                                                      │          │
│                                                      ▼          │
│                                               Start VM          │
│                                                      │          │
│                                                      ▼          │
│                                            Update Status        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Retention Policy Examples

```javascript
// Keep last 7 daily snapshots
{
  retentionCount: 7,
  retentionDays: null
}

// Keep snapshots for 30 days
{
  retentionCount: null,
  retentionDays: 30
}

// Keep last 7 OR 14 days (whichever keeps more)
{
  retentionCount: 7,
  retentionDays: 14
}
```

---

## Dashboard Integration

1. **Snapshot Timeline**: Visual timeline showing snapshot history
2. **Policy Manager**: Create/edit policies with visual schedule picker
3. **Quick Restore**: One-click restore button on pod dashboard
4. **Storage Usage**: Show total snapshot storage consumption
5. **Job Status**: View scheduled/running/completed jobs
6. **Notifications**: Configure email/webhook alerts for snapshot events

---

## Next Steps

1. Run Prisma migration to create tables
2. Deploy snapshot worker alongside CloudPod workers
3. Install cron-parser for accurate schedule calculations
4. Add dashboard UI components
5. Configure default snapshot policy for new tenants
6. Integrate with backup storage for off-site copies
