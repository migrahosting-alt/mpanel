# CloudPods Usage Metering & Budget Alerts

## Overview

Comprehensive usage metering system for CloudPods that tracks resource consumption (CPU, memory, disk, bandwidth) at configurable intervals, aggregates data for billing and analytics, and provides budget alerting capabilities for cost control.

---

## Prisma Schema

```prisma
// Raw usage samples (high frequency, short retention)
model CloudPodUsageSample {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  sampleTime      DateTime  @map("sample_time")
  cpuPercent      Float?    @map("cpu_percent")
  memoryUsedMb    Int?      @map("memory_used_mb")
  memoryTotalMb   Int?      @map("memory_total_mb")
  diskUsedGb      Float?    @map("disk_used_gb")
  diskTotalGb     Float?    @map("disk_total_gb")
  networkInMb     Float?    @map("network_in_mb")
  networkOutMb    Float?    @map("network_out_mb")
  diskReadMb      Float?    @map("disk_read_mb")
  diskWriteMb     Float?    @map("disk_write_mb")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@index([podId, sampleTime])
  @@index([sampleTime])
  @@map("cloud_pod_usage_samples")
}

// Hourly aggregated usage
model CloudPodUsageHourly {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  hourStart       DateTime  @map("hour_start")
  cpuAvgPercent   Float?    @map("cpu_avg_percent")
  cpuMaxPercent   Float?    @map("cpu_max_percent")
  memoryAvgMb     Int?      @map("memory_avg_mb")
  memoryMaxMb     Int?      @map("memory_max_mb")
  diskAvgGb       Float?    @map("disk_avg_gb")
  networkInTotalMb Float?   @map("network_in_total_mb")
  networkOutTotalMb Float?  @map("network_out_total_mb")
  diskReadTotalMb Float?    @map("disk_read_total_mb")
  diskWriteTotalMb Float?   @map("disk_write_total_mb")
  sampleCount     Int       @default(0) @map("sample_count")
  uptimeMinutes   Int?      @map("uptime_minutes")

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@unique([podId, hourStart])
  @@index([hourStart])
  @@map("cloud_pod_usage_hourly")
}

// Daily aggregated usage (billing-friendly)
model CloudPodUsageDaily {
  id              Int       @id @default(autoincrement())
  podId           Int       @map("pod_id")
  date            DateTime  @db.Date
  cpuAvgPercent   Float?    @map("cpu_avg_percent")
  cpuMaxPercent   Float?    @map("cpu_max_percent")
  cpuP95Percent   Float?    @map("cpu_p95_percent")
  memoryAvgMb     Int?      @map("memory_avg_mb")
  memoryMaxMb     Int?      @map("memory_max_mb")
  diskAvgGb       Float?    @map("disk_avg_gb")
  diskMaxGb       Float?    @map("disk_max_gb")
  networkInTotalGb Float?   @map("network_in_total_gb")
  networkOutTotalGb Float?  @map("network_out_total_gb")
  diskIoTotalGb   Float?    @map("disk_io_total_gb")
  uptimeHours     Float?    @map("uptime_hours")
  estimatedCostUsd Decimal? @map("estimated_cost_usd") @db.Decimal(10, 4)

  pod             CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)

  @@unique([podId, date])
  @@index([date])
  @@map("cloud_pod_usage_daily")
}

// Monthly summary for billing
model CloudPodUsageMonthly {
  id                Int       @id @default(autoincrement())
  podId             Int       @map("pod_id")
  tenantId          Int       @map("tenant_id")
  yearMonth         String    @map("year_month") // '2025-01'
  cpuHours          Float?    @map("cpu_hours") // vCPU * hours
  memoryGbHours     Float?    @map("memory_gb_hours")
  diskGbHours       Float?    @map("disk_gb_hours")
  networkInGb       Float?    @map("network_in_gb")
  networkOutGb      Float?    @map("network_out_gb")
  totalUptimeHours  Float?    @map("total_uptime_hours")
  estimatedCostUsd  Decimal?  @map("estimated_cost_usd") @db.Decimal(10, 2)
  billedCostUsd     Decimal?  @map("billed_cost_usd") @db.Decimal(10, 2)
  invoiceId         Int?      @map("invoice_id")

  pod               CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)
  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([podId, yearMonth])
  @@index([tenantId, yearMonth])
  @@map("cloud_pod_usage_monthly")
}

// Tenant-level budget configuration
model CloudPodBudget {
  id                    Int       @id @default(autoincrement())
  tenantId              Int       @unique @map("tenant_id")
  monthlyLimitUsd       Decimal   @map("monthly_limit_usd") @db.Decimal(10, 2)
  alertThreshold1       Int       @default(50) @map("alert_threshold_1") // percentage
  alertThreshold2       Int       @default(80) @map("alert_threshold_2")
  alertThreshold3       Int       @default(100) @map("alert_threshold_3")
  hardLimitEnabled      Boolean   @default(false) @map("hard_limit_enabled")
  hardLimitAction       String?   @map("hard_limit_action") // 'stop_pods', 'notify_only'
  notificationEmails    String[]  @map("notification_emails")
  webhookUrl            String?   @map("webhook_url")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  tenant                Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("cloud_pod_budgets")
}

// Budget alert history
model CloudPodBudgetAlert {
  id              Int       @id @default(autoincrement())
  tenantId        Int       @map("tenant_id")
  yearMonth       String    @map("year_month")
  threshold       Int       // 50, 80, 100
  currentSpendUsd Decimal   @map("current_spend_usd") @db.Decimal(10, 2)
  budgetLimitUsd  Decimal   @map("budget_limit_usd") @db.Decimal(10, 2)
  percentUsed     Float     @map("percent_used")
  alertedAt       DateTime  @default(now()) @map("alerted_at")
  notifiedVia     String[]  @map("notified_via") // ['email', 'webhook']
  acknowledged    Boolean   @default(false)
  acknowledgedAt  DateTime? @map("acknowledged_at")
  acknowledgedBy  Int?      @map("acknowledged_by")

  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, yearMonth, threshold])
  @@index([alertedAt])
  @@map("cloud_pod_budget_alerts")
}

// Pricing tiers (admin-managed)
model CloudPodPricing {
  id              Int       @id @default(autoincrement())
  name            String    // 'standard', 'premium', 'enterprise'
  cpuPerHourUsd   Decimal   @map("cpu_per_hour_usd") @db.Decimal(10, 6)
  memoryGbPerHourUsd Decimal @map("memory_gb_per_hour_usd") @db.Decimal(10, 6)
  diskGbPerMonthUsd Decimal @map("disk_gb_per_month_usd") @db.Decimal(10, 4)
  networkOutGbUsd Decimal   @map("network_out_gb_usd") @db.Decimal(10, 4)
  networkInFree   Boolean   @default(true) @map("network_in_free")
  effectiveFrom   DateTime  @map("effective_from")
  effectiveUntil  DateTime? @map("effective_until")
  isDefault       Boolean   @default(false) @map("is_default")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("cloud_pod_pricing")
}
```

