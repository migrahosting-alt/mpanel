/**
 * CloudPods Enterprise Types
 * Type definitions for enterprise-grade CloudPods features
 */

// ============================================
// AUDIT LOG TYPES
// ============================================

export type CloudPodAuditCategory =
  | 'lifecycle'   // create, destroy, start, stop, rebuild
  | 'quota'       // quota checks, limit changes
  | 'security'    // security group changes, firewall rules
  | 'backup'      // backup create, restore, delete
  | 'health'      // health checks, auto-healing
  | 'webhook'     // webhook delivery events
  | 'system';     // system/worker actions

export type CloudPodAuditAction =
  // Lifecycle actions
  | 'POD_CREATED'
  | 'POD_DESTROYED'
  | 'POD_STARTED'
  | 'POD_STOPPED'
  | 'POD_REBOOTED'
  | 'POD_REBUILT'
  | 'POD_RESIZED'
  // Quota actions
  | 'QUOTA_CHECKED'
  | 'QUOTA_EXCEEDED'
  | 'QUOTA_UPDATED'
  // Security actions
  | 'SECURITY_GROUP_CREATED'
  | 'SECURITY_GROUP_UPDATED'
  | 'SECURITY_GROUP_DELETED'
  | 'SECURITY_GROUP_ASSIGNED'
  | 'SECURITY_GROUP_UNASSIGNED'
  | 'FIREWALL_RULE_ADDED'
  | 'FIREWALL_RULE_REMOVED'
  // Backup actions
  | 'BACKUP_CREATED'
  | 'BACKUP_RESTORED'
  | 'BACKUP_DELETED'
  | 'BACKUP_POLICY_CREATED'
  | 'BACKUP_POLICY_UPDATED'
  | 'BACKUP_POLICY_DELETED'
  // Health actions
  | 'HEALTH_CHECK_PASSED'
  | 'HEALTH_CHECK_FAILED'
  | 'AUTO_HEAL_TRIGGERED'
  | 'AUTO_HEAL_COMPLETED'
  | 'AUTO_HEAL_FAILED'
  // Webhook actions
  | 'WEBHOOK_CREATED'
  | 'WEBHOOK_UPDATED'
  | 'WEBHOOK_DELETED'
  | 'WEBHOOK_DELIVERED'
  | 'WEBHOOK_DELIVERY_FAILED';

export interface CloudPodAuditContext {
  tenantId: string;
  userId?: string;      // null = system/worker action
  podId?: string;
  vmid?: number;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// WEBHOOK EVENT TYPES
// ============================================

export type CloudPodWebhookEventType =
  | 'pod.created'
  | 'pod.destroyed'
  | 'pod.started'
  | 'pod.stopped'
  | 'pod.rebooted'
  | 'pod.rebuilt'
  | 'pod.resized'
  | 'pod.health.changed'
  | 'backup.created'
  | 'backup.restored'
  | 'backup.failed'
  | 'security_group.updated'
  | 'quota.exceeded';

export interface CloudPodEventPayload {
  eventType: CloudPodWebhookEventType;
  timestamp: string;   // ISO 8601
  tenantId: string;
  podId?: string;
  vmid?: number;
  data: Record<string, unknown>;
}

// ============================================
// SECURITY GROUP TYPES
// ============================================

export type SecurityGroupDirection = 'ingress' | 'egress';
export type SecurityGroupProtocol = 'tcp' | 'udp' | 'icmp' | 'any';

export interface SecurityGroupRuleInput {
  direction: SecurityGroupDirection;
  protocol: SecurityGroupProtocol;
  portRange: string;    // "22", "80-443", "*"
  cidr: string;         // "0.0.0.0/0", "10.1.10.0/24"
  description?: string;
}

export interface SecurityGroupCreateInput {
  tenantId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  rules?: SecurityGroupRuleInput[];
}

export interface SecurityGroupUpdateInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  rules?: SecurityGroupRuleInput[];  // replace all rules
}

// ============================================
// HEALTH & METRICS TYPES
// ============================================

export type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  podId: string;
  vmid: number;
  status: HealthStatus;
  lastCheckedAt: Date;
  lastError?: string;
  consecutiveFailures: number;
  autoHealTriggered?: boolean;
}

export interface UsageSample {
  tenantId: string;
  podId: string;
  timestamp: Date;
  cpuPct: number;
  memoryMb: number;
  diskGb: number;
  netInMb: number;
  netOutMb: number;
}

export interface TenantUsageSummary {
  tenantId: string;
  period: { start: Date; end: Date };
  totalPods: number;
  totalCpuCores: number;
  totalRamMb: number;
  totalDiskGb: number;
  avgCpuUtilization: number;
  avgRamUtilization: number;
  totalNetworkInMb: number;
  totalNetworkOutMb: number;
}

// ============================================
// BACKUP TYPES
// ============================================

export type BackupType = 'snapshot' | 'full-backup';
export type BackupStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BackupPolicyInput {
  tenantId?: string;
  podId?: string;
  name: string;
  schedule: string;    // cron or "daily" | "weekly" | "hourly"
  retentionCount?: number;
  type: BackupType;
  isActive?: boolean;
}

export interface BackupResult {
  id: string;
  podId: string;
  policyId?: string;
  backupType: BackupType;
  location: string;
  status: BackupStatus;
  sizeGb?: number;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

// ============================================
// WEBHOOK CONFIGURATION TYPES
// ============================================

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'permanently_failed';

export interface WebhookConfigInput {
  tenantId: string;
  name: string;
  url: string;
  secret: string;
  events: CloudPodWebhookEventType[];
  isActive?: boolean;
}

export interface WebhookDeliveryResult {
  id: string;
  webhookId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  httpStatus?: number;
  errorMessage?: string;
  attempts: number;
  nextRetryAt?: Date;
  createdAt: Date;
}
