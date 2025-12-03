/**
 * OPS OVERVIEW Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as opsOverviewService from './ops-overview.service.js';

export async function handleGetOpsOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const overview = await opsOverviewService.getOpsOverview();
    return res.json(overview);
  } catch (error) {
    return next(error);
    next(error);
  }
}
