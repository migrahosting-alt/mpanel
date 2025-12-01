/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * DNS Module Index - Exports all DNS services.
 */

export { default as dnsService } from './dnsService.js';

// Re-export key functions
export {
  applyDnsTemplateForCloudPod,
  deleteDnsRecordsForCloudPod,
  getDnsRecordsForDomain,
} from './dnsService.js';
