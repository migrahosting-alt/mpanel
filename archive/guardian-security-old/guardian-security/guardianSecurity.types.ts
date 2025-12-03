import { z } from 'zod';

export const GuardianSecurityAgentFindingSchema = z.object({
  externalId: z.string().optional(),
  title: z.string().min(1, 'Finding title is required'),
  severity: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  signatureId: z.string().optional(),
  status: z.string().optional(),
  remediationStatus: z.string().optional(),
  remediationMode: z.string().optional(),
  recommendedAction: z.string().optional(),
  evidence: z.record(z.any()).optional(),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  autoCreateTask: z.boolean().optional(),
  remediationTask: z
    .object({
      mode: z.string().optional(),
      severity: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
  serverId: z.string().uuid().optional(),
});

export type GuardianSecurityAgentFindingPayload = z.infer<typeof GuardianSecurityAgentFindingSchema>;

export const GuardianSecurityAgentRemediationSchema = z.object({
  externalId: z.string().optional(),
  findingId: z.string().uuid().optional(),
  findingExternalId: z.string().optional(),
  mode: z.string().optional(),
  severity: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  serverId: z.string().uuid().optional(),
  scanId: z.string().uuid().optional(),
});

export type GuardianSecurityAgentRemediationPayload = z.infer<typeof GuardianSecurityAgentRemediationSchema>;

export const GuardianSecurityAgentScanSchema = z
  .object({
    sourceType: z.string().optional(),
    scanType: z.string().optional(),
    mode: z.string().optional(),
    status: z.string().optional(),
    findingsCount: z.number().optional(),
    severitySummary: z.record(z.number()).optional(),
    startedAt: z.union([z.string(), z.date()]).optional(),
    completedAt: z.union([z.string(), z.date()]).optional(),
    triggeredBy: z.string().optional(),
    triggeredByType: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .optional();

export type GuardianSecurityAgentScanPayload = z.infer<typeof GuardianSecurityAgentScanSchema>;

export const GuardianSecurityAgentEventSchema = z.object({
  tenantId: z.string().uuid(),
  guardianInstanceId: z.string().uuid().optional(),
  dataRegion: z.string().default('us'),
  serverId: z.string().uuid().optional(),
  serverName: z.string().optional(),
  serverIp: z.string().optional(),
  agentId: z.string().optional(),
  agentVersion: z.string().optional(),
  agentRunId: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  scan: GuardianSecurityAgentScanSchema,
  findings: z.array(GuardianSecurityAgentFindingSchema).default([]),
  remediationTasks: z.array(GuardianSecurityAgentRemediationSchema).default([]),
});

export type GuardianSecurityAgentEventJobPayload = z.infer<typeof GuardianSecurityAgentEventSchema>;
