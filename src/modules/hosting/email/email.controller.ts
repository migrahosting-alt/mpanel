/**
 * MODULE_EMAIL Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as emailService from './email.service.js';
import type { CreateEmailDomainRequest, CreateEmailAccountRequest } from './email.types.js';

export async function handleListEmailDomains(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const domains = await emailService.listEmailDomains(actorTenantId);
    return res.json(domains);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateEmailDomain(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateEmailDomainRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await emailService.createEmailDomain(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListEmailAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const { emailDomainId } = req.params;
    const actorTenantId = (req as any).tenantId;
    const accounts = await emailService.listEmailAccounts(emailDomainId, actorTenantId);
    return res.json(accounts);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateEmailAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const { emailDomainId } = req.params;
    const data: CreateEmailAccountRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await emailService.createEmailAccount(emailDomainId, data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
