/**
 * Customers Service - Platform-level tenant/revenue view
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import { writeAuditEvent } from '../security/auditService.js';

export interface CustomerSummary {
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  primaryContactEmail: string | null;
  healthScore: number;
  subscriptionsCount: number;
  totalRevenueCents: number;
  mrrCents: number;
  createdAt: Date;
}

export interface CustomerOverview {
  tenant: any;
  subscriptions: any[];
  orders: any[];
  cloudPods: any[];
  metrics: {
    totalRevenueCents: number;
    mrrCents: number;
    healthScore: number;
    lastActivityAt: Date | null;
  };
}

/**
 * List all customers (platform-wide)
 */
export async function listCustomers(options: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
} = {}): Promise<{ customers: CustomerSummary[]; total: number }> {
  const { page = 1, pageSize = 50, search, status } = options;
  const skip = (page - 1) * pageSize;

  const where: any = {
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { billingEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        subscriptions: {
          where: { deletedAt: null },
        },
        orders: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.tenant.count({ where }),
  ]);

  const customers: CustomerSummary[] = await Promise.all(
    tenants.map(async (tenant) => {
      const subscriptionsCount = tenant.subscriptions.length;
      
      // Calculate total revenue from orders
      const totalRevenueCents = tenant.orders.reduce(
        (sum, order) => sum + order.totalAmountCents,
        0
      );

      // Calculate MRR from active subscriptions
      const activeSubscriptions = tenant.subscriptions.filter(
        (s) => s.status === 'active'
      );
      const mrrCents = activeSubscriptions.reduce((sum, sub) => {
        const price = sub.price ? Number(sub.price) * 100 : 0;
        return sum + price;
      }, 0);

      // Simple health score (0-100)
      const healthScore = calculateHealthScore({
        hasActiveSubscriptions: activeSubscriptions.length > 0,
        orderCount: tenant.orders.length,
        tenantAge: Date.now() - tenant.createdAt.getTime(),
      });

      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        primaryContactEmail: tenant.billingEmail,
        healthScore,
        subscriptionsCount,
        totalRevenueCents,
        mrrCents,
        createdAt: tenant.createdAt,
      };
    })
  );

  return { customers, total };
}

/**
 * Get customer overview (platform-wide)
 */
export async function getCustomerOverview(
  tenantId: string
): Promise<CustomerOverview | null> {
  const tenant = await prisma.tenant.findFirst({
    where: {
      id: tenantId,
      deletedAt: null,
    },
    include: {
      subscriptions: {
        where: { deletedAt: null },
        include: {
          price_rel: {
            include: {
              product: true,
            },
          },
        },
      },
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      cloudPods: {
        where: { deletedAt: null },
      },
    },
  });

  if (!tenant) {
    return null;
  }

  // Calculate metrics
  const totalRevenueCents = tenant.orders.reduce(
    (sum, order) => sum + order.totalAmountCents,
    0
  );

  const activeSubscriptions = tenant.subscriptions.filter(
    (s) => s.status === 'active'
  );
  const mrrCents = activeSubscriptions.reduce((sum, sub) => {
    const price = sub.price ? Number(sub.price) * 100 : 0;
    return sum + price;
  }, 0);

  const healthScore = calculateHealthScore({
    hasActiveSubscriptions: activeSubscriptions.length > 0,
    orderCount: tenant.orders.length,
    tenantAge: Date.now() - tenant.createdAt.getTime(),
  });

  // Last activity = most recent order or subscription update
  const lastActivityAt =
    tenant.orders.length > 0
      ? tenant.orders[0].createdAt
      : tenant.subscriptions.length > 0
      ? tenant.subscriptions[0].updatedAt
      : null;

  return {
    tenant,
    subscriptions: tenant.subscriptions,
    orders: tenant.orders,
    cloudPods: tenant.cloudPods,
    metrics: {
      totalRevenueCents,
      mrrCents,
      healthScore,
      lastActivityAt,
    },
  };
}

/**
 * Calculate health score (0-100)
 */
function calculateHealthScore(params: {
  hasActiveSubscriptions: boolean;
  orderCount: number;
  tenantAge: number;
}): number {
  let score = 50; // Base score

  // Has active subscriptions: +30
  if (params.hasActiveSubscriptions) {
    score += 30;
  }

  // Order count: up to +20
  if (params.orderCount > 0) {
    score += Math.min(20, params.orderCount * 2);
  }

  // Tenant age (older = more established): up to +10
  const daysOld = params.tenantAge / (1000 * 60 * 60 * 24);
  if (daysOld > 30) {
    score += 10;
  } else if (daysOld > 7) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

export default {
  listCustomers,
  getCustomerOverview,
};
