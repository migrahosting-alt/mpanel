/**
 * OPS OVERVIEW Types
 * Platform health and operational monitoring
 * 
 * Spec: MODULE_OPS_OVERVIEW.ix.md
 * Route: /ops/overview
 * 
 * CRITICAL: NO MOCK DATA - All values from real tables/services
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
  label: string; // "SRV1-WEB", "MAIL-CORE", etc.
  role: string; // CoreNodeRole (WEB, MAIL, DNS, CLOUD, DB, BACKUP, MPANEL, VOIP, MIGRAGUARD)
  status: string; // CoreNodeStatus (ACTIVE, DEGRADED, OFFLINE, MAINTENANCE, UNKNOWN)
  cpuPercent: number; // latest known metrics
  ramPercent: number;
  diskPercent: number;
  lastMetricsAt?: string; // ISO timestamp
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
  recentFailures: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    tenantId?: string;
    createdAt: string; // ISO timestamp
    errorMessage?: string;
  }>;
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
  dbCoreLastSuccess?: string; // ISO timestamp
  mpanelCoreLastSuccess?: string;
  cloudPodsLastSuccess?: string;
  notes?: string;
}
