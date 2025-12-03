/**
 * MODULE_DOMAINS Types
 */

export enum DomainType {
  INTERNAL_REGISTRAR = 'INTERNAL_REGISTRAR',
  EXTERNAL = 'EXTERNAL',
  DNS_ONLY = 'DNS_ONLY',
}

export enum Registrar {
  NAMESILO = 'NAMESILO',
  OTHER = 'OTHER',
  UNKNOWN = 'UNKNOWN',
}

export enum DomainStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  PENDING_TRANSFER = 'PENDING_TRANSFER',
  TRANSFER_OUT = 'TRANSFER_OUT',
  DNS_ONLY = 'DNS_ONLY',
}

export interface Domain {
  id: string;
  tenantId: string;
  name: string;
  type: DomainType;
  registrar: Registrar;
  expiryDate: Date | null;
  autoRenew: boolean;
  nameservers: string[];
  dnsZoneId: string | null;
  primaryWebsiteId: string | null;
  status: DomainStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportDomainRequest {
  name: string;
  nameservers?: string[];
  dnsHostedHere?: boolean;
}

export interface RegisterDomainRequest {
  name: string;
  years: number;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  nameservers?: string[];
}

export interface TransferDomainRequest {
  eppCode: string;
}

export interface UpdateNameserversRequest {
  nameservers: string[];
}
