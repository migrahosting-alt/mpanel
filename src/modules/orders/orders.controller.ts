import { Request, Response, NextFunction } from 'express';
import ordersService from './orders.service.js';
import type { CreateOrderRequest } from './orders.types.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import logger from '../../config/logger.js';
import { env } from '../../config/env.js';

export class OrdersController {
  /**
   * POST /api/orders
   * Create order (called by marketing site after Stripe payment)
   * Protected by internal webhook secret
   */
  async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify internal webhook secret
      const internalKey = req.headers['x-internal-key'];

      if (!env.MARKETING_WEBHOOK_SECRET || internalKey !== env.MARKETING_WEBHOOK_SECRET) {
        logger.warn('Unauthorized order creation attempt', {
          ip: req.ip,
          headers: req.headers,
        });

        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid internal API key',
        });
        return;
      }

      const orderData: CreateOrderRequest = req.body;

      // Validate required fields
      if (!orderData.tenantSlug || !orderData.customer?.email || !orderData.priceSlug) {
        res.status(400).json({
          error: 'Validation error',
          message: 'tenantSlug, customer.email, and priceSlug are required',
        });
        return;
      }

      logger.info('Order creation request received', {
        tenantSlug: orderData.tenantSlug,
        email: orderData.customer.email,
        priceSlug: orderData.priceSlug,
        domain: orderData.metadata?.domain,
      });

      const result = await ordersService.createOrder(orderData);

      res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('inactive')) {
          res.status(404).json({
            error: 'Not found',
            message: error.message,
          });
          return;
        }
      }

      logger.error('Order creation error', {
        error: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      next(error);
    }
  }

  /**
   * GET /api/orders/:id
   * Get order by ID (admin)
   */
  async getOrderById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const order = await ordersService.getOrderById(id, req.user.tenantId);

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json({ order });
    } catch (error) {
      logger.error('Get order error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/orders
   * Get all orders (admin)
   */
  async getAllOrders(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const orders = await ordersService.getOrdersByTenant(req.user.tenantId);

      res.json({ orders });
    } catch (error) {
      logger.error('Get all orders error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }
}

export default new OrdersController();
