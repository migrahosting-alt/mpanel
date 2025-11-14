import rbacService from '../services/rbacService.js';
import logger from '../config/logger.js';

/**
 * Role Management Controller
 * Handles role and permission management (super admin only)
 */

/**
 * Get all roles
 * GET /api/roles
 */
export const getAllRoles = async (req, res) => {
  try {
    const roles = await rbacService.getAllRoles();
    res.json(roles);
  } catch (error) {
    logger.error('Get all roles error:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
};

/**
 * Get role by ID
 * GET /api/roles/:id
 */
export const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await rbacService.getRoleById(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(role);
  } catch (error) {
    logger.error('Get role error:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
};

/**
 * Get all permissions
 * GET /api/roles/permissions/all
 */
export const getAllPermissions = async (req, res) => {
  try {
    const permissions = await rbacService.getAllPermissions();
    
    // Group permissions by resource
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {});

    res.json({ permissions, grouped });
  } catch (error) {
    logger.error('Get permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
};

/**
 * Create role
 * POST /api/roles
 */
export const createRole = async (req, res) => {
  try {
    const { name, display_name, description, level, is_admin, is_client } = req.body;

    if (!name || !display_name || level === undefined) {
      return res.status(400).json({ error: 'Name, display_name, and level are required' });
    }

    const role = await rbacService.createRole({
      name,
      display_name,
      description,
      level,
      is_admin,
      is_client
    });

    res.status(201).json(role);
  } catch (error) {
    logger.error('Create role error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Role with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create role' });
  }
};

/**
 * Update role
 * PUT /api/roles/:id
 */
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description, level } = req.body;

    const role = await rbacService.updateRole(id, {
      display_name,
      description,
      level
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json(role);
  } catch (error) {
    logger.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

/**
 * Delete role
 * DELETE /api/roles/:id
 */
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await rbacService.deleteRole(id);
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    logger.error('Delete role error:', error);
    if (error.message.includes('assigned to users')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete role' });
  }
};

/**
 * Assign permissions to role
 * PUT /api/roles/:id/permissions
 */
export const assignPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permission_ids } = req.body;

    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }

    await rbacService.assignPermissions(id, permission_ids);
    
    // Return updated role
    const role = await rbacService.getRoleById(id);
    res.json(role);
  } catch (error) {
    logger.error('Assign permissions error:', error);
    res.status(500).json({ error: 'Failed to assign permissions' });
  }
};

/**
 * Assign role to user
 * PUT /api/roles/:id/assign
 */
export const assignRoleToUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    // Check if current user can manage target user
    const canManage = await rbacService.canManageUser(req.user.id, user_id);
    
    if (!canManage) {
      return res.status(403).json({ 
        error: 'You cannot assign roles to users with equal or higher privileges'
      });
    }

    const user = await rbacService.assignRoleToUser(user_id, id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Assign role to user error:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
};

/**
 * Get users by role
 * GET /api/roles/:id/users
 */
export const getUsersByRole = async (req, res) => {
  try {
    const { id } = req.params;
    const users = await rbacService.getUsersByRole(id);
    res.json(users);
  } catch (error) {
    logger.error('Get users by role error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export default {
  getAllRoles,
  getRoleById,
  getAllPermissions,
  createRole,
  updateRole,
  deleteRole,
  assignPermissions,
  assignRoleToUser,
  getUsersByRole
};
