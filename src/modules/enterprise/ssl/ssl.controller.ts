/**
 * ENTERPRISE SSL CERTIFICATES Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as sslService from './ssl.service.js';
import type {
  IssueCertificateRequest,
  UploadCustomCertificateRequest,
  RenewCertificateRequest,
} from './ssl.types.js';

export async function handleListCertificates(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const certificates = await sslService.listCertificates(actorTenantId);
    return res.json(certificates);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const certificate = await sslService.getCertificateById(id, actorTenantId);
    if (!certificate) return res.status(404).json({ error: 'Certificate not found' });
    return res.json(certificate);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleIssueCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const data: IssueCertificateRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await sslService.issueCertificate(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUploadCustom(req: Request, res: Response, next: NextFunction) {
  try {
    const data: UploadCustomCertificateRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await sslService.uploadCustomCertificate(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRenewCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { force }: RenewCertificateRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await sslService.renewCertificate(id, actorTenantId, actorId, force);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteCertificate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await sslService.deleteCertificate(id, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
