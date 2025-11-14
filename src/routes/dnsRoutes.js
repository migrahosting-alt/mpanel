import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createZone,
  getZones,
  getZone,
  getZoneRecords,
  createRecord,
  updateRecord,
  deleteRecord
} from '../controllers/dnsController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// DNS Zones
router.post('/zones', createZone);
router.get('/zones', getZones);
router.get('/zones/:id', getZone);

// DNS Records
router.get('/zones/:id/records', getZoneRecords);
router.post('/zones/:id/records', createRecord);
router.put('/records/:recordId', updateRecord);
router.delete('/records/:recordId', deleteRecord);

export default router;
