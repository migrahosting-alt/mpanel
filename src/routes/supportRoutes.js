const express = require('express');
const router = express.Router();
const supportService = require('../services/supportService');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * Advanced Support System Routes
 * 
 * Endpoints for ticketing, live chat, knowledge base, SLA tracking
 */

// Public routes (no auth required)

/**
 * @route   GET /api/support/kb/search
 * @desc    Search knowledge base (public)
 * @access  Public
 */
router.get('/kb/search', async (req, res) => {
  try {
    const { q, tenantId } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const articles = await supportService.searchKnowledgeBase(q, tenantId || null);
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Authenticated routes
router.use(authenticate);

/**
 * @route   POST /api/support/tickets
 * @desc    Create support ticket
 * @access  Private
 */
router.post('/tickets', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const ticketData = {
      tenantId,
      userId,
      ...req.body
    };

    const ticket = await supportService.createTicket(ticketData);
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/support/tickets
 * @desc    List tickets
 * @access  Private
 */
router.get('/tickets', async (req, res) => {
  try {
    const { tenantId, userId, role } = req.user;
    const { status, priority, assigned_to, limit = 50 } = req.query;

    const pool = require('../config/database');
    
    // Agents can see all tickets, users see only their own
    const isAgent = ['agent', 'admin'].includes(role);
    
    let query = `
      SELECT st.*, u.full_name as user_name, u.email as user_email,
             a.full_name as agent_name
      FROM support_tickets st
      JOIN users u ON st.user_id = u.id
      LEFT JOIN users a ON st.assigned_to = a.id
      WHERE st.tenant_id = $1
    `;
    const params = [tenantId];
    let paramCount = 1;

    if (!isAgent) {
      query += ` AND st.user_id = $${++paramCount}`;
      params.push(userId);
    }

    if (status) {
      query += ` AND st.status = $${++paramCount}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND st.priority = $${++paramCount}`;
      params.push(priority);
    }

    if (assigned_to) {
      query += ` AND st.assigned_to = $${++paramCount}`;
      params.push(assigned_to);
    }

    query += ` ORDER BY st.created_at DESC LIMIT $${++paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/support/tickets/:id
 * @desc    Get ticket details
 * @access  Private
 */
router.get('/tickets/:id', async (req, res) => {
  try {
    const { tenantId, userId, role } = req.user;
    const { id } = req.params;

    const pool = require('../config/database');
    const result = await pool.query(
      `SELECT st.*, u.full_name as user_name, u.email as user_email,
              a.full_name as agent_name
       FROM support_tickets st
       JOIN users u ON st.user_id = u.id
       LEFT JOIN users a ON st.assigned_to = a.id
       WHERE st.id = $1 AND st.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = result.rows[0];

    // Users can only view their own tickets
    if (!['agent', 'admin'].includes(role) && ticket.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get replies
    const repliesResult = await pool.query(
      `SELECT tr.*, u.full_name as user_name
       FROM ticket_replies tr
       JOIN users u ON tr.user_id = u.id
       WHERE tr.ticket_id = $1
       ORDER BY tr.created_at ASC`,
      [id]
    );

    ticket.replies = repliesResult.rows;

    // Get history
    const historyResult = await pool.query(
      `SELECT th.*, u.full_name as user_name
       FROM ticket_history th
       LEFT JOIN users u ON th.user_id = u.id
       WHERE th.ticket_id = $1
       ORDER BY th.created_at DESC`,
      [id]
    );

    ticket.history = historyResult.rows;

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   PUT /api/support/tickets/:id/status
 * @desc    Update ticket status
 * @access  Agent/Admin only
 */
router.put('/tickets/:id/status', requireRole('agent'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { status, note } = req.body;

    const ticket = await supportService.updateTicketStatus(id, userId, status, note);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/tickets/:id/replies
 * @desc    Add reply to ticket
 * @access  Private
 */
router.post('/tickets/:id/replies', async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { message, isInternal, attachments } = req.body;

    const reply = await supportService.addReply({
      ticketId: id,
      userId,
      message,
      isInternal: isInternal || false,
      attachments: attachments || []
    });

    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/tickets/:id/escalate
 * @desc    Escalate ticket
 * @access  Agent/Admin only
 */
router.post('/tickets/:id/escalate', requireRole('agent'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { reason } = req.body;

    const result = await supportService.escalateTicket(id, userId, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/tickets/:id/macro
 * @desc    Apply ticket macro
 * @access  Agent/Admin only
 */
router.post('/tickets/:id/macro', requireRole('agent'), async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const { macroId } = req.body;

    const result = await supportService.applyMacro(id, macroId, userId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/chat/start
 * @desc    Start live chat session
 * @access  Private
 */
router.post('/chat/start', async (req, res) => {
  try {
    const { tenantId, userId } = req.user;
    const { initialMessage } = req.body;

    const session = await supportService.startLiveChat({
      tenantId,
      userId,
      initialMessage
    });

    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/chat/:sessionId/message
 * @desc    Send chat message
 * @access  Private
 */
router.post('/chat/:sessionId/message', async (req, res) => {
  try {
    const { userId } = req.user;
    const { sessionId } = req.params;
    const { message } = req.body;

    const chatMessage = await supportService.sendChatMessage(sessionId, userId, message);
    res.status(201).json(chatMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/chat/:sessionId/end
 * @desc    End chat session
 * @access  Private
 */
router.post('/chat/:sessionId/end', async (req, res) => {
  try {
    const { userId } = req.user;
    const { sessionId } = req.params;

    const session = await supportService.endChatSession(sessionId, userId);
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/kb/articles
 * @desc    Create knowledge base article
 * @access  Agent/Admin only
 */
router.post('/kb/articles', requireRole('agent'), async (req, res) => {
  try {
    const { userId } = req.user;
    const articleData = {
      authorId: userId,
      ...req.body
    };

    const article = await supportService.createKBArticle(articleData);
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/support/kb/articles
 * @desc    List knowledge base articles
 * @access  Private
 */
router.get('/kb/articles', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { category, status = 'published', limit = 50 } = req.query;

    const pool = require('../config/database');
    let query = `
      SELECT kb.*, u.full_name as author_name
      FROM knowledge_base kb
      JOIN users u ON kb.author_id = u.id
      WHERE (kb.tenant_id = $1 OR kb.tenant_id IS NULL)
        AND kb.status = $2
    `;
    const params = [tenantId, status];
    let paramCount = 2;

    if (category) {
      query += ` AND kb.category = $${++paramCount}`;
      params.push(category);
    }

    query += ` ORDER BY kb.views DESC, kb.created_at DESC LIMIT $${++paramCount}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/support/surveys/:surveyId/response
 * @desc    Submit satisfaction survey response
 * @access  Private
 */
router.post('/surveys/:surveyId/response', async (req, res) => {
  try {
    const { surveyId } = req.params;
    const { rating, feedback, npsScore } = req.body;

    const response = await supportService.submitSurveyResponse(surveyId, {
      rating,
      feedback,
      npsScore
    });

    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/support/sla/metrics
 * @desc    Get SLA metrics
 * @access  Admin only
 */
router.get('/sla/metrics', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    const metrics = await supportService.getSLAMetrics(
      tenantId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/support/analytics
 * @desc    Get support analytics
 * @access  Admin only
 */
router.get('/analytics', requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    const analytics = await supportService.getSupportAnalytics(
      tenantId,
      new Date(startDate),
      new Date(endDate)
    );

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