---

## Pricing Model

| Resource | Standard Rate | Unit |
|----------|---------------|------|
| vCPU | $0.01 | per hour |
| Memory | $0.005 | per GB-hour |
| Disk | $0.10 | per GB-month |
| Network Out | $0.05 | per GB |
| Network In | Free | - |

Example monthly costs for a 2 vCPU, 4GB RAM, 50GB disk pod running 24/7:
- CPU: 2 × $0.01 × 730h = $14.60
- Memory: 4 × $0.005 × 730h = $14.60
- Disk: 50 × $0.10 = $5.00
- **Total: ~$34.20/month**

---

## Service Layer

```javascript
// src/services/cloudPodMetering.js

import { prisma } from '../database.js';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Usage metering service for CloudPods
 */
class CloudPodMeteringService {
  
  // ─────────────────────────────────────────────────────────────────
  // Usage Collection
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Record a usage sample from Proxmox/MigraAgent
   */
  async recordUsageSample(podId, metrics) {
    const {
      cpuPercent,
      memoryUsedMb,
      memoryTotalMb,
      diskUsedGb,
      diskTotalGb,
      networkInMb,
      networkOutMb,
      diskReadMb,
      diskWriteMb
    } = metrics;
    
    return prisma.cloudPodUsageSample.create({
      data: {
        podId,
        sampleTime: new Date(),
        cpuPercent,
        memoryUsedMb,
        memoryTotalMb,
        diskUsedGb,
        diskTotalGb,
        networkInMb,
        networkOutMb,
        diskReadMb,
        diskWriteMb
      }
    });
  }

  /**
   * Batch record samples (more efficient for multiple pods)
   */
  async recordUsageSamplesBatch(samples) {
    const now = new Date();
    const data = samples.map(s => ({
      ...s,
      sampleTime: now
    }));
    
    return prisma.cloudPodUsageSample.createMany({ data });
  }

  // ─────────────────────────────────────────────────────────────────
  // Aggregation Jobs
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Aggregate samples into hourly records
   * Run every hour via cron/scheduler
   */
  async aggregateHourly(hourStart) {
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    
    // Get all pods with samples in this hour
    const samples = await prisma.cloudPodUsageSample.groupBy({
      by: ['podId'],
      where: {
        sampleTime: { gte: hourStart, lt: hourEnd }
      },
      _avg: {
        cpuPercent: true,
        memoryUsedMb: true,
        diskUsedGb: true
      },
      _max: {
        cpuPercent: true,
        memoryUsedMb: true
      },
      _sum: {
        networkInMb: true,
        networkOutMb: true,
        diskReadMb: true,
        diskWriteMb: true
      },
      _count: true
    });
    
    // Upsert hourly records
    for (const sample of samples) {
      await prisma.cloudPodUsageHourly.upsert({
        where: {
          podId_hourStart: { podId: sample.podId, hourStart }
        },
        create: {
          podId: sample.podId,
          hourStart,
          cpuAvgPercent: sample._avg.cpuPercent,
          cpuMaxPercent: sample._max.cpuPercent,
          memoryAvgMb: Math.round(sample._avg.memoryUsedMb || 0),
          memoryMaxMb: sample._max.memoryUsedMb,
          diskAvgGb: sample._avg.diskUsedGb,
          networkInTotalMb: sample._sum.networkInMb,
          networkOutTotalMb: sample._sum.networkOutMb,
          diskReadTotalMb: sample._sum.diskReadMb,
          diskWriteTotalMb: sample._sum.diskWriteMb,
          sampleCount: sample._count,
          uptimeMinutes: sample._count // Assuming 1 sample/minute
        },
        update: {
          cpuAvgPercent: sample._avg.cpuPercent,
          cpuMaxPercent: sample._max.cpuPercent,
          memoryAvgMb: Math.round(sample._avg.memoryUsedMb || 0),
          memoryMaxMb: sample._max.memoryUsedMb,
          diskAvgGb: sample._avg.diskUsedGb,
          networkInTotalMb: sample._sum.networkInMb,
          networkOutTotalMb: sample._sum.networkOutMb,
          diskReadTotalMb: sample._sum.diskReadMb,
          diskWriteTotalMb: sample._sum.diskWriteMb,
          sampleCount: sample._count,
          uptimeMinutes: sample._count
        }
      });
    }
    
    console.log(`[Metering] Aggregated ${samples.length} pods for hour ${hourStart.toISOString()}`);
    return samples.length;
  }

  /**
   * Aggregate hourly data into daily records
   * Run daily at midnight
   */
  async aggregateDaily(date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    
    // Get hourly records for this day
    const hourlyData = await prisma.cloudPodUsageHourly.groupBy({
      by: ['podId'],
      where: {
        hourStart: { gte: dayStart, lt: dayEnd }
      },
      _avg: {
        cpuAvgPercent: true,
        memoryAvgMb: true,
        diskAvgGb: true
      },
      _max: {
        cpuMaxPercent: true,
        memoryMaxMb: true,
        diskAvgGb: true
      },
      _sum: {
        networkInTotalMb: true,
        networkOutTotalMb: true,
        uptimeMinutes: true
      },
      _count: true
    });
    
    // Get pricing
    const pricing = await this.getCurrentPricing();
    
    for (const data of hourlyData) {
      // Calculate estimated cost
      const uptimeHours = (data._sum.uptimeMinutes || 0) / 60;
      
      // Get pod config for vCPU count
      const pod = await prisma.cloudPod.findUnique({
        where: { id: data.podId },
        select: { vcpus: true, memoryMb: true }
      });
      
      const cpuCost = (pod?.vcpus || 1) * uptimeHours * parseFloat(pricing.cpuPerHourUsd);
      const memCost = ((pod?.memoryMb || 1024) / 1024) * uptimeHours * parseFloat(pricing.memoryGbPerHourUsd);
      const networkOutGb = (data._sum.networkOutTotalMb || 0) / 1024;
      const networkCost = networkOutGb * parseFloat(pricing.networkOutGbUsd);
      const estimatedCost = cpuCost + memCost + networkCost;
      
      await prisma.cloudPodUsageDaily.upsert({
        where: {
          podId_date: { podId: data.podId, date: dayStart }
        },
        create: {
          podId: data.podId,
          date: dayStart,
          cpuAvgPercent: data._avg.cpuAvgPercent,
          cpuMaxPercent: data._max.cpuMaxPercent,
          memoryAvgMb: Math.round(data._avg.memoryAvgMb || 0),
          memoryMaxMb: data._max.memoryMaxMb,
          diskAvgGb: data._avg.diskAvgGb,
          diskMaxGb: data._max.diskAvgGb,
          networkInTotalGb: (data._sum.networkInTotalMb || 0) / 1024,
          networkOutTotalGb: networkOutGb,
          uptimeHours,
          estimatedCostUsd: estimatedCost
        },
        update: {
          cpuAvgPercent: data._avg.cpuAvgPercent,
          cpuMaxPercent: data._max.cpuMaxPercent,
          memoryAvgMb: Math.round(data._avg.memoryAvgMb || 0),
          memoryMaxMb: data._max.memoryMaxMb,
          diskAvgGb: data._avg.diskAvgGb,
          diskMaxGb: data._max.diskAvgGb,
          networkInTotalGb: (data._sum.networkInTotalMb || 0) / 1024,
          networkOutTotalGb: networkOutGb,
          uptimeHours,
          estimatedCostUsd: estimatedCost
        }
      });
    }
    
    // Check budget alerts after daily aggregation
    await this.checkAllBudgetAlerts();
    
    console.log(`[Metering] Aggregated ${hourlyData.length} pods for day ${dayStart.toISOString()}`);
    return hourlyData.length;
  }

  /**
   * Aggregate daily data into monthly summary
   * Run on the 1st of each month for previous month
   */
  async aggregateMonthly(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    
    // Get daily records for this month
    const dailyData = await prisma.cloudPodUsageDaily.groupBy({
      by: ['podId'],
      where: {
        date: { gte: monthStart, lt: monthEnd }
      },
      _sum: {
        uptimeHours: true,
        networkInTotalGb: true,
        networkOutTotalGb: true,
        estimatedCostUsd: true
      }
    });
    
    const pricing = await this.getCurrentPricing();
    
    for (const data of dailyData) {
      const pod = await prisma.cloudPod.findUnique({
        where: { id: data.podId },
        select: { tenantId: true, vcpus: true, memoryMb: true, diskGb: true }
      });
      
      if (!pod) continue;
      
      const uptimeHours = data._sum.uptimeHours || 0;
      const cpuHours = (pod.vcpus || 1) * uptimeHours;
      const memoryGbHours = ((pod.memoryMb || 1024) / 1024) * uptimeHours;
      
      // Disk is billed monthly regardless of uptime
      const diskGbHours = (pod.diskGb || 20) * 730; // Assuming full month
      const diskCost = (pod.diskGb || 20) * parseFloat(pricing.diskGbPerMonthUsd);
      
      const totalCost = (data._sum.estimatedCostUsd || 0) + diskCost;
      
      await prisma.cloudPodUsageMonthly.upsert({
        where: {
          podId_yearMonth: { podId: data.podId, yearMonth }
        },
        create: {
          podId: data.podId,
          tenantId: pod.tenantId,
          yearMonth,
          cpuHours,
          memoryGbHours,
          diskGbHours,
          networkInGb: data._sum.networkInTotalGb,
          networkOutGb: data._sum.networkOutTotalGb,
          totalUptimeHours: uptimeHours,
          estimatedCostUsd: totalCost
        },
        update: {
          cpuHours,
          memoryGbHours,
          diskGbHours,
          networkInGb: data._sum.networkInTotalGb,
          networkOutGb: data._sum.networkOutTotalGb,
          totalUptimeHours: uptimeHours,
          estimatedCostUsd: totalCost
        }
      });
    }
    
    console.log(`[Metering] Aggregated ${dailyData.length} pods for month ${yearMonth}`);
    return dailyData.length;
  }

  // ─────────────────────────────────────────────────────────────────
  // Usage Queries
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Get current month's usage for a tenant
   */
  async getTenantCurrentUsage(tenantId) {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get daily aggregates for current month
    const dailyUsage = await prisma.cloudPodUsageDaily.findMany({
      where: {
        pod: { tenantId },
        date: { gte: monthStart }
      },
      include: {
        pod: { select: { id: true, name: true } }
      }
    });
    
    // Calculate totals
    let totalCost = 0;
    let totalUptimeHours = 0;
    let totalNetworkOutGb = 0;
    
    const podUsage = {};
    for (const daily of dailyUsage) {
      totalCost += parseFloat(daily.estimatedCostUsd || 0);
      totalUptimeHours += daily.uptimeHours || 0;
      totalNetworkOutGb += daily.networkOutTotalGb || 0;
      
      if (!podUsage[daily.podId]) {
        podUsage[daily.podId] = {
          podId: daily.podId,
          podName: daily.pod.name,
          totalCost: 0,
          uptimeHours: 0
        };
      }
      podUsage[daily.podId].totalCost += parseFloat(daily.estimatedCostUsd || 0);
      podUsage[daily.podId].uptimeHours += daily.uptimeHours || 0;
    }
    
    // Get budget
    const budget = await prisma.cloudPodBudget.findUnique({
      where: { tenantId }
    });
    
    return {
      yearMonth,
      totalCostUsd: totalCost.toFixed(2),
      totalUptimeHours: totalUptimeHours.toFixed(1),
      totalNetworkOutGb: totalNetworkOutGb.toFixed(2),
      podBreakdown: Object.values(podUsage),
      budget: budget ? {
        monthlyLimitUsd: budget.monthlyLimitUsd.toString(),
        percentUsed: ((totalCost / parseFloat(budget.monthlyLimitUsd)) * 100).toFixed(1)
      } : null
    };
  }

  /**
   * Get usage history for a specific pod
   */
  async getPodUsageHistory(podId, options = {}) {
    const { days = 30 } = options;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const dailyUsage = await prisma.cloudPodUsageDaily.findMany({
      where: {
        podId,
        date: { gte: since }
      },
      orderBy: { date: 'asc' }
    });
    
    return {
      podId,
      period: `${days} days`,
      dailyUsage
    };
  }

  /**
   * Get real-time usage metrics (from recent samples)
   */
  async getPodRealtimeUsage(podId) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const recentSamples = await prisma.cloudPodUsageSample.findMany({
      where: {
        podId,
        sampleTime: { gte: fiveMinutesAgo }
      },
      orderBy: { sampleTime: 'desc' },
      take: 5
    });
    
    if (recentSamples.length === 0) {
      return { status: 'no_data' };
    }
    
    const latest = recentSamples[0];
    const avgCpu = recentSamples.reduce((sum, s) => sum + (s.cpuPercent || 0), 0) / recentSamples.length;
    
    return {
      status: 'live',
      lastUpdate: latest.sampleTime,
      current: {
        cpuPercent: latest.cpuPercent,
        memoryUsedMb: latest.memoryUsedMb,
        memoryTotalMb: latest.memoryTotalMb,
        memoryPercent: latest.memoryTotalMb ? ((latest.memoryUsedMb / latest.memoryTotalMb) * 100).toFixed(1) : null,
        diskUsedGb: latest.diskUsedGb,
        diskTotalGb: latest.diskTotalGb,
        diskPercent: latest.diskTotalGb ? ((latest.diskUsedGb / latest.diskTotalGb) * 100).toFixed(1) : null
      },
      averages: {
        cpuPercent5min: avgCpu.toFixed(1)
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Budget Management
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Set budget for tenant
   */
  async setBudget(tenantId, budgetConfig) {
    const {
      monthlyLimitUsd,
      alertThreshold1 = 50,
      alertThreshold2 = 80,
      alertThreshold3 = 100,
      hardLimitEnabled = false,
      hardLimitAction,
      notificationEmails = [],
      webhookUrl
    } = budgetConfig;
    
    return prisma.cloudPodBudget.upsert({
      where: { tenantId },
      create: {
        tenantId,
        monthlyLimitUsd,
        alertThreshold1,
        alertThreshold2,
        alertThreshold3,
        hardLimitEnabled,
        hardLimitAction,
        notificationEmails,
        webhookUrl
      },
      update: {
        monthlyLimitUsd,
        alertThreshold1,
        alertThreshold2,
        alertThreshold3,
        hardLimitEnabled,
        hardLimitAction,
        notificationEmails,
        webhookUrl
      }
    });
  }

  /**
   * Get budget configuration
   */
  async getBudget(tenantId) {
    return prisma.cloudPodBudget.findUnique({
      where: { tenantId }
    });
  }

  /**
   * Check budget alerts for a tenant
   */
  async checkBudgetAlerts(tenantId) {
    const budget = await prisma.cloudPodBudget.findUnique({
      where: { tenantId }
    });
    
    if (!budget) return;
    
    const usage = await this.getTenantCurrentUsage(tenantId);
    const currentSpend = parseFloat(usage.totalCostUsd);
    const budgetLimit = parseFloat(budget.monthlyLimitUsd);
    const percentUsed = (currentSpend / budgetLimit) * 100;
    
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const thresholds = [budget.alertThreshold1, budget.alertThreshold2, budget.alertThreshold3];
    
    for (const threshold of thresholds) {
      if (percentUsed >= threshold) {
        // Check if alert already sent
        const existing = await prisma.cloudPodBudgetAlert.findUnique({
          where: {
            tenantId_yearMonth_threshold: { tenantId, yearMonth, threshold }
          }
        });
        
        if (!existing) {
          // Create and send alert
          const notifiedVia = [];
          
          if (budget.notificationEmails.length > 0) {
            await this.sendBudgetAlertEmail(budget, currentSpend, budgetLimit, threshold);
            notifiedVia.push('email');
          }
          
          if (budget.webhookUrl) {
            await this.sendBudgetAlertWebhook(budget, currentSpend, budgetLimit, threshold, tenantId);
            notifiedVia.push('webhook');
          }
          
          await prisma.cloudPodBudgetAlert.create({
            data: {
              tenantId,
              yearMonth,
              threshold,
              currentSpendUsd: currentSpend,
              budgetLimitUsd: budgetLimit,
              percentUsed,
              notifiedVia
            }
          });
          
          console.log(`[Budget] Alert sent for tenant ${tenantId}: ${threshold}% threshold hit`);
          
          // Check hard limit
          if (threshold >= 100 && budget.hardLimitEnabled) {
            await this.enforceHardLimit(tenantId, budget.hardLimitAction);
          }
        }
      }
    }
  }

  /**
   * Check budget alerts for all tenants
   */
  async checkAllBudgetAlerts() {
    const budgets = await prisma.cloudPodBudget.findMany();
    
    for (const budget of budgets) {
      try {
        await this.checkBudgetAlerts(budget.tenantId);
      } catch (error) {
        console.error(`[Budget] Error checking alerts for tenant ${budget.tenantId}:`, error);
      }
    }
  }

  /**
   * Send budget alert email
   */
  async sendBudgetAlertEmail(budget, currentSpend, budgetLimit, threshold) {
    // TODO: Integrate with email service
    console.log(`[Budget Email] ${threshold}% alert to ${budget.notificationEmails.join(', ')}`);
    console.log(`  Current: $${currentSpend.toFixed(2)} / $${budgetLimit.toFixed(2)}`);
  }

  /**
   * Send budget alert webhook
   */
  async sendBudgetAlertWebhook(budget, currentSpend, budgetLimit, threshold, tenantId) {
    try {
      const payload = {
        type: 'budget_alert',
        tenantId,
        threshold,
        currentSpendUsd: currentSpend,
        budgetLimitUsd: budgetLimit,
        percentUsed: ((currentSpend / budgetLimit) * 100).toFixed(1),
        timestamp: new Date().toISOString()
      };
      
      await fetch(budget.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log(`[Budget Webhook] Sent to ${budget.webhookUrl}`);
    } catch (error) {
      console.error(`[Budget Webhook] Failed:`, error.message);
    }
  }

  /**
   * Enforce hard budget limit
   */
  async enforceHardLimit(tenantId, action) {
    console.log(`[Budget] Enforcing hard limit for tenant ${tenantId}: ${action}`);
    
    if (action === 'stop_pods') {
      // Stop all running pods
      const pods = await prisma.cloudPod.findMany({
        where: { tenantId, status: 'running', deletedAt: null }
      });
      
      for (const pod of pods) {
        try {
          const { stopPod } = await import('./cloudPodProvisioning.js');
          await stopPod(pod.id);
          console.log(`[Budget] Stopped pod ${pod.id} due to budget limit`);
        } catch (error) {
          console.error(`[Budget] Failed to stop pod ${pod.id}:`, error);
        }
      }
    }
    // 'notify_only' just sends the alert, no action needed
  }

  /**
   * Acknowledge a budget alert
   */
  async acknowledgeBudgetAlert(alertId, userId) {
    return prisma.cloudPodBudgetAlert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId
      }
    });
  }

  /**
   * Get budget alert history
   */
  async getBudgetAlertHistory(tenantId, limit = 20) {
    return prisma.cloudPodBudgetAlert.findMany({
      where: { tenantId },
      orderBy: { alertedAt: 'desc' },
      take: limit
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Pricing
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Get current pricing configuration
   */
  async getCurrentPricing() {
    const now = new Date();
    
    const pricing = await prisma.cloudPodPricing.findFirst({
      where: {
        effectiveFrom: { lte: now },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gt: now } }
        ]
      },
      orderBy: { effectiveFrom: 'desc' }
    });
    
    // Return default pricing if none configured
    return pricing || {
      name: 'default',
      cpuPerHourUsd: new Decimal('0.01'),
      memoryGbPerHourUsd: new Decimal('0.005'),
      diskGbPerMonthUsd: new Decimal('0.10'),
      networkOutGbUsd: new Decimal('0.05'),
      networkInFree: true
    };
  }

  /**
   * Calculate estimated cost for a pod configuration
   */
  async estimateMonthlyCost(config) {
    const { vcpus, memoryMb, diskGb, estimatedNetworkOutGb = 10 } = config;
    const pricing = await this.getCurrentPricing();
    
    const hoursPerMonth = 730;
    
    const cpuCost = vcpus * hoursPerMonth * parseFloat(pricing.cpuPerHourUsd);
    const memCost = (memoryMb / 1024) * hoursPerMonth * parseFloat(pricing.memoryGbPerHourUsd);
    const diskCost = diskGb * parseFloat(pricing.diskGbPerMonthUsd);
    const networkCost = estimatedNetworkOutGb * parseFloat(pricing.networkOutGbUsd);
    
    return {
      breakdown: {
        cpuCost: cpuCost.toFixed(2),
        memoryCost: memCost.toFixed(2),
        diskCost: diskCost.toFixed(2),
        networkCost: networkCost.toFixed(2)
      },
      totalMonthlyUsd: (cpuCost + memCost + diskCost + networkCost).toFixed(2)
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────
  
  /**
   * Clean up old usage samples (run daily)
   */
  async cleanupOldSamples() {
    const sampleRetentionHours = 72; // Keep raw samples for 3 days
    const cutoff = new Date(Date.now() - sampleRetentionHours * 60 * 60 * 1000);
    
    const deleted = await prisma.cloudPodUsageSample.deleteMany({
      where: { sampleTime: { lt: cutoff } }
    });
    
    console.log(`[Metering] Deleted ${deleted.count} old usage samples`);
    return deleted.count;
  }

  /**
   * Clean up old hourly data (run weekly)
   */
  async cleanupOldHourlyData() {
    const hourlyRetentionDays = 30;
    const cutoff = new Date(Date.now() - hourlyRetentionDays * 24 * 60 * 60 * 1000);
    
    const deleted = await prisma.cloudPodUsageHourly.deleteMany({
      where: { hourStart: { lt: cutoff } }
    });
    
    console.log(`[Metering] Deleted ${deleted.count} old hourly records`);
    return deleted.count;
  }
}

export const cloudPodMetering = new CloudPodMeteringService();
```

