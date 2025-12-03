/**
 * ENTERPRISE ANALYTICS (BI) Types
 * Unified dashboards from internal/external sources
 */

export enum DataSourceType {
  INTERNAL = 'INTERNAL',
  POSTGRES = 'POSTGRES',
  MYSQL = 'MYSQL',
  REST_API = 'REST_API',
}

export interface DataSource {
  id: string;
  tenantId: string;
  name: string;
  type: DataSourceType;
  config: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Dashboard {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  widgets: DashboardWidget[];
  layout: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'map';
  dataSourceId: string;
  query: string;
  config: Record<string, any>;
}

export interface CreateDataSourceRequest {
  name: string;
  type: DataSourceType;
  config: Record<string, any>;
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  widgets: DashboardWidget[];
}
