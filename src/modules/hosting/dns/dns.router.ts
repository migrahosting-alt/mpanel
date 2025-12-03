/**
 * MODULE_DNS Router
 * Routes: /api/hosting/dns
 */

import { Router } from 'express';
import * as dnsController from './dns.controller.js';

const router = Router();

router.get('/zones', dnsController.handleListZones);
router.post('/zones', dnsController.handleCreateZone);
router.get('/zones/:id/records', dnsController.handleGetZoneRecords);
router.post('/zones/:id/records', dnsController.handleCreateRecord);

export default router;
