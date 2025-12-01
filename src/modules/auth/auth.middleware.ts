import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, extractTokenFromHeader, hasPermission } from '../../config/auth.js';
import type { AuthenticatedRequest } from './auth.types.js';
import logger from '../../config/logger.js';
import { UserRole } from '@prisma/client';

/**
 * Middleware to verify JWT token and attach user to request
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No token provided' 
      });
      return;
    }
    
    const payload = verifyAccessToken(token);
    
    // Attach user to request
    (req as AuthenticatedRequest).user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as UserRole,
      tenantId: payload.tenantId,
    };
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        res.status(401).json({ 
          error: 'Token expired',
          message: 'Please refresh your token' 
        });
        return;
      }
      
      if (error.message.includes('Invalid')) {
        res.status(401).json({ 
          error: 'Invalid token',
          message: 'Authentication failed' 
        });
        return;
      }
    }
    
    logger.error('Auth middleware error', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Authentication check failed' 
    });
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(requiredRole: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authenticatedReq = req as AuthenticatedRequest;
    
    if (!authenticatedReq.user) {
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
      return;
    }
    
    if (!hasPermission(authenticatedReq.user.role, requiredRole)) {
      res.status(403).json({ 
        error: 'Forbidden',
        message: 'Insufficient permissions' 
      });
      return;
    }
    
    next();
  };
}

/**
 * Optional auth middleware - attaches user if token is valid, but doesn't fail if missing
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (token) {
      const payload = verifyAccessToken(token);
      
      (req as AuthenticatedRequest).user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role as UserRole,
        tenantId: payload.tenantId,
      };
    }
  } catch (error) {
    // Silently ignore auth errors for optional auth
    logger.debug('Optional auth failed', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
  
  next();
}
