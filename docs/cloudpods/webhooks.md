# CloudPods Webhooks

## Overview

Event-driven webhook system allowing tenants and internal services to react to CloudPods lifecycle events in real-time. Features reliable delivery with exponential backoff retries, HMAC signature verification, and automatic disabling of persistently failing endpoints.

---

## Prisma Schema

```prisma
// Webhook endpoint configuration
model CloudPodWebhook {
  id              Int       @id @default(autoincrement())
  tenantId        Int       @map("tenant_id")
  name            String    // "Slack alerts", "CI/CD trigger"
  url             String    // HTTPS endpoint (required)
  secret          String    // HMAC SHA-256 signing secret
  events          String[]  // Array: ["pod.created", "pod.deleted", ...]
  headers         Json?     // Optional custom headers
  isActive        Boolean   @default(true) @map("is_active")
  autoDisabled    Boolean   @default(false) @map("auto_disabled") // System disabled due to failures
  autoDisabledAt  DateTime? @map("auto_disabled_at")
  lastDeliveryAt  DateTime? @map("last_delivery_at")
  failureCount    Int       @default(0) @map("failure_count") // Consecutive failures
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  deliveries      CloudPodWebhookDelivery[]

  @@index([tenantId, isActive])
  @@map("cloud_pod_webhooks")
}

// Delivery attempt records
model CloudPodWebhookDelivery {
  id              Int       @id @default(autoincrement())
  webhookId       Int       @map("webhook_id")
  eventId         String    @map("event_id") // UUID for idempotency
  eventType       String    @map("event_type")
  payload         Json
  status          String    @default("pending") // 'pending', 'delivered', 'failed', 'permanently_failed'
  httpStatus      Int?      @map("http_status")
  responseBody    String?   @map("response_body") // First 1KB of response
  errorMessage    String?   @map("error_message")
  attempts        Int       @default(0)
  maxAttempts     Int       @default(8) @map("max_attempts")
  nextRetryAt     DateTime? @map("next_retry_at")
  deliveredAt     DateTime? @map("delivered_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  webhook         CloudPodWebhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@index([webhookId, status])
  @@index([status, nextRetryAt])
  @@index([eventId])
  @@map("cloud_pod_webhook_deliveries")
}

// Internal event queue (optional - can use BullMQ instead)
model CloudPodEvent {
  id              Int       @id @default(autoincrement())
  eventId         String    @unique @map("event_id") // UUID
  tenantId        Int       @map("tenant_id")
  podId           Int?      @map("pod_id")
  eventType       String    @map("event_type")
  payload         Json
  processed       Boolean   @default(false)
  processedAt     DateTime? @map("processed_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@index([processed, createdAt])
  @@index([tenantId, eventType])
  @@map("cloud_pod_events")
}
```

---

## Supported Events

### Lifecycle Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `pod.created` | Pod provisioning completed | `{ podId, name, plan, ipAddress }` |
| `pod.create_failed` | Pod provisioning failed | `{ podId, error }` |
| `pod.updated` | Pod config changed | `{ podId, changes }` |
| `pod.deleted` | Pod destroyed | `{ podId, name }` |
| `pod.started` | Pod powered on | `{ podId }` |
| `pod.stopped` | Pod powered off | `{ podId }` |
| `pod.rebooted` | Pod rebooted | `{ podId }` |
| `pod.scaled` | Pod resources changed | `{ podId, oldPlan, newPlan }` |

### Health Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `pod.health.unhealthy` | Health check failed | `{ podId, consecutiveFailures, lastError }` |
| `pod.health.recovered` | Pod became healthy again | `{ podId, downtime }` |
| `pod.autoheal.triggered` | Auto-heal action taken | `{ podId, action, reason }` |

### Backup Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `pod.backup.started` | Backup job started | `{ podId, backupId, policyId }` |
| `pod.backup.completed` | Backup succeeded | `{ podId, backupId, sizeBytes }` |
| `pod.backup.failed` | Backup failed | `{ podId, backupId, error }` |
| `pod.restore.started` | Restore initiated | `{ podId, backupId }` |
| `pod.restore.completed` | Restore succeeded | `{ podId, backupId }` |

