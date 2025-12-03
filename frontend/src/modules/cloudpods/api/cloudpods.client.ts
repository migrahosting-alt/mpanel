import { http } from '@/lib/http';
import { CloudPod, CloudPodMetrics, CloudPodLogEntry, CloudPodPlan } from '../types/cloudpods.types';

export const CloudPodsApi = {
  list: (params?: { status?: string; plan?: CloudPodPlan }) =>
    http.get<CloudPod[]>('/api/cloudpods', { params }),

  get: (podId: number) =>
    http.get<CloudPod>(`/api/cloudpods/${podId}`),

  metrics: (podId: number) =>
    http.get<CloudPodMetrics>(`/api/cloudpods/${podId}/metrics`),

  logs: (podId: number) =>
    http.get<CloudPodLogEntry[]>(`/api/cloudpods/${podId}/logs`),

  create: (payload: {
    name: string;
    plan: CloudPodPlan;
    region: string;
    node: string;
  }) =>
    http.post<CloudPod>('/api/cloudpods', payload),

  actions: (podId: number, action: 'start' | 'stop' | 'reboot' | 'terminate') =>
    http.post(`/api/cloudpods/${podId}/actions`, { action }),
};
