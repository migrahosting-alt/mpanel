/**
 * Metrics Reporter
 * Sends collected metrics to control panel
 */

import axios from 'axios';

export class MetricsReporter {
  constructor(config) {
    this.controlPanelUrl = config.controlPanel.url;
    this.apiKey = config.controlPanel.apiKey;
    this.agentId = config.agent.agentId || null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  /**
   * Register agent with control panel
   */
  async register(systemInfo) {
    try {
      console.log('[Reporter] Registering agent with control panel...');
      
      const response = await axios.post(
        `${this.controlPanelUrl}/api/agent/register`,
        {
          hostname: systemInfo.hostname,
          os: systemInfo.os,
          arch: systemInfo.arch,
          platform: systemInfo.platform,
          agentVersion: systemInfo.version,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.agentId) {
        this.agentId = response.data.agentId;
        console.log(`[Reporter] ✓ Registered successfully. Agent ID: ${this.agentId}`);
        return response.data;
      } else {
        throw new Error('Invalid registration response');
      }
    } catch (error) {
      console.error('[Reporter] Registration failed:', error.message);
      if (error.response) {
        console.error('[Reporter] Response:', error.response.status, error.response.data);
      }
      throw error;
    }
  }

  /**
   * Submit metrics to control panel
   */
  async submitMetrics(metrics) {
    if (!this.agentId) {
      console.error('[Reporter] Cannot submit metrics: Agent not registered');
      return false;
    }

    try {
      const payload = {
        agentId: this.agentId,
        timestamp: new Date().toISOString(),
        metrics,
      };

      const response = await axios.post(
        `${this.controlPanelUrl}/api/agent/metrics`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (response.data && response.data.received) {
        console.log('[Reporter] ✓ Metrics submitted successfully');
        this.retryCount = 0; // Reset retry counter on success
        return true;
      }

      return false;
    } catch (error) {
      this.retryCount++;
      console.error(`[Reporter] Failed to submit metrics (attempt ${this.retryCount}/${this.maxRetries}):`, error.message);
      
      if (this.retryCount >= this.maxRetries) {
        console.error('[Reporter] Max retries reached. Will try again next cycle.');
        this.retryCount = 0;
      }
      
      return false;
    }
  }

  /**
   * Send heartbeat to control panel
   */
  async sendHeartbeat() {
    if (!this.agentId) {
      return false;
    }

    try {
      const response = await axios.post(
        `${this.controlPanelUrl}/api/agent/heartbeat`,
        {
          agentId: this.agentId,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );

      return response.data && response.data.status === 'ok';
    } catch (error) {
      console.error('[Reporter] Heartbeat failed:', error.message);
      return false;
    }
  }
}
