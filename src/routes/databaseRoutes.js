import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  createDatabase,
  getDatabases,
  getDatabase,
  rotatePassword,
  updateSize,
  deleteDatabase
} from '../controllers/databaseController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

router.post('/', createDatabase);
router.get('/', getDatabases);
router.get('/:id', getDatabase);
router.post('/:id/rotate-password', rotatePassword);
router.put('/:id/size', updateSize);
router.delete('/:id', deleteDatabase);

export default router;
