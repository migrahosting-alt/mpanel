export type CloudPodPlan = 'mini' | 'pro' | 'business' | 'enterprise';

export interface CloudPod {
  id: number;
  tenantId: number;
  name: string;
  plan: CloudPodPlan;
  status: 'provisioning' | 'running' | 'stopped' | 'error' | 'deleting';
  region: string;
  node: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  createdAt: string;
  updatedAt: string;
}

export interface CloudPodMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

export interface CloudPodLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string; // 'provisioner' | 'agent' | 'panel'
}
