// src/types/cloudpods.d.ts

// ------------------------
// Core enums / unions
// ------------------------

export type CloudPodStatus =
  | 'pending'
  | 'provisioning'
  | 'active'
  | 'error'
  | 'deleting'
  | 'deleted';

export type CloudPodQueueAction =
  | 'create'
  | 'destroy'
  | 'start'
  | 'stop'
  | 'reboot'
  | 'backup'
  | 'scale'
  | 'sync';

export type CloudPodQueueStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed';

// ------------------------
// Plan & Blueprint
// ------------------------

export interface CloudPodPlan {
  code: string;
  name: string;
  description?: string;
  priceMonthly: number;
  vcpu: number;
  ramMb: number;
  storageGb: number;
  bandwidthGb?: number;
  bandwidthType?: 'metered' | 'unmetered';
  isActive?: boolean;

  // Optional billing integration
  billingProductId?: string;
  billingPlanId?: string;

  // Optional per-plan tenant caps
  maxPodsPerTenant?: number | null;
}

export interface CloudPodBlueprint {
  id: string; // or code
  name: string;
  description?: string;

  proxmoxTemplateVmid: number;
  defaultNode: string;
  storagePool: string;
  networkBridge: string;

  // Misc metadata for cloud-init / automation
  cloudInitProfile?: Record<string, unknown>;
  tags?: string[];

  isActive?: boolean;
}

// ------------------------
// Pod & related models
// ------------------------

export interface CloudPod {
  id: string; // e.g. "pod-1764399306066"
  tenantId: string | number;
  userId?: string | number | null;

  planCode: string;
  blueprintId?: string | null;

  vmid: number | null;
  node?: string | null;
  ipAddress?: string | null;

  status: CloudPodStatus;

  cpuCores: number;
  memoryMb: number;
  diskGb: number;

  displayName?: string | null;
  notes?: string | null;

  provisioningState?: Record<string, unknown> | null;
  lastError?: string | null;

  createdAt: string; // ISO timestamp
  updatedAt: string;
  deletedAt?: string | null;
}

export interface CloudPodListItem extends CloudPod {
  // Same as CloudPod for now, but can be slimmed down later
}

// ------------------------
// Queue & Jobs
// ------------------------

export interface CloudPodQueueItem {
  id: string | number;
  podId: string;
  tenantId?: string | number;
  userId?: string | number | null;

  action: CloudPodQueueAction;
  payload?: Record<string, unknown> | null;

  status: CloudPodQueueStatus;
  retryCount: number;
  errorMessage?: string | null;

  createdAt: string;
  updatedAt: string;
  processedAt?: string | null;
}

export interface CloudPodJob {
  id: string;
  tenantId: string | number;
  userId?: string | number | null;

  type:
    | 'provision'
    | 'destroy'
    | 'scale'
    | 'backup'
    | 'sync'
    | 'maintenance';

  status: 'pending' | 'running' | 'success' | 'failed';

  queueItemIds: (string | number)[];
  metadata?: Record<string, unknown> | null;

  createdAt: string;
  updatedAt: string;
}

// ------------------------
// Quotas
// ------------------------

export interface CloudPodQuotaLimits {
  max_pods: number;
  max_cpu_cores: number;
  max_memory_mb: number;
  max_disk_gb: number;
}

export interface CloudPodQuotaUsage {
  pods: number;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}

export interface CloudPodQuotaRemaining {
  pods: number;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}

export interface CloudPodQuotaDetails extends CloudPodQuotaLimits {
  current_pods: number;
  requested_pods: number;

  current_cpu_cores: number;
  requested_cpu_cores: number;

  current_memory_mb: number;
  requested_memory_mb: number;

  current_disk_gb: number;
  requested_disk_gb: number;

  error_field?: 'pods' | 'cpu_cores' | 'memory_mb' | 'disk_gb';
  error_code?:
    | 'MAX_PODS_EXCEEDED'
    | 'MAX_CPU_EXCEEDED'
    | 'MAX_MEMORY_EXCEEDED'
    | 'MAX_DISK_EXCEEDED'
    | string;
}

export interface CloudPodQuotaCheckResult {
  allowed: boolean;
  message?: string;
  details?: CloudPodQuotaDetails;
}

