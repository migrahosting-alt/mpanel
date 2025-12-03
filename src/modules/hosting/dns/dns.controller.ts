/**
 * MODULE_DNS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as dnsService from './dns.service.js';
import type { CreateZoneRequest, CreateRecordRequest } from './dns.types.js';

export async function handleListZones(req: Request, res: Response, next: NextFunction) {
  try {
    const domainId = req.query.domainId as string | undefined;
    const actorTenantId = (req as any).tenantId;
    const zones = await dnsService.listZones(domainId, actorTenantId);
    return res.json(zones);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetZoneRecords(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const records = await dnsService.getZoneRecords(id, actorTenantId);
    return res.json(records);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateZone(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateZoneRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await dnsService.createZone(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateRecord(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: CreateRecordRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await dnsService.createRecord(id, data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