### Security Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `security_group.created` | New SG created | `{ securityGroupId, name }` |
| `security_group.updated` | SG rules changed | `{ securityGroupId, changes }` |
| `security_group.deleted` | SG removed | `{ securityGroupId, name }` |
| `security_group.attached` | SG assigned to pod | `{ podId, securityGroupId }` |
| `security_group.detached` | SG removed from pod | `{ podId, securityGroupId }` |

### Quota Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `quota.warning` | Usage at 80% | `{ tenantId, resource, usage, limit }` |
| `quota.exceeded` | Quota limit hit | `{ tenantId, resource, usage, limit }` |

### Budget Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `budget.threshold_reached` | Spend threshold hit | `{ tenantId, threshold, currentSpend, limit }` |
| `budget.limit_exceeded` | 100% budget reached | `{ tenantId, currentSpend, limit }` |

---

## Webhook Payload Format

```json
{
  "id": "evt_01HXYZ123ABC",
  "type": "pod.created",
  "created_at": "2025-11-29T12:00:00.000Z",
  "tenant_id": 42,
  "pod_id": 101,
  "data": {
    "podId": 101,
    "name": "web-server-prod",
    "plan": "cloudpod-2vcpu-4gb",
    "ipAddress": "10.1.50.15"
  }
}
```

---

## HTTP Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-CloudPods-Event-Type` | Event type (e.g., `pod.created`) |
| `X-CloudPods-Event-ID` | Unique event ID for idempotency |
| `X-CloudPods-Signature` | HMAC SHA-256 signature |
| `X-CloudPods-Timestamp` | Unix timestamp of signature |
| `User-Agent` | `CloudPods-Webhook/1.0` |

---

## Signature Verification

```javascript
// How recipients should verify the signature

const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, timestamp, secret) {
  // Prevent replay attacks - reject if timestamp is too old
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) { // 5 minute tolerance
    return false;
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in webhook handler
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-cloudpods-signature'];
  const timestamp = req.headers['x-cloudpods-timestamp'];
  
  if (!verifyWebhookSignature(req.body, signature, timestamp, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process the event
  console.log(`Received ${req.body.type} event`);
  res.status(200).json({ received: true });
});
```

---

## Service Layer

