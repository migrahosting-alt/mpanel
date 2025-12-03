/**
 * ENTERPRISE APP INSTALLER Types
 * One-click installations (WordPress, Joomla, Drupal, etc.)
 */

export enum AppTemplate {
  WORDPRESS = 'WORDPRESS',
  JOOMLA = 'JOOMLA',
  DRUPAL = 'DRUPAL',
  PRESTASHOP = 'PRESTASHOP',
  MAGENTO = 'MAGENTO',
  NEXTCLOUD = 'NEXTCLOUD',
  MOODLE = 'MOODLE',
  GHOST = 'GHOST',
}

export enum AppInstallStatus {
  PENDING = 'PENDING',
  INSTALLING = 'INSTALLING',
  INSTALLED = 'INSTALLED',
  FAILED = 'FAILED',
}

export interface AppInstallerTemplate {
  id: string;
  slug: AppTemplate;
  name: string;
  description: string;
  version: string;
  requirements: {
    php?: string;
    mysql?: boolean;
    postgresql?: boolean;
    minDiskMb?: number;
    minMemoryMb?: number;
  };
  installSteps: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppInstall {
  id: string;
  tenantId: string;
  templateSlug: AppTemplate;
  websiteId: string;
  databaseId: string | null;
  installPath: string;
  status: AppInstallStatus;
  installUrl: string | null;
  adminUsername: string | null;
  adminPassword: string | null; // Encrypted
  metadata: Record<string, any> | null;
  installedAt: Date | null;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InstallAppRequest {
  templateSlug: AppTemplate;
  websiteId: string;
  installPath?: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  siteName?: string;
}
