/**
 * API Client for mPanel backend
 * Handles all communication with the mPanel API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://mpanel.migrahosting.com';
const API_KEY = import.meta.env.VITE_MARKETING_API_KEY || 'mpanel_marketing_live_2025_secure_key_abc123xyz';

export interface CheckoutPayload {
  planId: string;
  billingCycle: string;
  trialActive: boolean;
  addonIds: string[];
  couponCode: string | null;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company?: string;
    address: {
      line1: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };
  domain: {
    mode: 'existing' | 'register' | 'subdomain';
    value: string;
  };
  account: {
    password: string;
  };
}

export interface CheckoutResponse {
  success: boolean;
  data?: {
    checkoutUrl: string;
    subscriptionId: string;
    customerId: string;
    domainId?: string;
    status: string;
    price: number;
    originalPrice: number;
    discount?: {
      amount: number;
      code: string;
      finalPrice: number;
    };
    paymentRequired: boolean;
  };
  error?: string;
}

export interface SessionStatusResponse {
  success: boolean;
  data?: {
    sessionId: string;
    status: 'pending' | 'paid' | 'failed';
    subscription: {
      id: string;
      plan: string;
      status: string;
      nextBillingDate: string;
    };
    customer: {
      id: string;
      email: string;
    };
    portal: {
      url: string;
      username: string;
    };
  };
  error?: string;
}

export interface CouponValidationResponse {
  valid: boolean;
  coupon?: {
    code: string;
    type: string;
    value: number;
    description: string;
  };
  discount?: {
    amount: number;
    finalPrice: number;
  };
  reason?: string;
}

class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API request failed: ${response.statusText}`);
    }

    return data;
  }

  /**
   * Create a checkout session
   */
  async createCheckout(payload: CheckoutPayload): Promise<CheckoutResponse> {
    return this.request<CheckoutResponse>('/api/marketing/checkout-intent', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Validate a coupon code
   */
  async validateCoupon(
    code: string,
    planId?: string
  ): Promise<CouponValidationResponse> {
    return this.request<CouponValidationResponse>('/api/marketing/validate-coupon', {
      method: 'POST',
      body: JSON.stringify({ code, planId }),
    });
  }

  /**
   * Get checkout session status
   */
  async getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    return this.request<SessionStatusResponse>(
      `/api/marketing/checkout-session?session_id=${sessionId}`
    );
  }

  /**
   * Get order status
   */
  async getOrderStatus(sessionId: string): Promise<any> {
    return this.request(`/api/marketing/orders/${sessionId}/status`);
  }
}

// Export singleton instance
export const apiClient = new ApiClient(API_BASE_URL, API_KEY);

// Export class for testing or custom instances
export default ApiClient;
