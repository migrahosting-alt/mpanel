import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  addTLD,
  getTLDs
} from '../controllers/productController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', requireRole('admin', 'manager'), createProduct);
router.get('/', getProducts);
router.get('/:id', getProduct);
router.put('/:id', requireRole('admin', 'manager'), updateProduct);
router.delete('/:id', requireRole('admin'), deleteProduct);

// TLD management
router.post('/:id/tlds', requireRole('admin', 'manager'), addTLD);
router.get('/:id/tlds', getTLDs);

export default router;
