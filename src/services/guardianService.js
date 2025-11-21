/**
 * Guardian Service
 * Manages AFM Guardian (AI Support Assistant) instances
 */

import pool from '../db/index.js';
import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * Generate a secure widget token for authentication
 */
function generateWidgetToken() {
  return `guardian_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Create a new Guardian instance for a customer
 */
export async function createGuardianInstance(tenantId, data) {
  const {
    customerId,
    instanceName,
    gatewayUrl = 'http://localhost:8080',
    allowedOrigins = [],
    maxMessagesPerDay = 100,
    enableVoice = false,
    llmProvider = 'openai',
    llmModel = 'gpt-4o-mini',
    llmTemperature = 0.7,
    widgetTitle = 'AI Support Assistant',
    widgetSubtitle = null,
    primaryColor = '#3b82f6',
    assistantName = 'Abigail',
    avatarUrl = null,
    productId = null,
    monthlyPrice = 29.99
  } = data;

  const widgetToken = generateWidgetToken();

  const result = await pool.query(
    `INSERT INTO guardian_instances (
      tenant_id, customer_id, instance_name, widget_token, gateway_url,
      allowed_origins, max_messages_per_day, enable_voice,
      llm_provider, llm_model, llm_temperature,
      widget_title, widget_subtitle, primary_color, assistant_name, avatar_url,
      product_id, monthly_price, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'active')
    RETURNING *`,
    [
      tenantId, customerId, instanceName, widgetToken, gatewayUrl,
      allowedOrigins, maxMessagesPerDay, enableVoice,
      llmProvider, llmModel, llmTemperature,
      widgetTitle, widgetSubtitle, primaryColor, assistantName, avatarUrl,
      productId, monthlyPrice
    ]
  );

  logger.info('Guardian instance created', {
    instanceId: result.rows[0].id,
    customerId,
    instanceName
  });

  return result.rows[0];
}

/**
 * Get all Guardian instances for a tenant
 */
export async function listGuardianInstances(tenantId, filters = {}) {
  const { customerId, status, limit = 50, offset = 0 } = filters;

  let query = `
    SELECT gi.*, 
           c.company_name as customer_name,
           u.email as customer_email,
           u.first_name, u.last_name,
           p.name as product_name
    FROM guardian_instances gi
    LEFT JOIN customers c ON gi.customer_id = c.id
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN products p ON gi.product_id = p.id
    WHERE gi.tenant_id = $1
  `;
  const params = [tenantId];
  let paramIndex = 2;

  if (customerId) {
    query += ` AND gi.customer_id = $${paramIndex}`;
    params.push(customerId);
    paramIndex++;
  }

  if (status) {
    query += ` AND gi.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY gi.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  const result = await pool.query(query, params);

  // Get total count
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM guardian_instances WHERE tenant_id = $1',
    [tenantId]
  );

  return {
    instances: result.rows,
    total: parseInt(countResult.rows[0].count),
    limit,
    offset
  };
}

/**
 * Get a specific Guardian instance
 */
