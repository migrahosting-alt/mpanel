import express from 'express';
import {
  registerAgent,
  submitMetrics,
  heartbeat,
  getAgents,
  getAgentMetrics,
} from '../controllers/agentController.js';

const router = express.Router();

// Agent endpoints (no auth required - uses API key in controller)
router.post('/register', registerAgent);
router.post('/metrics', submitMetrics);
router.post('/heartbeat', heartbeat);

// Admin endpoints (auth required)
// Note: Add authenticateToken middleware when integrating with main app
router.get('/', getAgents);
router.get('/:id/metrics', getAgentMetrics);

export default router;

