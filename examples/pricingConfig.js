// pricingConfig.js - JavaScript version (no TypeScript required)
// Use this if your marketing site doesn't use TypeScript

// Shared Hosting (MigraHosting)
export const hostingPlans = {
  currency: "USD",
  billingCycles: ["monthly", "oneYear", "twoYears", "threeYears"],
  plans: [
    {
      id: "student",
      name: "Student",
      type: "shared-hosting",
      pricing: {
        monthly: 0,
        oneYear: 0,
        twoYears: 0,
        threeYears: 0,
      },
      notes: "Requires academic verification.",
    },
    {
      id: "starter",
      name: "Starter",
      type: "shared-hosting",
      pricing: {
        monthly: 7.95,
        oneYear: 1.99,
        twoYears: 1.69,
        threeYears: 1.49,
      },
    },
    {
      id: "premium",
      name: "Premium",
      type: "shared-hosting",
      pricing: {
        monthly: 8.95,
        oneYear: 3.19,
        twoYears: 2.79,
        threeYears: 2.49,
      },
    },
    {
      id: "business",
      name: "Business",
      type: "shared-hosting",
      pricing: {
        monthly: 9.95,
        oneYear: 4.79,
        twoYears: 4.39,
        threeYears: 3.99,
      },
    },
  ],
};

// Managed WordPress (MigraWP)
export const wpPlans = {
  currency: "USD",
  billingCycles: ["monthly", "oneYear", "twoYears", "threeYears"],
  plans: [
    {
      id: "wp-starter",
      name: "WP Starter",
      type: "managed-wordpress",
      pricing: {
        monthly: 11.95,
        oneYear: 8.95,
        twoYears: 7.95,
        threeYears: 6.95,
      },
    },
    {
      id: "wp-growth",
      name: "WP Growth",
      type: "managed-wordpress",
      pricing: {
        monthly: 16.95,
        oneYear: 12.95,
        twoYears: 11.45,
        threeYears: 9.95,
      },
    },
    {
      id: "wp-business",
      name: "WP Business",
      type: "managed-wordpress",
      pricing: {
        monthly: 24.95,
        oneYear: 19.95,
        twoYears: 17.95,
        threeYears: 15.95,
      },
    },
    {
      id: "wp-agency",
      name: "WP Agency",
      type: "managed-wordpress",
      pricing: {
        monthly: 39.95,
        oneYear: 32.95,
        twoYears: 29.95,
        threeYears: 26.95,
      },
    },
  ],
};

// Email (MigraMail)
export const mailPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"],
  plans: [
    {
      id: "mail-basic",
      name: "MigraMail Basic",
      type: "email",
      pricing: {
        monthly: 1.5,
        yearly: 1.2,
      },
    },
    {
      id: "mail-pro",
      name: "MigraMail Pro",
      type: "email",
      pricing: {
        monthly: 2.5,
        yearly: 2.0,
      },
    },
    {
      id: "mail-business",
      name: "MigraMail Business",
      type: "email",
      pricing: {
        monthly: 3.5,
        yearly: 3.0,
      },
    },
  ],
};

// VPS (MigraVPS)
export const vpsPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"],
  plans: [
    {
      id: "vps-essential",
      name: "VPS Essential",
      type: "vps",
      pricing: {
        monthly: 7.95,
        yearly: 6.95,
      },
    },
    {
      id: "vps-plus",
      name: "VPS Plus",
      type: "vps",
      pricing: {
        monthly: 14.95,
        yearly: 12.95,
      },
    },
    {
      id: "vps-pro",
      name: "VPS Pro",
      type: "vps",
      pricing: {
        monthly: 29.95,
        yearly: 24.95,
      },
    },
  ],
};

// Cloud (MigraCloud)
export const cloudPlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"],
  plans: [
    {
      id: "cloud-start",
      name: "MigraCloud Start",
      type: "cloud",
      pricing: {
        monthly: 19.95,
        yearly: 16.95,
      },
    },
    {
      id: "cloud-scale",
      name: "MigraCloud Scale",
      type: "cloud",
      pricing: {
        monthly: 39.95,
        yearly: 32.95,
      },
    },
    {
      id: "cloud-enterprise",
      name: "MigraCloud Enterprise",
      type: "cloud",
      pricing: {
        monthly: 79.95,
        yearly: 64.95,
      },
    },
  ],
};

// Cloud Storage (MigraDrive / MigraStorage)
export const storagePlans = {
  currency: "USD",
  billingCycles: ["monthly", "yearly"],
  plans: [
    {
      id: "storage-personal",
      name: "MigraDrive Personal",
      type: "storage",
      pricing: {
        monthly: 4.95,
        yearly: 3.95,
      },
    },
    {
      id: "storage-team",
      name: "MigraDrive Team",
      type: "storage",
      pricing: {
        monthly: 9.95,
        yearly: 8.45,
      },
    },
    {
      id: "storage-business",
      name: "MigraDrive Business",
      type: "storage",
      pricing: {
        monthly: 24.95,
        yearly: 19.95,
      },
    },
  ],
};

// Helper function to get price with savings calculation
export function getPriceWithSavings(monthlyPrice, termPrice, months) {
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
export function formatPrice(price, currency = "USD") {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

// Helper function to get billing cycle display name
export function getBillingCycleLabel(cycle) {
  const labels = {
    monthly: "Monthly",
    yearly: "Yearly",
    oneYear: "1 Year",
    twoYears: "2 Years",
    threeYears: "3 Years",
  };
  return labels[cycle] || cycle;
}

// Helper function to get months for billing cycle
export function getMonthsForCycle(cycle) {
  const months = {
    monthly: 1,
    yearly: 12,
    oneYear: 12,
    twoYears: 24,
    threeYears: 36,
  };
  return months[cycle] || 1;
}