```javascript
// src/services/cloudPodWebhooks.js

import { prisma } from '../database.js';
import { auditLog } from './cloudPodAudit.js';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * Webhook service for CloudPods events
 */
class CloudPodWebhookService {
  
  // Retry intervals in seconds: 1m, 5m, 15m, 30m, 1h, 2h, 4h, 8h
  static RETRY_INTERVALS = [60, 300, 900, 1800, 3600, 7200, 14400, 28800];
  static MAX_ATTEMPTS = 8;
  static AUTO_DISABLE_THRESHOLD = 50; // Consecutive failures before auto-disable
  
  // ─────────────────────────────────────────────────────────────────
  // Webhook Management
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Create a new webhook
   */
  async createWebhook(tenantId, config, actorUserId) {
    const { name, url, events, headers } = config;
    
    // Validate URL is HTTPS
    if (!url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }
    
    // Validate events
    const validEvents = this.getValidEvents();
    const invalidEvents = events.filter(e => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }
    
    // Generate signing secret
    const secret = this.generateSecret();
    
    const webhook = await prisma.cloudPodWebhook.create({
      data: {
        tenantId,
        name,
        url,
        secret,
        events,
        headers,
        isActive: true
      }
    });
    
    await auditLog(null, actorUserId, 'webhook_created', {
      webhookId: webhook.id,
      name,
      url,
      events
    }, tenantId);
    
    return {
      ...webhook,
      secret // Only returned on create
    };
  }

  /**
   * Update a webhook
   */
  async updateWebhook(webhookId, updates, actorUserId) {
    const webhook = await prisma.cloudPodWebhook.findUnique({
      where: { id: webhookId }
    });
    
    if (!webhook) throw new Error('Webhook not found');
    
    // Validate URL if provided
    if (updates.url && !updates.url.startsWith('https://')) {
      throw new Error('Webhook URL must use HTTPS');
    }
    
    // Validate events if provided
    if (updates.events) {
      const validEvents = this.getValidEvents();
      const invalidEvents = updates.events.filter(e => !validEvents.includes(e));
      if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
      }
    }
    
    // If re-enabling, reset failure state
    if (updates.isActive === true && webhook.autoDisabled) {
      updates.autoDisabled = false;
      updates.autoDisabledAt = null;
      updates.failureCount = 0;
    }
    
    const updated = await prisma.cloudPodWebhook.update({
      where: { id: webhookId },
      data: updates
    });
    
    await auditLog(null, actorUserId, 'webhook_updated', {
      webhookId,
      changes: Object.keys(updates)
    }, webhook.tenantId);
    
    return updated;
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId, actorUserId) {
    const webhook = await prisma.cloudPodWebhook.findUnique({
      where: { id: webhookId }
    });
    
    if (!webhook) throw new Error('Webhook not found');
    
    await prisma.cloudPodWebhook.delete({
      where: { id: webhookId }
    });
    
    await auditLog(null, actorUserId, 'webhook_deleted', {
      webhookId,
      name: webhook.name,
      url: webhook.url
    }, webhook.tenantId);
    
    return { deleted: true };
  }

  /**
   * Get webhooks for a tenant
   */
  async getWebhooks(tenantId) {
    return prisma.cloudPodWebhook.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        headers: true,
        isActive: true,
        autoDisabled: true,
        autoDisabledAt: true,
        lastDeliveryAt: true,
        failureCount: true,
        createdAt: true,
        updatedAt: true
        // Note: secret is NOT included
      }
    });
  }

  /**
   * Rotate webhook secret
   */
  async rotateSecret(webhookId, actorUserId) {
    const webhook = await prisma.cloudPodWebhook.findUnique({
      where: { id: webhookId }
    });
    
    if (!webhook) throw new Error('Webhook not found');
    
    const newSecret = this.generateSecret();
    
    await prisma.cloudPodWebhook.update({
      where: { id: webhookId },
      data: { secret: newSecret }
    });
    
    await auditLog(null, actorUserId, 'webhook_secret_rotated', {
      webhookId
    }, webhook.tenantId);
    
    return { secret: newSecret };
  }

  // ─────────────────────────────────────────────────────────────────
  // Event Publishing
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Publish an event to all subscribed webhooks
   */
  async publishEvent(eventType, tenantId, podId, data) {
    const eventId = `evt_${uuidv4()}`;
    
    // Store event
    await prisma.cloudPodEvent.create({
      data: {
        eventId,
        tenantId,
        podId,
        eventType,
        payload: data
      }
    });
    
    // Find active webhooks subscribed to this event
    const webhooks = await prisma.cloudPodWebhook.findMany({
      where: {
        tenantId,
        isActive: true,
        autoDisabled: false,
        events: { has: eventType }
      }
    });
    
    if (webhooks.length === 0) {
      // Mark event as processed (no subscribers)
      await prisma.cloudPodEvent.update({
        where: { eventId },
        data: { processed: true, processedAt: new Date() }
      });
      return { eventId, deliveries: 0 };
    }
    
    // Create delivery records for each webhook
    const payload = {
      id: eventId,
      type: eventType,
      created_at: new Date().toISOString(),
      tenant_id: tenantId,
      pod_id: podId,
      data
    };
    
    const deliveries = await Promise.all(
      webhooks.map(webhook =>
        prisma.cloudPodWebhookDelivery.create({
          data: {
            webhookId: webhook.id,
            eventId,
            eventType,
            payload,
            status: 'pending',
            nextRetryAt: new Date() // Immediate first attempt
          }
        })
      )
    );
    
    // Queue delivery jobs
    const { webhookQueue } = await import('../workers/webhookQueue.js');
    for (const delivery of deliveries) {
      await webhookQueue.add('deliver', { deliveryId: delivery.id }, {
        delay: 0,
        removeOnComplete: 100,
        removeOnFail: 50
      });
    }
    
    return { eventId, deliveries: deliveries.length };
  }

  /**
   * Convenience method to publish from anywhere
   */
  static async emit(eventType, tenantId, podId, data) {
    const service = new CloudPodWebhookService();
    return service.publishEvent(eventType, tenantId, podId, data);
  }

  // ─────────────────────────────────────────────────────────────────
  // Delivery Execution
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Attempt to deliver a webhook
   */
  async deliverWebhook(deliveryId) {
    const delivery = await prisma.cloudPodWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true }
    });
    
    if (!delivery) throw new Error('Delivery not found');
    if (delivery.status === 'delivered') return { alreadyDelivered: true };
    if (delivery.status === 'permanently_failed') return { permanentlyFailed: true };
    
    const webhook = delivery.webhook;
    if (!webhook.isActive || webhook.autoDisabled) {
      await prisma.cloudPodWebhookDelivery.update({
        where: { id: deliveryId },
        data: { status: 'permanently_failed', errorMessage: 'Webhook disabled' }
      });
      return { skipped: true, reason: 'Webhook disabled' };
    }
    
    // Prepare request
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(delivery.payload, timestamp, webhook.secret);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudPods-Webhook/1.0',
      'X-CloudPods-Event-Type': delivery.eventType,
      'X-CloudPods-Event-ID': delivery.eventId,
      'X-CloudPods-Signature': signature,
      'X-CloudPods-Timestamp': timestamp.toString(),
      ...(webhook.headers || {})
    };
    
    // Increment attempt count
    const attemptNumber = delivery.attempts + 1;
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const responseBody = await response.text().catch(() => '');
      
      if (response.ok) {
        // Success!
        await prisma.$transaction([
          prisma.cloudPodWebhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status: 'delivered',
              httpStatus: response.status,
              responseBody: responseBody.substring(0, 1024),
              attempts: attemptNumber,
              deliveredAt: new Date()
            }
          }),
          prisma.cloudPodWebhook.update({
            where: { id: webhook.id },
            data: {
              lastDeliveryAt: new Date(),
              failureCount: 0 // Reset on success
            }
          }),
          prisma.cloudPodEvent.update({
            where: { eventId: delivery.eventId },
            data: { processed: true, processedAt: new Date() }
          })
        ]);
        
        console.log(`[Webhook] Delivered ${delivery.eventId} to ${webhook.url}`);
        return { delivered: true, httpStatus: response.status };
        
      } else {
        // HTTP error
        throw new Error(`HTTP ${response.status}: ${responseBody.substring(0, 200)}`);
      }
      
    } catch (error) {
      // Delivery failed
      return this.handleDeliveryFailure(deliveryId, webhook, attemptNumber, error);
    }
  }

  /**
   * Handle failed delivery attempt
   */
  async handleDeliveryFailure(deliveryId, webhook, attemptNumber, error) {
    const isPermanentlyFailed = attemptNumber >= CloudPodWebhookService.MAX_ATTEMPTS;
    
    // Calculate next retry time
    let nextRetryAt = null;
    if (!isPermanentlyFailed) {
      const retryDelay = CloudPodWebhookService.RETRY_INTERVALS[attemptNumber - 1] || 28800;
      nextRetryAt = new Date(Date.now() + retryDelay * 1000);
    }
    
    // Update delivery record
    await prisma.cloudPodWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: isPermanentlyFailed ? 'permanently_failed' : 'failed',
        attempts: attemptNumber,
        errorMessage: error.message,
        nextRetryAt
      }
    });
    
    // Update webhook failure count
    const newFailureCount = webhook.failureCount + 1;
    const shouldAutoDisable = newFailureCount >= CloudPodWebhookService.AUTO_DISABLE_THRESHOLD;
    
    await prisma.cloudPodWebhook.update({
      where: { id: webhook.id },
      data: {
        failureCount: newFailureCount,
        ...(shouldAutoDisable && {
          autoDisabled: true,
          autoDisabledAt: new Date()
        })
      }
    });
    
    // Log to audit if permanently failed or auto-disabled
    if (isPermanentlyFailed || shouldAutoDisable) {
      await auditLog(null, null, 
        shouldAutoDisable ? 'webhook_auto_disabled' : 'webhook_delivery_failed',
        {
          webhookId: webhook.id,
          webhookName: webhook.name,
          url: webhook.url,
          attempts: attemptNumber,
          error: error.message
        },
        webhook.tenantId
      );
    }
    
    // Schedule retry if not permanent
    if (!isPermanentlyFailed && nextRetryAt) {
      const { webhookQueue } = await import('../workers/webhookQueue.js');
      await webhookQueue.add('deliver', { deliveryId }, {
        delay: nextRetryAt.getTime() - Date.now(),
        removeOnComplete: 100,
        removeOnFail: 50
      });
    }
    
    console.log(`[Webhook] Delivery ${deliveryId} failed (attempt ${attemptNumber}): ${error.message}`);
    
    return {
      failed: true,
      attempts: attemptNumber,
      permanentlyFailed: isPermanentlyFailed,
      autoDisabled: shouldAutoDisable,
      nextRetryAt
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Testing
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Send a test webhook
   */
  async sendTestWebhook(webhookId, actorUserId) {
    const webhook = await prisma.cloudPodWebhook.findUnique({
      where: { id: webhookId }
    });
    
    if (!webhook) throw new Error('Webhook not found');
    
    const testPayload = {
      id: `test_${uuidv4()}`,
      type: 'test.ping',
      created_at: new Date().toISOString(),
      tenant_id: webhook.tenantId,
      pod_id: null,
      data: {
        message: 'This is a test webhook from CloudPods',
        webhook_name: webhook.name,
        timestamp: new Date().toISOString()
      }
    };
    
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.signPayload(testPayload, timestamp, webhook.secret);
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'CloudPods-Webhook/1.0',
      'X-CloudPods-Event-Type': 'test.ping',
      'X-CloudPods-Event-ID': testPayload.id,
      'X-CloudPods-Signature': signature,
      'X-CloudPods-Timestamp': timestamp.toString(),
      ...(webhook.headers || {})
    };
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s for test
      
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testPayload),
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      const responseBody = await response.text().catch(() => '');
      
      await auditLog(null, actorUserId, 'webhook_test_sent', {
        webhookId,
        url: webhook.url,
        httpStatus: response.status,
        success: response.ok
      }, webhook.tenantId);
      
      return {
        success: response.ok,
        httpStatus: response.status,
        responseBody: responseBody.substring(0, 1024)
      };
      
    } catch (error) {
      await auditLog(null, actorUserId, 'webhook_test_sent', {
        webhookId,
        url: webhook.url,
        error: error.message,
        success: false
      }, webhook.tenantId);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Delivery History
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(webhookId, options = {}) {
    const { limit = 50, status } = options;
    
    return prisma.cloudPodWebhookDelivery.findMany({
      where: {
        webhookId,
        ...(status && { status })
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        status: true,
        httpStatus: true,
        errorMessage: true,
        attempts: true,
        deliveredAt: true,
        createdAt: true
        // Note: payload excluded for brevity
      }
    });
  }

  /**
   * Get a specific delivery with full payload
   */
  async getDelivery(deliveryId) {
    return prisma.cloudPodWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: {
          select: { id: true, name: true, url: true }
        }
      }
    });
  }

  /**
   * Retry a failed delivery
   */
  async retryDelivery(deliveryId, actorUserId) {
    const delivery = await prisma.cloudPodWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true }
    });
    
    if (!delivery) throw new Error('Delivery not found');
    if (delivery.status === 'delivered') {
      throw new Error('Delivery already succeeded');
    }
    
    // Reset for retry
    await prisma.cloudPodWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'pending',
        nextRetryAt: new Date(),
        attempts: 0 // Reset attempts for manual retry
      }
    });
    
    // Queue immediate delivery
    const { webhookQueue } = await import('../workers/webhookQueue.js');
    await webhookQueue.add('deliver', { deliveryId }, {
      delay: 0,
      removeOnComplete: 100
    });
    
    await auditLog(null, actorUserId, 'webhook_delivery_retried', {
      deliveryId,
      webhookId: delivery.webhookId,
      eventId: delivery.eventId
    }, delivery.webhook.tenantId);
    
    return { retried: true };
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Generate a secure webhook secret
   */
  generateSecret() {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Sign a payload with HMAC SHA-256
   */
  signPayload(payload, timestamp, secret) {
    const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
    return crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
  }

  /**
   * Get list of valid event types
   */
  getValidEvents() {
    return [
      // Lifecycle
      'pod.created',
      'pod.create_failed',
      'pod.updated',
      'pod.deleted',
      'pod.started',
      'pod.stopped',
      'pod.rebooted',
      'pod.scaled',
      // Health
      'pod.health.unhealthy',
      'pod.health.recovered',
      'pod.autoheal.triggered',
      // Backup
      'pod.backup.started',
      'pod.backup.completed',
      'pod.backup.failed',
      'pod.restore.started',
      'pod.restore.completed',
      // Security
      'security_group.created',
      'security_group.updated',
      'security_group.deleted',
      'security_group.attached',
      'security_group.detached',
      // Quota
      'quota.warning',
      'quota.exceeded',
      // Budget
      'budget.threshold_reached',
      'budget.limit_exceeded',
      // Test
      'test.ping'
    ];
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Clean up old delivery records
   * Run daily via scheduler
   */
  async cleanupOldDeliveries() {
    const retentionDays = 30;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    const deleted = await prisma.cloudPodWebhookDelivery.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: { in: ['delivered', 'permanently_failed'] }
      }
    });
    
    // Also clean up old events
    await prisma.cloudPodEvent.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        processed: true
      }
    });
    
    console.log(`[Webhook] Cleaned up ${deleted.count} old deliveries`);
    return deleted.count;
  }
}

export const cloudPodWebhooks = new CloudPodWebhookService();
```

