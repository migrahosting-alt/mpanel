/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Provisioning Module Index - Exports all provisioning services and workers.
 * 
 * NOTE: Workers are not exported here because they have complex dependencies
 * (dns.service, etc). Import workers directly if needed for runtime.
 */

export { default as queue } from './queue.js';
export { default as serverSelectionService } from './serverSelectionService.js';

// NOTE: Workers commented out to avoid transitive dependencies on dns.service
// Import workers directly if needed at runtime:
//   import { processCreateCloudPodJob } from './workers/createCloudPodWorker.js';
//   import { processIssueSslJob } from './workers/issueSslWorker.js';

// Re-export queue functions
export {
  enqueueCreateCloudPodJob,
  enqueueScaleCloudPodJob,
  enqueueDestroyCloudPodJob,
  enqueueIssueSslJob,
  enqueueBackupCloudPodJob,
} from './queue.js';

// Re-export server selection functions
export {
  selectServerForCloudPod,
  getServerSshCommand,
  getServerById,
  getAllServers,
  checkServerHealth,
  getServerResourceUsage,
  getCloudPodUsageByTenant,
} from './serverSelectionService.js';

// Types
export type {
  CreateCloudPodJobPayload,
  ScaleCloudPodJobPayload,
  DestroyCloudPodJobPayload,
  IssueSslJobPayload,
  BackupCloudPodJobPayload,
  JobPayload,
  Job,
} from './queue.js';

export type {
  Server,
  ServerSelectionCriteria,
} from './serverSelectionService.js';
