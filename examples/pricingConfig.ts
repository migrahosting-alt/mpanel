// src/config/pricingConfig.ts

export type HostingBillingCycle = "monthly" | "oneYear" | "twoYears" | "threeYears";
export type SimpleBillingCycle = "monthly" | "yearly";

export type HostingPlanId = "student" | "starter" | "premium" | "business";
export type WpPlanId = "wp-starter" | "wp-growth" | "wp-business" | "wp-agency";
export type MailPlanId = "mail-basic" | "mail-pro" | "mail-business";
export type VpsPlanId = "vps-essential" | "vps-plus" | "vps-pro";
export type CloudPlanId = "cloud-start" | "cloud-scale" | "cloud-enterprise";
export type StoragePlanId = "storage-personal" | "storage-team" | "storage-business";

// Shared Hosting (MigraHosting)
export const hostingPlans = {
  currency: "USD",
  billingCycles: ["monthly", "oneYear", "twoYears", "threeYears"] as HostingBillingCycle[],
  plans: [
    {
      id: "student" as HostingPlanId,
      name: "Student",
      type: "shared-hosting" as const,
      pricing: {
        monthly: 0,
        oneYear: 0,
        twoYears: 0,
        threeYears: 0,
      },
      notes: "Requires academic verification.",
    },
    {
      id: "starter" as HostingPlanId,
      name: "Starter",
      type: "shared-hosting" as const,
      pricing: {
        monthly: 7.95,
        oneYear: 1.99,
        twoYears: 1.69,
        threeYears: 1.49,
      },
    },
    {
      id: "premium" as HostingPlanId,
      name: "Premium",
      type: "shared-hosting" as const,
      pricing: {
        monthly: 8.95,
        oneYear: 3.19,
        twoYears: 2.79,
        threeYears: 2.49,
      },
    },
    {
      id: "business" as HostingPlanId,
      name: "Business",
      type: "shared-hosting" as const,
      pricing: {
        monthly: 9.95,
        oneYear: 4.79,
        twoYears: 4.39,
        threeYears: 3.99,
      },
    },
  ],
} as const;

// Managed WordPress (MigraWP)
export const wpPlans = {
  currency: "USD",
  billingCycles: ["monthly", "oneYear", "twoYears", "threeYears"] as HostingBillingCycle[],
  plans: [
    {
      id: "wp-starter" as WpPlanId,
      name: "WP Starter",
      type: "managed-wordpress" as const,
      pricing: {
        monthly: 11.95,
        oneYear: 8.95,
        twoYears: 7.95,
        threeYears: 6.95,
      },
    },
    {
      id: "wp-growth" as WpPlanId,
      name: "WP Growth",
      type: "managed-wordpress" as const,
      pricing: {
        monthly: 16.95,
        oneYear: 12.95,
        twoYears: 11.45,
        threeYears: 9.95,
      },
    },
    {
      id: "wp-business" as WpPlanId,
      name: "WP Business",
      type: "managed-wordpress" as const,
      pricing: {
        monthly: 24.95,
        oneYear: 19.95,
        twoYears: 17.95,
        threeYears: 15.95,
      },
    },
    {
      id: "wp-agency" as WpPlanId,
      name: "WP Agency",
      type: "managed-wordpress" as const,
      pricing: {
        monthly: 39.95,
        oneYear: 32.95,
        twoYears: 29.95,
        threeYears: 26.95,
      },
    },
  ],
} as const;

// Email (MigraMail)
export const mailPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"] as SimpleBillingCycle[],
  plans: [
    {
      id: "mail-basic" as MailPlanId,
      name: "MigraMail Basic",
      type: "email" as const,
      pricing: {
        monthly: 1.5,
        yearly: 1.2,
      },
    },
    {
      id: "mail-pro" as MailPlanId,
      name: "MigraMail Pro",
      type: "email" as const,
      pricing: {
        monthly: 2.5,
        yearly: 2.0,
      },
    },
    {
      id: "mail-business" as MailPlanId,
      name: "MigraMail Business",
      type: "email" as const,
      pricing: {
        monthly: 3.5,
        yearly: 3.0,
      },
    },
  ],
} as const;

// VPS (MigraVPS)
export const vpsPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"] as SimpleBillingCycle[],
  plans: [
    {
      id: "vps-essential" as VpsPlanId,
      name: "VPS Essential",
      type: "vps" as const,
      pricing: {
        monthly: 7.95,
        yearly: 6.95,
      },
    },
    {
      id: "vps-plus" as VpsPlanId,
      name: "VPS Plus",
      type: "vps" as const,
      pricing: {
        monthly: 14.95,
        yearly: 12.95,
      },
    },
    {
      id: "vps-pro" as VpsPlanId,
      name: "VPS Pro",
      type: "vps" as const,
      pricing: {
        monthly: 29.95,
        yearly: 24.95,
      },
    },
  ],
} as const;

// Cloud (MigraCloud)
export const cloudPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"] as SimpleBillingCycle[],
  plans: [
    {
      id: "cloud-start" as CloudPlanId,
      name: "MigraCloud Start",
      type: "cloud" as const,
      pricing: {
        monthly: 19.95,
        yearly: 16.95,
      },
    },
    {
      id: "cloud-scale" as CloudPlanId,
      name: "MigraCloud Scale",
      type: "cloud" as const,
      pricing: {
        monthly: 39.95,
        yearly: 32.95,
      },
    },
    {
      id: "cloud-enterprise" as CloudPlanId,
      name: "MigraCloud Enterprise",
      type: "cloud" as const,
      pricing: {
        monthly: 79.95,
        yearly: 64.95,
      },
    },
  ],
} as const;

// Cloud Storage (MigraDrive / MigraStorage)
export const storagePlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"] as SimpleBillingCycle[],
  plans: [
    {
      id: "storage-personal" as StoragePlanId,
      name: "MigraDrive Personal",
      type: "storage" as const,
      pricing: {
        monthly: 4.95,
        yearly: 3.95,
      },
    },
    {
      id: "storage-team" as StoragePlanId,
      name: "MigraDrive Team",
      type: "storage" as const,
      pricing: {
        monthly: 9.95,
        yearly: 8.45,
      },
    },
    {
      id: "storage-business" as StoragePlanId,
      name: "MigraDrive Business",
      type: "storage" as const,
      pricing: {
        monthly: 24.95,
        yearly: 19.95,
      },
    },
  ],
} as const;

// Helper function to get price with savings calculation
export function getPriceWithSavings(
  monthlyPrice: number,
  termPrice: number,
  months: number
): { price: number; savings: number; savingsPercent: number } {
  const totalMonthly = monthlyPrice * months;
  const savings = totalMonthly - termPrice;
  const savingsPercent = Math.round((savings / totalMonthly) * 100);
  
  return {
    price: termPrice,
    savings,
    savingsPercent,
  };
}

// Helper function to format price
export function formatPrice(price: number, currency: string = "USD"): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Helper function to get billing cycle display name
export function getBillingCycleLabel(cycle: HostingBillingCycle | SimpleBillingCycle): string {
  const labels: Record<string, string> = {
    monthly: "Monthly",
    yearly: "Yearly",
    oneYear: "1 Year",
    twoYears: "2 Years",
    threeYears: "3 Years",
  };
  return labels[cycle] || cycle;
}

// Helper function to get months for billing cycle
export function getMonthsForCycle(cycle: HostingBillingCycle | SimpleBillingCycle): number {
  const months: Record<string, number> = {
    monthly: 1,
    yearly: 12,
    oneYear: 12,
    twoYears: 24,
    threeYears: 36,
  };
  return months[cycle] || 1;
}
