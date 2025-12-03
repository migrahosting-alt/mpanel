/**
 * ENTERPRISE ANALYTICS (BI) Service
 * Data aggregation from multiple sources
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  DataSource,
  Dashboard,
  CreateDataSourceRequest,
  CreateDashboardRequest,
} from './analytics.types.js';

// Data Sources
export async function listDataSources(actorTenantId: string): Promise<DataSource[]> {
  try {
    // @ts-ignore
    const sources = await prisma.dataSource.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return sources;
  } catch {
    return [];
  }
}

export async function createDataSource(
  data: CreateDataSourceRequest,
  actorTenantId: string,
  actorId: string
): Promise<DataSource> {
  const { name, type, config } = data;

  // @ts-ignore
  const source = await prisma.dataSource.create({
    data: {
      tenantId: actorTenantId,
      name,
      type,
      config,
      isActive: true,
      createdBy: actorId,
    },
  });

  logger.info('Data source created', { sourceId: source.id, type });

  return source;
}

export async function deleteDataSource(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.dataSource.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Data source deleted', { sourceId: id });
}

// Dashboards
export async function listDashboards(actorTenantId: string): Promise<Dashboard[]> {
  try {
    // @ts-ignore
    const dashboards = await prisma.dashboard.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return dashboards;
  } catch {
    return [];
  }
}

export async function getDashboardById(
  id: string,
  actorTenantId: string
): Promise<Dashboard | null> {
  try {
    // @ts-ignore
    const dashboard = await prisma.dashboard.findFirst({
      where: { id, tenantId: actorTenantId },
    });
    return dashboard;
  } catch {
    return null;
  }
}

export async function createDashboard(
  data: CreateDashboardRequest,
  actorTenantId: string,
  actorId: string
): Promise<Dashboard> {
  const { name, description, widgets } = data;

  // @ts-ignore
  const dashboard = await prisma.dashboard.create({
    data: {
      tenantId: actorTenantId,
      name,
      description: description || null,
      widgets,
      layout: { cols: 12, rows: [] },
      createdBy: actorId,
    },
  });

  logger.info('Dashboard created', { dashboardId: dashboard.id });

  return dashboard;
}

export async function deleteDashboard(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.dashboard.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Dashboard deleted', { dashboardId: id });
}
