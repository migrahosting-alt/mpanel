/**
 * Orders Service - Enterprise-grade Order Management
 * 
 * Aligned with:
 * - Prisma schema (Order, Customer, Price, Product, Subscription, Job)
 * - Multi-tenant isolation (all queries filter by tenantId)
 * - Audit logging for all order state changes
 * 
 * Key functions:
 * - createOrder: Create new order in PENDING state
 * - processOrder: Mark order as PAID, create subscription
 * - cancelOrder: Cancel an order
 * - failOrder: Mark order as FAILED
 * - getOrder: Get single order with relations
 * - listOrders: Paginated order listing with filters
 * - createOrderFromWebhook: Handle marketing site webhook
 */

import { prisma } from '../../config/database.js';
import { Prisma } from '@prisma/client';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';
import type {
  CreateOrderInput,
  CreateOrderFromWebhookInput,
  ProcessOrderInput,
  CancelOrderInput,
  FailOrderInput,
  ListOrdersOptions,
  OrderCreateResponse,
  OrderWithRelations,
  OrdersListResponse,
  OrderMetadata,
  JobInfo,
} from './orders.types.js';
import { ORDER_STATUSES } from './orders.types.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Build order response with relations.
 */
function buildOrderResponse(order: any): OrderWithRelations {
  return {
    id: order.id,
    tenantId: order.tenantId,
    customerId: order.customerId,
    priceId: order.priceId,
    status: order.status,
    totalAmountCents: order.totalAmountCents,
    currency: order.currency,
    stripePaymentIntentId: order.stripePaymentIntentId,
    stripeSessionId: order.stripeSessionId,
    externalOrderId: order.externalOrderId,
    metadata: order.metadata as OrderMetadata | null,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customer: {
      id: order.customer.id,
      email: order.customer.email,
      fullName: order.customer.fullName,
      phone: order.customer.phone ?? null,
    },
    price: order.price
      ? {
          id: order.price.id,
          name: order.price.name,
          slug: order.price.slug,
          interval: order.price.interval,
          amountCents: order.price.amountCents,
          product: {
            id: order.price.product.id,
            name: order.price.product.name,
            type: order.price.product.type,
            code: order.price.product.code,
          },
        }
      : null,
    subscription: order.subscription
      ? {
          id: order.subscription.id,
          status: order.subscription.status,
          startedAt: order.subscription.startedAt,
          currentPeriodEnd: order.subscription.currentPeriodEnd,
        }
      : null,
    jobs: (order.jobs ?? []).map((j: any) => ({
      id: j.id,
      type: j.type,
      status: j.status,
    })),
  };
}

/**
 * Standard includes for order queries.
 */
const orderIncludes = {
  customer: {
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
    },
  },
  price: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          type: true,
          code: true,
        },
      },
    },
  },
  subscription: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      currentPeriodEnd: true,
    },
  },
  jobs: {
    select: {
      id: true,
      type: true,
      status: true,
    },
  },
};

// ============================================
// ORDERS SERVICE CLASS
// ============================================

export class OrdersService {
  /**
   * Create a new order in PENDING state.
   * 
   * Flow:
   * 1. Validate customer exists or create from email
   * 2. Validate price/product exists if provided
   * 3. Create order in PENDING status
   * 4. Emit ORDER_CREATED audit event
   * 
   * @param input - Order creation input
   * @param actorUserId - User creating the order (null for system)
   */
  async createOrder(
    input: CreateOrderInput,
    actorUserId: string | null = null
  ): Promise<OrderCreateResponse> {
    const {
      tenantId,
      customerId,
      customerEmail,
      customerName,
      customerPhone,
      priceId,
      priceSlug,
      productCode,
      quantity = 1,
      totalAmountCents,
      currency = 'usd',
      stripePaymentIntentId,
      stripeSessionId,
      externalOrderId,
      metadata,
      notes,
    } = input;

    logger.info('Creating order', {
      tenantId,
      customerId,
      customerEmail,
      priceId,
      priceSlug,
      productCode,
    });

    // 1) Resolve customer
    let resolvedCustomerId = customerId;

    if (!resolvedCustomerId && customerEmail) {
      // Find or create customer
      let customer = await prisma.customer.findFirst({
        where: {
          tenantId,
          email: customerEmail.toLowerCase(),
        },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            tenantId,
            email: customerEmail.toLowerCase(),
            fullName: customerName ?? null,
            phone: customerPhone ?? null,
            isActive: true,
          },
        });
        logger.info('Customer created', { customerId: customer.id, email: customer.email });
      }

