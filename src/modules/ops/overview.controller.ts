/**
 * Ops Overview Controller
 * Based on: MODULE_OPS_OVERVIEW.ix.md
 * 
 * Single endpoint: GET /api/ops/overview
 * Returns real-time operational dashboard data
 */

import { Request, Response } from 'express';
import { getOpsOverview } from './overview.service.js';
import logger from '../../config/logger.js';

export async function handleGetOpsOverview(req: Request, res: Response): Promise<void> {
  try {
    const summary = await getOpsOverview();
    res.json(summary);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get ops overview', { error: errorMessage });
    res.status(500).json({ error: 'Failed to get ops overview' });
  }
}

export default {
  handleGetOpsOverview,
};
