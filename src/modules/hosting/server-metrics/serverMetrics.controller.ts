/**
 * MODULE_SERVER_METRICS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as metricsService from './serverMetrics.service.js';
import type { TimeseriesQuery, AlertQuery } from './serverMetrics.types.js';

/**
 * GET /api/hosting/server-metrics/summary?serverId=...
 */
export async function handleGetMetricSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const { serverId } = req.query;

    if (!serverId || typeof serverId !== 'string') {
      return res.status(400).json({ error: 'serverId is required' });
    }

    const actorTenantId = (req as any).tenantId || null;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    const summary = await metricsService.getServerMetricSummary(
      serverId,
      actorTenantId,
      isPlatformAdmin
    );

    if (!summary) {
      return res.status(404).json({ error: 'Server not found' });
    }

    return res.json(summary);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * GET /api/hosting/server-metrics/timeseries?serverId=...&metric=...&from=...&to=...
 */
export async function handleGetTimeseries(req: Request, res: Response, next: NextFunction) {
  try {
    const { serverId, metric, from, to, interval } = req.query;

    if (!serverId || !metric || !from || !to) {
      return res.status(400).json({ error: 'serverId, metric, from, and to are required' });
    }

    const query: TimeseriesQuery = {
      serverId: serverId as string,
      metric: metric as any,
      from: new Date(from as string),
      to: new Date(to as string),
      interval: interval as string,
    };

    const actorTenantId = (req as any).tenantId || null;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    const data = await metricsService.getMetricTimeseries(query, actorTenantId, isPlatformAdmin);

    return res.json(data);
  } catch (error) {
    return next(error);
    next(error);
  }
}

/**
 * GET /api/hosting/server-metrics/alerts?serverId=...&status=...
 */
export async function handleGetAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const query: AlertQuery = {
      serverId: req.query.serverId as string,
      status: req.query.status as any,
    };

    const actorTenantId = (req as any).tenantId || null;
    const isPlatformAdmin = (req as any).user?.platformAdmin || false;

    const alerts = await metricsService.getMetricAlerts(query, actorTenantId, isPlatformAdmin);

    return res.json(alerts);
  } catch (error) {
    return next(error);
    next(error);
  }
}