export interface CloudPodQuotaSummary {
  limits: CloudPodQuotaLimits;
  usage: CloudPodQuotaUsage;
  remaining: CloudPodQuotaRemaining;
}

// ------------------------
// API DTOs
// ------------------------

// ---- Generic API error

export interface ApiError {
  error: string; // short code, e.g. "QUOTA_EXCEEDED"
  message: string; // user-facing message
  details?: Record<string, unknown>;
}

export interface QuotaExceededError extends ApiError {
  error: 'QUOTA_EXCEEDED';
  details?: CloudPodQuotaDetails & {
    tenantId?: string | number;
  };
}

// ---- Plans

export interface GetCloudPodPlansResponse {
  plans: CloudPodPlan[];
}

export interface GetCloudPodPlanResponse {
  plan: CloudPodPlan;
}

export interface GetCloudPodPlansCompareResponse {
  plans: CloudPodPlan[];
  comparisonTable: unknown; // UI-specific shape if you add one
}

// ---- Create Order

export interface CreateCloudPodOrderRequest {
  planCode: string;
  blueprintCode: string;
  name?: string;
  notes?: string;
  tags?: string[];
}

export interface CreateCloudPodOrderResponse {
  pod: CloudPod;
  job?: CloudPodJob;
  queueItem?: CloudPodQueueItem;
}

// ---- List & get details

export interface GetCloudPodsResponse {
  pods: CloudPodListItem[];
}

export interface GetCloudPodDetailResponse {
  pod: CloudPod;
}

// ---- Destroy / backup / scale

export interface DestroyCloudPodRequest {
  reason?: string;
}

export interface DestroyCloudPodResponse {
  pod: CloudPod;
  job?: CloudPodJob;
}

export interface BackupCloudPodRequest {
  label?: string;
  notes?: string;
}

export interface BackupCloudPodResponse {
  pod: CloudPod;
  job?: CloudPodJob;
}

export interface ScaleCloudPodRequest {
  // Either absolute new size or deltas depending on implementation
  planCode?: string; // optional switch to a new plan
  cpuCores?: number;
  memoryMb?: number;
  diskGb?: number;
}

export interface ScaleCloudPodResponse {
  pod: CloudPod;
  job?: CloudPodJob;
}

// ---- Health

export interface CloudPodHealthStatus {
  vmid: number | null;
  poweredOn: boolean;
  reachable: boolean;
  node?: string | null;
  ipAddress?: string | null;

  lastCheckAt: string;
  metrics?: Record<string, unknown>;
}

export interface GetCloudPodHealthResponse {
  pod: CloudPod;
  health: CloudPodHealthStatus;
}

// ---- Quotas

export interface GetMyQuotaResponse extends CloudPodQuotaSummary {}

export interface CheckQuotaForPlanResponse extends CloudPodQuotaCheckResult {
  planCode: string;
}

export interface GetTenantQuotaResponse extends CloudPodQuotaSummary {
  tenantId: string | number;
}

export interface UpdateTenantQuotaRequest {
  max_pods?: number;
  max_cpu_cores?: number;
  max_memory_mb?: number;
  max_disk_gb?: number;
}

export interface UpdateTenantQuotaResponse extends GetTenantQuotaResponse {}

// ---- Admin stats

export interface CloudPodsAdminStats {
  totalPods: number;
  totalActivePods: number;
  totalTenants: number;

  totalCpuCores: number;
  totalMemoryMb: number;
  totalDiskGb: number;

  byPlan?: Record<string, { count: number; cpuCores: number; memoryMb: number; diskGb: number }>;
  byStatus?: Record<CloudPodStatus, number>;
}

export interface GetCloudPodsAdminStatsResponse {
  stats: CloudPodsAdminStats;
}

// ------------------------
// Helpers / service contracts (optional but useful)
// ------------------------

export interface CheckTenantQuotaParams {
  tenantId: string | number;
  requested: {
    pods: number;
    cpuCores: number;
    memoryMb: number;
    diskGb: number;
  };
}

export interface CloudPodCreateContext {
  tenantId: string | number;
  userId?: string | number | null;
  plan: CloudPodPlan;
  blueprint: CloudPodBlueprint;
  request: CreateCloudPodOrderRequest;
}

export interface CloudPodScaleContext {
  tenantId: string | number;
  userId?: string | number | null;
  pod: CloudPod;
  request: ScaleCloudPodRequest;
}
