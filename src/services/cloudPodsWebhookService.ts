/**
 * CloudPods Webhook Service
 * Event delivery system for CloudPods lifecycle events
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import type {
  CloudPodWebhookEventType,
  CloudPodEventPayload,
  WebhookConfigInput,
  WebhookDeliveryResult,
  WebhookDeliveryStatus,
} from './cloudPodsEnterpriseTypes';

const prisma = new PrismaClient();

// Webhook delivery settings
const MAX_ATTEMPTS = 8;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 3600000;  // 1 hour

/**
 * Create a new webhook configuration
 */
export async function createWebhook(input: WebhookConfigInput) {
  return prisma.cloudPodWebhook.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      url: input.url,
      secret: input.secret,
      events: input.events,
      isActive: input.isActive ?? true,
    },
  });
}

/**
 * Update a webhook configuration
 */
export async function updateWebhook(
  id: string,
  tenantId: string,
  input: Partial<WebhookConfigInput>
) {
  // Verify ownership
  const existing = await prisma.cloudPodWebhook.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw new Error('Webhook not found or access denied');
  }

  return prisma.cloudPodWebhook.update({
    where: { id },
    data: {
      name: input.name,
      url: input.url,
      secret: input.secret,
      events: input.events,
      isActive: input.isActive,
    },
  });
}

/**
 * Delete a webhook configuration
 */
export async function deleteWebhook(id: string, tenantId: string) {
  // Verify ownership
  const existing = await prisma.cloudPodWebhook.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw new Error('Webhook not found or access denied');
  }

  await prisma.cloudPodWebhook.delete({ where: { id } });
  return { success: true };
}

/**
 * List webhooks for a tenant
 */
export async function listWebhooks(tenantId: string) {
  return prisma.cloudPodWebhook.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get webhook by ID
 */
export async function getWebhook(id: string, tenantId: string) {
  return prisma.cloudPodWebhook.findFirst({
    where: { id, tenantId },
    include: {
      deliveries: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
}

/**
 * Emit an event to all subscribed webhooks for a tenant
 */
export async function emitEvent(
  tenantId: string,
  eventType: CloudPodWebhookEventType,
  data: Record<string, unknown>
): Promise<number> {
  // Find all active webhooks for this tenant that subscribe to this event
  const webhooks = await prisma.cloudPodWebhook.findMany({
    where: {
      tenantId,
      isActive: true,
    },
  });

  // Filter webhooks that are subscribed to this event type
  const subscribedWebhooks = webhooks.filter(wh => {
    const events = wh.events as string[];
    return events.includes(eventType) || events.includes('*');
  });

  if (subscribedWebhooks.length === 0) {
    return 0;
  }

  // Create payload
  const payload: CloudPodEventPayload = {
    eventType,
    timestamp: new Date().toISOString(),
    tenantId,
    data,
  };

  // Create delivery records for each webhook
  const deliveries = await Promise.all(
    subscribedWebhooks.map(webhook =>
      prisma.cloudPodWebhookDelivery.create({
        data: {
          webhookId: webhook.id,
          eventType,
          payload,
          status: 'pending',
          attempts: 0,
          nextRetryAt: new Date(),
        },
      })
    )
  );

  return deliveries.length;
}

/**
 * Process pending webhook deliveries
 * Should be called by a cron job or queue worker
 */
export async function processPendingDeliveries(): Promise<{ processed: number; succeeded: number; failed: number }> {
  const pendingDeliveries = await prisma.cloudPodWebhookDelivery.findMany({
    where: {
      status: { in: ['pending', 'failed'] },
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    include: {
      webhook: true,
    },
    take: 50, // Process in batches
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const delivery of pendingDeliveries) {
    try {
      await _deliver(delivery.id, delivery.webhook.url, delivery.webhook.secret, delivery.payload);
      succeeded++;
    } catch {
      failed++;
    }
    processed++;
  }

  return { processed, succeeded, failed };
}

/**
 * Internal: Deliver a webhook payload
 */
async function _deliver(
  deliveryId: string,
  url: string,
  secret: string,
  payload: unknown
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  
  // Create HMAC signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadStr)
    .digest('hex');

  // Update attempts count
  await prisma.cloudPodWebhookDelivery.update({
    where: { id: deliveryId },
    data: { attempts: { increment: 1 } },
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CloudPods-Signature': `sha256=${signature}`,
        'X-CloudPods-Delivery': deliveryId,
      },
      body: payloadStr,
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (response.ok) {
      // Success
      await prisma.cloudPodWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'delivered',
          httpStatus: response.status,
          errorMessage: null,
          nextRetryAt: null,
        },
      });
    } else {
      // HTTP error
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (err) {
    // Get current delivery to check attempts
    const delivery = await prisma.cloudPodWebhookDelivery.findUnique({
      where: { id: deliveryId },
    });

    if (!delivery) return;

    const attempts = delivery.attempts;
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (attempts >= MAX_ATTEMPTS) {
      // Permanently failed
      await prisma.cloudPodWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'permanently_failed',
          errorMessage,
          nextRetryAt: null,
        },
      });
    } else {
      // Schedule retry with exponential backoff
      const delayMs = Math.min(
        INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts),
        MAX_RETRY_DELAY_MS
      );
      const nextRetryAt = new Date(Date.now() + delayMs);

      await prisma.cloudPodWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          errorMessage,
          nextRetryAt,
        },
      });
    }

    throw err;
  }
}

