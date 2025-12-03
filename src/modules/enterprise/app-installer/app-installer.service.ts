/**
 * ENTERPRISE APP INSTALLER Service
 * Template-based app installation with idempotency
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  AppInstallerTemplate,
  AppInstall,
  InstallAppRequest,
  AppTemplate,
} from './app-installer.types.js';

// Templates
export async function listTemplates(): Promise<AppInstallerTemplate[]> {
  try {
    // @ts-ignore
    const templates = await prisma.appInstallerTemplate.findMany({
      orderBy: { name: 'asc' },
    });
    return templates;
  } catch {
    return [];
  }
}

export async function getTemplateBySlug(slug: AppTemplate): Promise<AppInstallerTemplate | null> {
  try {
    // @ts-ignore
    const template = await prisma.appInstallerTemplate.findFirst({
      where: { slug },
    });
    return template;
  } catch {
    return null;
  }
}

// Installations
export async function listInstallations(actorTenantId: string): Promise<AppInstall[]> {
  try {
    // @ts-ignore
    const installs = await prisma.appInstall.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return installs;
  } catch {
    return [];
  }
}

export async function getInstallById(
  id: string,
  actorTenantId: string
): Promise<AppInstall | null> {
  try {
    // @ts-ignore
    const install = await prisma.appInstall.findFirst({
      where: { id, tenantId: actorTenantId },
    });
    return install;
  } catch {
    return null;
  }
}

export async function installApp(
  data: InstallAppRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ install: AppInstall; jobId: string }> {
  const {
    templateSlug,
    websiteId,
    installPath = '/',
    adminEmail,
    adminUsername,
    adminPassword,
    siteName,
  } = data;

  // Verify template exists
  const template = await getTemplateBySlug(templateSlug);
  if (!template) {
    throw new Error('Template not found');
  }

  // Verify website belongs to tenant
  // @ts-ignore
  const website = await prisma.website.findFirst({
    where: { id: websiteId, tenantId: actorTenantId },
  });
  if (!website) {
    throw new Error('Website not found');
  }

  // Check for existing install at same path (idempotency)
  // @ts-ignore
  const existingInstall = await prisma.appInstall.findFirst({
    where: {
      tenantId: actorTenantId,
      websiteId,
      installPath,
      status: { in: ['PENDING', 'INSTALLING', 'INSTALLED'] },
    },
  });

  if (existingInstall) {
    throw new Error('Application already installed at this path');
  }

  // Create database if needed
  let databaseId = null;
  if (template.requirements.mysql || template.requirements.postgresql) {
    const dbEngine = template.requirements.mysql ? 'MYSQL' : 'POSTGRESQL';
    const dbName = `app_${templateSlug.toLowerCase()}_${Date.now()}`;

    // @ts-ignore
    const database = await prisma.database.create({
      data: {
        tenantId: actorTenantId,
        serverId: website.serverId,
        engine: dbEngine,
        name: dbName,
        username: dbName,
        password: Math.random().toString(36).slice(2),
        status: 'ACTIVE',
        quotaMb: 1024,
        createdBy: actorId,
      },
    });
    databaseId = database.id;
  }

  // Create installation record
  // @ts-ignore
  const install = await prisma.appInstall.create({
    data: {
      tenantId: actorTenantId,
      templateSlug,
      websiteId,
      databaseId,
      installPath,
      status: 'PENDING',
      installUrl: null,
      adminUsername,
      adminPassword, // TODO: Encrypt
      metadata: {
        adminEmail,
        siteName: siteName || template.name,
      },
      installedAt: null,
      lastError: null,
      createdBy: actorId,
    },
  });

  // Enqueue installation job
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'app.install',
      status: 'pending',
      payload: {
        installId: install.id,
        templateSlug,
        websiteId,
        databaseId,
        adminEmail,
        adminUsername,
        adminPassword,
        siteName,
      },
      createdBy: actorId,
    },
  });

  logger.info('App installation initiated', {
    installId: install.id,
    jobId: job.id,
    template: templateSlug,
  });

  return { install, jobId: job.id };
}

export async function deleteInstallation(
  id: string,
  actorTenantId: string,
  actorId: string
): Promise<{ jobId: string }> {
  // Verify install exists
  // @ts-ignore
  const install = await prisma.appInstall.findFirst({
    where: { id, tenantId: actorTenantId },
  });

  if (!install) {
    throw new Error('Installation not found');
  }

  // Enqueue deletion job (removes files + database)
  const job = await prisma.job.create({
    data: {
      tenantId: actorTenantId,
      type: 'app.uninstall',
      status: 'pending',
      payload: { installId: id },
      createdBy: actorId,
    },
  });

  logger.info('App uninstallation initiated', { installId: id, jobId: job.id });

  return { jobId: job.id };
}
