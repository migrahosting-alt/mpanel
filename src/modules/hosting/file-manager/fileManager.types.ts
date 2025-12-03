/**
 * MODULE_FILE_MANAGER Types
 */

export type FileNodeType = 'file' | 'dir' | 'symlink';

export type FileOperation =
  | 'move'
  | 'copy'
  | 'delete'
  | 'chmod'
  | 'chown'
  | 'compress'
  | 'extract'
  | 'create_file'
  | 'create_directory';

export interface FileNode {
  name: string;
  type: FileNodeType;
  sizeBytes: number;
  modifiedAt: string;
  permissions: string;
}

export interface BrowseQuery {
  serverId: string;
  root: string; // websiteId or cloudpodId
  path: string; // relative within root
}

export interface FileOperationRequest {
  operation: FileOperation;
  args: Record<string, any>;
}

export interface FileOperationJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message: string | null;
}
