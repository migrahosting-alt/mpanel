/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Security Module Index - Exports audit service.
 */

export { default as auditService } from './auditService.js';

// Re-export key functions
export {
  writeAuditEvent,
  createAuditContext,
  getAuditEvents,
} from './auditService.js';

// Re-export types
export type {
  AuditEvent,
  AuditEventType,
  WriteAuditEventInput,
  AuditContext,
} from './auditService.js';
