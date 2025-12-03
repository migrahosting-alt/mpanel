import { http } from '@/lib/http';
import {
  GuardianSummary,
  GuardianScan,
  GuardianFinding,
  GuardianRemediationTask,
} from '../types/guardian.types';

export const GuardianApi = {
  summary: () => http.get<GuardianSummary>('/api/guardian/summary'),

  scans: () => http.get<GuardianScan[]>('/api/guardian/scans'),

  findings: (params?: { status?: string; severity?: string }) =>
    http.get<GuardianFinding[]>('/api/guardian/findings', { params }),

  remediations: () =>
    http.get<GuardianRemediationTask[]>('/api/guardian/remediations'),

  triggerScan: (payload: { target: string }) =>
    http.post('/api/guardian/scan', payload),

  requestRemediation: (findingId: number) =>
    http.post('/api/guardian/remediations/request', { findingId }),

  approveRemediationTenant: (id: number) =>
    http.post(`/api/guardian/remediations/${id}/approve-tenant`, {}),

  approveRemediationPlatform: (id: number) =>
    http.post(`/api/guardian/remediations/${id}/approve-platform`, {}),
};
