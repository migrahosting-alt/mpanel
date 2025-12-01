/**
 * Auth Router - Enterprise-grade Authentication Routes
 * 
 * Routes:
 * - POST /login         - User authentication (public)
 * - POST /logout        - User logout, audit event (private)
 * - POST /refresh       - Token refresh (public)
 * - GET /me             - Current user profile + tenants (private)
 * - GET /me/tenants     - List user's tenant memberships (private)
 * - POST /me/switch-tenant - Switch active tenant (private)
 */

import { Router } from 'express';
import authController from './auth.controller.js';
import { authMiddleware } from './auth.middleware.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get JWT tokens
 * @access  Public
 * @body    { email: string, password: string }
 * @returns { accessToken, refreshToken, tokenType, expiresIn, user, tenants, activeTenant }
 */
router.post('/login', authController.login.bind(authController));

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    { refreshToken: string }
 * @returns { accessToken, refreshToken, tokenType, expiresIn }
 */
router.post('/refresh', authController.refresh.bind(authController));

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (audit event only, JWT is stateless)
 * @access  Private
 * @returns { message: "Logged out successfully" }
 */
router.post('/logout', authMiddleware, authController.logout.bind(authController));

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user info with tenant memberships
 * @access  Private
 * @returns { user, tenants, activeTenant }
 */
router.get('/me', authMiddleware, authController.me.bind(authController));

/**
 * @route   GET /api/auth/me/tenants
 * @desc    List user's tenant memberships
 * @access  Private
 * @returns { tenants: TenantMembership[] }
 */
router.get('/me/tenants', authMiddleware, authController.listTenants.bind(authController));

/**
 * @route   POST /api/auth/me/switch-tenant
 * @desc    Switch active tenant context (issues new JWT)
 * @access  Private
 * @body    { tenantId: string }
 * @returns { accessToken, refreshToken, tokenType, expiresIn, activeTenant }
 */
router.post('/me/switch-tenant', authMiddleware, authController.switchTenant.bind(authController));

// ============================================
// EXPORT
// ============================================

export default router;
