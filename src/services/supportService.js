const pool = require('../config/database');
const aiService = require('./aiService');
const websocketService = require('./websocketService');
const logger = require('../utils/logger');

/**
 * Advanced Support System Service
 * 
 * Features:
 * - AI-powered ticket triage and classification
 * - SLA tracking and alerting
 * - Knowledge base with full-text search
 * - Live chat with agent routing
 * - Customer satisfaction surveys (CSAT/NPS)
 * - Escalation workflows
 * - Ticket macros and canned responses
 * - Multi-channel support (email, chat, phone)
 */

class SupportService {
  constructor() {
    this.slaTargets = {
      critical: { response: 15, resolution: 240 }, // 15min response, 4h resolution
      high: { response: 60, resolution: 480 }, // 1h response, 8h resolution
      medium: { response: 240, resolution: 1440 }, // 4h response, 24h resolution
      low: { response: 480, resolution: 2880 } // 8h response, 48h resolution
    };
  }

  /**
   * Create support ticket with AI triage
   * 
   * @param {Object} ticketData
   * @returns {Promise<Object>}
   */
  async createTicket(ticketData) {
    const {
      tenantId,
      userId,
      subject,
      description,
      channel = 'email', // email, chat, phone, portal
      attachments = []
    } = ticketData;

    try {
      // AI-powered triage
      const triage = await aiService.triageTicket(subject, description);

      // Calculate SLA targets
      const slaTarget = this.slaTargets[triage.priority] || this.slaTargets.medium;
      const responseBy = new Date(Date.now() + slaTarget.response * 60 * 1000);
      const resolutionBy = new Date(Date.now() + slaTarget.resolution * 60 * 1000);

      // Create ticket
      const result = await pool.query(
        `INSERT INTO support_tickets 
        (tenant_id, user_id, subject, description, priority, category, 
         sentiment, channel, status, response_by, resolution_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10, NOW())
        RETURNING *`,
        [
          tenantId,
          userId,
          subject,
          description,
          triage.priority,
          triage.category,
          triage.sentiment,
          channel,
          responseBy,
          resolutionBy
        ]
      );

      const ticket = result.rows[0];

      // Store attachments
      if (attachments.length > 0) {
        await this.addAttachments(ticket.id, attachments);
      }

      // Auto-assign to agent based on category and availability
      await this.autoAssignTicket(ticket.id, triage.category);

      // Send notification to assigned agent
      websocketService.sendToUser(ticket.assigned_to, 'new_ticket', {
        ticketId: ticket.id,
        priority: ticket.priority,
        subject: ticket.subject
      });

      // Create ticket history entry
      await this.addTicketHistory(ticket.id, null, 'created', 'Ticket created via ' + channel);

      return ticket;
    } catch (error) {
      logger.error('Failed to create ticket:', error);
      throw error;
    }
  }

  /**
   * Auto-assign ticket to available agent
   * 
   * @param {number} ticketId
   * @param {string} category
   */
  async autoAssignTicket(ticketId, category) {
    try {
      // Find agents with matching expertise and lowest current workload
      const result = await pool.query(
        `SELECT sa.user_id, COUNT(st.id) as active_tickets
         FROM support_agents sa
         LEFT JOIN support_tickets st ON sa.user_id = st.assigned_to 
           AND st.status IN ('open', 'in_progress')
         WHERE sa.status = 'available' 
           AND sa.categories @> $1::jsonb
         GROUP BY sa.user_id
         ORDER BY active_tickets ASC
         LIMIT 1`,
        [JSON.stringify([category])]
      );

      if (result.rows.length > 0) {
        const agentId = result.rows[0].user_id;

        await pool.query(
          'UPDATE support_tickets SET assigned_to = $1, assigned_at = NOW() WHERE id = $2',
          [agentId, ticketId]
        );

        await this.addTicketHistory(ticketId, agentId, 'assigned', `Auto-assigned to agent`);
      }
    } catch (error) {
      logger.error('Failed to auto-assign ticket:', error);
    }
  }

