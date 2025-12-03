/**
 * ENTERPRISE API MARKETPLACE Router
 * Routes: /api/enterprise/api-marketplace
 */

import { Router } from 'express';
import * as apiMarketplaceController from './api-marketplace.controller.js';

const router = Router();

router.get('/listings', apiMarketplaceController.handleListApiListings);
router.get('/listings/:id', apiMarketplaceController.handleGetApiListing);
router.get('/subscriptions', apiMarketplaceController.handleListSubscriptions);
router.post('/subscriptions', apiMarketplaceController.handleSubscribeToApi);
router.delete('/subscriptions/:id', apiMarketplaceController.handleCancelSubscription);

export default router;
