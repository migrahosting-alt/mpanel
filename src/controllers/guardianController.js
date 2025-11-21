/**
 * Guardian Controller
 * Handles AFM Guardian instance management
 */

import * as guardianService from '../services/guardianService.js';
import logger from '../config/logger.js';

/**
 * Create a new Guardian instance
 */
export async function createInstance(req, res) {
  try {
    const { tenantId } = req.user;
    const instance = await guardianService.createGuardianInstance(tenantId, req.body);

    res.status(201).json({
      success: true,
      data: instance,
      message: 'Guardian instance created successfully'
    });
  } catch (error) {
    logger.error('Error creating Guardian instance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create Guardian instance',
      message: error.message
    });
  }
}

/**
 * List all Guardian instances
 */
export async function listInstances(req, res) {
  try {
    const { tenantId } = req.user;
    const { customerId, status, limit, offset } = req.query;

    const result = await guardianService.listGuardianInstances(tenantId, {
      customerId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      data: result.instances || [],
      total: result.total || 0,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error) {
    logger.error('Error listing Guardian instances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list Guardian instances',
      message: error.message
    });
  }
}

/**
 * Get a specific Guardian instance
 */
export async function getInstance(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const instance = await guardianService.getGuardianInstance(tenantId, id);

    res.json({
      success: true,
      data: instance
    });
  } catch (error) {
    logger.error('Error getting Guardian instance:', error);
    const status = error.message === 'Guardian instance not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update Guardian instance
 */
export async function updateInstance(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const instance = await guardianService.updateGuardianInstance(tenantId, id, req.body);

    res.json({
      success: true,
      data: instance,
      message: 'Guardian instance updated successfully'
    });
  } catch (error) {
    logger.error('Error updating Guardian instance:', error);
    const status = error.message === 'Guardian instance not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Delete Guardian instance
 */
export async function deleteInstance(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const result = await guardianService.deleteGuardianInstance(tenantId, id);

    res.json({
      success: true,
      data: result,
      message: 'Guardian instance deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting Guardian instance:', error);
    const status = error.message === 'Guardian instance not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Regenerate widget token
 */
export async function regenerateToken(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const instance = await guardianService.regenerateWidgetToken(tenantId, id);

    res.json({
      success: true,
      data: {
        instanceId: instance.id,
        widgetToken: instance.widget_token
      },
      message: 'Widget token regenerated successfully'
    });
  } catch (error) {
    logger.error('Error regenerating widget token:', error);
    const status = error.message === 'Guardian instance not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get analytics for an instance
 */
export async function getAnalytics(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    const analytics = await guardianService.getGuardianAnalytics(tenantId, id, {
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Error getting Guardian analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get session history for an instance
 */
export async function getSessionHistory(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { limit } = req.query;

    const sessions = await guardianService.getSessionHistory(
      tenantId,
      id,
      limit ? parseInt(limit) : undefined
    );

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    logger.error('Error getting session history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get conversation for a session
 */
export async function getSessionConversation(req, res) {
  try {
    const { tenantId } = req.user;
    const { sessionId } = req.params;

    const conversation = await guardianService.getSessionConversation(tenantId, sessionId);

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    logger.error('Error getting session conversation:', error);
    const status = error.message === 'Session not found' || error.message === 'Unauthorized' ? 404 : 500;
    res.status(status).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Widget embed code generator
 */
export async function getEmbedCode(req, res) {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const instance = await guardianService.getGuardianInstance(tenantId, id);

    const embedCode = `<!-- Migra AFM Guardian Chat Widget -->
<script>
  window.MigraGuardianConfig = {
    token: '${instance.widget_token}',
    gatewayUrl: '${instance.gateway_url}',
    title: '${instance.widget_title}',
    subtitle: '${instance.widget_subtitle || ''}',
    primaryColor: '${instance.primary_color}',
    assistantName: '${instance.assistant_name}',
    avatarUrl: '${instance.avatar_url || ''}',
    enableVoice: ${instance.enable_voice}
  };
</script>
<script src="https://migrapanel.com/guardian/widget.js" async></script>`;

    res.json({
      success: true,
      data: {
        embedCode,
        widgetToken: instance.widget_token,
        gatewayUrl: instance.gateway_url
      }
    });
  } catch (error) {
    logger.error('Error generating embed code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
