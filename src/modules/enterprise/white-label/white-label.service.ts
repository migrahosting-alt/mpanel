/**
 * ENTERPRISE WHITE-LABEL Service
 * Tenant-specific branding overrides
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  WhiteLabelConfig,
  UpdateWhiteLabelRequest,
  UploadAssetRequest,
} from './white-label.types.js';

export async function getConfig(actorTenantId: string): Promise<WhiteLabelConfig | null> {
  try {
    // @ts-ignore
    const config = await prisma.whiteLabelConfig.findFirst({
      where: { tenantId: actorTenantId },
    });

    if (!config) {
      // Return default config
      return {
        id: 'default',
        tenantId: actorTenantId,
        companyName: 'MigraHosting',
        logo: null,
        favicon: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#1e40af',
        customDomain: null,
        customCss: null,
        emailFromName: 'MigraHosting',
        emailFromAddress: 'noreply@migrahosting.com',
        supportEmail: 'support@migrahosting.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return config;
  } catch {
    return null;
  }
}

export async function updateConfig(
  data: UpdateWhiteLabelRequest,
  actorTenantId: string
): Promise<WhiteLabelConfig> {
  // Check if config exists
  // @ts-ignore
  const existing = await prisma.whiteLabelConfig.findFirst({
    where: { tenantId: actorTenantId },
  });

  if (existing) {
    // @ts-ignore
    const updated = await prisma.whiteLabelConfig.update({
      where: { id: existing.id },
      data,
    });

    logger.info('White-label config updated', { tenantId: actorTenantId });
    return updated;
  } else {
    // @ts-ignore
    const created = await prisma.whiteLabelConfig.create({
      data: {
        tenantId: actorTenantId,
        companyName: data.companyName || 'MigraHosting',
        logo: null,
        favicon: null,
        primaryColor: data.primaryColor || '#3b82f6',
        secondaryColor: data.secondaryColor || '#1e40af',
        customDomain: data.customDomain || null,
        customCss: data.customCss || null,
        emailFromName: data.emailFromName || 'MigraHosting',
        emailFromAddress: data.emailFromAddress || 'noreply@migrahosting.com',
        supportEmail: data.supportEmail || 'support@migrahosting.com',
      },
    });

    logger.info('White-label config created', { tenantId: actorTenantId });
    return created;
  }
}

export async function uploadAsset(
  data: UploadAssetRequest,
  actorTenantId: string
): Promise<{ url: string }> {
  const { assetType, base64Data } = data;

  // TODO: Upload to MinIO
  const storagePath = `tenant-${actorTenantId}/branding/${assetType}-${Date.now()}.png`;

  // Update config
  // @ts-ignore
  await prisma.whiteLabelConfig.updateMany({
    where: { tenantId: actorTenantId },
    data: {
      [assetType]: storagePath,
    },
  });

  logger.info('White-label asset uploaded', { tenantId: actorTenantId, assetType });

  return { url: `/assets/${storagePath}` };
}
