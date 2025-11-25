/**
 * Price calculation utilities
 * All pricing logic flows through these functions to ensure consistency
 */

import type { Plan, Addon, Coupon, BillingCycle, ProductType } from '../config/pricing-config';

/**
 * Calculate subtotal for plan + addons before any discounts
 */
export function calculateSubtotal(
  plan: Plan,
  addons: Addon[],
  billingCycle: BillingCycle,
  trialActive: boolean
): number {
  // If trial is active, first billing is $0
  if (trialActive) {
    return 0;
  }

  const planPrice = plan.basePrice[billingCycle];
  const addonsPrice = addons.reduce((sum, addon) => sum + addon.price[billingCycle], 0);

  return planPrice + addonsPrice;
}

/**
 * Calculate discount amount based on coupon rules
 */
export function calculateDiscount(
  subtotal: number,
  coupon: Coupon | null,
  productType: ProductType
): number {
  if (!coupon) return 0;

  // Check if coupon applies to this product type
  if (coupon.appliesToProducts && !coupon.appliesToProducts.includes(productType)) {
    return 0;
  }

  // Check minimum subtotal requirement
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return 0;
  }

  // Calculate discount based on type
  switch (coupon.type) {
    case 'percent':
      return Math.round((subtotal * coupon.value) / 100 * 100) / 100; // Round to 2 decimals

    case 'flat':
      return Math.min(subtotal, coupon.value); // Can't discount more than subtotal

    case 'free-first-month':
      return subtotal; // 100% discount on first invoice

    default:
      return 0;
  }
}

/**
 * Calculate all totals (subtotal, discount, final total)
 */
export function calculateTotals(options: {
  plan: Plan;
  addons: Addon[];
  billingCycle: BillingCycle;
  trialActive: boolean;
  coupon: Coupon | null;
}): {
  subtotal: number;
  discount: number;
  total: number;
} {
  const subtotal = calculateSubtotal(
    options.plan,
    options.addons,
    options.billingCycle,
    options.trialActive
  );

  const discount = calculateDiscount(
    subtotal,
    options.coupon,
    options.plan.productType
  );

  const total = Math.max(0, subtotal - discount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Format price for display
 */
export function formatPrice(amount: number, includeCents: boolean = true): string {
  if (includeCents) {
    return `$${amount.toFixed(2)}`;
  }
  return `$${Math.floor(amount)}`;
}

/**
 * Calculate monthly equivalent price for yearly billing
 */
export function getMonthlyEquivalent(yearlyPrice: number): number {
  return Math.round((yearlyPrice / 12) * 100) / 100;
}

/**
 * Calculate savings when choosing yearly vs monthly
 */
export function calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): {
  amount: number;
  percentage: number;
} {
  const monthlyTotal = monthlyPrice * 12;
  const savings = monthlyTotal - yearlyPrice;
  const percentage = Math.round((savings / monthlyTotal) * 100);

  return {
    amount: Math.round(savings * 100) / 100,
    percentage,
  };
}

/**
 * Get billing cycle display text
 */
export function getBillingCycleText(cycle: BillingCycle): string {
  switch (cycle) {
    case 'monthly':
      return 'per month';
    case 'yearly':
      return 'per year';
    default:
      return '';
  }
}

/**
 * Get trial description text
 */
export function getTrialText(plan: Plan): string {
  if (!plan.trialEnabled) {
    return '';
  }
  return `${plan.trialDays}-day free trial`;
}

/**
 * Validate coupon against business rules
 */
export function validateCoupon(
  coupon: Coupon,
  subtotal: number,
  productType: ProductType
): { valid: boolean; reason?: string } {
  // Check if expired
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, reason: 'This coupon has expired' };
  }

  // Check product applicability
  if (coupon.appliesToProducts && !coupon.appliesToProducts.includes(productType)) {
    return { valid: false, reason: 'This coupon does not apply to this product' };
  }

  // Check minimum subtotal
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      valid: false,
      reason: `Minimum order of ${formatPrice(coupon.minSubtotal)} required`,
    };
  }

  return { valid: true };
}
