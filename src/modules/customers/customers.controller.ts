/**
 * Customers Controller - Platform-level tenant management
 */

import { Request, Response } from 'express';
import * as customersService from './customers.service.js';
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
 * GET /api/platform/customers - List all customers
 * RBAC: PLATFORM_ADMIN only
 */
export async function listCustomers(req: AuthRequest, res: Response) {
  try {
    const { page, pageSize, search, status } = req.query;

    const result = await customersService.listCustomers({
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
      search: search as string,
      status: status as string,
    });

    // Audit
    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_CUSTOMERS_LISTED',
      metadata: {
        resultCount: result.customers.length,
        total: result.total,
      },
    });

    return res.json({
      success: true,
      data: result.customers,
      pagination: {
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
        total: result.total,
        totalPages: Math.ceil(result.total / (pageSize ? parseInt(pageSize as string) : 50)),
      },
    });
  } catch (error) {
    logger.error('Error listing customers', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to list customers',
    });
  }
}

/**
 * GET /api/platform/customers/:tenantId - Get customer overview
 * RBAC: PLATFORM_ADMIN only
 */
export async function getCustomerOverview(req: AuthRequest, res: Response) {
  try {
    const tenantId = req.params.tenantId;

    const overview = await customersService.getCustomerOverview(tenantId);

    if (!overview) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }

    // Audit
    await writeAuditEvent({
      actorUserId: req.user!.id,
      tenantId: null,
      type: 'PLATFORM_CUSTOMER_VIEWED',
      metadata: {
        viewedTenantId: tenantId,
      },
    });

    return res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    logger.error('Error getting customer overview', { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to get customer overview',
    });
  }
}

export default {
  listCustomers,
  getCustomerOverview,
};
