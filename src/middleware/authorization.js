import rbacService from '../services/rbacService.js';
import logger from '../config/logger.js';

/**
 * Authorization Middleware - RBAC Permission Checks
 */

/**
 * Check if user has specific permission
 * Usage: requirePermission('servers.create')
 */
export const requirePermission = (permissionName) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await rbacService.hasPermission(userId, permissionName);

      if (!hasPermission) {
        logger.warn(`User ${userId} denied access: missing permission ${permissionName}`);
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `You don't have permission to ${permissionName}`
        });
      }

      next();
    } catch (error) {
      logger.error('Error in requirePermission middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Check if user has permission for resource and action
 * Usage: requireResourcePermission('servers', 'create')
 */
export const requireResourcePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const hasPermission = await rbacService.hasResourcePermission(userId, resource, action);

      if (!hasPermission) {
        logger.warn(`User ${userId} denied access: missing permission ${resource}.${action}`);
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `You don't have permission to ${action} ${resource}`
        });
      }

      next();
    } catch (error) {
      logger.error('Error in requireResourcePermission middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Check if user has ANY of the specified permissions
 * Usage: requireAnyPermission(['servers.create', 'servers.update'])
 */
export const requireAnyPermission = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      for (const permissionName of permissionNames) {
        const hasPermission = await rbacService.hasPermission(userId, permissionName);
        if (hasPermission) {
          return next();
        }
      }

      logger.warn(`User ${userId} denied access: missing any of ${permissionNames.join(', ')}`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'You don\'t have the required permissions'
      });
    } catch (error) {
      logger.error('Error in requireAnyPermission middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Check if user has ALL of the specified permissions
 * Usage: requireAllPermissions(['servers.read', 'deployments.database'])
 */
export const requireAllPermissions = (permissionNames) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      for (const permissionName of permissionNames) {
        const hasPermission = await rbacService.hasPermission(userId, permissionName);
        if (!hasPermission) {
          logger.warn(`User ${userId} denied access: missing permission ${permissionName}`);
          return res.status(403).json({ 
            error: 'Forbidden',
            message: `You don't have permission to ${permissionName}`
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Error in requireAllPermissions middleware:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Check if user has admin role
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = await rbacService.getUserRole(userId);

    if (!userRole || !userRole.is_admin) {
      logger.warn(`User ${userId} denied admin access`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }

    // Attach role info to request
    req.userRole = userRole;
    next();
  } catch (error) {
    logger.error('Error in requireAdmin middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Check if user is super admin
 */
export const requireSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = await rbacService.getUserRole(userId);

    if (!userRole || userRole.role_name !== 'super_admin') {
      logger.warn(`User ${userId} denied super admin access`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Super admin access required'
      });
    }

    req.userRole = userRole;
    next();
  } catch (error) {
    logger.error('Error in requireSuperAdmin middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Check if user is client (customer)
 */
export const requireClient = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = await rbacService.getUserRole(userId);

    if (!userRole || !userRole.is_client) {
      logger.warn(`User ${userId} denied client access`);
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Client access required'
      });
    }

    req.userRole = userRole;
    next();
  } catch (error) {
    logger.error('Error in requireClient middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Attach user's role and permissions to request
 * Does NOT block access - just adds info
 */
export const attachRoleInfo = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (userId) {
      const userRole = await rbacService.getUserRole(userId);
      req.userRole = userRole;
    }

    next();
  } catch (error) {
    logger.error('Error in attachRoleInfo middleware:', error);
    next(); // Continue even if there's an error
  }
};

export default {
  requirePermission,
  requireResourcePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireAdmin,
  requireSuperAdmin,
  requireClient,
  attachRoleInfo
};