  /**
   * Update ticket status
   * 
   * @param {number} ticketId
   * @param {number} agentId
   * @param {string} newStatus
   * @param {string} note
   * @returns {Promise<Object>}
   */
  async updateTicketStatus(ticketId, agentId, newStatus, note = null) {
    try {
      const result = await pool.query(
        `UPDATE support_tickets 
         SET status = $1, 
             first_response_at = CASE WHEN first_response_at IS NULL AND $1 = 'in_progress' THEN NOW() ELSE first_response_at END,
             resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
             closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [newStatus, ticketId]
      );

      const ticket = result.rows[0];

      // Add to history
      await this.addTicketHistory(ticketId, agentId, 'status_change', `Status changed to ${newStatus}. ${note || ''}`);

      // Check SLA compliance
      if (newStatus === 'in_progress' && ticket.first_response_at) {
        const responseTime = (new Date(ticket.first_response_at) - new Date(ticket.created_at)) / (1000 * 60);
        const slaTarget = this.slaTargets[ticket.priority].response;

        if (responseTime > slaTarget) {
          await this.recordSLABreach(ticketId, 'response', responseTime, slaTarget);
        }
      }

      if (newStatus === 'resolved' && ticket.resolved_at) {
        const resolutionTime = (new Date(ticket.resolved_at) - new Date(ticket.created_at)) / (1000 * 60);
        const slaTarget = this.slaTargets[ticket.priority].resolution;

        if (resolutionTime > slaTarget) {
          await this.recordSLABreach(ticketId, 'resolution', resolutionTime, slaTarget);
        }
      }

      // Send notification to user
      websocketService.sendToUser(ticket.user_id, 'ticket_updated', {
        ticketId: ticket.id,
        status: newStatus,
        message: note
      });

      return ticket;
    } catch (error) {
      logger.error('Failed to update ticket status:', error);
      throw error;
    }
  }

  /**
   * Add reply to ticket
   * 
   * @param {Object} replyData
   * @returns {Promise<Object>}
   */
  async addReply(replyData) {
    const {
      ticketId,
      userId,
      message,
      isInternal = false,
      attachments = []
    } = replyData;

    try {
      const result = await pool.query(
        `INSERT INTO ticket_replies 
        (ticket_id, user_id, message, is_internal, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING *`,
        [ticketId, userId, message, isInternal]
      );

      const reply = result.rows[0];

      // Store attachments
      if (attachments.length > 0) {
        await this.addAttachments(ticketId, attachments, reply.id);
      }

      // Update ticket's last activity
      await pool.query(
        'UPDATE support_tickets SET updated_at = NOW() WHERE id = $1',
        [ticketId]
      );

      // Get ticket details for notification
      const ticketResult = await pool.query(
        'SELECT * FROM support_tickets WHERE id = $1',
        [ticketId]
      );
      const ticket = ticketResult.rows[0];

      // Send real-time notification
      if (!isInternal) {
        const recipientId = userId === ticket.user_id ? ticket.assigned_to : ticket.user_id;
        websocketService.sendToUser(recipientId, 'ticket_reply', {
          ticketId,
          message,
          from: userId
        });
      }

      // Add to history
      await this.addTicketHistory(ticketId, userId, 'reply', isInternal ? 'Internal note added' : 'Reply added');

      return reply;
    } catch (error) {
      logger.error('Failed to add reply:', error);
      throw error;
    }
  }

  /**
   * Live chat functionality
   * 
   * @param {Object} chatData
   * @returns {Promise<Object>}
   */
  async startLiveChat(chatData) {
    const { tenantId, userId, initialMessage } = chatData;

    try {
      // Create chat session
      const result = await pool.query(
        `INSERT INTO live_chat_sessions 
        (tenant_id, user_id, status, started_at)
        VALUES ($1, $2, 'waiting', NOW())
        RETURNING *`,
        [tenantId, userId]
      );

      const session = result.rows[0];

      // Add initial message
      await pool.query(
        `INSERT INTO chat_messages 
        (session_id, sender_id, message, created_at)
        VALUES ($1, $2, $3, NOW())`,
        [session.id, userId, initialMessage]
      );

      // Find available agent
      const agentResult = await pool.query(
        `SELECT sa.user_id, COUNT(lcs.id) as active_chats
         FROM support_agents sa
         LEFT JOIN live_chat_sessions lcs ON sa.user_id = lcs.agent_id 
           AND lcs.status = 'active'
         WHERE sa.status = 'available' AND sa.accepts_chat = true
         GROUP BY sa.user_id
         ORDER BY active_chats ASC
         LIMIT 1`
      );

      if (agentResult.rows.length > 0) {
        const agentId = agentResult.rows[0].user_id;

        // Assign agent
        await pool.query(
          `UPDATE live_chat_sessions 
           SET agent_id = $1, status = 'active', agent_joined_at = NOW()
           WHERE id = $2`,
          [agentId, session.id]
        );

        // Notify agent
        websocketService.sendToUser(agentId, 'chat_request', {
          sessionId: session.id,
          userId,
          message: initialMessage
        });

        // Join chat room
        websocketService.joinRoom(`chat_${session.id}`, [userId, agentId]);

        return { ...session, agent_id: agentId, status: 'active' };
      } else {
        // No agents available
        return { ...session, status: 'waiting', message: 'All agents are currently busy. You will be connected soon.' };
      }
    } catch (error) {
      logger.error('Failed to start live chat:', error);
      throw error;
    }
  }

  /**
   * Send chat message
   * 
   * @param {number} sessionId
   * @param {number} senderId
   * @param {string} message
   * @returns {Promise<Object>}
   */
  async sendChatMessage(sessionId, senderId, message) {
    try {
      const result = await pool.query(
        `INSERT INTO chat_messages 
        (session_id, sender_id, message, created_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *`,
        [sessionId, senderId, message]
      );

      const chatMessage = result.rows[0];

      // Broadcast to chat room
      websocketService.sendToRoom(`chat_${sessionId}`, 'chat_message', {
        sessionId,
        senderId,
        message,
        timestamp: chatMessage.created_at
      });

      return chatMessage;
    } catch (error) {
      logger.error('Failed to send chat message:', error);
      throw error;
    }
  }

  /**
   * End chat session
   * 
   * @param {number} sessionId
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async endChatSession(sessionId, userId) {
    try {
      const result = await pool.query(
        `UPDATE live_chat_sessions 
         SET status = 'ended', ended_at = NOW(), ended_by = $2
         WHERE id = $1
         RETURNING *`,
        [sessionId, userId]
      );

      const session = result.rows[0];

      // Notify participants
      websocketService.sendToRoom(`chat_${sessionId}`, 'chat_ended', {
        sessionId,
        endedBy: userId
      });

      // Send satisfaction survey
      await this.sendSatisfactionSurvey(session.user_id, 'chat', sessionId);

      return session;
    } catch (error) {
      logger.error('Failed to end chat session:', error);
      throw error;
    }
  }

  /**
   * Knowledge base search
   * 
   * @param {string} query
   * @param {number} tenantId
   * @returns {Promise<Array>}
   */
  async searchKnowledgeBase(query, tenantId = null) {
    try {
      // Full-text search on knowledge base articles
      const result = await pool.query(
        `SELECT 
          kb.*,
          ts_rank(to_tsvector('english', kb.title || ' ' || kb.content), plainto_tsquery('english', $1)) as rank
         FROM knowledge_base kb
         WHERE kb.status = 'published'
           AND ($2::int IS NULL OR kb.tenant_id IS NULL OR kb.tenant_id = $2)
           AND to_tsvector('english', kb.title || ' ' || kb.content) @@ plainto_tsquery('english', $1)
         ORDER BY rank DESC, kb.views DESC
         LIMIT 10`,
        [query, tenantId]
      );

      // Increment view count for top result
      if (result.rows.length > 0) {
        await pool.query(
          'UPDATE knowledge_base SET views = views + 1 WHERE id = $1',
          [result.rows[0].id]
        );
      }

      return result.rows;
    } catch (error) {
      logger.error('Failed to search knowledge base:', error);
      throw error;
    }
  }

  /**
   * Create knowledge base article
   * 
   * @param {Object} articleData
   * @returns {Promise<Object>}
   */
  async createKBArticle(articleData) {
    const {
      tenantId = null, // null = global article
      authorId,
      title,
      content,
      category,
      tags = [],
      status = 'draft' // draft, published
    } = articleData;

    try {
      const result = await pool.query(
        `INSERT INTO knowledge_base 
        (tenant_id, author_id, title, content, category, tags, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [tenantId, authorId, title, content, category, tags, status]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create KB article:', error);
      throw error;
    }
  }

  /**
   * Send satisfaction survey (CSAT/NPS)
   * 
   * @param {number} userId
   * @param {string} type - 'ticket', 'chat'
   * @param {number} resourceId - ticket ID or chat session ID
   * @returns {Promise<Object>}
   */
  async sendSatisfactionSurvey(userId, type, resourceId) {
    try {
      const result = await pool.query(
        `INSERT INTO satisfaction_surveys 
        (user_id, type, resource_id, sent_at)
        VALUES ($1, $2, $3, NOW())
        RETURNING *`,
        [userId, type, resourceId]
      );

      const survey = result.rows[0];

      // Send email or notification with survey link
      websocketService.sendToUser(userId, 'satisfaction_survey', {
        surveyId: survey.id,
        type,
        message: 'How satisfied were you with our support?'
      });

      return survey;
    } catch (error) {
      logger.error('Failed to send satisfaction survey:', error);
      throw error;
    }
  }

  /**
   * Submit survey response
   * 
   * @param {number} surveyId
   * @param {Object} responseData
   * @returns {Promise<Object>}
   */
  async submitSurveyResponse(surveyId, responseData) {
    const {
      rating, // 1-5 for CSAT, 0-10 for NPS
      feedback = null,
      npsScore = null
    } = responseData;

    try {
      const result = await pool.query(
        `UPDATE satisfaction_surveys 
         SET rating = $1, feedback = $2, nps_score = $3, responded_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [rating, feedback, npsScore, surveyId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to submit survey response:', error);
      throw error;
    }
  }

  /**
   * Apply ticket macro (canned response)
   * 
   * @param {number} ticketId
   * @param {number} macroId
   * @param {number} agentId
   * @returns {Promise<Object>}
   */
  async applyMacro(ticketId, macroId, agentId) {
    try {
      // Get macro
      const macroResult = await pool.query(
        'SELECT * FROM ticket_macros WHERE id = $1',
        [macroId]
      );

      if (macroResult.rows.length === 0) {
        throw new Error('Macro not found');
      }

      const macro = macroResult.rows[0];

      // Apply macro actions
      const actions = macro.actions;

      // Add reply if specified
      if (actions.reply) {
        await this.addReply({
          ticketId,
          userId: agentId,
          message: actions.reply,
          isInternal: false
        });
      }

      // Update status if specified
      if (actions.status) {
        await this.updateTicketStatus(ticketId, agentId, actions.status, 'Macro applied: ' + macro.name);
      }

      // Add tags if specified
      if (actions.tags && actions.tags.length > 0) {
        await pool.query(
          `UPDATE support_tickets 
           SET tags = array_cat(tags, $1::text[])
           WHERE id = $2`,
          [actions.tags, ticketId]
        );
      }

      // Assign to user/team if specified
      if (actions.assignTo) {
        await pool.query(
          'UPDATE support_tickets SET assigned_to = $1 WHERE id = $2',
          [actions.assignTo, ticketId]
        );
      }

      return { success: true, macro: macro.name };
    } catch (error) {
      logger.error('Failed to apply macro:', error);
      throw error;
    }
  }

  /**
   * Escalate ticket
   * 
   * @param {number} ticketId
   * @param {number} agentId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async escalateTicket(ticketId, agentId, reason) {
    try {
      // Increase priority
      await pool.query(
        `UPDATE support_tickets 
         SET priority = CASE 
           WHEN priority = 'low' THEN 'medium'
           WHEN priority = 'medium' THEN 'high'
           WHEN priority = 'high' THEN 'critical'
           ELSE priority
         END,
         escalated = true,
         escalated_at = NOW(),
         escalated_by = $2
         WHERE id = $1`,
        [ticketId, agentId]
      );

      // Add to history
      await this.addTicketHistory(ticketId, agentId, 'escalated', `Ticket escalated: ${reason}`);

      // Notify managers
      const managers = await pool.query(
        `SELECT user_id FROM support_agents WHERE role = 'manager' AND status = 'available'`
      );

      for (const manager of managers.rows) {
        websocketService.sendToUser(manager.user_id, 'ticket_escalated', {
          ticketId,
          reason
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to escalate ticket:', error);
      throw error;
    }
  }

  /**
   * Get SLA metrics
   * 
   * @param {number} tenantId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getSLAMetrics(tenantId, startDate, endDate) {
    try {
      const result = await pool.query(
        `SELECT 
          priority,
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN first_response_at IS NOT NULL THEN 1 END) as responded_tickets,
          AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_response_time_minutes,
          COUNT(CASE WHEN resolved_at IS NOT NULL THEN 1 END) as resolved_tickets,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_resolution_time_minutes,
          COUNT(CASE WHEN id IN (SELECT ticket_id FROM sla_breaches WHERE breach_type = 'response') THEN 1 END) as response_breaches,
          COUNT(CASE WHEN id IN (SELECT ticket_id FROM sla_breaches WHERE breach_type = 'resolution') THEN 1 END) as resolution_breaches
         FROM support_tickets
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY priority`,
        [tenantId, startDate, endDate]
      );

      const metrics = {};

      for (const row of result.rows) {
        const slaTarget = this.slaTargets[row.priority];
        const responseCompliance = row.responded_tickets > 0
          ? ((row.responded_tickets - row.response_breaches) / row.responded_tickets * 100).toFixed(2)
          : 100;
        const resolutionCompliance = row.resolved_tickets > 0
          ? ((row.resolved_tickets - row.resolution_breaches) / row.resolved_tickets * 100).toFixed(2)
          : 100;

        metrics[row.priority] = {
          totalTickets: parseInt(row.total_tickets),
          avgResponseTime: parseFloat(row.avg_response_time_minutes || 0).toFixed(2),
          avgResolutionTime: parseFloat(row.avg_resolution_time_minutes || 0).toFixed(2),
          slaTargets: slaTarget,
          responseCompliance: `${responseCompliance}%`,
          resolutionCompliance: `${resolutionCompliance}%`,
          breaches: {
            response: parseInt(row.response_breaches),
            resolution: parseInt(row.resolution_breaches)
          }
        };
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get SLA metrics:', error);
      throw error;
    }
  }

  /**
   * Get support analytics
   * 
   * @param {number} tenantId
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {Promise<Object>}
   */
  async getSupportAnalytics(tenantId, startDate, endDate) {
    try {
      // Ticket volume
      const volumeResult = await pool.query(
        `SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
          COUNT(CASE WHEN status IN ('open', 'in_progress') THEN 1 END) as active_tickets
         FROM support_tickets
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3`,
        [tenantId, startDate, endDate]
      );

      // Satisfaction metrics
      const satisfactionResult = await pool.query(
        `SELECT 
          AVG(rating) as avg_csat,
          AVG(nps_score) as avg_nps,
          COUNT(*) as total_responses
         FROM satisfaction_surveys
         WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)
           AND sent_at BETWEEN $2 AND $3
           AND responded_at IS NOT NULL`,
        [tenantId, startDate, endDate]
      );

      // Top categories
      const categoriesResult = await pool.query(
        `SELECT category, COUNT(*) as count
         FROM support_tickets
         WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
         GROUP BY category
         ORDER BY count DESC
         LIMIT 10`,
        [tenantId, startDate, endDate]
      );

      // Agent performance
      const agentPerformanceResult = await pool.query(
        `SELECT 
          u.full_name,
          COUNT(st.id) as tickets_handled,
          AVG(EXTRACT(EPOCH FROM (st.resolved_at - st.created_at))/60) as avg_resolution_time,
          AVG(ss.rating) as avg_satisfaction
         FROM support_tickets st
         JOIN users u ON st.assigned_to = u.id
         LEFT JOIN satisfaction_surveys ss ON ss.resource_id = st.id AND ss.type = 'ticket'
         WHERE st.tenant_id = $1 AND st.created_at BETWEEN $2 AND $3
         GROUP BY u.id, u.full_name
         ORDER BY tickets_handled DESC`,
        [tenantId, startDate, endDate]
      );

      return {
        volume: volumeResult.rows[0],
        satisfaction: {
          avgCSAT: parseFloat(satisfactionResult.rows[0].avg_csat || 0).toFixed(2),
          avgNPS: parseFloat(satisfactionResult.rows[0].avg_nps || 0).toFixed(2),
          responses: parseInt(satisfactionResult.rows[0].total_responses)
        },
        topCategories: categoriesResult.rows,
        agentPerformance: agentPerformanceResult.rows
      };
    } catch (error) {
      logger.error('Failed to get support analytics:', error);
      throw error;
    }
  }

  // Helper methods

  async addAttachments(ticketId, attachments, replyId = null) {
    for (const attachment of attachments) {
      await pool.query(
        `INSERT INTO ticket_attachments 
        (ticket_id, reply_id, filename, file_path, file_size, mime_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [ticketId, replyId, attachment.filename, attachment.path, attachment.size, attachment.mimeType]
      );
    }
  }

  async addTicketHistory(ticketId, userId, action, description) {
    await pool.query(
      `INSERT INTO ticket_history 
      (ticket_id, user_id, action, description, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [ticketId, userId, action, description]
    );
  }

  async recordSLABreach(ticketId, breachType, actualTime, targetTime) {
    await pool.query(
      `INSERT INTO sla_breaches 
      (ticket_id, breach_type, actual_time_minutes, target_time_minutes, created_at)
      VALUES ($1, $2, $3, $4, NOW())`,
      [ticketId, breachType, actualTime, targetTime]
    );

    logger.warn('SLA breach recorded', { ticketId, breachType, actualTime, targetTime });
  }
}

module.exports = new SupportService();
