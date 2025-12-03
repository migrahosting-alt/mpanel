/**
 * ENTERPRISE APP INSTALLER Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as appInstallerService from './app-installer.service.js';
import type { InstallAppRequest } from './app-installer.types.js';

export async function handleListTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const templates = await appInstallerService.listTemplates();
    return res.json(templates);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { slug } = req.params;
    const template = await appInstallerService.getTemplateBySlug(slug as any);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json(template);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListInstallations(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const installations = await appInstallerService.listInstallations(actorTenantId);
    return res.json(installations);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetInstallation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const installation = await appInstallerService.getInstallById(id, actorTenantId);
    if (!installation) return res.status(404).json({ error: 'Installation not found' });
    return res.json(installation);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleInstallApp(req: Request, res: Response, next: NextFunction) {
  try {
    const data: InstallAppRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await appInstallerService.installApp(data, actorTenantId, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleDeleteInstallation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const result = await appInstallerService.deleteInstallation(id, actorTenantId, actorId);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}
