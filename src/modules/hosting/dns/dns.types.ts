/**
 * MODULE_DNS Types
 * PowerDNS zone and record management
 */

export enum DnsZoneStatus {
  ACTIVE = 'ACTIVE',
  SYNCING = 'SYNCING',
  ERROR = 'ERROR',
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA' | 'SRV' | 'CAA';

export enum DnsRecordFlag {
  SYSTEM_LOCKED = 'SYSTEM_LOCKED',
}

export interface DnsZone {
  id: string;
  tenantId: string;
  domainId: string;
  name: string; // example.com.
  type: string; // MASTER
  soa: Record<string, any> | null;
  status: DnsZoneStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DnsRecord {
  id: string;
  zoneId: string;
  name: string; // www.example.com.
  type: DnsRecordType;
  content: string;
  ttl: number;
  priority: number | null;
  flags: DnsRecordFlag[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateZoneRequest {
  domainId?: string;
  name?: string;
  preset?: 'STANDARD_MIGRAHOSTING' | 'BLANK';
}

export interface CreateRecordRequest {
  name: string;
  type: DnsRecordType;
  content: string;
  ttl?: number;
  priority?: number;
}

export interface UpdateRecordRequest {
  content?: string;
  ttl?: number;
  priority?: number;
}
