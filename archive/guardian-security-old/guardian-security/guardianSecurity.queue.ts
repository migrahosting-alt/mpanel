import { enqueueJob } from '../../config/redis.js';
import logger from '../../config/logger.js';
import type { GuardianSecurityAgentEventJobPayload } from './guardianSecurity.types.js';

export const GUARDIAN_SECURITY_QUEUE = 'guardian-security';

export const GUARDIAN_SECURITY_JOB_TYPES = {
  AGENT_EVENT: 'guardian.security.agent_event',
} as const;

export async function enqueueGuardianAgentEvent(payload: GuardianSecurityAgentEventJobPayload) {
  await enqueueJob(GUARDIAN_SECURITY_QUEUE, {
    type: GUARDIAN_SECURITY_JOB_TYPES.AGENT_EVENT,
    payload,
    maxAttempts: 5,
  });
  logger.debug('Guardian security agent event queued', {
    tenantId: payload.tenantId,
    instanceId: payload.guardianInstanceId,
    findings: payload.findings.length,
  });
}
