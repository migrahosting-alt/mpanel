/**
 * Ops Overview Types
 * Based on: MODULE_OPS_OVERVIEW.ix.md
 * 
 * Real-time operational dashboard showing:
 * - Core nodes status
 * - Queue & worker health
 * - Provisioning failures
 * - Security posture (Shield + Guardian)
 * - Backup status
 */

export interface OpsOverviewSummary {
  generatedAt: string; // ISO timestamp
  coreNodes: CoreNodeOverview[];
  queues: QueueOverview[];
  provisioning: ProvisioningOverview;
  security: SecurityOverview;
  backups: BackupOverview;
}

export interface CoreNodeOverview {
  id: string;
  label: string;      // "SRV1-WEB"
  role: string;       // CoreNodeRole
  status: string;     // CoreNodeStatus
  cpuPercent: number; // latest known
  ramPercent: number;
  diskPercent: number;
  lastMetricsAt?: string;
}

export interface QueueOverview {
  name: string;
  waiting: number;
  active: number;
  failed: number;
  delayed: number;
  oldestWaitingSeconds?: number;
}

export interface ProvisioningOverview {
  failedLast24h: number;
  stuckLast24h: number;
  recentFailures: {
    id: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    tenantId?: string;
    createdAt: string;
    errorMessage?: string;
  }[];
}

export interface SecurityOverview {
  shieldEventsLast24h: {
    total: number;
    byDecision: {
      ALLOW: number;
      BLOCK: number;
      CHALLENGE: number;
      RATE_LIMITED: number;
    };
  };
  shieldPolicies: {
    enforceCount: number;
    monitorCount: number;
    disabledCount: number;
  };
  guardianFindings?: {
    criticalOpen: number;
    highOpen: number;
    mediumOpen: number;
  };
}

export interface BackupOverview {
  dbCoreLastSuccess?: string;
  mpanelCoreLastSuccess?: string;
  cloudPodsLastSuccess?: string;
  notes?: string;
}
