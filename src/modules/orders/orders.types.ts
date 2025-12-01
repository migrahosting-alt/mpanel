import { OrderStatus, SubscriptionStatus, JobType } from '@prisma/client';

export interface CreateOrderRequest {
  tenantSlug: string;
  customer: {
    email: string;
    fullName?: string;
    phone?: string;
  };
  priceSlug: string;
  totalAmountCents: number;
  currency?: string;
  stripePaymentIntentId?: string;
  metadata?: {
    domain?: string;
    notes?: string;
    [key: string]: any;
  };
}

export interface OrderResponse {
  orderId: string;
  subscriptionId: string;
  customerId: string;
  jobs: JobInfo[];
}

export interface JobInfo {
  id: string;
  type: JobType;
  status: string;
}

export interface OrderWithRelations {
  id: string;
  status: OrderStatus;
  totalAmountCents: number;
  currency: string;
  createdAt: Date;
  customer: {
    id: string;
    email: string;
    fullName: string | null;
  };
  price: {
    id: string;
    name: string;
    slug: string;
    interval: string;
    amountCents: number;
    product: {
      id: string;
      name: string;
      type: string;
    };
  };
  subscription?: {
    id: string;
    status: SubscriptionStatus;
  };
}
