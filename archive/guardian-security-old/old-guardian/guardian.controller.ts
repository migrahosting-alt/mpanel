/**
 * Guardian Controller - AI assistant management
 */

import { Request, Response } from 'express';
import * as guardianService from './guardian.service.js';
import { writeAuditEvent } from '../security/auditService.js';
import logger from '../../config/logger.js';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}

/**
 * GET /api/guardian/instances - List instances
 */
export async function listInstances(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const instances = await guardianService.listInstancesForTenant(tenantId);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId,
      type: 'GUARDIAN_INSTANCES_LISTED',
      metadata: { count: instances.length },
    });

    return res.json({
      success: true,
      data: instances,
    });
  } catch (error) {
    logger.error('Error listing Guardian instances', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list instances',
    });
  }
}

/**
 * POST /api/guardian/instances - Create instance
 */
export async function createInstance(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.user!.tenantId;
    const actorUserId = req.user!.id;

    const {
      name,
      widgetTitle,
      widgetSubtitle,
      assistantName,
      primaryColor,
      llmProvider,
      llmModel,
      maxMessagesPerDay,
      enableVoiceInput,
      gatewayUrl,
    } = req.body;

    if (!name || !widgetTitle || !assistantName || !llmProvider || !llmModel || !gatewayUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
    }

    const instance = await guardianService.createInstance({
      tenantId,
      name,
      widgetTitle,
      widgetSubtitle,
      assistantName,
      primaryColor: primaryColor || '#3B82F6',
      llmProvider,
      llmModel,
      maxMessagesPerDay,
      enableVoiceInput,
      gatewayUrl,
    });

    await writeAuditEvent({
      actorUserId,
      tenantId,
      type: 'GUARDIAN_INSTANCE_CREATED',
      metadata: {
        instanceId: instance.id,
        name: instance.name,
      },
    });

    return res.status(201).json({
      success: true,
      data: instance,
    });
  } catch (error) {
    logger.error('Error creating Guardian instance', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to create instance',
    });
  }
}

/**
 * GET /api/guardian/instances/:id - Get instance
 */
export async function getInstance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const instance = await guardianService.listInstancesForTenant(tenantId);
    const found = instance.find((i) => i.id === id);

    if (!found) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found',
      });
    }

    return res.json({
      success: true,
      data: found,
    });
  } catch (error) {
    logger.error('Error getting Guardian instance', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get instance',
    });
  }
}

/**
 * PATCH /api/guardian/instances/:id - Update instance
 */
export async function updateInstance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const instance = await guardianService.updateInstance(id, req.body);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: req.user!.tenantId,
      type: 'GUARDIAN_INSTANCE_UPDATED',
      metadata: { instanceId: id },
    });

    return res.json({
      success: true,
      data: instance,
    });
  } catch (error) {
    logger.error('Error updating Guardian instance', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to update instance',
    });
  }
}

/**
 * POST /api/guardian/instances/:id/disable - Disable instance
 */
export async function disableInstance(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const instance = await guardianService.disableInstance(id);

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: req.user!.tenantId,
      type: 'GUARDIAN_INSTANCE_DISABLED',
      metadata: { instanceId: id },
    });

    return res.json({
      success: true,
      data: instance,
    });
  } catch (error) {
    logger.error('Error disabling Guardian instance', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to disable instance',
    });
  }
}

/**
 * GET /api/guardian/instances/:id/embed - Get embed config
 */
export async function getEmbedConfig(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const config = await guardianService.getEmbedConfig(id);

    if (!config) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found or inactive',
      });
    }

    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: req.user!.tenantId,
      type: 'GUARDIAN_EMBED_VIEWED',
      metadata: { instanceId: id },
    });

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Error getting embed config', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get embed config',
    });
  }
}

export default {
  listInstances,
  createInstance,
  getInstance,
  updateInstance,
  disableInstance,
  getEmbedConfig,
};
