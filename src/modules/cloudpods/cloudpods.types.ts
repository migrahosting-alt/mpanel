/**
 * CLOUDPODS Types
 * CloudPod lifecycle, provisioning, and management
 */

export enum CloudPodStatus {
  PROVISIONING = 'PROVISIONING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
  FAILED = 'FAILED',
}

export enum CloudPodPlan {
  MINI = 'MINI',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
  ENTERPRISE = 'ENTERPRISE',
}

export interface CloudPod {
  id: string;
  tenantId: string;
  subscriptionId: string;
  name: string;
  plan: CloudPodPlan;
  status: CloudPodStatus;
  region: string;
  proxmoxVmId: number | null;
  proxmoxNode: string | null;
  ipAddress: string | null;
  hostname: string | null;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  maxWebsites: number;
  maxEmailAccounts: number;
  usageStats: {
    cpuUsagePercent: number;
    ramUsageMb: number;
    diskUsageGb: number;
    websiteCount: number;
    emailAccountCount: number;
  };
  guardianEnabled: boolean;
  guardianStatus: string | null;
  backupPolicyId: string | null;
  lastBackup: Date | null;
  provisionedAt: Date | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloudPodPlanSpec {
  plan: CloudPodPlan;
  displayName: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  maxWebsites: number;
  maxEmailAccounts: number;
  basePrice: number;
}

// Request types
export interface CreateCloudPodRequest {
  tenantId: string;
  subscriptionId: string;
  name: string;
  plan: CloudPodPlan;
  region: string;
}

export interface ResizeCloudPodRequest {
  newPlan: CloudPodPlan;
}

export interface UpdateCloudPodRequest {
  name?: string;
  guardianEnabled?: boolean;
}

// CloudPod plan specifications
export const CLOUDPOD_PLANS: Record<CloudPodPlan, CloudPodPlanSpec> = {
  MINI: {
    plan: CloudPodPlan.MINI,
    displayName: 'CloudPod Mini',
    cpuCores: 1,
    ramMb: 1024,
    diskGb: 20,
    maxWebsites: 5,
    maxEmailAccounts: 10,
    basePrice: 9.99,
  },
  PRO: {
    plan: CloudPodPlan.PRO,
    displayName: 'CloudPod Pro',
    cpuCores: 2,
    ramMb: 2048,
    diskGb: 50,
    maxWebsites: 20,
    maxEmailAccounts: 50,
    basePrice: 19.99,
  },
  BUSINESS: {
    plan: CloudPodPlan.BUSINESS,
    displayName: 'CloudPod Business',
    cpuCores: 4,
    ramMb: 4096,
    diskGb: 100,
    maxWebsites: 50,
    maxEmailAccounts: 100,
    basePrice: 39.99,
  },
  ENTERPRISE: {
    plan: CloudPodPlan.ENTERPRISE,
    displayName: 'CloudPod Enterprise',
    cpuCores: 8,
    ramMb: 8192,
    diskGb: 200,
    maxWebsites: -1, // Unlimited
    maxEmailAccounts: -1, // Unlimited
    basePrice: 79.99,
  },
};
