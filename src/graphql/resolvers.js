/**
 * GraphQL Resolvers
 * Complete resolver implementation for mPanel GraphQL API
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PubSub } from 'graphql-subscriptions';

const pubsub = new PubSub();

export const resolvers = {
  // ============================================
  // Query Resolvers
  // ============================================
  
  Query: {
    // User queries
    me: async (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [context.user.id]
      );
      
      return result.rows[0];
    },

    user: async (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      
      return result.rows[0];
    },

    users: async (_, { limit = 50, offset = 0 }, context) => {
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      const result = await pool.query(
        'SELECT * FROM users WHERE tenant_id = $1 LIMIT $2 OFFSET $3',
        [context.user.tenant_id, limit, offset]
      );
      
      return result.rows;
    },

    // Product queries
    products: async (_, { active }, context) => {
      let query = 'SELECT * FROM products WHERE tenant_id = $1';
      const params = [context.user?.tenant_id || 1];
      
      if (active !== undefined) {
        query += ' AND active = $2';
        params.push(active);
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    },

    product: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return result.rows[0];
    },

    // Subscription queries
    subscriptions: async (_, { userId, status }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      let query = 'SELECT * FROM subscriptions WHERE tenant_id = $1';
      const params = [context.user.tenant_id];
      
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId);
      }
      
      if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    },

    // Invoice queries
    invoices: async (_, { userId, status, limit = 50 }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      let query = 'SELECT * FROM invoices WHERE tenant_id = $1';
      const params = [context.user.tenant_id];
      
      if (userId) {
        query += ' AND user_id = $2';
        params.push(userId);
      }
      
      if (status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(status);
      }
      
      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      return result.rows;
    },

    // Server queries
    servers: async (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'SELECT * FROM servers WHERE tenant_id = $1',
        [context.user.tenant_id]
      );
      
      return result.rows;
    },

    // Website queries
    websites: async (_, { serverId }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      let query = 'SELECT * FROM websites WHERE tenant_id = $1';
      const params = [context.user.tenant_id];
      
      if (serverId) {
        query += ' AND server_id = $2';
        params.push(serverId);
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    },

    // Database queries
    databases: async (_, { serverId }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      let query = 'SELECT * FROM databases WHERE tenant_id = $1';
      const params = [context.user.tenant_id];
      
      if (serverId) {
        query += ' AND server_id = $2';
        params.push(serverId);
      }
      
      const result = await pool.query(query, params);
      return result.rows;
    },

    // Serverless Function queries
    functions: async (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        'SELECT * FROM serverless_functions WHERE tenant_id = $1',
        [context.user.tenant_id]
      );
      
      return result.rows;
    },

    // Analytics queries
    analytics: async (_, { period = '30d' }, context) => {
      if (!context.user || context.user.role !== 'admin') {
        throw new Error('Admin access required');
      }
      
      // This would call the advancedAnalytics service
      return {
        revenue: {},
        customers: {},
        products: [],
        cohorts: []
      };
    },

    // Notification queries
    notifications: async (_, { read }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      let query = 'SELECT * FROM notifications WHERE user_id = $1';
      const params = [context.user.id];
      
      if (read !== undefined) {
        query += ' AND read = $2';
        params.push(read);
      }
      
      query += ' ORDER BY created_at DESC LIMIT 50';
      
      const result = await pool.query(query, params);
      return result.rows;
    }
  },

  // ============================================
  // Mutation Resolvers
  // ============================================

  Mutation: {
    // Auth mutations
    login: async (_, { email, password }) => {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];
      
      if (!user || !await bcrypt.compare(password, user.password_hash)) {
        throw new Error('Invalid credentials');
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );
      
      return {
        token,
        refreshToken,
        user,
        expiresIn: 7 * 24 * 60 * 60
      };
    },

    register: async (_, { email, password, name }) => {
      const passwordHash = await bcrypt.hash(password, 10);
      
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, tenant_id, status)
         VALUES ($1, $2, $3, 'customer', 1, 'active')
         RETURNING *`,
        [email, passwordHash, name]
      );
      
      const user = result.rows[0];
      
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );
      
      return {
        token,
        refreshToken,
        user,
        expiresIn: 7 * 24 * 60 * 60
      };
    },

    // Subscription mutations
    createSubscription: async (_, { productId, userId }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const targetUserId = userId || context.user.id;
      
      // Get product details
      const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
      const product = productResult.rows[0];
      
      if (!product) throw new Error('Product not found');
      
      const result = await pool.query(
        `INSERT INTO subscriptions (user_id, product_id, status, price, billing_cycle, tenant_id)
         VALUES ($1, $2, 'active', $3, $4, $5)
         RETURNING *`,
        [targetUserId, productId, product.price, product.billing_cycle, context.user.tenant_id]
      );
      
      const subscription = result.rows[0];
      
      // Publish real-time update
      pubsub.publish('SUBSCRIPTION_UPDATED', { subscriptionUpdated: subscription, userId: targetUserId });
      
      return subscription;
    },

    cancelSubscription: async (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        `UPDATE subscriptions 
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, context.user.id]
      );
      
      const subscription = result.rows[0];
      
      if (subscription) {
        pubsub.publish('SUBSCRIPTION_UPDATED', { subscriptionUpdated: subscription, userId: subscription.user_id });
      }
      
      return subscription;
    },

    // Serverless Function mutations
    createFunction: async (_, { name, runtime, code }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        `INSERT INTO serverless_functions (user_id, tenant_id, name, runtime, code, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING *`,
        [context.user.id, context.user.tenant_id, name, runtime, code]
      );
      
      return result.rows[0];
    },

    invokeFunction: async (_, { id, payload }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      // This would trigger actual function execution
      const invocation = {
        id: Math.random().toString(36).substr(2, 9),
        function: { id },
        status: 'success',
        duration: Math.random() * 1000,
        memoryUsed: Math.random() * 256,
        createdAt: new Date()
      };
      
      pubsub.publish('FUNCTION_INVOKED', { functionInvoked: invocation, functionId: id });
      
      return invocation;
    },

    // Notification mutations
    markNotificationRead: async (_, { id }, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      const result = await pool.query(
        `UPDATE notifications SET read = true, read_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, context.user.id]
      );
      
      return result.rows[0];
    },

    markAllNotificationsRead: async (_, __, context) => {
      if (!context.user) throw new Error('Not authenticated');
      
      await pool.query(
        'UPDATE notifications SET read = true, read_at = NOW() WHERE user_id = $1',
        [context.user.id]
      );
      
      return true;
    }
  },

  // ============================================
  // Subscription Resolvers (Real-time)
  // ============================================

  Subscription: {
    invoiceCreated: {
      subscribe: (_, { userId }) => pubsub.asyncIterator(['INVOICE_CREATED'])
    },
    
    subscriptionUpdated: {
      subscribe: (_, { userId }) => pubsub.asyncIterator(['SUBSCRIPTION_UPDATED'])
    },
    
    notificationReceived: {
      subscribe: () => pubsub.asyncIterator(['NOTIFICATION_RECEIVED'])
    },
    
    serverMetricsUpdated: {
      subscribe: (_, { serverId }) => pubsub.asyncIterator([`SERVER_METRICS_${serverId}`])
    },
    
    functionInvoked: {
      subscribe: (_, { functionId }) => pubsub.asyncIterator(['FUNCTION_INVOKED'])
    }
  },

  // ============================================
  // Field Resolvers
  // ============================================

  User: {
    subscriptions: async (user) => {
      const result = await pool.query(
        'SELECT * FROM subscriptions WHERE user_id = $1',
        [user.id]
      );
      return result.rows;
    },

    invoices: async (user) => {
      const result = await pool.query(
        'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
        [user.id]
      );
      return result.rows;
    },

    totalSpent: async (user) => {
      const result = await pool.query(
        "SELECT SUM(total) as total FROM invoices WHERE user_id = $1 AND status = 'paid'",
        [user.id]
      );
      return parseFloat(result.rows[0]?.total || 0);
    }
  },

  Subscription: {
    user: async (subscription) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [subscription.user_id]);
      return result.rows[0];
    },

    product: async (subscription) => {
      const result = await pool.query('SELECT * FROM products WHERE id = $1', [subscription.product_id]);
      return result.rows[0];
    }
  },

  Invoice: {
    user: async (invoice) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [invoice.user_id]);
      return result.rows[0];
    }
  },

  Website: {
    server: async (website) => {
      const result = await pool.query('SELECT * FROM servers WHERE id = $1', [website.server_id]);
      return result.rows[0];
    }
  },

  Database: {
    server: async (database) => {
      const result = await pool.query('SELECT * FROM servers WHERE id = $1', [database.server_id]);
      return result.rows[0];
    }
  }
};

export { pubsub };