---

## Metering Worker

```javascript
// src/workers/meteringWorker.js

import { Worker, Queue } from 'bullmq';
import { cloudPodMetering } from '../services/cloudPodMetering.js';
import { prisma } from '../database.js';

const REDIS_CONNECTION = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379
};

/**
 * Collect usage from Proxmox API
 */
async function collectProxmoxUsage(podId) {
  const pod = await prisma.cloudPod.findUnique({
    where: { id: podId },
    select: { proxmoxVmid: true, proxmoxNode: true, ipAddress: true }
  });
  
  if (!pod || !pod.proxmoxVmid) return null;
  
  // TODO: Call Proxmox API to get VM stats
  // Example: GET /nodes/{node}/qemu/{vmid}/status/current
  
  // For now, return simulated data
  return {
    cpuPercent: Math.random() * 50 + 10,
    memoryUsedMb: Math.floor(Math.random() * 2048 + 512),
    memoryTotalMb: 4096,
    diskUsedGb: Math.random() * 30 + 5,
    diskTotalGb: 50,
    networkInMb: Math.random() * 100,
    networkOutMb: Math.random() * 50,
    diskReadMb: Math.random() * 20,
    diskWriteMb: Math.random() * 10
  };
}

/**
 * BullMQ Worker for usage collection
 */
export function startMeteringWorker() {
  const worker = new Worker(
    'cloudpod-metering',
    async (job) => {
      switch (job.name) {
        case 'collectUsage':
          return await handleCollectUsage(job.data);
        case 'aggregateHourly':
          return await handleAggregateHourly(job.data);
        case 'aggregateDaily':
          return await handleAggregateDaily(job.data);
        case 'aggregateMonthly':
          return await handleAggregateMonthly(job.data);
        case 'cleanupSamples':
          return await cloudPodMetering.cleanupOldSamples();
        case 'checkBudgets':
          return await cloudPodMetering.checkAllBudgetAlerts();
        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    { connection: REDIS_CONNECTION }
  );
  
  worker.on('completed', (job, result) => {
    console.log(`[Metering] Job ${job.name} completed`);
  });
  
  worker.on('failed', (job, error) => {
    console.error(`[Metering] Job ${job.name} failed:`, error.message);
  });
  
  return worker;
}

async function handleCollectUsage({ podId }) {
  const metrics = await collectProxmoxUsage(podId);
  if (metrics) {
    await cloudPodMetering.recordUsageSample(podId, metrics);
  }
  return { collected: !!metrics };
}

async function handleAggregateHourly({ hourStart }) {
  const hour = new Date(hourStart);
  return await cloudPodMetering.aggregateHourly(hour);
}

async function handleAggregateDaily({ date }) {
  const d = new Date(date);
  return await cloudPodMetering.aggregateDaily(d);
}

async function handleAggregateMonthly({ yearMonth }) {
  return await cloudPodMetering.aggregateMonthly(yearMonth);
}

/**
 * Schedule recurring metering jobs
 */
export async function scheduleMeteringJobs() {
  const queue = new Queue('cloudpod-metering', { connection: REDIS_CONNECTION });
  
  // Get all active pods
  const pods = await prisma.cloudPod.findMany({
    where: { status: 'running', deletedAt: null },
    select: { id: true }
  });
  
  // Schedule usage collection every minute for each pod
  for (const pod of pods) {
    await queue.add(
      'collectUsage',
      { podId: pod.id },
      {
        repeat: { every: 60 * 1000 }, // Every minute
        jobId: `collect-${pod.id}`,
        removeOnComplete: 100,
        removeOnFail: 50
      }
    );
  }
  
  // Schedule hourly aggregation
  await queue.add(
    'aggregateHourly',
    { hourStart: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    {
      repeat: { cron: '5 * * * *' }, // 5 minutes past every hour
      jobId: 'aggregate-hourly',
      removeOnComplete: 24,
      removeOnFail: 10
    }
  );
  
  // Schedule daily aggregation
  await queue.add(
    'aggregateDaily',
    { date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    {
      repeat: { cron: '15 0 * * *' }, // 00:15 daily
      jobId: 'aggregate-daily',
      removeOnComplete: 30,
      removeOnFail: 10
    }
  );
  
  // Schedule sample cleanup
  await queue.add(
    'cleanupSamples',
    {},
    {
      repeat: { cron: '0 3 * * *' }, // 03:00 daily
      jobId: 'cleanup-samples',
      removeOnComplete: 7,
      removeOnFail: 3
    }
  );
  
  // Schedule budget checks
  await queue.add(
    'checkBudgets',
    {},
    {
      repeat: { cron: '0 * * * *' }, // Every hour
      jobId: 'check-budgets',
      removeOnComplete: 24,
      removeOnFail: 5
    }
  );
  
  console.log(`[Metering] Scheduled jobs for ${pods.length} pods`);
}
```

