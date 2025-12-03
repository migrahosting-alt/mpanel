/**
 * ENTERPRISE PREMIUM TOOLS SUITE Types
 * Integrations with 33 existing endpoints
 */

export enum ToolCategory {
  INTEGRATION = 'INTEGRATION',
  SEO = 'SEO',
  INSTALLER = 'INSTALLER',
  AI_BUILDER = 'AI_BUILDER',
}

export interface PremiumTool {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  endpoint: string;
  icon: string | null;
  isEnabled: boolean;
}

export interface ToolUsageRecord {
  id: string;
  tenantId: string;
  toolId: string;
  feature: string;
  metadata: Record<string, any> | null;
  createdBy: string;
  createdAt: Date;
}

export interface ExecuteToolRequest {
  toolId: string;
  action: string;
  params: Record<string, any>;
}
