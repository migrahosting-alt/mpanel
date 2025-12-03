/**
 * ENTERPRISE API MARKETPLACE Service
 * Subscription management for APIs
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import crypto from 'crypto';
import type {
  ApiListing,
  ApiSubscription,
  SubscribeToApiRequest,
} from './api-marketplace.types.js';

export async function listApiListings(): Promise<ApiListing[]> {
  try {
    // @ts-ignore
    const listings = await prisma.apiListing.findMany({
      orderBy: { name: 'asc' },
    });
    return listings;
  } catch {
    return [];
  }
}

export async function getApiListingById(id: string): Promise<ApiListing | null> {
  try {
    // @ts-ignore
    const listing = await prisma.apiListing.findFirst({
      where: { id },
    });
    return listing;
  } catch {
    return null;
  }
}

export async function listSubscriptions(actorTenantId: string): Promise<ApiSubscription[]> {
  try {
    // @ts-ignore
    const subscriptions = await prisma.apiSubscription.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
    });
    return subscriptions;
  } catch {
    return [];
  }
}

export async function subscribeToApi(
  data: SubscribeToApiRequest,
  actorTenantId: string,
  actorId: string
): Promise<ApiSubscription> {
  const { listingId } = data;

  // Verify listing exists
  const listing = await getApiListingById(listingId);
  if (!listing) {
    throw new Error('API listing not found');
  }

  // Check for existing subscription
  // @ts-ignore
  const existing = await prisma.apiSubscription.findFirst({
    where: { tenantId: actorTenantId, listingId },
  });

  if (existing) {
    throw new Error('Already subscribed to this API');
  }

  // Generate API key for subscription
  const apiKey = listing.type === 'EXTERNAL'
    ? `ext_${crypto.randomBytes(16).toString('hex')}`
    : null;

  // @ts-ignore
  const subscription = await prisma.apiSubscription.create({
    data: {
      tenantId: actorTenantId,
      listingId,
      status: 'ACTIVE',
      apiKey,
      usageThisMonth: 0,
      createdBy: actorId,
    },
  });

  logger.info('API subscription created', { subscriptionId: subscription.id, listingId });

  return subscription;
}

export async function cancelSubscription(
  id: string,
  actorTenantId: string
): Promise<void> {
  // @ts-ignore
  await prisma.apiSubscription.updateMany({
    where: { id, tenantId: actorTenantId },
    data: { status: 'CANCELLED' },
  });

  logger.info('API subscription cancelled', { subscriptionId: id });
}
