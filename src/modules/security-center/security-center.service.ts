/**
 * SECURITY CENTER Service
 * MFA, sessions, API tokens, security events
 */

import prisma from '../../config/database.js';
import logger from '../../config/logger.js';
import crypto from 'crypto';
import {
  type UserSecurityProfile,
  type Session,
  type ApiToken,
  type SecurityEvent,
  type TenantSecurityPolicy,
  type EnableMfaRequest,
  type CreateApiTokenRequest,
  type UpdateSecurityPolicyRequest,
  SecurityEventType,
} from './security-center.types.js';

export async function getSecurityProfile(userId: string): Promise<UserSecurityProfile | null> {
  try {
    // @ts-ignore
    const profile = await prisma.userSecurityProfile.findFirst({
      where: { userId },
    });
    return profile;
  } catch {
    return null;
  }
}

export async function enableMfa(userId: string, data: EnableMfaRequest): Promise<{ secret?: string; recoveryCodes?: string[] }> {
  const { method, totpSecret } = data;

  // Generate TOTP secret if not provided
  const secret = totpSecret || crypto.randomBytes(20).toString('base64');
  
  // Generate 10 recovery codes
  const recoveryCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );

  // @ts-ignore
  await prisma.userSecurityProfile.upsert({
    where: { userId },
    create: {
      userId,
      mfaEnabled: false, // Not enabled until confirmed
      mfaMethods: [method],
      totpSecret: secret,
      recoveryCodes,
      lastPasswordChange: null,
      passwordExpiresAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      trustedIps: [],
    },
    update: {
      mfaMethods: [method],
      totpSecret: secret,
      recoveryCodes,
    },
  });

  await logSecurityEvent({
    userId,
    eventType: SecurityEventType.MFA_ENABLED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: { method },
  });

  logger.info('MFA setup initiated', { userId, method });

  return { secret, recoveryCodes };
}

export async function confirmMfa(userId: string): Promise<UserSecurityProfile> {
  // @ts-ignore
  const profile = await prisma.userSecurityProfile.update({
    where: { userId },
    data: {
      mfaEnabled: true,
    },
  });

  logger.info('MFA confirmed', { userId });

  return profile;
}

export async function disableMfa(userId: string): Promise<UserSecurityProfile> {
  // @ts-ignore
  const profile = await prisma.userSecurityProfile.update({
    where: { userId },
    data: {
      mfaEnabled: false,
      mfaMethods: [],
      totpSecret: null,
      recoveryCodes: [],
    },
  });

  await logSecurityEvent({
    userId,
    eventType: SecurityEventType.MFA_DISABLED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: {},
  });

  logger.info('MFA disabled', { userId });

  return profile;
}

export async function listSessions(userId: string): Promise<Session[]> {
  try {
    // @ts-ignore
    const sessions = await prisma.session.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { lastActivityAt: 'desc' },
    });
    return sessions;
  } catch {
    return [];
  }
}

export async function revokeSession(sessionId: string, revokedBy: string): Promise<Session> {
  // @ts-ignore
  const session = await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedBy,
    },
  });

  await logSecurityEvent({
    userId: session.userId,
    eventType: SecurityEventType.SESSION_REVOKED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: { sessionId },
  });

  logger.info('Session revoked', { sessionId });

  return session;
}

export async function revokeAllSessions(userId: string, exceptSessionId: string | null, revokedBy: string): Promise<number> {
  const where: any = { userId, status: 'ACTIVE' };
  if (exceptSessionId) {
    where.id = { not: exceptSessionId };
  }

  // @ts-ignore
  const result = await prisma.session.updateMany({
    where,
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revokedBy,
    },
  });

  logger.info('All sessions revoked', { userId, count: result.count });

  return result.count;
}

export async function listApiTokens(userId: string): Promise<ApiToken[]> {
  try {
    // @ts-ignore
    const tokens = await prisma.apiToken.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return tokens;
  } catch {
    return [];
  }
}

export async function createApiToken(userId: string, data: CreateApiTokenRequest): Promise<{ token: string; apiToken: ApiToken }> {
  const { name, scopes, expiresInDays } = data;

  // Generate token
  const tokenValue = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // @ts-ignore
  const apiToken = await prisma.apiToken.create({
    data: {
      userId,
      tenantId: null,
      name,
      tokenHash,
      scopes,
      expiresAt,
      lastUsedAt: null,
      isActive: true,
      revokedAt: null,
    },
  });

  await logSecurityEvent({
    userId,
    eventType: SecurityEventType.TOKEN_CREATED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: { tokenId: apiToken.id, scopes },
  });

  logger.info('API token created', { userId, tokenId: apiToken.id });

  return { token: tokenValue, apiToken };
}

export async function revokeApiToken(tokenId: string): Promise<ApiToken> {
  // @ts-ignore
  const token = await prisma.apiToken.update({
    where: { id: tokenId },
    data: {
      isActive: false,
      revokedAt: new Date(),
    },
  });

  await logSecurityEvent({
    userId: token.userId,
    eventType: SecurityEventType.TOKEN_REVOKED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: { tokenId },
  });

  logger.info('API token revoked', { tokenId });

  return token;
}

export async function listSecurityEvents(userId: string, limit = 50): Promise<SecurityEvent[]> {
  try {
    // @ts-ignore
    const events = await prisma.securityEvent.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return events;
  } catch {
    return [];
  }
}

export async function logSecurityEvent(event: {
  userId: string | null;
  eventType: SecurityEventType;
  ipAddress: string;
  userAgent: string;
  metadata: any;
}): Promise<void> {
  try {
    // @ts-ignore
    await prisma.securityEvent.create({
      data: {
        tenantId: null,
        userId: event.userId,
        eventType: event.eventType,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        metadata: event.metadata,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to log security event', { error });
  }
}

export async function getTenantSecurityPolicy(tenantId: string): Promise<TenantSecurityPolicy | null> {
  try {
    // @ts-ignore
    const policy = await prisma.tenantSecurityPolicy.findFirst({
      where: { tenantId },
    });
    return policy;
  } catch {
    return null;
  }
}

export async function updateTenantSecurityPolicy(
  tenantId: string,
  data: UpdateSecurityPolicyRequest,
  updatedBy: string
): Promise<TenantSecurityPolicy> {
  // @ts-ignore
  const policy = await prisma.tenantSecurityPolicy.upsert({
    where: { tenantId },
    create: {
      tenantId,
      requireMfa: data.requireMfa ?? false,
      requireStrongPasswords: data.requireStrongPasswords ?? true,
      passwordMinLength: data.passwordMinLength ?? 12,
      passwordExpiryDays: data.passwordExpiryDays ?? null,
      sessionTimeoutMinutes: data.sessionTimeoutMinutes ?? 60,
      allowedIps: data.allowedIps ?? [],
      maxFailedLogins: data.maxFailedLogins ?? 5,
      lockoutDurationMinutes: data.lockoutDurationMinutes ?? 30,
      updatedBy,
      updatedAt: new Date(),
    },
    update: {
      ...data,
      updatedBy,
      updatedAt: new Date(),
    },
  });

  await logSecurityEvent({
    userId: updatedBy,
    eventType: SecurityEventType.POLICY_UPDATED,
    ipAddress: '0.0.0.0',
    userAgent: 'system',
    metadata: { tenantId, changes: data },
  });

  logger.info('Security policy updated', { tenantId });

  return policy;
}
