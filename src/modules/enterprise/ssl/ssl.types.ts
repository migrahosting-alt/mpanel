/**
 * ENTERPRISE SSL CERTIFICATES Types
 * Multi-tenant SSL lifecycle (issue, renew, revoke, delete)
 */

export enum SslCertificateType {
  LETS_ENCRYPT = 'LETS_ENCRYPT',
  CUSTOM = 'CUSTOM',
}

export enum SslCertificateStatus {
  PENDING = 'PENDING',
  ISSUED = 'ISSUED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum SslManagedBy {
  AUTO = 'AUTO',
  MANUAL = 'MANUAL',
}

export enum SslChallengeMethod {
  HTTP_01 = 'HTTP_01',
  DNS_01 = 'DNS_01',
}

export enum SslChallengeStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
}

export interface SslCertificate {
  id: string;
  tenantId: string;
  type: SslCertificateType;
  commonName: string;
  altNames: string[];
  status: SslCertificateStatus;
  managedBy: SslManagedBy;
  issuedAt: Date | null;
  expiresAt: Date | null;
  storageKey: string | null; // MinIO path
  attachedServers: Record<string, any> | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SslChallenge {
  id: string;
  certificateId: string;
  method: SslChallengeMethod;
  token: string;
  value: string;
  status: SslChallengeStatus;
  createdAt: Date;
  validatedAt: Date | null;
}

export interface IssueCertificateRequest {
  domains: string[];
  challengeType: SslChallengeMethod;
  targetServerId?: string;
  autoRenew?: boolean;
}

export interface UploadCustomCertificateRequest {
  commonName: string;
  certificate: string; // PEM
  privateKey: string; // PEM
  chain?: string; // PEM
  targetServerId?: string;
}

export interface RenewCertificateRequest {
  force?: boolean;
}
