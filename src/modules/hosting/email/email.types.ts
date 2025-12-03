/**
 * MODULE_EMAIL Types
 */

export enum EmailDomainStatus {
  PENDING_DNS = 'PENDING_DNS',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum EmailMxMode {
  CENTRAL_MAIL_MIGRAHOSTING_ONLY = 'CENTRAL_MAIL_MIGRAHOSTING_ONLY',
}

export enum EmailAccountStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETING = 'DELETING',
}

export interface EmailDomain {
  id: string;
  tenantId: string;
  domainId: string;
  status: EmailDomainStatus;
  mxMode: EmailMxMode;
  spamPolicy: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAccount {
  id: string;
  emailDomainId: string;
  address: string; // "support"
  fullAddress: string; // "support@example.com"
  displayName: string | null;
  quotaMb: number;
  usageMb: number;
  status: EmailAccountStatus;
  forwardTo: string[];
  aliases: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEmailDomainRequest {
  domainId: string;
  spamPolicy?: Record<string, any>;
}

export interface CreateEmailAccountRequest {
  address: string;
  displayName?: string;
  quotaMb: number;
  password: string;
}
