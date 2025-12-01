import { prisma } from '../../config/database.js';
import { enqueueJob } from '../../config/redis.js';
import type { CreateOrderRequest, OrderResponse, OrderWithRelations } from './orders.types.js';
import { OrderStatus, SubscriptionStatus, JobType, JobStatus, ProductType } from '@prisma/client';
import logger from '../../config/logger.js';

export class OrdersService {
  /**
   * Create order from marketing site (after successful Stripe payment)
   * This is the critical integration point that triggers provisioning
   */
  async createOrder(data: CreateOrderRequest): Promise<OrderResponse> {
    logger.info('Creating order from marketing site', {
      email: data.customer.email,
      priceSlug: data.priceSlug,
      domain: data.metadata?.domain,
    });

    // Use transaction to ensure all-or-nothing
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find tenant by slug
      const tenant = await tx.tenant.findUnique({
        where: { slug: data.tenantSlug },
      });

      if (!tenant || !tenant.isActive) {
        throw new Error(`Tenant not found or inactive: ${data.tenantSlug}`);
      }

      // 2. Find price by slug
      const price = await tx.price.findUnique({
        where: { slug: data.priceSlug },
        include: {
          product: true,
        },
      });

      if (!price || !price.isActive) {
        throw new Error(`Price not found or inactive: ${data.priceSlug}`);
      }

      // 3. Find or create customer
      let customer = await tx.customer.findFirst({
        where: {
          tenantId: tenant.id,
          email: data.customer.email.toLowerCase(),
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId: tenant.id,
            email: data.customer.email.toLowerCase(),
            fullName: data.customer.fullName,
            phone: data.customer.phone,
          },
        });

        logger.info('New customer created', {
          customerId: customer.id,
          email: customer.email,
        });
      }

      // 4. Create order
      const order = await tx.order.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          priceId: price.id,
          status: OrderStatus.PAID,
          totalAmountCents: data.totalAmountCents,
          currency: data.currency || 'usd',
          stripePaymentIntentId: data.stripePaymentIntentId,
          metadata: data.metadata,
        },
      });

      logger.info('Order created', {
        orderId: order.id,
        customerId: customer.id,
        priceId: price.id,
      });

      // 5. Calculate subscription period
      const now = new Date();
      const periodEnd = new Date(now);
      if (price.interval === 'MONTHLY') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else if (price.interval === 'YEARLY') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1); // Default to 1 month
      }

      // 6. Create subscription
      const subscription = await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          priceId: price.id,
          orderId: order.id,
          status: SubscriptionStatus.INACTIVE, // Will be activated after provisioning
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      logger.info('Subscription created', {
        subscriptionId: subscription.id,
        status: subscription.status,
        periodEnd: periodEnd.toISOString(),
      });

      // 7. Create domain if needed
      let domainId: string | null = null;
      if (data.metadata?.domain) {
        const domain = await tx.domain.create({
          data: {
            tenantId: tenant.id,
            name: data.metadata.domain,
            status: 'PENDING_SETUP',
            autoDns: true,
            autoMail: true,
          },
        });
        domainId = domain.id;

        logger.info('Domain created', {
          domainId: domain.id,
          domainName: domain.name,
        });
      }

      // 8. Create provisioning jobs based on product type
      const jobs = [];

      if (price.product.type === ProductType.SHARED_HOSTING) {
        // Create DNS provisioning job
        const dnsJob = await tx.job.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            type: JobType.PROVISION_DNS,
            status: JobStatus.PENDING,
            payload: {
              subscriptionId: subscription.id,
              domainId,
              domain: data.metadata?.domain,
              customerId: customer.id,
            },
          },
        });
        jobs.push(dnsJob);

        // Create hosting provisioning job
        const hostingJob = await tx.job.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            type: JobType.PROVISION_HOSTING,
            status: JobStatus.PENDING,
            payload: {
              subscriptionId: subscription.id,
              domainId,
              domain: data.metadata?.domain,
              customerId: customer.id,
              email: customer.email,
            },
          },
        });
        jobs.push(hostingJob);

        // Create mail provisioning job if needed
        const limitsJson = price.limitsJson as Record<string, any> | null;
        const hasEmailFeature = limitsJson && typeof limitsJson === 'object' && 'emails' in limitsJson && limitsJson.emails > 0;
        if (hasEmailFeature) {
          const mailJob = await tx.job.create({
            data: {
              tenantId: tenant.id,
              orderId: order.id,
              type: JobType.PROVISION_MAIL,
              status: JobStatus.PENDING,
              payload: {
                subscriptionId: subscription.id,
                domainId,
                domain: data.metadata?.domain,
                customerId: customer.id,
                email: customer.email,
              },
            },
          });
          jobs.push(mailJob);
        }
      }

      logger.info('Provisioning jobs created', {
        orderId: order.id,
        jobCount: jobs.length,
        jobTypes: jobs.map((j) => j.type),
      });

      return {
        orderId: order.id,
        subscriptionId: subscription.id,
        customerId: customer.id,
        jobs: jobs.map((j) => ({
          id: j.id,
          type: j.type,
          status: j.status,
        })),
      };
    });

    // 9. Enqueue jobs to Redis for worker processing (outside transaction)
    for (const job of result.jobs) {
      await enqueueJob('provisioning', {
        type: job.type,
        payload: {
          jobId: job.id,
          orderId: result.orderId,
          subscriptionId: result.subscriptionId,
        },
      });

      logger.info('Job enqueued to Redis', {
        jobId: job.id,
        jobType: job.type,
        queue: 'provisioning',
      });
    }

    logger.info('Order creation completed successfully', {
      orderId: result.orderId,
      subscriptionId: result.subscriptionId,
      jobsEnqueued: result.jobs.length,
    });

    return result;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string, tenantId: string): Promise<OrderWithRelations | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        price: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    return order as OrderWithRelations | null;
  }

  /**
   * Get all orders for tenant
   */
  async getOrdersByTenant(tenantId: string): Promise<OrderWithRelations[]> {
    const orders = await prisma.order.findMany({
      where: {
        tenantId,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        price: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
        subscription: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return orders as OrderWithRelations[];
  }
}

export default new OrdersService();
