/**
 * ENTERPRISE API KEYS & WEBHOOKS Types
 * Secure programmatic access with HMAC signatures
 */

export enum ApiKeyStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum WebhookEventType {
  SERVER_PROVISIONED = 'server.provisioned',
  WEBSITE_DEPLOYED = 'website.deployed',
  SSL_ISSUED = 'ssl.issued',
  BACKUP_COMPLETED = 'backup.completed',
  CUSTOM = 'custom',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  keyPrefix: string; // mgh_live_xxxx
  keyHashedSecret: string; // bcrypt/Argon2
  scopes: string[];
  status: ApiKeyStatus;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string;
  events: WebhookEventType[];
  secret: string; // HMAC key
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  endpointId: string;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastAttemptAt: Date | null;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expiresInDays?: number;
}

export interface CreateWebhookRequest {
  url: string;
  events: WebhookEventType[];
}

export interface TriggerWebhookRequest {
  eventType: WebhookEventType;
  payload: Record<string, any>;
}
