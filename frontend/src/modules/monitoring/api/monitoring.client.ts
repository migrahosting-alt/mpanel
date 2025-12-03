import { http } from '@/lib/http';
import {
  ServiceStatus,
  SlowQuery,
  WebhookDelivery,
  JobQueueMetric,
} from '../types/monitoring.types';

export const MonitoringApi = {
  overview: () =>
    http.get<{ services: ServiceStatus[]; queues: JobQueueMetric[] }>(
      '/api/monitoring/overview'
    ),

  slowQueries: () =>
    http.get<SlowQuery[]>('/api/monitoring/slow-queries'),

  webhooks: (params?: { status?: string }) =>
    http.get<WebhookDelivery[]>('/api/monitoring/webhooks', { params }),

  events: () =>
    http.get<any[]>('/api/monitoring/events'),
};
