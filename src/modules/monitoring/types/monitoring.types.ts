export interface ServiceStatus {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latencyMs?: number;
  lastCheckedAt: string;
}

export interface SlowQuery {
  id: string;
  query: string;
  avgDurationMs: number;
  calls: number;
  lastRunAt: string;
}

export interface WebhookDelivery {
  id: number;
  target: string;
  status: 'pending' | 'sent' | 'failed';
  lastError?: string;
  createdAt: string;
}

export interface JobQueueMetric {
  queueName: string;
  pending: number;
  active: number;
  failed: number;
  completedLastHour: number;
}
