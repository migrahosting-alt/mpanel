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
  reactivateTenant,  // renamed from unsuspendTenant
  addUserToTenant,
  removeUserFromTenant,
  getTenantUsers,
} from './tenantService.js';

// Re-export types
export type {
  Tenant,
  CreateTenantInput,
  TenantWithOwner,
} from './tenantService.js';
