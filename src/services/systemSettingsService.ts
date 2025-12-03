/**
 * System Settings Service
 * 
 * Central typed access to system settings.
 * All services (CloudPods, workers, etc.) MUST use this service
 * instead of reading raw database values or hardcoding thresholds.
 */

import { prisma } from '../config/database.js';

export class SystemSettingsService {
  // Simple in-memory cache to reduce DB hits
  private static cache = new Map<string, { value: unknown; loadedAt: number }>();
  private static CACHE_TTL_MS = 60_000; // 1 minute

  private static makeKey(namespace: string, key: string) {
    return `${namespace}:${key}`;
  }

  private static isFresh(entry?: { loadedAt: number }) {
    if (!entry) return false;
    return Date.now() - entry.loadedAt < SystemSettingsService.CACHE_TTL_MS;
  }

  /**
   * Get raw string value from settings
   */
  static async getRaw(namespace: string, key: string): Promise<string | null> {
    const cacheKey = this.makeKey(namespace, key);
    const cached = this.cache.get(cacheKey);
    if (this.isFresh(cached)) {
      return cached!.value as string;
    }

    const row = await prisma.systemSetting.findUnique({
      where: { namespace_key: { namespace, key } },
    });

    if (!row) {
      this.cache.delete(cacheKey);
      return null;
    }

    this.cache.set(cacheKey, { value: row.value, loadedAt: Date.now() });
    return row.value;
  }

  /**
   * Get boolean value with default
   */
  static async getBoolean(namespace: string, key: string, defaultValue: boolean): Promise<boolean> {
    const raw = await this.getRaw(namespace, key);
    if (raw == null) return defaultValue;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return defaultValue;
  }

  /**
   * Get number value with default
   */
  static async getNumber(namespace: string, key: string, defaultValue: number): Promise<number> {
    const raw = await this.getRaw(namespace, key);
    if (raw == null) return defaultValue;
    const n = Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  }

  /**
   * Get string value with default
   */
  static async getString(namespace: string, key: string, defaultValue: string): Promise<string> {
    const raw = await this.getRaw(namespace, key);
    return raw ?? defaultValue;
  }

  /**
   * Get JSON value with default
   */
  static async getJson<T = unknown>(
    namespace: string,
    key: string,
    defaultValue: T,
  ): Promise<T> {
    const raw = await this.getRaw(namespace, key);
    if (raw == null) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a setting value
   */
  static async set(
    namespace: string,
    key: string,
    value: string,
    opts?: { userId?: string; valueType?: string },
  ) {
    const cacheKey = this.makeKey(namespace, key);
    const now = new Date();

    await prisma.systemSetting.upsert({
      where: { namespace_key: { namespace, key } },
      create: {
        namespace,
        key,
        value,
        valueType: opts?.valueType ?? 'string',
        updatedBy: opts?.userId ?? null,
        updatedAt: now,
      },
      update: {
        value,
        valueType: opts?.valueType,
        updatedBy: opts?.userId ?? null,
        updatedAt: now,
      },
    });

    this.cache.set(cacheKey, { value, loadedAt: Date.now() });
  }

  /**
   * Delete a setting
   */
  static async delete(namespace: string, key: string) {
    const cacheKey = this.makeKey(namespace, key);
    this.cache.delete(cacheKey);

    await prisma.systemSetting.delete({
      where: { namespace_key: { namespace, key } },
    }).catch(() => {
      // Ignore if not found
    });
  }

  /**
   * List all settings in a namespace
   */
  static async listByNamespace(namespace: string) {
    return prisma.systemSetting.findMany({
      where: { namespace },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Clear the cache (useful after bulk updates)
   */
  static clearCache() {
    this.cache.clear();
  }

  // ============================================
  // CloudPods Convenience Accessors
  // ============================================

  static async getCloudPodsAutoHealEnabled(): Promise<boolean> {
    return this.getBoolean('cloudpods', 'auto_heal.enabled', true);
  }

  static async getCloudPodsAutoHealFailureThreshold(): Promise<number> {
    return this.getNumber('cloudpods', 'auto_heal.failure_threshold', 3);
  }

  static async getCloudPodsBackupDefaultRetention(): Promise<number> {
    return this.getNumber('cloudpods', 'backup.default_retention_count', 7);
  }

  static async getCloudPodsMetricsIntervalSeconds(): Promise<number> {
    return this.getNumber('cloudpods', 'metrics.sample_interval_seconds', 300);
  }

  static async getCloudPodsAuditRetentionDays(): Promise<number> {
    return this.getNumber('cloudpods', 'audit.retention_days', 180);
  }

  static async getCloudPodsWebhookMaxAttempts(): Promise<number> {
    return this.getNumber('cloudpods', 'webhooks.max_attempts', 8);
  }

  static async getCloudPodsWebhookRetryDelaySeconds(): Promise<number> {
    return this.getNumber('cloudpods', 'webhooks.initial_retry_delay_seconds', 60);
  }

  // ============================================
  // Platform Convenience Accessors
  // ============================================

  static async getPlatformTimezone(): Promise<string> {
    return this.getString('platform', 'timezone', 'UTC');
  }

  static async getPlatformBrandName(): Promise<string> {
    return this.getString('platform', 'brand_name', 'MigraCloud');
  }

  static async getPlatformPrimaryColor(): Promise<string> {
    return this.getString('platform', 'primary_color', '#3B82F6');
  }

  // ============================================
  // Billing Convenience Accessors
  // ============================================

  static async getBillingCurrency(): Promise<string> {
    return this.getString('billing', 'default_currency', 'USD');
  }

  static async getBillingTaxRate(): Promise<number> {
    return this.getNumber('billing', 'default_tax_rate', 0);
  }
}

export default SystemSettingsService;