---

## Webhook Worker

```javascript
// src/workers/webhookQueue.js

import { Queue, Worker } from 'bullmq';
import { cloudPodWebhooks } from '../services/cloudPodWebhooks.js';

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
};

// Export queue for use by event publishers
export const webhookQueue = new Queue('cloudpod-webhooks', {
  connection: REDIS_CONNECTION,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

/**
 * Start the webhook delivery worker
 */
export function startWebhookWorker() {
  const worker = new Worker(
    'cloudpod-webhooks',
    async (job) => {
      switch (job.name) {
        case 'deliver':
          return await cloudPodWebhooks.deliverWebhook(job.data.deliveryId);
        case 'cleanup':
          return await cloudPodWebhooks.cleanupOldDeliveries();
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency: 10 // Process 10 deliveries in parallel
    }
  );
  
  worker.on('completed', (job, result) => {
    if (result?.delivered) {
      console.log(`[Webhook Worker] Delivery ${job.data.deliveryId} completed`);
    }
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[Webhook Worker] Job ${job.name} failed:`, error.message);
  });
  
  // Schedule daily cleanup
  webhookQueue.add('cleanup', {}, {
    repeat: { cron: '0 4 * * *' }, // 4am daily
    jobId: 'webhook-cleanup'
  });
  
  console.log('[Webhook Worker] Started');
  return worker;
}
```

---

## API Routes

```javascript
// Add to src/routes/cloudPodRoutes.js

