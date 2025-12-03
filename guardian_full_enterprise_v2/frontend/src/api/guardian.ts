import { apiClient } from '../lib/apiClient';

export type GuardianInstance = {
  id: string;
  tenantId: string;
  dataRegion: string;
  enabled: boolean;
  environment: string;
  policyPack: string;
  policyVersion: string;
  autoRemediationEnabled: boolean;
  autoRemediationAllowedSeverities: string;
  allowProdAutoRemediation: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuardianScan = {
  id: string;
  tenantId: string;
  instanceId: string;
  serverId?: string | null;
  dataRegion: string;
  type: string;
  status: string;
  findingsCount: number;
  severityMax?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type GuardianFinding = {
  id: string;
  tenantId: string;
  scanId: string;
  serverId?: string | null;
  dataRegion: string;
  code: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  createdAt: string;
};

export type GuardianRemediationTask = {
  id: string;
  tenantId: string;
  instanceId: string;
  scanId?: string | null;
  findingId?: string | null;
  serverId?: string | null;
  dataRegion: string;
  status: string;
  mode: string;
  severity?: string | null;
  actionType: string;
  requestedAt: string;
  resultStatus?: string | null;
  resultMessage?: string | null;
};

export type GuardianTenantSummary = {
  activeInstances: number;
  openFindings: number;
  pendingTasks: number;
  recentScansCount: number;
  recentScans: GuardianScan[];
};

export async function fetchGuardianSummary() {
  const res = await apiClient.get<GuardianTenantSummary>('/guardian/summary');
  return res.data;
}

export async function fetchGuardianInstance() {
  const res = await apiClient.get<GuardianInstance | null>('/guardian/instance');
  return res.data;
}

export async function fetchGuardianFindings(params?: { status?: string; severity?: string }) {
  const res = await apiClient.get<GuardianFinding[]>('/guardian/findings', { params });
  return res.data;
}

export async function fetchGuardianRemediations(params?: { status?: string }) {
  const res = await apiClient.get<GuardianRemediationTask[]>('/guardian/remediations', { params });
  return res.data;
}

export async function fetchGuardianScans(limit = 20) {
  const res = await apiClient.get<GuardianScan[]>('/guardian/scans', { params: { limit } });
  return res.data;
}

export async function triggerGuardianScan(type: string, serverId?: string) {
  const res = await apiClient.post('/guardian/scan', { type, serverId });
  return res.data;
}
