/**
 * MODULE_SERVER_METRICS Types
 * Live and historical performance data for servers and CloudPods
 */

export type HealthState = 'OK' | 'WARN' | 'CRITICAL' | 'UNKNOWN';

export type MetricType = 'cpu' | 'mem' | 'disk' | 'net_in' | 'net_out' | 'load1' | 'load5' | 'load15';

export interface ServerMetricSnapshot {
  id: string;
  serverId: string;
  timestamp: Date;
  cpuUsagePct: number;
  memUsedBytes: bigint;
  memTotalBytes: bigint;
  diskUsedBytes: bigint;
  diskTotalBytes: bigint;
  netInBps: bigint | null;
  netOutBps: bigint | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  services: Record<string, any> | null;
}

export interface ServerMetricSummary {
  serverId: string;
  serverName: string;
  lastSnapshot: ServerMetricSnapshot | null;
  healthState: HealthState;
  uptime: number | null;
  servicesStatus: ServiceStatus[];
}

export interface ServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  pid: number | null;
  uptime: number | null;
}

export interface TimeseriesQuery {
  serverId: string;
  metric: MetricType;
  from: Date;
  to: Date;
  interval?: string; // e.g. '1m', '5m', '1h'
}

export interface TimeseriesDataPoint {
  timestamp: Date;
  value: number;
}

export interface AlertQuery {
  serverId?: string;
  status?: 'open' | 'closed';
}

export interface MetricAlert {
  id: string;
  serverId: string;
  metric: MetricType;
  threshold: number;
  currentValue: number;
  severity: 'info' | 'warning' | 'critical';
  status: 'open' | 'closed';
  firedAt: Date;
  resolvedAt: Date | null;
  message: string;
}
