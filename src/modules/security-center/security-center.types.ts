/**
 * SECURITY CENTER Types
 * User security profiles, MFA, sessions, API tokens
 */

export enum MfaMethod {
  TOTP = 'TOTP',
  FIDO2 = 'FIDO2',
  BACKUP_CODE = 'BACKUP_CODE',
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export enum ApiTokenScope {
  READ = 'READ',
  WRITE = 'WRITE',
  ADMIN = 'ADMIN',
  BILLING = 'BILLING',
  PROVISIONING = 'PROVISIONING',
  SECURITY = 'SECURITY',
}

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
  TOKEN_CREATED = 'TOKEN_CREATED',
  TOKEN_REVOKED = 'TOKEN_REVOKED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  POLICY_UPDATED = 'POLICY_UPDATED',
}

export interface UserSecurityProfile {
  userId: string;
  mfaEnabled: boolean;
  mfaMethods: MfaMethod[];
  totpSecret?: string | null;
  fido2Credentials?: any[];
  recoveryCodes?: string[];
  lastPasswordChange: Date | null;
  passwordExpiresAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  trustedIps: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  tenantId: string | null;
  status: SessionStatus;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string | null;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

export interface ApiToken {
  id: string;
  userId: string;
  tenantId: string | null;
  name: string;
  tokenHash: string;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface SecurityEvent {
  id: string;
  tenantId: string | null;
  userId: string | null;
  eventType: SecurityEventType;
  ipAddress: string;
  userAgent: string;
  metadata: any;
  timestamp: Date;
}

export interface TenantSecurityPolicy {
  tenantId: string;
  requireMfa: boolean;
  requireStrongPasswords: boolean;
  passwordMinLength: number;
  passwordExpiryDays: number | null;
  sessionTimeoutMinutes: number;
  allowedIps: string[];
  maxFailedLogins: number;
  lockoutDurationMinutes: number;
  updatedBy: string;
  updatedAt: Date;
}

// Request types
export interface EnableMfaRequest {
  method: MfaMethod;
  totpSecret?: string;
  fido2Credential?: any;
}

export interface ConfirmMfaRequest {
  code: string;
}

export interface CreateApiTokenRequest {
  name: string;
  scopes: ApiTokenScope[];
  expiresInDays?: number;
}

export interface UpdateSecurityPolicyRequest {
  requireMfa?: boolean;
  requireStrongPasswords?: boolean;
  passwordMinLength?: number;
  passwordExpiryDays?: number | null;
  sessionTimeoutMinutes?: number;
  allowedIps?: string[];
  maxFailedLogins?: number;
  lockoutDurationMinutes?: number;
}
