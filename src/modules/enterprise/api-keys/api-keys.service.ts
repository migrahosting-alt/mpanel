/**
 * ENTERPRISE API KEYS & WEBHOOKS Service
 * Key management with prefix+hash, webhook delivery with HMAC
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import type {
  ApiKey,
  WebhookEndpoint,
  WebhookDelivery,
  CreateApiKeyRequest,
  CreateWebhookRequest,
  TriggerWebhookRequest,
} from './api-keys.types.js';

// API Key Management
export async function listApiKeys(actorTenantId: string): Promise<ApiKey[]> {
  try {
    // @ts-ignore
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  } catch {
    return [];
  }
}

export async function createApiKey(
  data: CreateApiKeyRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ apiKey: ApiKey; plainSecret: string }> {
  const { name, scopes, expiresInDays } = data;

  // Generate prefix and secret
  const prefix = 'mgh_live';
  const randomPart = crypto.randomBytes(16).toString('hex');
  const plainSecret = `${prefix}_${randomPart}`;
  const keyHashedSecret = await bcrypt.hash(plainSecret, 10);

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // @ts-ignore
  const apiKey = await prisma.apiKey.create({
    data: {
      tenantId: actorTenantId,
      name,
      keyPrefix: prefix,
      keyHashedSecret,
      scopes,
      status: 'ACTIVE',
      lastUsedAt: null,
      expiresAt,
      createdBy: actorId,
    },
  });

  logger.info('API key created', { apiKeyId: apiKey.id, name });

  return { apiKey, plainSecret };
}

export async function revokeApiKey(
  id: string,
  actorTenantId: string
): Promise<void> {
  // @ts-ignore
  await prisma.apiKey.updateMany({
    where: { id, tenantId: actorTenantId },
    data: { status: 'REVOKED' },
  });

  logger.info('API key revoked', { apiKeyId: id });
}

// Webhook Endpoint Management
export async function listWebhookEndpoints(actorTenantId: string): Promise<WebhookEndpoint[]> {
  try {
    // @ts-ignore
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints;
  } catch {
    return [];
  }
}

export async function createWebhookEndpoint(
  data: CreateWebhookRequest,
  actorTenantId: string,
  actorId: string
): Promise<{ endpoint: WebhookEndpoint; secret: string }> {
  const { url, events } = data;

  // Generate HMAC secret
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  // @ts-ignore
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      tenantId: actorTenantId,
      url,
      events,
      secret,
      isActive: true,
      createdBy: actorId,
    },
  });

  logger.info('Webhook endpoint created', { endpointId: endpoint.id, url });

  return { endpoint, secret };
}

export async function deleteWebhookEndpoint(
  id: string,
  actorTenantId: string
): Promise<void> {
  // @ts-ignore
  await prisma.webhookEndpoint.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('Webhook endpoint deleted', { endpointId: id });
}

// Webhook Delivery
export async function triggerWebhook(
  data: TriggerWebhookRequest,
  actorTenantId: string
): Promise<{ deliveryId: string }> {
  const { eventType, payload } = data;

  // Find active endpoints subscribed to this event
  // @ts-ignore
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      tenantId: actorTenantId,
      isActive: true,
    },
  });

  const subscribedEndpoints = endpoints.filter((e: any) =>
    e.events.includes(eventType)
  );

  if (subscribedEndpoints.length === 0) {
    logger.debug('No webhook endpoints for event', { eventType });
    return { deliveryId: 'none' };
  }

  // Create delivery records (worker will process)
  for (const endpoint of subscribedEndpoints) {
    // @ts-ignore
    await prisma.webhookDelivery.create({
      data: {
        tenantId: actorTenantId,
        endpointId: endpoint.id,
        eventType,
        payload,
        status: 'PENDING',
        attempts: 0,
        lastAttemptAt: null,
        responseCode: null,
        errorMessage: null,
      },
    });
  }

  logger.info('Webhook deliveries enqueued', {
    eventType,
    endpointCount: subscribedEndpoints.length,
  });

  return { deliveryId: 'enqueued' };
}

export async function listWebhookDeliveries(
  actorTenantId: string
): Promise<WebhookDelivery[]> {
  try {
    // @ts-ignore
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return deliveries;
  } catch {
    return [];
  }
}
