export interface GuardianSummary {
  totalScans: number;
  openFindings: number;
  criticalFindings: number;
  remediationsPending: number;
  lastScanAt?: string;
}

export interface GuardianScan {
  id: number;
  tenantId: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  target: string;
}

export interface GuardianFinding {
  id: number;
  scanId: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  message: string;
  status: 'open' | 'in_review' | 'resolved' | 'ignored';
  createdAt: string;
}

export interface GuardianRemediationTask {
  id: number;
  findingId: number;
  status: 'pending_tenant' | 'pending_platform' | 'approved' | 'executed' | 'failed';
  createdAt: string;
}
