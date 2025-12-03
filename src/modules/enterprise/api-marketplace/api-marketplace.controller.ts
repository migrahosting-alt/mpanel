/**
 * ENTERPRISE API MARKETPLACE Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as apiMarketplaceService from './api-marketplace.service.js';
import type { SubscribeToApiRequest } from './api-marketplace.types.js';

export async function handleListApiListings(req: Request, res: Response, next: NextFunction) {
  try {
    const listings = await apiMarketplaceService.listApiListings();
    return res.json(listings);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetApiListing(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const listing = await apiMarketplaceService.getApiListingById(id);
    if (!listing) return res.status(404).json({ error: 'API listing not found' });
    return res.json(listing);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleListSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const actorTenantId = (req as any).tenantId;
    const subscriptions = await apiMarketplaceService.listSubscriptions(actorTenantId);
    return res.json(subscriptions);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleSubscribeToApi(req: Request, res: Response, next: NextFunction) {
  try {
    const data: SubscribeToApiRequest = req.body;
    const actorTenantId = (req as any).tenantId;
    const actorId = (req as any).user?.id;
    const subscription = await apiMarketplaceService.subscribeToApi(data, actorTenantId, actorId);
    return res.status(201).json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorTenantId = (req as any).tenantId;
    await apiMarketplaceService.cancelSubscription(id, actorTenantId);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
    next(error);
  }
}
