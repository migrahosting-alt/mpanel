/**
 * ENTERPRISE AI FEATURES Types
 * Centralized AI provider config with usage metering
 */

export enum AiProvider {
  OPENAI = 'OPENAI',
  CUSTOM = 'CUSTOM',
}

export enum AiModel {
  GPT_4 = 'GPT_4',
  GPT_35_TURBO = 'GPT_35_TURBO',
  CUSTOM = 'CUSTOM',
}

export interface AiProviderConfig {
  id: string;
  tenantId: string;
  provider: AiProvider;
  apiKey: string; // Encrypted
  baseUrl: string | null;
  defaultModel: AiModel;
  maxTokensPerRequest: number;
  monthlyTokenBudget: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AiUsageRecord {
  id: string;
  tenantId: string;
  configId: string;
  feature: string; // 'code-gen', 'chat', 'analysis'
  model: AiModel;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateAiConfigRequest {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  defaultModel: AiModel;
  maxTokensPerRequest?: number;
  monthlyTokenBudget?: number;
}

export interface AiCompletionRequest {
  feature: string;
  prompt: string;
  model?: AiModel;
  maxTokens?: number;
}

export interface AiUsageStats {
  currentMonthTokens: number;
  currentMonthCostUsd: number;
  budgetRemaining: number | null;
  topFeatures: Array<{ feature: string; tokens: number }>;
}