/**
 * Get delivery history for a webhook
 */
export async function getDeliveryHistory(
  webhookId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: WebhookDeliveryResult[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const [items, total] = await Promise.all([
    prisma.cloudPodWebhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.cloudPodWebhookDelivery.count({ where: { webhookId } }),
  ]);

  return {
    items: items.map(d => ({
      id: d.id,
      webhookId: d.webhookId,
      eventType: d.eventType,
      status: d.status as WebhookDeliveryStatus,
      httpStatus: d.httpStatus || undefined,
      errorMessage: d.errorMessage || undefined,
      attempts: d.attempts,
      nextRetryAt: d.nextRetryAt || undefined,
      createdAt: d.createdAt,
    })),
    total,
  };
}

/**
 * Retry a failed delivery manually
 */
export async function retryDelivery(deliveryId: string): Promise<{ success: boolean }> {
  const delivery = await prisma.cloudPodWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });

  if (!delivery) {
    throw new Error('Delivery not found');
  }

  if (delivery.status === 'delivered') {
    throw new Error('Delivery already succeeded');
  }

  // Reset for retry
  await prisma.cloudPodWebhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      attempts: 0,
      nextRetryAt: new Date(),
    },
  });

  return { success: true };
}

/**
 * Test a webhook by sending a test event
 */
export async function testWebhook(webhookId: string, tenantId: string): Promise<{ success: boolean; error?: string }> {
  const webhook = await prisma.cloudPodWebhook.findFirst({
    where: { id: webhookId, tenantId },
  });

  if (!webhook) {
    throw new Error('Webhook not found or access denied');
  }

  const testPayload: CloudPodEventPayload = {
    eventType: 'pod.created',
    timestamp: new Date().toISOString(),
    tenantId,
    data: {
      test: true,
      message: 'This is a test webhook delivery',
    },
  };

  // Create delivery record
  const delivery = await prisma.cloudPodWebhookDelivery.create({
    data: {
      webhookId,
      eventType: 'test',
      payload: testPayload,
      status: 'pending',
      attempts: 0,
      nextRetryAt: new Date(),
    },
  });

  try {
    await _deliver(delivery.id, webhook.url, webhook.secret, testPayload);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export const CloudPodsWebhookService = {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhooks,
  getWebhook,
  emitEvent,
  processPendingDeliveries,
  getDeliveryHistory,
  retryDelivery,
  testWebhook,
  MAX_ATTEMPTS,
};

export default CloudPodsWebhookService;
