/**
 * ENTERPRISE WEBSOCKET Router
 * Routes: /api/enterprise/websocket
 */

import { Router } from 'express';
import * as websocketController from './websocket.controller.js';

const router = Router();

router.post('/broadcast', websocketController.handleBroadcast);

export default router;
