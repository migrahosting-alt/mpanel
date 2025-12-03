/**
 * ENTERPRISE KUBERNETES Types
 * External cluster registration and health tracking
 */

export enum ClusterStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export interface KubernetesCluster {
  id: string;
  tenantId: string;
  name: string;
  kubeconfig: string; // Encrypted
  apiServerUrl: string;
  version: string | null;
  status: ClusterStatus;
  lastHealthCheckAt: Date | null;
  nodeCount: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClusterHealth {
  status: ClusterStatus;
  nodeCount: number;
  namespaceCount: number;
  podCount: number;
  checkedAt: Date;
}

export interface RegisterClusterRequest {
  name: string;
  kubeconfig: string;
}
