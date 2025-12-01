/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * DNS Module Index - Exports all DNS services.
 * 
 * Uses PowerDNS as the DNS backend (not Cloudflare).
 * 
 * P0.2 FIX (Enterprise Hardening):
 * - Added dns.router.ts with RBAC middleware
 * - All routes require authentication
 * - BILLING+ can read, ADMIN+ can write
 * 
 * SCHEMA ALIGNMENT (2025-01):
 * - Domain model: id, tenantId, name (unique), status, autoDns, autoMail
 * - DnsZone model: id, tenantId, domainId (FK), pdnsId, soaSerial, isSynced
 * - DnsRecord model: id, zoneId (FK), name, type, content, ttl, priority
 */

export { default as dnsService } from './dns.service.js';
export { default as dnsRouter } from './dns.router.js';

// Re-export key functions
export {
  ensureDomain,
  applyDnsTemplateForCloudPod,
  provisionDnsZone,
  deleteDnsRecordsForCloudPod,
  getDnsRecordsForDomain,
  getDnsZone,
} from './dns.service.js';

// Re-export types
export type {
  EnsureDomainInput,
  EnsureDomainResult,
  ApplyDnsTemplateInput,
  ProvisionDnsZoneParams,
  DnsRecordType,
} from './dns.service.js';
