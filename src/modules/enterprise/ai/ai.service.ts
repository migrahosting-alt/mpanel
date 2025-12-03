/**
 * ENTERPRISE AI FEATURES Service
 * Centralized AiClientService for all modules
 */

import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import type {
  AiProviderConfig,
  AiUsageRecord,
  CreateAiConfigRequest,
  AiCompletionRequest,
  AiUsageStats,
} from './ai.types.js';

// Provider Config
export async function getActiveConfig(actorTenantId: string): Promise<AiProviderConfig | null> {
  try {
    // @ts-ignore
    const config = await prisma.aiProviderConfig.findFirst({
      where: { tenantId: actorTenantId, isActive: true },
    });
    return config;
  } catch {
    return null;
  }
}

export async function createConfig(
  data: CreateAiConfigRequest,
  actorTenantId: string
): Promise<AiProviderConfig> {
  const {
    provider,
    apiKey,
    baseUrl,
    defaultModel,
    maxTokensPerRequest = 4096,
    monthlyTokenBudget,
  } = data;

  // Deactivate existing configs
  try {
    // @ts-ignore
    await prisma.aiProviderConfig.updateMany({
      where: { tenantId: actorTenantId },
      data: { isActive: false },
    });
  } catch {}

  // @ts-ignore
  const config = await prisma.aiProviderConfig.create({
    data: {
      tenantId: actorTenantId,
      provider,
      apiKey, // TODO: Encrypt
      baseUrl: baseUrl || null,
      defaultModel,
      maxTokensPerRequest,
      monthlyTokenBudget: monthlyTokenBudget || null,
      isActive: true,
    },
  });

  logger.info('AI provider config created', { configId: config.id, provider });

  return config;
}

export async function deleteConfig(id: string, actorTenantId: string): Promise<void> {
  // @ts-ignore
  await prisma.aiProviderConfig.deleteMany({
    where: { id, tenantId: actorTenantId },
  });

  logger.info('AI provider config deleted', { configId: id });
}

// AI Completion
export async function generateCompletion(
  data: AiCompletionRequest,
  actorTenantId: string
): Promise<{ text: string; tokensUsed: number }> {
  const { feature, prompt, model, maxTokens } = data;

  const config = await getActiveConfig(actorTenantId);
  if (!config) {
    throw new Error('No active AI provider configured');
  }

  // Check budget
  const stats = await getUsageStats(actorTenantId);
  if (config.monthlyTokenBudget && stats.budgetRemaining !== null && stats.budgetRemaining <= 0) {
    throw new Error('Monthly token budget exceeded');
  }

  // TODO: Call actual AI provider API
  const mockResponse = {
    text: `[AI Response for: ${prompt.slice(0, 50)}...]`,
    promptTokens: 100,
    completionTokens: 50,
  };

  // Record usage
  // @ts-ignore
  await prisma.aiUsageRecord.create({
    data: {
      tenantId: actorTenantId,
      configId: config.id,
      feature,
      model: model || config.defaultModel,
      promptTokens: mockResponse.promptTokens,
      completionTokens: mockResponse.completionTokens,
      totalTokens: mockResponse.promptTokens + mockResponse.completionTokens,
      costUsd: null, // Calculate based on model pricing
      metadata: { prompt: prompt.slice(0, 100) },
    },
  });

  logger.info('AI completion generated', {
    feature,
    tokensUsed: mockResponse.promptTokens + mockResponse.completionTokens,
  });

  return {
    text: mockResponse.text,
    tokensUsed: mockResponse.promptTokens + mockResponse.completionTokens,
  };
}

// Usage Stats
export async function getUsageStats(actorTenantId: string): Promise<AiUsageStats> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  try {
    // @ts-ignore
    const records = await prisma.aiUsageRecord.findMany({
      where: {
        tenantId: actorTenantId,
        createdAt: { gte: startOfMonth },
      },
    });

    const currentMonthTokens = records.reduce((sum: number, r: any) => sum + r.totalTokens, 0);
    const currentMonthCostUsd = records.reduce(
      (sum: number, r: any) => sum + (r.costUsd || 0),
      0
    );

    const config = await getActiveConfig(actorTenantId);
    const budgetRemaining = config?.monthlyTokenBudget
      ? config.monthlyTokenBudget - currentMonthTokens
      : null;

    // Group by feature
    const featureMap: Record<string, number> = {};
    records.forEach((r: any) => {
      featureMap[r.feature] = (featureMap[r.feature] || 0) + r.totalTokens;
    });

    const topFeatures = Object.entries(featureMap)
      .map(([feature, tokens]) => ({ feature, tokens }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    return {
      currentMonthTokens,
      currentMonthCostUsd,
      budgetRemaining,
      topFeatures,
    };
  } catch {
    return {
      currentMonthTokens: 0,
      currentMonthCostUsd: 0,
      budgetRemaining: null,
      topFeatures: [],
    };
  }
}

export async function listUsageRecords(actorTenantId: string): Promise<AiUsageRecord[]> {
  try {
    // @ts-ignore
    const records = await prisma.aiUsageRecord.findMany({
      where: { tenantId: actorTenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return records;
  } catch {
    return [];
  }
}
