/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Users Module Index - Exports user service.
 * 
 * P0.1/P0.4 FIX: Added tenant-scoped user access and bcrypt password helpers.
 */

export { default as userService } from './userService.js';

// Re-export key functions
export {
  getOrCreateUserForEmail,
  getUserById,
  getUserByEmail,
  getUserTenants,
  userBelongsToTenant,
  getUserTenantRole,
  updateUser,
  recordUserLogin,
  deleteUser,
  // P0.1: Tenant-scoped user access
  listUsersForTenant,
  getUserForTenant,
  verifyUserInTenant,
  // P0.4: Password helpers (bcrypt)
  hashPassword,
  verifyPassword,
  verifyPasswordWithMigration,
} from './userService.js';

// Re-export types
export type {
  User,
  CreateUserInput,
  TenantUserInfo,
} from './userService.js';
