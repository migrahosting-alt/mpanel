/**
 * Orders Controller - Enterprise-grade HTTP handlers
 * 
 * Endpoints:
 * - POST /api/orders             - Create order (admin)
 * - POST /api/orders/webhook     - Create order from marketing site
 * - GET /api/orders              - List orders with pagination
 * - GET /api/orders/:id          - Get single order
 * - POST /api/orders/:id/pay     - Process order payment
 * - POST /api/orders/:id/cancel  - Cancel order
 * 
 * All endpoints enforce multi-tenant isolation via JWT tenantId.
 */

import type { Request, Response, NextFunction } from 'express';
import ordersService from './orders.service.js';
import type {
  CreateOrderInput,
  CreateOrderFromWebhookInput,
  ProcessOrderInput,
  CancelOrderInput,
  FailOrderInput,
  ListOrdersOptions,
} from './orders.types.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import logger from '../../config/logger.js';
import { env } from '../../config/env.js';

// ============================================
// ORDERS CONTROLLER
// ============================================

export class OrdersController {
  /**
   * POST /api/orders
   * Create a new order in PENDING state.
   * Requires ADMIN or OWNER role.
   */
  async createOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { tenantId, userId } = req.user;

      // Validate required fields
      const body = req.body as Partial<CreateOrderInput>;
      if (
        !body.totalAmountCents ||
        (!body.customerId && !body.customerEmail)
      ) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'totalAmountCents and (customerId or customerEmail) are required',
        });
        return;
      }

      const input: CreateOrderInput = {
        tenantId,
        customerId: body.customerId,
        customerEmail: body.customerEmail,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        priceId: body.priceId,
        priceSlug: body.priceSlug,
        productCode: body.productCode,
        quantity: body.quantity ?? 1,
        totalAmountCents: body.totalAmountCents,
        currency: body.currency ?? 'usd',
        stripePaymentIntentId: body.stripePaymentIntentId,
        stripeSessionId: body.stripeSessionId,
        externalOrderId: body.externalOrderId,
        metadata: body.metadata,
        notes: body.notes,
      };

      logger.info('Admin creating order', {
        tenantId,
        userId,
        customerId: input.customerId,
        customerEmail: input.customerEmail,
      });

      const result = await ordersService.createOrder(input, userId);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: 'Not found', message: error.message });
        }
        if (error.message.includes('required')) {
          return res.status(400).json({ error: 'Validation error', message: error.message });
        }
      }
      next(error);
    }
  }

  /**
   * POST /api/orders/webhook
   * Create order from marketing site (after successful Stripe payment).
   * Protected by internal webhook secret.
   */
  async createOrderFromWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Verify internal webhook secret
      const internalKey = req.headers['x-internal-key'];

      if (
        !env.MARKETING_WEBHOOK_SECRET ||
        internalKey !== env.MARKETING_WEBHOOK_SECRET
      ) {
        logger.warn('Unauthorized webhook order creation attempt', {
          ip: req.ip,
          headers: Object.keys(req.headers),
        });

        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid internal API key',
        });
        return;
      }

      const body = req.body as Partial<CreateOrderFromWebhookInput>;

      // Validate required fields
      if (
        !body.tenantSlug ||
        !body.customer?.email ||
        !body.priceSlug ||
        !body.totalAmountCents
      ) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'tenantSlug, customer.email, priceSlug, and totalAmountCents are required',
        });
        return;
      }

      logger.info('Webhook order request received', {
        tenantSlug: body.tenantSlug,
        email: body.customer.email,
        priceSlug: body.priceSlug,
        domain: body.metadata?.domain,
      });

      const input: CreateOrderFromWebhookInput = {
        tenantSlug: body.tenantSlug,
        customer: {
          email: body.customer.email,
          fullName: body.customer.fullName,
          phone: body.customer.phone,
        },
        priceSlug: body.priceSlug,
        totalAmountCents: body.totalAmountCents,
        currency: body.currency ?? 'usd',
        stripePaymentIntentId: body.stripePaymentIntentId,
        stripeSessionId: body.stripeSessionId,
        metadata: body.metadata,
      };

      const result = await ordersService.createOrderFromWebhook(input);

      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('inactive')) {
          return res.status(404).json({ error: 'Not found', message: error.message });
        }
      }

      logger.error('Webhook order creation error', {
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return next(error);
    }
  }

  /**
   * GET /api/orders
   * List orders with pagination and filters.
   * Requires at least BILLING role.
   */
  async listOrders(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { tenantId } = req.user;

      // Parse query params
      const options: ListOrdersOptions = {
        tenantId,
        customerId: req.query.customerId as string | undefined,
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
        sortBy: (req.query.sortBy as 'createdAt' | 'totalAmountCents') ?? 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') ?? 'desc',
      };

      // Parse date filters
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }

      const result = await ordersService.listOrders(options);

      return res.json({
        success: true,
        data: result.orders,
        meta: result.meta,
      });
    } catch (error) {
      logger.error('List orders error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return next(error);
    }
  }

  /**
   * GET /api/orders/:id
   * Get a single order by ID.
   * Requires at least BILLING role.
   */
  async getOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { tenantId } = req.user;

      const order = await ordersService.getOrder(id, tenantId);

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      logger.error('Get order error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return next(error);
    }
  }

  /**
   * POST /api/orders/:id/pay
   * Process order payment - mark as PAID and create subscription.
   * Requires ADMIN or OWNER role.
   */
  async processOrderPayment(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { tenantId, userId } = req.user;

      const body = req.body as Partial<ProcessOrderInput>;

      const input: ProcessOrderInput = {
        orderId: id,
        tenantId,
        stripePaymentIntentId: body.stripePaymentIntentId,
        stripeSessionId: body.stripeSessionId,
        notes: body.notes,
      };

      logger.info('Processing order payment', { orderId: id, tenantId, userId });

      const order = await ordersService.processOrder(input, userId);

      return res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: 'Not found', message: error.message });
        }
        if (error.message.includes('cannot be processed')) {
          return res.status(400).json({ error: 'Invalid state', message: error.message });
        }
      }

      logger.error('Process order payment error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return next(error);
    }
  }

  /**
   * POST /api/orders/:id/cancel
   * Cancel an order.
   * Requires ADMIN or OWNER role.
   */
  async cancelOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { tenantId, userId } = req.user;

      const body = req.body as Partial<CancelOrderInput>;

      const input: CancelOrderInput = {
        orderId: id,
        tenantId,
        reason: body.reason,
      };

      logger.info('Cancelling order', { orderId: id, tenantId, userId, reason: body.reason });

      const order = await ordersService.cancelOrder(input, userId);

      return res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: 'Not found', message: error.message });
        }
        if (error.message.includes('cannot be cancelled')) {
          return res.status(400).json({ error: 'Invalid state', message: error.message });
        }
      }

      logger.error('Cancel order error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return next(error);
    }
  }

  /**
   * POST /api/orders/:id/fail
   * Mark an order as failed.
   * Requires ADMIN or OWNER role.
   */
  async failOrder(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { tenantId, userId } = req.user;

      const body = req.body as Partial<FailOrderInput>;

      if (!body.reason) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'reason is required',
        });
        return;
      }

      const input: FailOrderInput = {
        orderId: id,
        tenantId,
        reason: body.reason,
        errorDetails: body.errorDetails,
      };

      logger.info('Marking order as failed', { orderId: id, tenantId, userId });

      const order = await ordersService.failOrder(input, userId);

      return res.json({
        success: true,
        data: order,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return res.status(404).json({ error: 'Not found', message: error.message });
        }
      }

      logger.error('Fail order error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return next(error);
    }
  }
}

// ============================================
// EXPORT
// ============================================

export default new OrdersController();
