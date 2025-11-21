/**
 * mPanel Integration Client
 * Easy-to-use JavaScript client for integrating mPanel with your marketing site
 * 
 * Usage:
 *   import MPanelClient from './mpanel-client.js';
 *   const client = new MPanelClient('http://localhost:2271');
 *   const plans = await client.getPlans();
 *   const checkoutUrl = await client.createCheckout('basic', 'monthly', 'user@example.com');
 */

class MPanelClient {
  /**
   * @param {string} baseURL - mPanel API base URL (e.g., 'https://migrapanel.com')
   * @param {string} apiToken - Optional API token for authenticated endpoints (server-side only!)
   */
  constructor(baseURL = 'https://migrapanel.com', apiToken = null) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.apiToken = apiToken;
  }

  /**
   * Get available hosting plans
   * @returns {Promise<Array>} List of plans with pricing and features
   */
  async getPlans() {
    const response = await fetch(`${this.baseURL}/api/public/plans`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch plans: ${response.statusText}`);
    }

    const data = await response.json();
    return data.plans;
  }

  /**
   * Create Stripe checkout session
   * @param {string} planId - Plan identifier (e.g., 'basic', 'pro')
   * @param {string} term - Billing term ('monthly' or 'annually')
   * @param {string} email - Customer email address
   * @param {string} successUrl - URL to redirect after successful payment
   * @param {string} cancelUrl - URL to redirect if checkout is cancelled
   * @returns {Promise<{url: string, id: string}>} Checkout session URL and ID
   */
  async createCheckout(planId, term, email, successUrl, cancelUrl) {
    const response = await fetch(`${this.baseURL}/api/public/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        term,
        email,
        successUrl: successUrl || `${window.location.origin}/checkout/success`,
        cancelUrl: cancelUrl || `${window.location.origin}/pricing`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }

    return response.json();
  }

  /**
   * Create a customer account (requires API token)
   * @param {Object} customerData - Customer information
   * @returns {Promise<Object>} Created customer object
   */
  async createCustomer(customerData) {
    this._requireAuth();

    const response = await fetch(`${this.baseURL}/api/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      },
      body: JSON.stringify(customerData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create customer');
    }

    return response.json();
  }

  /**
   * Provision a service (requires API token)
   * @param {Object} provisionData - Provisioning details
   * @returns {Promise<Object>} Provisioning job details
   */
  async provisionService(provisionData) {
    this._requireAuth();

    const response = await fetch(`${this.baseURL}/api/provisioning/provision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiToken}`
      },
      body: JSON.stringify(provisionData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to provision service');
    }

    return response.json();
  }

  /**
   * Check provisioning status (requires API token)
   * @param {string} jobId - Job ID or task ID
   * @returns {Promise<Object>} Provisioning status
   */
  async getProvisioningStatus(jobId) {
    this._requireAuth();

    const response = await fetch(`${this.baseURL}/api/provisioning/tasks/${jobId}`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get provisioning status');
    }

    return response.json();
  }

  /**
   * Poll provisioning status until completion
   * @param {string} jobId - Job ID to monitor
   * @param {number} interval - Polling interval in milliseconds (default: 5000)
   * @param {number} timeout - Maximum wait time in milliseconds (default: 300000 = 5 minutes)
   * @returns {Promise<Object>} Final provisioning status
   */
  async waitForProvisioning(jobId, interval = 5000, timeout = 300000) {
    this._requireAuth();

    const startTime = Date.now();

    while (true) {
      const status = await this.getProvisioningStatus(jobId);

      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      if (Date.now() - startTime > timeout) {
        throw new Error('Provisioning timeout exceeded');
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Get provisioning queue statistics (requires API token)
   * @returns {Promise<Object>} Queue stats
   */
  async getProvisioningStats() {
    this._requireAuth();

    const response = await fetch(`${this.baseURL}/api/provisioning/stats`, {
      headers: {
        'Authorization': `Bearer ${this.apiToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get stats');
    }

    return response.json();
  }

  /**
   * Check API health
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    const response = await fetch(`${this.baseURL}/api/health`);
    return response.json();
  }

  /**
   * Helper to ensure API token is set for authenticated requests
   * @private
   */
  _requireAuth() {
    if (!this.apiToken) {
      throw new Error('API token required for this operation. Initialize client with apiToken parameter.');
    }
  }
}

// Export for use in different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MPanelClient; // CommonJS
}

export default MPanelClient; // ES6
