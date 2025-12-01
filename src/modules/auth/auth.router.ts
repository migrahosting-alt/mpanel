import { Router } from 'express';
import authController from './auth.controller.js';
import { authMiddleware } from './auth.middleware.js';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get JWT tokens
 * @access  Public
 */
router.post('/login', authController.login.bind(authController));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', authController.refresh.bind(authController));

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authMiddleware, authController.me.bind(authController));

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authMiddleware, authController.logout.bind(authController));

export default router;
