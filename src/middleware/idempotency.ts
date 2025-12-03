/**
 * Idempotency Middleware
 * 
 * Ensures critical operations (webhooks, payments, provisioning) are never
 * executed twice, even if client retries or webhook fires multiple times.
 * 
 * Usage:
 *   router.post('/webhooks/stripe', idempotency('stripe.webhook'), handler);
 *   router.post('/cloudpods', authMiddleware, idempotency('cloudpod.create'), handler);
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../config/database.js';
import logger from '../config/logger.js';

interface IdempotencyOptions {
  operation: string;
  ttlHours?: number; // How long to keep keys (default 24h)
  extractKey?: (req: Request) => string; // Custom key extraction
}

/**
 * Idempotency middleware factory
 */
export function idempotency(
  operationOrOptions: string | IdempotencyOptions
) {
  const options: IdempotencyOptions = typeof operationOrOptions === 'string'
    ? { operation: operationOrOptions }
    : operationOrOptions;

  const { operation, ttlHours = 24, extractKey } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract idempotency key
      let idempotencyKey = req.headers['idempotency-key'] as string;
      
      // For webhooks, use webhook event ID
      if (!idempotencyKey && extractKey) {
        idempotencyKey = extractKey(req);
      }
      
      // If no key provided, skip idempotency check (not a retryable operation)
      if (!idempotencyKey) {
        return next();
      }

      // Generate request hash for validation
      const requestHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(req.body))
        .digest('hex');

      const tenantId = (req as any).tenantId || null;

      // Check if this key was already processed
      // @ts-ignore - IdempotencyKey table will be created
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      if (existing) {
        // Key exists - check status
        if (existing.status === 'PROCESSING') {
          // Still processing - ask client to retry later
          return res.status(409).json({
            error: 'REQUEST_IN_PROGRESS',
            message: 'This request is already being processed. Please retry in a few seconds.',
            retryAfter: 5,
          });
        }

        if (existing.status === 'COMPLETED') {
          // Already completed - return cached response
          logger.info('Idempotent request - returning cached response', {
            operation,
            idempotencyKey,
            originalTimestamp: existing.createdAt,
          });

          return res.status(200).json(existing.responseData || { success: true });
        }

        if (existing.status === 'FAILED') {
          // Previously failed - check if request is identical
          if (existing.requestHash === requestHash) {
            // Same request that failed before - return same error
            return res.status(500).json({
              error: 'PREVIOUS_ATTEMPT_FAILED',
              message: existing.errorMessage || 'This request failed previously',
            });
          } else {
            // Different request body - allow retry with new data
            logger.info('Idempotent request - different body, allowing retry', {
              operation,
              idempotencyKey,
            });
          }
        }
      }

      // Create new idempotency record (status: PROCESSING)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      // @ts-ignore - IdempotencyKey table will be created
      const record = await prisma.idempotencyKey.upsert({
        where: { key: idempotencyKey },
        create: {
          key: idempotencyKey,
          operation,
          tenantId,
          status: 'PROCESSING',
          requestHash,
          expiresAt,
        },
        update: {
          status: 'PROCESSING',
          requestHash,
          responseData: null,
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      // Attach idempotency info to request
      (req as any).idempotencyKey = idempotencyKey;
      (req as any).idempotencyRecordId = record.id;

      // Intercept response to save result
      const originalJson = res.json.bind(res);
      const originalStatus = res.status.bind(res);
      let statusCode = 200;

      res.status = (code: number) => {
        statusCode = code;
        return originalStatus(code);
      };

      res.json = (data: any) => {
        (async () => {
          try {
            // Determine if this was success or failure
            const isSuccess = statusCode >= 200 && statusCode < 300;

            // @ts-ignore
            await prisma.idempotencyKey.update({
              where: { id: record.id },
              data: {
                status: isSuccess ? 'COMPLETED' : 'FAILED',
                responseData: isSuccess ? data : null,
                errorMessage: isSuccess ? null : (data.error || data.message || 'Request failed'),
              },
            });

            logger.info('Idempotency key resolved', {
              operation,
              idempotencyKey,
              status: isSuccess ? 'COMPLETED' : 'FAILED',
              statusCode,
            });
          } catch (err) {
            logger.error('Failed to update idempotency record', {
              operation,
              idempotencyKey,
              error: err,
            });
          }
        })();

        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error', {
        operation,
        error,
      });
      // Don't block request if idempotency check fails
      next();
    }
  };
}

/**
 * Cleanup expired idempotency keys
 * Run this periodically (e.g., daily cron job)
 */
export async function cleanupExpiredIdempotencyKeys(): Promise<number> {
  try {
    // @ts-ignore
    const result = await prisma.idempotencyKey.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    logger.info('Cleaned up expired idempotency keys', {
      count: result.count,
    });

    return result.count;
  } catch (error) {
    logger.error('Failed to cleanup idempotency keys', { error });
    return 0;
  }
}

/**
 * Stripe webhook idempotency key extractor
 */
export function stripeIdempotencyKey(req: Request): string | undefined {
  // Stripe sends event ID in webhook
  const event = req.body;
  return event?.id; // evt_xxx
}

/**
 * Generic webhook idempotency key extractor
 */
export function webhookIdempotencyKey(req: Request): string | undefined {
  const event = req.body;
  return event?.id || event?.event_id || event?.eventId;
}
