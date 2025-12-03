/**
 * Guardian Service - AI assistant instance management
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

export interface GuardianEmbedConfig {
  instanceId: string;
  widgetTitle: string;
  widgetSubtitle?: string;
  assistantName: string;
  primaryColor: string;
  enableVoiceInput: boolean;
  gatewayUrl: string;
}

/**
 * List instances for tenant
 */
export async function listInstancesForTenant(tenantId: string) {
  const instances = await prisma.guardianInstance.findMany({
    where: {
      tenantId,
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  return instances;
}

/**
 * List instances for platform (all tenants)
 */
export async function listInstancesForPlatform(options: {
  tenantId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const { tenantId, page = 1, pageSize = 50 } = options;
  const skip = (page - 1) * pageSize;

  const where: any = { deletedAt: null };
  if (tenantId) {
    where.tenantId = tenantId;
  }

  const [instances, total] = await Promise.all([
    prisma.guardianInstance.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.guardianInstance.count({ where }),
  ]);

  return { instances, total };
}

/**
 * Create instance
 */
export async function createInstance(input: {
  tenantId: string;
  name: string;
  widgetTitle: string;
  widgetSubtitle?: string;
  assistantName: string;
  primaryColor: string;
  llmProvider: string;
  llmModel: string;
  maxMessagesPerDay?: number;
  enableVoiceInput?: boolean;
  gatewayUrl: string;
}) {
  const slug = generateSlug(input.name);
  const uniqueSlug = await ensureUniqueSlug(slug);

  const instance = await prisma.guardianInstance.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug: uniqueSlug,
      widgetTitle: input.widgetTitle,
      widgetSubtitle: input.widgetSubtitle || '',
      assistantName: input.assistantName,
      primaryColor: input.primaryColor,
      llmProvider: input.llmProvider,
      llmModel: input.llmModel,
      maxMessagesPerDay: input.maxMessagesPerDay || 100,
      enableVoiceInput: input.enableVoiceInput || false,
      gatewayUrl: input.gatewayUrl,
      status: 'active',
    },
  });

  logger.info('Guardian instance created', {
    instanceId: instance.id,
    tenantId: input.tenantId,
    name: input.name,
  });

  return instance;
}

/**
 * Update instance
 */
export async function updateInstance(id: string, input: any) {
  const instance = await prisma.guardianInstance.update({
    where: { id },
    data: {
      ...input,
      updatedAt: new Date(),
    },
  });

  logger.info('Guardian instance updated', { instanceId: id });

  return instance;
}

/**
 * Disable instance
 */
export async function disableInstance(id: string) {
  const instance = await prisma.guardianInstance.update({
    where: { id },
    data: {
      status: 'disabled',
      updatedAt: new Date(),
    },
  });

  logger.info('Guardian instance disabled', { instanceId: id });

  return instance;
}

/**
 * Get embed config (public-safe)
 */
export async function getEmbedConfig(id: string): Promise<GuardianEmbedConfig | null> {
  const instance = await prisma.guardianInstance.findFirst({
    where: {
      id,
      status: 'active',
      deletedAt: null,
    },
  });

  if (!instance) {
    return null;
  }

  return {
    instanceId: instance.id,
    widgetTitle: instance.widgetTitle,
    widgetSubtitle: instance.widgetSubtitle || undefined,
    assistantName: instance.assistantName,
    primaryColor: instance.primaryColor,
    enableVoiceInput: instance.enableVoiceInput,
    gatewayUrl: instance.gatewayUrl,
  };
}

/**
 * Generate slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Ensure unique slug
 */
async function ensureUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.guardianInstance.findFirst({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      slug = `${baseSlug}-${Date.now()}`;
      return slug;
    }
  }
}

export default {
  listInstancesForTenant,
  listInstancesForPlatform,
  createInstance,
  updateInstance,
  disableInstance,
  getEmbedConfig,
};
