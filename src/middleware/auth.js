import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize decoded payload so downstream code can safely access either casing
    const normalizedUser = {
      ...decoded,
      id: decoded.id ?? decoded.userId ?? decoded.user_id,
      userId: decoded.userId ?? decoded.id ?? decoded.user_id,
      user_id: decoded.user_id ?? decoded.userId ?? decoded.id,
      tenantId: decoded.tenantId ?? decoded.tenant_id,
      tenant_id: decoded.tenant_id ?? decoded.tenantId,
    };

    req.user = normalizedUser;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Alias for authenticateToken
export const authenticate = authenticateToken;
export const requireAuth = authenticateToken;

// Convenience middleware for admin-only routes
export const requireAdmin = requireRole('admin');