export async function getGuardianInstance(tenantId, instanceId) {
  const result = await pool.query(
    `SELECT gi.*, 
            c.company_name as customer_name,
            u.email as customer_email,
            u.first_name, u.last_name,
            p.name as product_name
     FROM guardian_instances gi
     LEFT JOIN customers c ON gi.customer_id = c.id
     LEFT JOIN users u ON c.user_id = u.id
     LEFT JOIN products p ON gi.product_id = p.id
     WHERE gi.id = $1 AND gi.tenant_id = $2`,
    [instanceId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Guardian instance not found');
  }

  return result.rows[0];
}

/**
 * Update Guardian instance configuration
 */
export async function updateGuardianInstance(tenantId, instanceId, updates) {
  const allowedFields = [
    'instance_name', 'gateway_url', 'allowed_origins', 'max_messages_per_day',
    'enable_voice', 'llm_provider', 'llm_model', 'llm_temperature',
    'widget_title', 'widget_subtitle', 'primary_color', 'assistant_name',
    'avatar_url', 'status', 'monthly_price'
  ];

  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  const setClause = fields.map((field, index) => `${field} = $${index + 3}`).join(', ');
  const values = fields.map(field => updates[field]);

  const result = await pool.query(
    `UPDATE guardian_instances 
     SET ${setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [instanceId, tenantId, ...values]
  );

  if (result.rows.length === 0) {
    throw new Error('Guardian instance not found');
  }

  logger.info('Guardian instance updated', { instanceId, fields });

  return result.rows[0];
}

/**
 * Delete Guardian instance
 */
export async function deleteGuardianInstance(tenantId, instanceId) {
  const result = await pool.query(
    'DELETE FROM guardian_instances WHERE id = $1 AND tenant_id = $2 RETURNING id',
    [instanceId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Guardian instance not found');
  }

  logger.info('Guardian instance deleted', { instanceId });

  return { success: true, instanceId };
}

/**
 * Regenerate widget token (for security rotation)
 */
export async function regenerateWidgetToken(tenantId, instanceId) {
  const newToken = generateWidgetToken();

  const result = await pool.query(
    `UPDATE guardian_instances 
     SET widget_token = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [newToken, instanceId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Guardian instance not found');
  }

  logger.info('Guardian widget token regenerated', { instanceId });

  return result.rows[0];
}

/**
 * Record a chat session
 */
export async function createGuardianSession(instanceId, sessionData) {
  const {
    sessionId,
    userIdentifier,
    ipAddress,
    userAgent
  } = sessionData;

  const result = await pool.query(
    `INSERT INTO guardian_sessions (
      instance_id, session_id, user_identifier, ip_address, user_agent
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [instanceId, sessionId, userIdentifier, ipAddress, userAgent]
  );

  // Increment total sessions for instance
  await pool.query(
    `UPDATE guardian_instances 
     SET total_sessions = total_sessions + 1
     WHERE id = $1`,
    [instanceId]
  );

  return result.rows[0];
}

/**
 * Log a message in a session
 */
export async function logGuardianMessage(sessionId, instanceId, messageData) {
  const {
    role,
    content,
    toolName = null,
    toolInput = null,
    toolResult = null,
    toolExecutionTimeMs = null,
    llmModel = null,
    llmTokensPrompt = null,
    llmTokensCompletion = null,
    llmCost = null
  } = messageData;

  const result = await pool.query(
    `INSERT INTO guardian_messages (
      session_id, instance_id, role, content,
      tool_name, tool_input, tool_result, tool_execution_time_ms,
      llm_model, llm_tokens_prompt, llm_tokens_completion, llm_cost
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      sessionId, instanceId, role, content,
      toolName, toolInput, toolResult, toolExecutionTimeMs,
      llmModel, llmTokensPrompt, llmTokensCompletion, llmCost
    ]
  );

  // Update session activity and message count
  await pool.query(
    `UPDATE guardian_sessions 
     SET message_count = message_count + 1,
         tool_calls_count = tool_calls_count + $1,
         last_activity_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [toolName ? 1 : 0, sessionId]
  );

  // Update instance total messages and last message time
  await pool.query(
    `UPDATE guardian_instances 
     SET total_messages = total_messages + 1,
         last_message_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [instanceId]
  );

  return result.rows[0];
}

/**
 * Get Guardian analytics for an instance
 */
export async function getGuardianAnalytics(tenantId, instanceId, dateRange) {
  const { startDate, endDate } = dateRange;

  const result = await pool.query(
    `SELECT * FROM guardian_analytics
     WHERE instance_id = $1
     AND date >= $2 AND date <= $3
     ORDER BY date DESC`,
    [instanceId, startDate, endDate]
  );

  // Verify instance belongs to tenant
  await getGuardianInstance(tenantId, instanceId);

  return result.rows;
}

/**
 * Get session history for an instance
 */
export async function getSessionHistory(tenantId, instanceId, limit = 50) {
  // Verify instance belongs to tenant
  await getGuardianInstance(tenantId, instanceId);

  const result = await pool.query(
    `SELECT s.*, 
            COUNT(m.id) as message_count
     FROM guardian_sessions s
     LEFT JOIN guardian_messages m ON s.id = m.session_id
     WHERE s.instance_id = $1
     GROUP BY s.id
     ORDER BY s.started_at DESC
     LIMIT $2`,
    [instanceId, limit]
  );

  return result.rows;
}

/**
 * Get conversation for a specific session
 */
export async function getSessionConversation(tenantId, sessionId) {
  // Get session and verify tenant ownership
  const sessionResult = await pool.query(
    `SELECT s.*, gi.tenant_id
     FROM guardian_sessions s
     JOIN guardian_instances gi ON s.instance_id = gi.id
     WHERE s.id = $1`,
    [sessionId]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('Session not found');
  }

  if (sessionResult.rows[0].tenant_id !== tenantId) {
    throw new Error('Unauthorized');
  }

  // Get messages
  const messagesResult = await pool.query(
    `SELECT * FROM guardian_messages
     WHERE session_id = $1
     ORDER BY created_at ASC`,
    [sessionId]
  );

  return {
    session: sessionResult.rows[0],
    messages: messagesResult.rows
  };
}

/**
 * Validate widget token and get instance
 */
export async function validateWidgetToken(token) {
  const result = await pool.query(
    `SELECT gi.*, t.name as tenant_name
     FROM guardian_instances gi
     JOIN tenants t ON gi.tenant_id = t.id
     WHERE gi.widget_token = $1 AND gi.status = 'active'`,
    [token]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