---

## API Routes

```javascript
// Add to src/routes/cloudPodRoutes.js

import { cloudPodMetering } from '../services/cloudPodMetering.js';

// ─────────────────────────────────────────────────────────────────
// Usage Metering Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/usage/current
 * Get current month's usage for tenant
 */
router.get('/usage/current', requireAuth, async (req, res) => {
  try {
    const usage = await cloudPodMetering.getTenantCurrentUsage(req.user.tenantId);
    res.json(usage);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/:id/usage
 * Get usage history for a pod
 */
router.get('/:id/usage', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    const days = parseInt(req.query.days) || 30;
    
    await validatePodAccess(req, podId);
    
    const usage = await cloudPodMetering.getPodUsageHistory(podId, { days });
    res.json(usage);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/:id/usage/realtime
 * Get real-time usage metrics for a pod
 */
router.get('/:id/usage/realtime', requireAuth, async (req, res) => {
  try {
    const podId = parseInt(req.params.id);
    await validatePodAccess(req, podId);
    
    const usage = await cloudPodMetering.getPodRealtimeUsage(podId);
    res.json(usage);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/usage/estimate
 * Estimate monthly cost for a pod configuration
 */
router.post('/usage/estimate', requireAuth, async (req, res) => {
  try {
    const estimate = await cloudPodMetering.estimateMonthlyCost(req.body);
    res.json(estimate);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Budget Management Endpoints
// ─────────────────────────────────────────────────────────────────

/**
 * GET /api/cloud-pods/budget
 * Get budget configuration for tenant
 */
router.get('/budget', requireAuth, async (req, res) => {
  try {
    const budget = await cloudPodMetering.getBudget(req.user.tenantId);
    res.json(budget || { configured: false });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * PUT /api/cloud-pods/budget
 * Set budget configuration for tenant
 */
router.put('/budget', requireAuth, async (req, res) => {
  try {
    const budget = await cloudPodMetering.setBudget(req.user.tenantId, req.body);
    res.json(budget);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/budget/alerts
 * Get budget alert history
 */
router.get('/budget/alerts', requireAuth, async (req, res) => {
  try {
    const alerts = await cloudPodMetering.getBudgetAlertHistory(req.user.tenantId);
    res.json(alerts);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /api/cloud-pods/budget/alerts/:id/acknowledge
 * Acknowledge a budget alert
 */
router.post('/budget/alerts/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const result = await cloudPodMetering.acknowledgeBudgetAlert(alertId, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * GET /api/cloud-pods/pricing
 * Get current pricing information
 */
router.get('/pricing', async (req, res) => {
  try {
    const pricing = await cloudPodMetering.getCurrentPricing();
    res.json(pricing);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});
```

