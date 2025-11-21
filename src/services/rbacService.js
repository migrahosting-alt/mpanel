import pool from '../db/index.js';
import logger from '../config/logger.js';

/**
 * RBAC Service - Role-Based Access Control
 * Handles roles, permissions, and authorization checks
 */

class RBACService {
  /**
   * Get user's role with permissions
   */
  async getUserRole(userId) {
    try {
      const result = await pool.query(`
        SELECT 
          r.id as role_id,
          r.name as role_name,
          r.display_name,
          r.level,
          r.is_admin,
          r.is_client,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'resource', p.resource,
                'action', p.action
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'
          ) as permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = $1
        GROUP BY r.id, r.name, r.display_name, r.level, r.is_admin, r.is_client
      `, [userId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting user role:', error);
      throw error;
    }
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(userId, permissionName) {
    try {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM users u
          JOIN roles r ON u.role = r.name
          JOIN role_permissions rp ON r.id = rp.role_id
          JOIN permissions p ON rp.permission_id = p.id
          WHERE u.id = $1 AND p.name = $2
        ) as has_permission
      `, [userId, permissionName]);

      return result.rows[0].has_permission;
    } catch (error) {
      logger.error('Error checking permission:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for resource and action
   */
  async hasResourcePermission(userId, resource, action) {
    const permissionName = `${resource}.${action}`;
    return this.hasPermission(userId, permissionName);
  }

  /**
   * Get all roles
   */
  async getAllRoles() {
    try {
      const result = await pool.query(`
        SELECT 
          r.*,
          COUNT(rp.permission_id) as permission_count,
          COUNT(u.id) as user_count
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN users u ON r.name = u.role
        GROUP BY r.id
        ORDER BY r.level ASC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error getting all roles:', error);
      throw error;
    }
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(roleId) {
    try {
      const result = await pool.query(`
        SELECT 
          r.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', p.id,
                'name', p.name,
                'resource', p.resource,
                'action', p.action,
                'description', p.description
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'
          ) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.id = $1
        GROUP BY r.id
      `, [roleId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting role by ID:', error);
      throw error;
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions() {
    try {
      const result = await pool.query(`
        SELECT * FROM permissions 
        ORDER BY resource, action
      `);

      return result.rows;
    } catch (error) {
      logger.error('Error getting all permissions:', error);
      throw error;
    }
  }

  /**
   * Create new role
   */
  async createRole(roleData) {
    const { name, display_name, description, level, is_admin, is_client } = roleData;

    try {
      const result = await pool.query(`
        INSERT INTO roles (name, display_name, description, level, is_admin, is_client)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [name, display_name, description, level, is_admin || false, is_client || false]);

      logger.info(`Role created: ${name}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId, roleData) {
    const { display_name, description, level } = roleData;

    try {
      const result = await pool.query(`
        UPDATE roles 
        SET 
          display_name = COALESCE($2, display_name),
          description = COALESCE($3, description),
          level = COALESCE($4, level),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [roleId, display_name, description, level]);

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Role updated: ${roleId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Delete role
   */
  async deleteRole(roleId) {
    try {
      // Check if role is in use
      const usageCheck = await pool.query(
        'SELECT COUNT(*) as count FROM users WHERE role_id = $1',
        [roleId]
      );

      if (parseInt(usageCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      await pool.query('DELETE FROM roles WHERE id = $1', [roleId]);
      logger.info(`Role deleted: ${roleId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting role:', error);
      throw error;
    }
  }

  /**
   * Assign permissions to role
   */
  async assignPermissions(roleId, permissionIds) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Remove existing permissions
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      // Add new permissions
      for (const permissionId of permissionIds) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permissionId]
        );
      }

      await client.query('COMMIT');
      logger.info(`Permissions assigned to role: ${roleId}`);
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error assigning permissions:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId, roleId) {
    try {
      const result = await pool.query(
        'UPDATE users SET role_id = $1 WHERE id = $2 RETURNING *',
        [roleId, userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      logger.info(`Role ${roleId} assigned to user ${userId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(roleId) {
    try {
      const result = await pool.query(`
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.created_at
        FROM users u
        WHERE u.role_id = $1
        ORDER BY u.created_at DESC
      `, [roleId]);

      return result.rows;
    } catch (error) {
      logger.error('Error getting users by role:', error);
      throw error;
    }
  }

  /**
   * Check if user can manage another user (based on role hierarchy)
   */
  async canManageUser(managerId, targetUserId) {
    try {
      const result = await pool.query(`
        SELECT 
          (SELECT r.level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1) as manager_level,
          (SELECT r.level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $2) as target_level
      `, [managerId, targetUserId]);

      if (result.rows.length === 0) {
        return false;
      }

      const { manager_level, target_level } = result.rows[0];
      
      // Lower level number = higher privilege
      // Manager can only manage users with higher level number (lower privilege)
      return manager_level < target_level;
    } catch (error) {
      logger.error('Error checking user management permission:', error);
      throw error;
    }
  }
}

export default new RBACService();
