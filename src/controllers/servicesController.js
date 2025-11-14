// src/controllers/servicesController.js
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import emailService from '../services/email.js';
import { shouldSendEmail } from './emailPreferencesController.js';

/**
 * Get all services for a user (or all if admin)
 */
export const getServices = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { type } = req.query; // Optional filter by type

    let query = `
      SELECT 
        s.*,
        u.email as customer_email,
        u.first_name,
        u.last_name
      FROM services s
      LEFT JOIN users u ON s.user_id = u.id
    `;
    
    const conditions = [];
    const params = [];
    
    if (!isAdmin) {
      conditions.push(`s.user_id = $${params.length + 1}`);
      params.push(userId);
    }
    
    if (type) {
      conditions.push(`s.type = $${params.length + 1}`);
      params.push(type);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);
    
    res.json({ services: result.rows });
  } catch (error) {
    logger.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
};

/**
 * Get a single service by ID
 */
export const getService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = `
      SELECT 
        s.*,
        u.email as customer_email,
        u.first_name,
        u.last_name
      FROM services s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = result.rows[0];
    
    // Check ownership unless admin
    if (!isAdmin && service.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(service);
  } catch (error) {
    logger.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
};

/**
 * Create a new service
 */
export const createService = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    const {
      type,
      name,
      configuration,
      price,
      billing_cycle,
      auto_renew,
      assigned_user_id, // Admin can assign to any user
    } = req.body;

    // Validation
    if (!type || !name) {
      return res.status(400).json({ error: 'Type and name are required' });
    }

    const validTypes = ['domain', 'hosting', 'database', 'email'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid service type' });
    }

    // Determine which user to assign service to
    const targetUserId = isAdmin && assigned_user_id ? assigned_user_id : userId;

    // Type-specific validation and configuration
    let serviceConfig = configuration || {};
    
    if (type === 'domain') {
      serviceConfig = {
        domain: name,
        nameservers: serviceConfig.nameservers || ['ns1.migrahosting.com', 'ns2.migrahosting.com'],
        auto_renew_enabled: auto_renew !== false,
        ...serviceConfig,
      };
    } else if (type === 'hosting') {
      serviceConfig = {
        domain: name,
        disk_quota_gb: serviceConfig.disk_quota_gb || 10,
        bandwidth_quota_gb: serviceConfig.bandwidth_quota_gb || 100,
        ftp_enabled: serviceConfig.ftp_enabled !== false,
        ssh_enabled: serviceConfig.ssh_enabled || false,
        ...serviceConfig,
      };
    } else if (type === 'database') {
      serviceConfig = {
        database_name: name,
        database_type: serviceConfig.database_type || 'postgresql',
        max_connections: serviceConfig.max_connections || 20,
        storage_gb: serviceConfig.storage_gb || 5,
        ...serviceConfig,
      };
    } else if (type === 'email') {
      serviceConfig = {
        email_address: name,
        mailbox_quota_gb: serviceConfig.mailbox_quota_gb || 5,
        aliases: serviceConfig.aliases || [],
        ...serviceConfig,
      };
    }

    const query = `
      INSERT INTO services (
        user_id,
        type,
        name,
        status,
        configuration,
        price,
        billing_cycle,
        auto_renew,
        renewal_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + (billing_cycle === 'yearly' ? 12 : 1));

    const values = [
      targetUserId,
      type,
      name,
      'active',
      JSON.stringify(serviceConfig),
      price || 0,
      billing_cycle || 'monthly',
      auto_renew !== false,
      renewalDate,
    ];

    const result = await pool.query(query, values);
    const service = result.rows[0];
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [targetUserId, 'service_created', `Created ${type} service: ${name}`]
    );

    // Send service provisioned email
    try {
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [targetUserId]);
      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const shouldSend = await shouldSendEmail(user.id, 'service');
        
        if (shouldSend) {
          await emailService.sendServiceProvisionedEmail(user, service);
          logger.info(`Service provisioned email sent to ${user.email}`, { serviceId: service.id });
        }
      }
    } catch (emailError) {
      logger.error('Failed to send service provisioned email:', emailError);
    }

    logger.info(`Service created: ${type} - ${name} (user: ${targetUserId})`);
    
    res.status(201).json(service);
  } catch (error) {
    logger.error('Error creating service:', error);
    res.status(500).json({ error: 'Failed to create service' });
  }
};

/**
 * Update a service
 */
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    const {
      name,
      status,
      configuration,
      price,
      billing_cycle,
      auto_renew,
    } = req.body;

    // Check if service exists and user has access
    const checkQuery = `SELECT * FROM services WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = checkResult.rows[0];
    
    if (!isAdmin && service.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (configuration !== undefined) {
      updates.push(`configuration = $${paramIndex++}`);
      values.push(JSON.stringify({ ...service.configuration, ...configuration }));
    }
    if (price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(price);
    }
    if (billing_cycle !== undefined) {
      updates.push(`billing_cycle = $${paramIndex++}`);
      values.push(billing_cycle);
    }
    if (auto_renew !== undefined) {
      updates.push(`auto_renew = $${paramIndex++}`);
      values.push(auto_renew);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE services 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pool.query(query, values);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [service.user_id, 'service_updated', `Updated ${service.type} service: ${service.name}`]
    );

    logger.info(`Service updated: ${id}`);
    
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating service:', error);
    res.status(500).json({ error: 'Failed to update service' });
  }
};

/**
 * Delete a service
 */
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Check if service exists and user has access
    const checkQuery = `SELECT * FROM services WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    const service = checkResult.rows[0];
    
    if (!isAdmin && service.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const query = `DELETE FROM services WHERE id = $1`;
    await pool.query(query, [id]);
    
    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [service.user_id, 'service_deleted', `Deleted ${service.type} service: ${service.name}`]
    );

    logger.info(`Service deleted: ${id}`);
    
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    logger.error('Error deleting service:', error);
    res.status(500).json({ error: 'Failed to delete service' });
  }
};

/**
 * Get service statistics (admin only)
 */
export const getServiceStats = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const query = `
      SELECT 
        type,
        status,
        COUNT(*) as count,
        SUM(price) as total_revenue
      FROM services
      GROUP BY type, status
      ORDER BY type, status
    `;

    const result = await pool.query(query);
    
    res.json({ stats: result.rows });
  } catch (error) {
    logger.error('Error fetching service stats:', error);
    res.status(500).json({ error: 'Failed to fetch service statistics' });
  }
};
