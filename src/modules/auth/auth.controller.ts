/**
 * Auth Controller - Enterprise-grade Authentication Endpoints
 * 
 * Handles:
 * - POST /login - User authentication
 * - POST /logout - User logout (audit only, JWT is stateless)
 * - POST /refresh - Token refresh
 * - GET /me - Current user info
 * - GET /me/tenants - List user's tenants
 * - POST /me/switch-tenant - Switch active tenant
 */

import type { Request, Response, NextFunction } from 'express';
import authService from './auth.service.js';
import type {
  LoginRequest,
  RefreshRequest,
  SwitchTenantRequest,
  AuthenticatedRequest,
} from './auth.types.js';
import logger from '../../config/logger.js';

// ============================================
// HELPER: GET CLIENT IP
// ============================================

function getClientIp(req: Request): string | undefined {
  // Check X-Forwarded-For header (for proxied requests)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',');
    return ips[0]?.trim();
  }

  // Fallback to socket address
  return req.socket.remoteAddress;
}

// ============================================
// CONTROLLER CLASS
// ============================================

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and return JWT tokens.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;

      // Validate required fields
      if (!loginData.email || !loginData.password) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Email and password are required',
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(loginData.email)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid email format',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const result = await authService.login(loginData, ipAddress);

      res.json(result);
    } catch (error) {
      // Handle specific error cases with appropriate status codes
      if (error instanceof Error) {
        // Invalid credentials - generic 401
        if (error.message.includes('credentials') || error.message.includes('Invalid')) {
          res.status(401).json({
            error: 'Authentication failed',
            message: 'Invalid email or password',
          });
          return;
        }

        // No tenant membership
        if (error.message.includes('tenant')) {
          res.status(403).json({
            error: 'Access denied',
            message: 'No active tenant membership found',
          });
          return;
        }
      }

      logger.error('Login error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user (audit event only, JWT is stateless).
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      await authService.logout(req.user.userId, req.user.tenantId, ipAddress);

      res.json({
        message: 'Logged out successfully',
      });
    } catch (error) {
      logger.error('Logout error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });

      // Don't fail the logout even if audit fails
      res.json({
        message: 'Logged out successfully',
      });
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token.
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshData: RefreshRequest = req.body;

      if (!refreshData.refreshToken) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Refresh token is required',
        });
        return;
      }

      const result = await authService.refresh(refreshData);

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes('expired') ||
          error.message.includes('Invalid') ||
          error.message.includes('token')
        ) {
          res.status(401).json({
            error: 'Token refresh failed',
            message: 'Invalid or expired refresh token',
          });
          return;
        }

        if (error.message.includes('inactive') || error.message.includes('not found')) {
          res.status(403).json({
            error: 'Access denied',
            message: 'User account is inactive or not found',
          });
          return;
        }
      }

      logger.error('Token refresh error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   * Get current authenticated user info with tenant memberships.
   */
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const result = await authService.me(req.user.userId, req.user.tenantId);

      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
        return;
      }

      logger.error('Get user error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * GET /api/auth/me/tenants
   * List user's tenant memberships.
   */
  async listTenants(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const tenants = await authService.listTenants(req.user.userId);

      res.json({ tenants });
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          error: 'Not found',
          message: 'User not found',
        });
        return;
      }

      logger.error('List tenants error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }

  /**
   * POST /api/auth/me/switch-tenant
   * Switch to a different tenant (issues new JWT).
   */
  async switchTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const switchData: SwitchTenantRequest = req.body;

      if (!switchData.tenantId) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Target tenant ID is required',
        });
        return;
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(switchData.tenantId)) {
        res.status(400).json({
          error: 'Validation error',
          message: 'Invalid tenant ID format',
        });
        return;
      }

      const ipAddress = getClientIp(req);
      const result = await authService.switchTenant(req.user.userId, switchData, ipAddress);

      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            error: 'Not found',
            message: 'User not found',
          });
          return;
        }

        if (error.message.includes('Access denied') || error.message.includes('not a member')) {
          res.status(403).json({
            error: 'Access denied',
            message: 'You are not a member of the target tenant',
          });
          return;
        }
      }

      logger.error('Switch tenant error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next(error);
    }
  }
}

// ============================================
// EXPORT
// ============================================

export default new AuthController();