---

## API Reference

### Usage Metering

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/usage/current` | GET | Current month's tenant usage |
| `/api/cloud-pods/:id/usage` | GET | Pod usage history |
| `/api/cloud-pods/:id/usage/realtime` | GET | Real-time pod metrics |
| `/api/cloud-pods/usage/estimate` | POST | Estimate monthly cost |
| `/api/cloud-pods/pricing` | GET | Current pricing info |

### Budget Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cloud-pods/budget` | GET | Get budget config |
| `/api/cloud-pods/budget` | PUT | Set budget config |
| `/api/cloud-pods/budget/alerts` | GET | Budget alert history |
| `/api/cloud-pods/budget/alerts/:id/acknowledge` | POST | Acknowledge alert |

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Usage Collection                             │
│                                                                 │
│   Proxmox API ──▶ Metering Worker ──▶ cloud_pod_usage_samples   │
│   MigraAgent  ─┘        (every minute)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Hourly Aggregation                          │
│                                                                 │
│   cloud_pod_usage_samples ──▶ cloud_pod_usage_hourly            │
│           (cron: 5 * * * *)                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Daily Aggregation                           │
│                                                                 │
│   cloud_pod_usage_hourly ──▶ cloud_pod_usage_daily              │
│           (cron: 15 0 * * *)                                    │
│                              │                                  │
│                              ▼                                  │
│                    Budget Alert Check                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Monthly Aggregation                          │
│                                                                 │
│   cloud_pod_usage_daily ──▶ cloud_pod_usage_monthly             │
│           (cron: 0 0 1 * *)                                     │
│                              │                                  │
│                              ▼                                  │
│                       Billing System                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Retention Policy

| Data Type | Retention | Purpose |
|-----------|-----------|---------|
| Raw samples | 72 hours | Real-time monitoring |
| Hourly aggregates | 30 days | Short-term analytics |
| Daily aggregates | 1 year | Historical analysis |
| Monthly summaries | Forever | Billing records |

---

## Dashboard Integration

1. **Usage Dashboard Widget**: Current month spend vs budget with progress bar
2. **Cost Breakdown Chart**: Pie chart showing CPU/Memory/Disk/Network costs
3. **Usage Trends**: Line chart of daily usage over time
4. **Real-time Metrics**: Live CPU/Memory/Disk gauges for selected pod
5. **Budget Alerts Panel**: List of recent alerts with acknowledge button
6. **Cost Estimator**: Calculator for new pod configurations

---

## Next Steps

1. Run Prisma migration to create tables
2. Deploy metering worker alongside CloudPod workers
3. Integrate Proxmox API for real metric collection
4. Add dashboard UI components
5. Configure default budget alerts for new tenants
6. Integrate with billing/invoice system
