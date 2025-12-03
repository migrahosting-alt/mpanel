/**
 * ENTERPRISE WHITE-LABEL Types
 * Per-tenant branding for resellers
 */

export interface WhiteLabelConfig {
  id: string;
  tenantId: string;
  companyName: string;
  logo: string | null; // MinIO path
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string | null;
  customCss: string | null;
  emailFromName: string;
  emailFromAddress: string;
  supportEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateWhiteLabelRequest {
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
  customCss?: string;
  emailFromName?: string;
  emailFromAddress?: string;
  supportEmail?: string;
}

export interface UploadAssetRequest {
  assetType: 'logo' | 'favicon';
  base64Data: string;
}
