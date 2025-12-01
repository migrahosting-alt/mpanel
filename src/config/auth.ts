import * as jwt from 'jsonwebtoken';
import { env } from './env.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// ============================================
// TOKEN GENERATION
// ============================================

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'mpanel',
    audience: 'mpanel-api',
  } as any);
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(
    { userId: payload.userId, tenantId: payload.tenantId },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: 'mpanel',
      audience: 'mpanel-refresh',
    } as any
  );
}

export function generateTokenPair(payload: JwtPayload): TokenPair {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

// ============================================
// TOKEN VERIFICATION
// ============================================

export function verifyAccessToken(token: string): JwtPayload {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mpanel',
      audience: 'mpanel-api',
    });
    
    if (typeof payload === 'string') {
      throw new Error('Invalid token payload');
    }
    
    return payload as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

export function verifyRefreshToken(token: string): { userId: string; tenantId: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'mpanel',
      audience: 'mpanel-refresh',
    });
    
    if (typeof payload === 'string') {
      throw new Error('Invalid refresh token payload');
    }
    
    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

// ============================================
// TOKEN EXTRACTION
// ============================================

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

// ============================================
// PASSWORD HASHING
// ============================================

import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// TYPES
// ============================================

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'BILLING' | 'READ_ONLY';

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy: Record<UserRole, number> = {
    SUPER_ADMIN: 5,
    ADMIN: 4,
    BILLING: 3,
    SUPPORT: 2,
    READ_ONLY: 1,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}
