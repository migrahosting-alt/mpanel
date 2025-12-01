import { Request } from 'express';

// Enterprise-grade: Use string for role to support both legacy JS routes and Prisma
// Valid roles: 'super_admin', 'admin', 'support', 'billing', 'read_only', 'customer'
export type UserRoleType = string;

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  accessToken?: string;
  refreshToken: string;
  user: UserInfo;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  token: string;
  accessToken?: string;
  refreshToken: string;
}

export interface UserInfo {
  id: string;
  email: string;
  displayName: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: UserRoleType;
  tenantId: string | null;
  isActive: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRoleType;
    tenantId: string | null;
  };
}
