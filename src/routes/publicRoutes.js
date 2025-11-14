import express from 'express';
import { listPublicPlans, startPublicCheckout } from '../controllers/publicController.js';

const router = express.Router();

router.get('/plans', listPublicPlans);
router.post('/checkout', startPublicCheckout);

export default router;
