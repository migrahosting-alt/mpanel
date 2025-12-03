/**
 * BILLING SUBSCRIPTIONS Controller
 */

import type { Request, Response, NextFunction } from 'express';
import * as billingSubscriptionsService from './billing-subscriptions.service.js';
import type {
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  CancelSubscriptionRequest,
  RecordUsageRequest,
} from './billing-subscriptions.types.js';

export async function handleListSubscriptions(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = {
      status: req.query.status as any,
      tenantId: req.query.tenantId as string,
      productId: req.query.productId as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 50,
    };

    const result = await billingSubscriptionsService.listSubscriptions(filters);
    return res.json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleGetSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const subscription = await billingSubscriptionsService.getSubscriptionById(id);
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    return res.json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCreateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const data: CreateSubscriptionRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const result = await billingSubscriptionsService.createSubscription(data, actorId);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleUpdateSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: UpdateSubscriptionRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const subscription = await billingSubscriptionsService.updateSubscription(id, data, actorId);
    return res.json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleCancelSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: CancelSubscriptionRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const subscription = await billingSubscriptionsService.cancelSubscription(id, data, actorId);
    return res.json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleSuspendSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const subscription = await billingSubscriptionsService.suspendSubscription(id, actorId);
    return res.json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleResumeSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id || 'system';
    
    const subscription = await billingSubscriptionsService.resumeSubscription(id, actorId);
    return res.json(subscription);
  } catch (error) {
    return next(error);
    next(error);
  }
}

export async function handleRecordUsage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const data: RecordUsageRequest = req.body;
    const actorId = (req as any).user?.id || 'system';
    
    const record = await billingSubscriptionsService.recordUsage(id, data, actorId);
    return res.json(record);
  } catch (error) {
    return next(error);
    next(error);
  }
}
