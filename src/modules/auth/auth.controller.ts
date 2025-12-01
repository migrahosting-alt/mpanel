import { Request, Response, NextFunction } from 'express';
import authService from './auth.service.js';
import type { LoginRequest, RefreshRequest, AuthenticatedRequest } from './auth.types.js';
import logger from '../../config/logger.js';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user and return JWT tokens
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;
      
      if (!loginData.email || !loginData.password) {
        res.status(400).json({ 
          error: 'Validation error',
          message: 'Email and password are required' 
        });
        return;
      }
      
      const result = await authService.login(loginData);
      
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('credentials')) {
        res.status(401).json({ 
          error: 'Authentication failed',
          message: error.message 
        });
        return;
      }
      
      if (error instanceof Error && error.message.includes('inactive')) {
        res.status(403).json({ 
          error: 'Account inactive',
          message: error.message 
        });
        return;
      }
      
      logger.error('Login error', { error: error instanceof Error ? error.message : 'Unknown' });
      next(error);
    }
  }
  
  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshData: RefreshRequest = req.body;
      
      if (!refreshData.refreshToken) {
        res.status(400).json({ 
          error: 'Validation error',
          message: 'Refresh token is required' 
        });
        return;
      }
      
      const result = await authService.refresh(refreshData);
      
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('refresh token')) {
        res.status(401).json({ 
          error: 'Token refresh failed',
          message: error.message 
        });
        return;
      }
      
      logger.error('Token refresh error', { error: error instanceof Error ? error.message : 'Unknown' });
      next(error);
    }
  }
  
  /**
   * GET /api/auth/me
   * Get current authenticated user info
   */
  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication required' 
        });
        return;
      }
      
      const user = await authService.me(req.user.userId);
      
      res.json({ user });
    } catch (error) {
      logger.error('Get user error', { error: error instanceof Error ? error.message : 'Unknown' });
      next(error);
    }
  }
  
  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal, optionally blacklist token)
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    // In a stateless JWT system, logout is typically handled client-side
    // For enhanced security, you could implement token blacklisting here using Redis
    
    logger.info('User logged out', { userId: req.user?.userId });
    
    res.json({ 
      message: 'Logged out successfully' 
    });
  }
}

export default new AuthController();
