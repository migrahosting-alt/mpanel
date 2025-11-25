/**
 * Shopping cart state management
 * Manages the current checkout session state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Addon, Coupon, BillingCycle } from '../config/pricing-config';
import { getPlanById, getAddonById, getCouponByCode } from '../config/pricing-config';
import { calculateTotals } from './priceCalculator';

export interface CartState {
  // Selected plan
  plan: Plan | null;
  planId: string | null;

  // Billing settings
  billingCycle: BillingCycle;
  trialActive: boolean;

  // Addons
  selectedAddonIds: string[];
  addons: Addon[];

  // Coupon
  couponCode: string | null;
  coupon: Coupon | null;

  // Customer information
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
  };

  // Domain information
  domain: {
    mode: 'existing' | 'register' | 'subdomain';
    value: string;
  };

  // Billing address
  billingAddress: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };

  // Account credentials
  account: {
    password: string;
  };

  // Computed totals
  totals: {
    subtotal: number;
    discount: number;
    total: number;
  };

  // Actions
  setPlan: (planId: string, cycle?: BillingCycle, trial?: boolean) => void;
  setBillingCycle: (cycle: BillingCycle) => void;
  setTrialActive: (active: boolean) => void;
  addAddon: (addonId: string) => void;
  removeAddon: (addonId: string) => void;
  toggleAddon: (addonId: string) => void;
  applyCoupon: (code: string) => boolean;
  removeCoupon: () => void;
  setCustomer: (customer: Partial<CartState['customer']>) => void;
  setDomain: (domain: Partial<CartState['domain']>) => void;
  setBillingAddress: (address: Partial<CartState['billingAddress']>) => void;
  setAccount: (account: Partial<CartState['account']>) => void;
  recalculateTotals: () => void;
  resetCart: () => void;
  loadFromQuery: (query: URLSearchParams) => void;
}

const initialState = {
  plan: null,
  planId: null,
  billingCycle: 'monthly' as BillingCycle,
  trialActive: false,
  selectedAddonIds: [],
  addons: [],
  couponCode: null,
  coupon: null,
  customer: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
  },
  domain: {
    mode: 'subdomain' as const,
    value: '',
  },
  billingAddress: {
    line1: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
  },
  account: {
    password: '',
  },
  totals: {
    subtotal: 0,
    discount: 0,
    total: 0,
  },
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setPlan: (planId, cycle, trial) => {
        const plan = getPlanById(planId);
        if (!plan) return;

        set({
          plan,
          planId,
          billingCycle: cycle || get().billingCycle,
          trialActive: trial !== undefined ? trial : (plan.trialEnabled && get().trialActive),
          // Load default addons
          selectedAddonIds: plan.defaultAddons,
          addons: plan.defaultAddons.map(id => getAddonById(id)).filter(Boolean) as Addon[],
        });

        get().recalculateTotals();
      },

      setBillingCycle: (cycle) => {
        set({ billingCycle: cycle });
        get().recalculateTotals();
      },

      setTrialActive: (active) => {
        const { plan } = get();
        if (!plan) return;

        // Only allow trial if plan supports it
        if (active && !plan.trialEnabled) return;

        set({ trialActive: active });
        get().recalculateTotals();
      },

      addAddon: (addonId) => {
        const { selectedAddonIds } = get();
        if (selectedAddonIds.includes(addonId)) return;

        const addon = getAddonById(addonId);
        if (!addon) return;

        set({
          selectedAddonIds: [...selectedAddonIds, addonId],
          addons: [...get().addons, addon],
        });

        get().recalculateTotals();
      },

      removeAddon: (addonId) => {
        set({
          selectedAddonIds: get().selectedAddonIds.filter(id => id !== addonId),
          addons: get().addons.filter(a => a.id !== addonId),
        });

        get().recalculateTotals();
      },

      toggleAddon: (addonId) => {
        const { selectedAddonIds } = get();
        if (selectedAddonIds.includes(addonId)) {
          get().removeAddon(addonId);
        } else {
          get().addAddon(addonId);
        }
      },

      applyCoupon: (code) => {
        const coupon = getCouponByCode(code);
        if (!coupon) return false;

        set({ coupon, couponCode: code.toUpperCase() });
        get().recalculateTotals();
        return true;
      },

      removeCoupon: () => {
        set({ coupon: null, couponCode: null });
        get().recalculateTotals();
      },

      setCustomer: (customer) => {
        set({ customer: { ...get().customer, ...customer } });
      },

      setDomain: (domain) => {
        set({ domain: { ...get().domain, ...domain } });
      },

      setBillingAddress: (address) => {
        set({ billingAddress: { ...get().billingAddress, ...address } });
      },

      setAccount: (account) => {
        set({ account: { ...get().account, ...account } });
      },

      recalculateTotals: () => {
        const { plan, addons, billingCycle, trialActive, coupon } = get();
        if (!plan) {
          set({ totals: { subtotal: 0, discount: 0, total: 0 } });
          return;
        }

        const totals = calculateTotals({
          plan,
          addons,
          billingCycle,
          trialActive,
          coupon,
        });

        set({ totals });
      },

      resetCart: () => {
        set(initialState);
      },

      loadFromQuery: (query) => {
        const planId = query.get('plan');
        const trial = query.get('trial') === '1';
        const cycle = query.get('cycle') as BillingCycle || 'monthly';

        if (planId) {
          get().setPlan(planId, cycle, trial);
        }
      },
    }),
    {
      name: 'migrahosting-cart',
      partialize: (state) => ({
        // Only persist essential cart data, not temporary UI state
        planId: state.planId,
        billingCycle: state.billingCycle,
        trialActive: state.trialActive,
        selectedAddonIds: state.selectedAddonIds,
        couponCode: state.couponCode,
        customer: state.customer,
        domain: state.domain,
        billingAddress: state.billingAddress,
      }),
    }
  )
);
