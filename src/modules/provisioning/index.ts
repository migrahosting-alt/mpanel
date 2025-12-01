/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Provisioning Module Index - Exports all provisioning services and workers.
 */

export { default as queue } from './queue.js';
export { default as serverSelectionService } from './serverSelectionService.js';
export { default as createCloudPodWorker } from './workers/createCloudPodWorker.js';
export { default as issueSslWorker } from './workers/issueSslWorker.js';

// Re-export queue functions
export {
  enqueueCreateCloudPodJob,
  enqueueScaleCloudPodJob,
  enqueueDestroyCloudPodJob,
  enqueueIssueSslJob,
  enqueueBackupCloudPodJob,
} from './queue.js';

// Re-export worker functions
export { processCreateCloudPodJob } from './workers/createCloudPodWorker.js';
export { processIssueSslJob, renewExpiringCertificates } from './workers/issueSslWorker.js';

// Re-export server selection functions
export {
  selectServerForCloudPod,
  getServerSshCommand,
  updateServerAllocation,
  getServerById,
  getAllServers,
  checkServerHealth,
  getServerResourceUsage,
  syncServerAllocations,
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