import { cloudPodWebhooks } from '../services/cloudPodWebhooks.js';

// ─────────────────────────────────────────────────────────────────
// Webhook Management Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/webhooks
 * List webhooks for tenant
 */
router.get('/webhooks', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhooks = await cloudPodWebhooks.getWebhooks(req.user.tenantId);
    res.json(webhooks);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/webhooks
 * Create a new webhook
 */
router.post('/webhooks', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhook = await cloudPodWebhooks.createWebhook(
      req.user.tenantId,
      req.body,
      req.user.id
    );
    res.status(201).json(webhook);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * PUT /api/cloud-pods/webhooks/:id
 * Update a webhook
 */
router.put('/webhooks/:id', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    // Verify ownership
    const webhook = await prisma.cloudPodWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const updated = await cloudPodWebhooks.updateWebhook(webhookId, req.body, req.user.id);
    res.json(updated);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * DELETE /api/cloud-pods/webhooks/:id
 * Delete a webhook
 */
router.delete('/webhooks/:id', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    // Verify ownership
    const webhook = await prisma.cloudPodWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    await cloudPodWebhooks.deleteWebhook(webhookId, req.user.id);
    res.json({ deleted: true });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/webhooks/:id/test
 * Send a test webhook
 */
router.post('/webhooks/:id/test', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    // Verify ownership
    const webhook = await prisma.cloudPodWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const result = await cloudPodWebhooks.sendTestWebhook(webhookId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/webhooks/:id/rotate-secret
 * Rotate webhook secret
 */
router.post('/webhooks/:id/rotate-secret', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    
    // Verify ownership
    const webhook = await prisma.cloudPodWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const result = await cloudPodWebhooks.rotateSecret(webhookId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/webhooks/:id/deliveries
 * Get delivery history for a webhook
 */
router.get('/webhooks/:id/deliveries', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const webhookId = parseInt(req.params.id);
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    
    // Verify ownership
    const webhook = await prisma.cloudPodWebhook.findUnique({ where: { id: webhookId } });
    if (!webhook || webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    
    const deliveries = await cloudPodWebhooks.getDeliveryHistory(webhookId, { status, limit });
    res.json(deliveries);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/webhooks/deliveries/:id/retry
 * Retry a failed delivery
 */
router.post('/webhooks/deliveries/:id/retry', requireAuth, requirePermission('cloudpods.webhooks.manage'), async (req, res) => {
  try {
    const deliveryId = parseInt(req.params.id);
    
    // Verify ownership through webhook
    const delivery = await prisma.cloudPodWebhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: true }
    });
    if (!delivery || delivery.webhook.tenantId !== req.user.tenantId) {
      return res.status(404).json({ error: 'Delivery not found' });
    }
    
    const result = await cloudPodWebhooks.retryDelivery(deliveryId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/webhooks/events
 * Get list of available webhook events
 */
router.get('/webhooks/events', requireAuth, async (req, res) => {
  try {
    const events = cloudPodWebhooks.getValidEvents();
    res.json({ events });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
```

---

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/webhooks` | GET | List tenant webhooks |
| `/api/cloud-pods/webhooks` | POST | Create webhook |
| `/api/cloud-pods/webhooks/:id` | PUT | Update webhook |
| `/api/cloud-pods/webhooks/:id` | DELETE | Delete webhook |
| `/api/cloud-pods/webhooks/:id/test` | POST | Send test webhook |
| `/api/cloud-pods/webhooks/:id/rotate-secret` | POST | Rotate signing secret |
| `/api/cloud-pods/webhooks/:id/deliveries` | GET | Delivery history |
| `/api/cloud-pods/webhooks/deliveries/:id/retry` | POST | Retry failed delivery |
| `/api/cloud-pods/webhooks/events` | GET | List available events |

---

## Integration with Services

Add webhook emits throughout the codebase:

```javascript
// In cloudPodProvisioning.js - after successful pod creation
import { CloudPodWebhookService } from './cloudPodWebhooks.js';

async function createPod(tenantId, config, userId) {
  // ... pod creation logic ...
  
  // Emit webhook event
  await CloudPodWebhookService.emit('pod.created', tenantId, pod.id, {
    podId: pod.id,
    name: pod.name,
    plan: pod.planId,
    ipAddress: pod.ipAddress
  });
  
  return pod;
}

// In cloudPodHealth.js - when unhealthy detected
await CloudPodWebhookService.emit('pod.health.unhealthy', pod.tenantId, pod.id, {
  podId: pod.id,
  consecutiveFailures: status.consecutiveFailures,
  lastError: status.lastError
});

// In cloudPodSnapshots.js - after backup completes
await CloudPodWebhookService.emit('pod.backup.completed', pod.tenantId, pod.id, {
  podId: pod.id,
  backupId: backup.id,
  sizeBytes: backup.sizeBytes
});
```

---

## Retry Strategy

```
Attempt 1: Immediate
Attempt 2: +1 minute
Attempt 3: +5 minutes
Attempt 4: +15 minutes
Attempt 5: +30 minutes
Attempt 6: +1 hour
Attempt 7: +2 hours
Attempt 8: +4 hours
─────────────────────
Total window: ~8 hours

After 8 failures: permanently_failed
After 50 consecutive failures across all deliveries: webhook auto-disabled
```

---

## Dashboard Integration

1. **Webhook List**: Table showing name, URL, events, status, last delivery
2. **Create/Edit Modal**: Event selector, URL input, custom headers
3. **Delivery Log**: Timeline of recent deliveries with status badges
4. **Test Button**: One-click test with response preview
5. **Secret Display**: Show once on create, rotate button
6. **Re-enable Button**: For auto-disabled webhooks

---

## Security Considerations

1. **HTTPS Only**: All webhook URLs must use HTTPS
2. **Signature Verification**: Recipients SHOULD verify signatures
3. **Timestamp Validation**: Reject events older than 5 minutes (replay protection)
4. **Secret Rotation**: Support for rotating secrets without downtime
5. **Auto-disable**: Prevent runaway retries for dead endpoints
6. **Rate Limiting**: Consider per-tenant delivery rate limits

---

## Next Steps

1. Run Prisma migration to create tables
2. Deploy webhook worker
3. Add emit() calls throughout CloudPods services
4. Add dashboard UI for webhook management
5. Document webhook setup for customers
