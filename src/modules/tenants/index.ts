/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Tenants Module Index - Exports tenant service.
 */

export { default as tenantService } from './tenantService.js';

// Re-export key functions
export {
  getOrCreateTenantForUser,
  getTenantById,
  getTenantBySlug,
  suspendTenant,
  unsuspendTenant,
  addUserToTenant,
  removeUserFromTenant,
  setUserTenantRole,
  getTenantUsers,
} from './tenantService.js';

// Re-export types
export type {
  Tenant,
  TenantUser,
} from './tenantService.js';
