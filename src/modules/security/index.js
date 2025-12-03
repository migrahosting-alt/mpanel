/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Security Module Index - Exports audit and RBAC services.
 */

export { default as auditService } from './auditService.js';
export { default as rbacService } from './rbacService.js';

// Re-export audit functions
export {
  writeAuditEvent,
  createAuditContext,
  getAuditEvents,
} from './auditService.js';

// Re-export RBAC functions
export {
  hasPermission,
  hasPlatformPermission,
  requireTenantPermission,
  requirePlatformPermission,
  userBelongsToTenant,
  getUserTenants,
  tenantScope,
  getTenantIdFromUser,
  requirePermission,
  requireTenantContext,
  requirePlatformAdmin,
} from './rbacService.js';

// Re-export types
export type {
  AuditEventType,
  AuditEventInput,
  GetAuditEventsOptions,
} from './auditService.js';

export type {
  RbacUser,
  PermissionCheck,
} from './rbacService.js';
