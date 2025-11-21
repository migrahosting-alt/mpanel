/**
 * WebSocket Service - Real-time Communication Hub
 * Handles: live updates, notifications, presence, collaborative editing
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import pool from '../db/index.js';
import logger from '../config/logger.js';
import Redis from 'ioredis';

class WebSocketService {
  constructor() {
    this.io = null;
    this.redis = null;
    this.presenceTracker = new Map(); // userId -> Set of socketIds
    this.rooms = new Map(); // roomId -> Set of userIds
  }

  /**
   * Initialize WebSocket server
   */
  async initialize(server) {
    // Redis for pub/sub across multiple server instances
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: 1 // Use separate DB for WebSocket
    });

    // Socket.io setup with Redis adapter for horizontal scaling
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
      },
      path: '/ws',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Redis adapter for multi-server support
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const pubClient = this.redis.duplicate();
    const subClient = this.redis.duplicate();
    
    // ioredis auto-connects, no need to call .connect() explicitly
    this.io.adapter(createAdapter(pubClient, subClient));

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.tenantId = decoded.tenant_id;
        socket.role = decoded.role;
        
        // Load user details
        const userResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [decoded.id]);
        if (userResult.rows.length === 0) {
          return next(new Error('User not found'));
        }
        
        socket.user = userResult.rows[0];
        next();
      } catch (error) {
        logger.error('WebSocket auth error:', error);
        next(new Error('Invalid token'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('WebSocket service initialized');
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    const tenantId = socket.tenantId;

    logger.info(`WebSocket connected: user=${userId}, socket=${socket.id}`);

    // Track presence
    this.addPresence(userId, socket.id);

    // Join tenant room for tenant-wide broadcasts
    socket.join(`tenant:${tenantId}`);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Emit presence update
    this.broadcastPresence(tenantId, userId, 'online');

    // Send initial state
    socket.emit('connected', {
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    });

    // Resource monitoring subscription
    socket.on('subscribe:resources', async (data) => {
      await this.handleResourceSubscription(socket, data);
    });

    // Deployment monitoring
    socket.on('subscribe:deployment', (deploymentId) => {
      socket.join(`deployment:${deploymentId}`);
      logger.info(`User ${userId} subscribed to deployment ${deploymentId}`);
    });

    // Billing events
    socket.on('subscribe:billing', () => {
      socket.join(`billing:${tenantId}`);
      logger.info(`User ${userId} subscribed to billing events`);
    });

    // Support chat
    socket.on('subscribe:support', (ticketId) => {
      socket.join(`support:${ticketId}`);
      logger.info(`User ${userId} joined support ticket ${ticketId}`);
    });

    // Collaborative editing
    socket.on('subscribe:editor', (documentId) => {
      socket.join(`editor:${documentId}`);
      this.handleEditorJoin(socket, documentId);
    });

    // Editor operations (OT - Operational Transformation)
    socket.on('editor:operation', (data) => {
      this.handleEditorOperation(socket, data);
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      socket.to(`support:${data.ticketId}`).emit('user:typing', {
        userId,
        user: socket.user.email
      });
    });

    socket.on('typing:stop', (data) => {
      socket.to(`support:${data.ticketId}`).emit('user:stopped-typing', {
        userId
      });
    });

    // Custom events
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      this.handleDisconnect(socket);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`WebSocket error for user ${userId}:`, error);
    });
  }

  /**
   * Handle resource monitoring subscription
   */
  async handleResourceSubscription(socket, data) {
    const { resourceType, resourceId } = data;
    
    // Verify access
    const hasAccess = await this.verifyResourceAccess(socket.userId, resourceType, resourceId);
    if (!hasAccess) {
      socket.emit('error', { message: 'Access denied to resource' });
      return;
    }

    const room = `resource:${resourceType}:${resourceId}`;
    socket.join(room);
    
    logger.info(`User ${socket.userId} subscribed to ${room}`);
    
    // Send initial metrics
    const metrics = await this.getCurrentMetrics(resourceType, resourceId);
    socket.emit('resource:metrics', { resourceType, resourceId, metrics });
  }

  /**
   * Handle collaborative editor join
   */
  handleEditorJoin(socket, documentId) {
    const userId = socket.userId;
    
    // Add to room tracking
    if (!this.rooms.has(documentId)) {
      this.rooms.set(documentId, new Set());
    }
    this.rooms.get(documentId).add(userId);

    // Notify others
    socket.to(`editor:${documentId}`).emit('editor:user-joined', {
      userId,
      user: socket.user.email,
      timestamp: Date.now()
    });

    // Send active users
    const activeUsers = Array.from(this.rooms.get(documentId));
    socket.emit('editor:active-users', { users: activeUsers });
  }

  /**
   * Handle editor operations (collaborative editing)
   */
  handleEditorOperation(socket, data) {
    const { documentId, operation, version } = data;
    
    // Broadcast operation to other users (OT)
    socket.to(`editor:${documentId}`).emit('editor:operation', {
      userId: socket.userId,
      operation,
      version,
      timestamp: Date.now()
    });

    // Store operation in Redis for history
    this.redis.lpush(
      `editor:${documentId}:ops`,
      JSON.stringify({ userId: socket.userId, operation, version, timestamp: Date.now() })
    );
  }

  /**
   * Handle disconnect
   */
  handleDisconnect(socket) {
    const userId = socket.userId;
    const tenantId = socket.tenantId;

    logger.info(`WebSocket disconnected: user=${userId}, socket=${socket.id}`);

    // Remove presence
    this.removePresence(userId, socket.id);

    // Clean up editor rooms
    for (const [documentId, users] of this.rooms.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        socket.to(`editor:${documentId}`).emit('editor:user-left', {
          userId,
          timestamp: Date.now()
        });
      }
    }

    // Check if user is completely offline
    if (!this.presenceTracker.has(userId) || this.presenceTracker.get(userId).size === 0) {
      this.broadcastPresence(tenantId, userId, 'offline');
    }
  }

  /**
   * Presence tracking
   */
  addPresence(userId, socketId) {
    if (!this.presenceTracker.has(userId)) {
      this.presenceTracker.set(userId, new Set());
    }
    this.presenceTracker.get(userId).add(socketId);
  }

  removePresence(userId, socketId) {
    if (this.presenceTracker.has(userId)) {
      this.presenceTracker.get(userId).delete(socketId);
      if (this.presenceTracker.get(userId).size === 0) {
        this.presenceTracker.delete(userId);
      }
    }
  }

  /**
   * Broadcast presence change
   */
  broadcastPresence(tenantId, userId, status) {
    this.io.to(`tenant:${tenantId}`).emit('presence:change', {
      userId,
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Send resource metrics update
   */
  sendResourceMetrics(resourceType, resourceId, metrics) {
    const room = `resource:${resourceType}:${resourceId}`;
    this.io.to(room).emit('resource:metrics', {
      resourceType,
      resourceId,
      metrics,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Send deployment update
   */
  sendDeploymentUpdate(deploymentId, status, data = {}) {
    this.io.to(`deployment:${deploymentId}`).emit('deployment:update', {
      deploymentId,
      status,
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Send billing event
   */
  sendBillingEvent(tenantId, event, data) {
    this.io.to(`billing:${tenantId}`).emit('billing:event', {
      event,
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Send support message
   */
  sendSupportMessage(ticketId, message) {
    this.io.to(`support:${ticketId}`).emit('support:message', {
      ticketId,
      message,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Send notification to user
   */
  sendNotification(userId, notification) {
    this.io.to(`user:${userId}`).emit('notification', {
      ...notification,
      timestamp: Date.now()
    });
  }

  /**
   * Public API: Broadcast to tenant
   */
  broadcastToTenant(tenantId, event, data) {
    this.io.to(`tenant:${tenantId}`).emit(event, {
      ...data,
      timestamp: Date.now()
    });
  }

  /**
   * Verify resource access
   */
  async verifyResourceAccess(userId, resourceType, resourceId) {
    try {
      let table;
      switch (resourceType) {
        case 'server': return true; // Servers visible to all tenant users
        case 'website': table = 'websites'; break;
        case 'database': table = 'databases'; break;
        case 'email': table = 'email_accounts'; break;
        default: return false;
      }

      const result = await pool.query(
        `SELECT id FROM ${table} WHERE id = $1 AND (user_id = $2 OR user_id IN (
          SELECT id FROM users WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = $2)
        ))`,
        [resourceId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error verifying resource access:', error);
      return false;
    }
  }

  /**
   * Get current metrics (placeholder)
   */
  async getCurrentMetrics(resourceType, resourceId) {
    // This would call monitoringController logic
    return {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: { rx: 0, tx: 0 }
    };
  }

  /**
   * Get online users
   */
  getOnlineUsers(tenantId) {
    const sockets = this.io.sockets.adapter.rooms.get(`tenant:${tenantId}`);
    if (!sockets) return [];
    
    const userIds = new Set();
    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        userIds.add(socket.userId);
      }
    }
    
    return Array.from(userIds);
  }

  /**
   * Shutdown
   */
  async shutdown() {
    if (this.io) {
      this.io.close();
      logger.info('WebSocket server closed');
    }
    if (this.redis) {
      await this.redis.quit();
      logger.info('WebSocket Redis connection closed');
    }
  }
}

export default new WebSocketService();
