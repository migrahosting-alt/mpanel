// src/routes/dnsZoneRoutes.js
import express from 'express';
import * as dnsZoneController from '../controllers/dnsZoneController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Zone routes
router.get('/', dnsZoneController.getZones);
router.get('/:id', dnsZoneController.getZone);
router.post('/', dnsZoneController.createZone);
router.put('/:id', dnsZoneController.updateZone);
router.delete('/:id', dnsZoneController.deleteZone);

// Record routes
router.get('/:zoneId/records', dnsZoneController.getRecords);
router.post('/:zoneId/records', dnsZoneController.createRecord);
router.post('/:zoneId/records/bulk', dnsZoneController.bulkCreateRecords);
router.put('/:zoneId/records/:recordId', dnsZoneController.updateRecord);
router.delete('/:zoneId/records/:recordId', dnsZoneController.deleteRecord);

export default router;
