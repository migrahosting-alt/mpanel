/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Users Module Index - Exports user service.
 */

export { default as userService } from './userService.js';

// Re-export key functions
export {
  getOrCreateUserForEmail,
  getUserById,
  getUserByEmail,
  getUserTenants,
  userBelongsToTenant,
  updateUser,
  updateLastLogin,
} from './userService.js';

// Re-export types
export type {
  User,
  UserTenant,
  CreateUserOptions,
} from './userService.js';