      resolvedCustomerId = customer.id;
    }

    if (!resolvedCustomerId) {
      throw new Error('Customer ID or email is required');
    }

    // 2) Resolve price if provided
    let resolvedPriceId = priceId;

    if (!resolvedPriceId && priceSlug) {
      const price = await prisma.price.findUnique({
        where: { slug: priceSlug },
      });
      if (!price) {
        throw new Error(`Price not found: ${priceSlug}`);
      }
      if (!price.isActive) {
        throw new Error(`Price is inactive: ${priceSlug}`);
      }
      resolvedPriceId = price.id;
    }

    if (!resolvedPriceId && productCode) {
      const product = await prisma.product.findUnique({
        where: { code: productCode },
        include: { prices: { where: { isActive: true }, take: 1 } },
      });
      if (!product) {
        throw new Error(`Product not found: ${productCode}`);
      }
      if (product.prices.length > 0) {
        resolvedPriceId = product.prices[0].id;
      }
    }

    // 3) Create order
    const order = await prisma.order.create({
      data: {
        tenantId,
        customerId: resolvedCustomerId,
        priceId: resolvedPriceId ?? null,
        status: ORDER_STATUSES.PENDING,
        totalAmountCents,
        currency,
        stripePaymentIntentId: stripePaymentIntentId ?? null,
        stripeSessionId: stripeSessionId ?? null,
        externalOrderId: externalOrderId ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
        notes: notes ?? null,
      },
      include: orderIncludes,
    });

    logger.info('Order created', {
      orderId: order.id,
      tenantId,
      customerId: resolvedCustomerId,
      status: order.status,
    });

    // 4) Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'ORDER_CREATED',
      metadata: {
        orderId: order.id,
        customerId: resolvedCustomerId,
        priceId: resolvedPriceId,
        totalAmountCents,
        currency,
        source: metadata?.source ?? 'api',
      },
    });

    return {
      orderId: order.id,
      status: order.status as any,
      customerId: order.customerId,
      totalAmountCents: order.totalAmountCents,
      currency: order.currency,
      jobs: [],
      createdAt: order.createdAt,
    };
  }

  /**
   * Process order payment - mark as PAID and create subscription.
   * 
   * Flow:
   * 1. Validate order exists and belongs to tenant
   * 2. Validate order is in PENDING state
   * 3. Update order status to PAID
   * 4. Create subscription if price is attached
   * 5. Emit ORDER_PAID audit event
   */
  async processOrder(
    input: ProcessOrderInput,
    actorUserId: string | null = null
  ): Promise<OrderWithRelations> {
    const { orderId, tenantId, stripePaymentIntentId, stripeSessionId, notes } = input;

    logger.info('Processing order payment', { orderId, tenantId });

    // 1) Get order with tenant validation
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        price: {
          include: { product: true },
        },
        customer: true,
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // 2) Validate status
    if (order.status !== ORDER_STATUSES.PENDING) {
      throw new Error(`Order cannot be processed: current status is ${order.status}`);
    }

    // 3) Update order and create subscription in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update order to PAID
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: ORDER_STATUSES.PAID,
          stripePaymentIntentId: stripePaymentIntentId ?? order.stripePaymentIntentId,
          stripeSessionId: stripeSessionId ?? order.stripeSessionId,
          notes: notes ?? order.notes,
        },
        include: orderIncludes,
      });

      // Create subscription if price exists
      let subscriptionId: string | null = null;

      if (order.price) {
        const now = new Date();
        const periodEnd = new Date(now);

        // Calculate period end based on interval
        const interval = order.price.interval?.toUpperCase() ?? 'MONTHLY';
        if (interval === 'YEARLY') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else if (interval === 'QUARTERLY') {
          periodEnd.setMonth(periodEnd.getMonth() + 3);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const subscription = await tx.subscription.create({
          data: {
            tenantId,
            customerId: order.customerId,
            priceId: order.priceId,
            orderId: order.id,
            productId: order.price.productId,
            productCode: order.price.product.code ?? null,
            status: 'active',
            startedAt: now,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            quantity: 1,
          },
        });

        subscriptionId = subscription.id;
        logger.info('Subscription created', { subscriptionId, orderId });
      }

      return { updatedOrder, subscriptionId };
    });

    // 4) Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'ORDER_PAID',
      metadata: {
        orderId,
        customerId: order.customerId,
        subscriptionId: result.subscriptionId,
        totalAmountCents: order.totalAmountCents,
        currency: order.currency,
      },
    });

    logger.info('Order processed successfully', {
      orderId,
      subscriptionId: result.subscriptionId,
    });

    return buildOrderResponse(result.updatedOrder);
  }

  /**
   * Cancel an order.
   * Only PENDING orders can be cancelled.
   */
  async cancelOrder(
    input: CancelOrderInput,
    actorUserId: string | null = null
  ): Promise<OrderWithRelations> {
    const { orderId, tenantId, reason } = input;

    logger.info('Cancelling order', { orderId, tenantId, reason });

    // 1) Get order with tenant validation
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // 2) Validate status - only PENDING can be cancelled
    if (order.status !== ORDER_STATUSES.PENDING) {
      throw new Error(`Order cannot be cancelled: current status is ${order.status}`);
    }

    // 3) Update order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUSES.CANCELLED,
        notes: reason ? `Cancelled: ${reason}` : order.notes,
      },
      include: orderIncludes,
    });

    // 4) Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'ORDER_CANCELLED',
      metadata: {
        orderId,
        reason,
        previousStatus: order.status,
      },
    });

    logger.info('Order cancelled', { orderId });

    return buildOrderResponse(updatedOrder);
  }

  /**
   * Mark an order as failed.
   */
  async failOrder(
    input: FailOrderInput,
    actorUserId: string | null = null
  ): Promise<OrderWithRelations> {
    const { orderId, tenantId, reason, errorDetails } = input;

    logger.info('Marking order as failed', { orderId, tenantId, reason });

    // 1) Get order with tenant validation
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
    });

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // 2) Update order
    const existingMetadata = (order.metadata as Record<string, unknown>) ?? {};
    const newMetadata = {
      ...existingMetadata,
      failureReason: reason,
      failureDetails: errorDetails ?? null,
      failedAt: new Date().toISOString(),
    };
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUSES.FAILED,
        notes: `Failed: ${reason}`,
        metadata: newMetadata as Prisma.InputJsonValue,
      },
      include: orderIncludes,
    });

    // 3) Audit event
    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'ORDER_FAILED',
      metadata: {
        orderId,
        reason,
        errorDetails,
        previousStatus: order.status,
      },
    });

    logger.info('Order marked as failed', { orderId });

    return buildOrderResponse(updatedOrder);
  }

  /**
   * Get a single order by ID.
   * Always validates tenant ownership.
   */
  async getOrder(orderId: string, tenantId: string): Promise<OrderWithRelations | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: orderIncludes,
    });

    if (!order) {
      return null;
    }

    return buildOrderResponse(order);
  }

  /**
   * List orders with pagination and filters.
   * Always scoped to tenant.
   */
  async listOrders(options: ListOrdersOptions): Promise<OrdersListResponse> {
    const {
      tenantId,
      customerId,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where clause
    const where: Prisma.OrderWhereInput = {
      tenantId,
    };

    if (customerId) {
      where.customerId = customerId;
    }

    if (status) {
      if (Array.isArray(status)) {
        where.status = { in: status };
      } else {
        where.status = status;
      }
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get total count
    const total = await prisma.order.count({ where });

    // Get orders
    const orders = await prisma.order.findMany({
      where,
      include: orderIncludes,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      orders: orders.map(buildOrderResponse),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Create order from marketing site webhook.
   * This is a convenience method that handles the full flow:
   * 1. Look up tenant by slug
   * 2. Look up price by slug
   * 3. Create or find customer
   * 4. Create order in PAID status (payment already confirmed)
   * 5. Create subscription
   * 6. Create provisioning jobs
   */
  async createOrderFromWebhook(
    input: CreateOrderFromWebhookInput
  ): Promise<OrderCreateResponse & { subscriptionId: string; jobs: JobInfo[] }> {
    const {
      tenantSlug,
      customer,
      priceSlug,
      totalAmountCents,
      currency = 'usd',
      stripePaymentIntentId,
      stripeSessionId,
      metadata,
    } = input;

    logger.info('Creating order from webhook', {
      tenantSlug,
      email: customer.email,
      priceSlug,
      domain: metadata?.domain,
    });

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1) Find tenant
      const tenant = await tx.tenant.findUnique({
        where: { slug: tenantSlug },
      });

      if (!tenant || !tenant.isActive) {
        throw new Error(`Tenant not found or inactive: ${tenantSlug}`);
      }

      // 2) Find price
      const price = await tx.price.findUnique({
        where: { slug: priceSlug },
        include: { product: true },
      });

      if (!price || !price.isActive) {
        throw new Error(`Price not found or inactive: ${priceSlug}`);
      }

      // 3) Find or create customer
      let dbCustomer = await tx.customer.findFirst({
        where: {
          tenantId: tenant.id,
          email: customer.email.toLowerCase(),
        },
      });

      if (!dbCustomer) {
        dbCustomer = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            email: customer.email.toLowerCase(),
            fullName: customer.fullName ?? null,
            phone: customer.phone ?? null,
            isActive: true,
          },
        });
        logger.info('Customer created', { customerId: dbCustomer.id });
      }

      // 4) Create order in PAID status (webhook means payment confirmed)
      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerId: dbCustomer.id,
          priceId: price.id,
          status: ORDER_STATUSES.PAID,
          totalAmountCents,
          currency,
          stripePaymentIntentId: stripePaymentIntentId ?? null,
          stripeSessionId: stripeSessionId ?? null,
          metadata: {
            ...metadata,
            source: 'marketing_site',
          },
        },
      });

      // 5) Create subscription
      const now = new Date();
      const periodEnd = new Date(now);
      const interval = price.interval?.toUpperCase() ?? 'MONTHLY';
      if (interval === 'YEARLY') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else if (interval === 'QUARTERLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          customerId: dbCustomer.id,
          priceId: price.id,
          orderId: order.id,
          productId: price.productId,
          productCode: price.product.code ?? null,
          status: 'inactive', // Will be activated after provisioning
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          quantity: 1,
        },
      });

      // 6) Create domain if provided
      let domainId: string | null = null;
      if (metadata?.domain) {
        const domain = await tx.domain.create({
          data: {
            tenantId: tenant.id,
            name: metadata.domain,
            status: 'pending',
            autoDns: true,
            autoMail: true,
          },
        });
        domainId = domain.id;
      }

      // 7) Create provisioning jobs based on product type
      const jobs: { id: string; type: string; status: string }[] = [];
      const productType = price.product.type?.toUpperCase();

      if (productType === 'SHARED_HOSTING' || productType === 'CLOUD_POD') {
        // DNS job
        const dnsJob = await tx.job.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            type: 'PROVISION_DNS',
            status: 'PENDING',
            payload: {
              subscriptionId: subscription.id,
              domainId,
              domain: metadata?.domain,
              customerId: dbCustomer.id,
            },
          },
        });
        jobs.push({ id: dnsJob.id, type: dnsJob.type, status: dnsJob.status });

        // Hosting job
        const hostingJob = await tx.job.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            type: 'PROVISION_HOSTING',
            status: 'PENDING',
            payload: {
              subscriptionId: subscription.id,
              domainId,
              domain: metadata?.domain,
              customerId: dbCustomer.id,
              email: dbCustomer.email,
            },
          },
        });
        jobs.push({ id: hostingJob.id, type: hostingJob.type, status: hostingJob.status });

        // Email job if plan includes email
        const limitsJson = price.limitsJson as Record<string, any> | null;
        if (limitsJson?.emails && limitsJson.emails > 0) {
          const mailJob = await tx.job.create({
            data: {
              tenantId: tenant.id,
              orderId: order.id,
              type: 'PROVISION_MAIL',
              status: 'PENDING',
              payload: {
                subscriptionId: subscription.id,
                domainId,
                domain: metadata?.domain,
                customerId: dbCustomer.id,
                email: dbCustomer.email,
              },
            },
          });
          jobs.push({ id: mailJob.id, type: mailJob.type, status: mailJob.status });
        }
      }

      return {
        tenant,
        order,
        subscription,
        customer: dbCustomer,
        jobs,
      };
    });

    // Audit event
    await writeAuditEvent({
      actorUserId: null,
      tenantId: result.tenant.id,
      type: 'ORDER_CREATED',
      metadata: {
        orderId: result.order.id,
        subscriptionId: result.subscription.id,
        customerId: result.customer.id,
        source: 'marketing_site',
        domain: metadata?.domain,
      },
    });

    await writeAuditEvent({
      actorUserId: null,
      tenantId: result.tenant.id,
      type: 'ORDER_PAID',
      metadata: {
        orderId: result.order.id,
        subscriptionId: result.subscription.id,
        totalAmountCents,
      },
    });

    logger.info('Webhook order created', {
      orderId: result.order.id,
      subscriptionId: result.subscription.id,
      jobCount: result.jobs.length,
    });

    return {
      orderId: result.order.id,
      status: result.order.status as any,
      subscriptionId: result.subscription.id,
      customerId: result.customer.id,
      totalAmountCents: result.order.totalAmountCents,
      currency: result.order.currency,
      jobs: result.jobs as JobInfo[],
      createdAt: result.order.createdAt,
    };
  }
}

// ============================================
// EXPORT
// ============================================

export default new OrdersService();
