/**
 * MODULE_DOMAINS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as domainsService from './domains.service.js';
import type { ImportDomainRequest, RegisterDomainRequest } from './domains.types.js';

export async function handleListDomains(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const domains = await domainsService.listDomains(actorTenantId);
    return res.json(domains);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetDomain(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const domain = await domainsService.getDomainById(id, actorTenantId);
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    return res.json(domain);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleImportDomain(req: Request, res: Response, next: NextFunction) {
  try {
    const data: ImportDomainRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await domainsService.importDomain(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRegisterDomain(req: Request, res: Response, next: NextFunction) {
  try {
    const data: RegisterDomainRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await domainsService.registerDomain(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
