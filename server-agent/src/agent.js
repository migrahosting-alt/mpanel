#!/usr/bin/env node
/**
 * mPanel Server Agent
 * Collects and reports system metrics to control panel
 */

import os from 'os';
import si from 'systeminformation';
import { Config } from './config.js';
import { MetricsReporter } from './reporter.js';
import { collectCPUMetrics } from './collectors/cpu.js';
import { collectMemoryMetrics } from './collectors/memory.js';
import { collectDiskMetrics } from './collectors/disk.js';
import { collectNetworkMetrics } from './collectors/network.js';

const AGENT_VERSION = '1.0.0';

class ServerAgent {
  constructor() {
    this.config = new Config();
    this.reporter = new MetricsReporter(this.config.config);
    this.intervalId = null;
    this.isRunning = false;
  }

  async getSystemInfo() {
    const osInfo = await si.osInfo();
    const system = await si.system();
    
    return {
      hostname: os.hostname(),
      os: osInfo.distro || osInfo.platform,
      arch: os.arch(),
      platform: os.platform(),
      version: AGENT_VERSION,
      system: {
        manufacturer: system.manufacturer,
        model: system.model,
        serial: system.serial,
      },
    };
  }

  async collectAllMetrics() {
    const enabledCollectors = this.config.get('agent.enabledCollectors') || [];
    const metrics = {};

    if (enabledCollectors.includes('cpu')) {
      metrics.cpu = await collectCPUMetrics();
    }

    if (enabledCollectors.includes('memory')) {
      metrics.memory = await collectMemoryMetrics();
    }

    if (enabledCollectors.includes('disk')) {
      metrics.disk = await collectDiskMetrics();
    }

    if (enabledCollectors.includes('network')) {
      metrics.network = await collectNetworkMetrics();
    }

    return metrics;
  }

  async start() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  mPanel Server Agent v' + AGENT_VERSION);
    console.log('═══════════════════════════════════════════════════════');
    console.log('');

    // Get system info
    const systemInfo = await this.getSystemInfo();
    console.log('[Agent] System Information:');
    console.log(`  Hostname: ${systemInfo.hostname}`);
    console.log(`  OS: ${systemInfo.os}`);
    console.log(`  Arch: ${systemInfo.arch}`);
    console.log(`  Platform: ${systemInfo.platform}`);
    console.log('');

    // Register with control panel
    try {
      console.log('[Agent] Control Panel:', this.config.get('controlPanel.url'));
      
      const registrationData = await this.reporter.register(systemInfo);
      this.config.set('agent.agentId', registrationData.agentId);
      this.config.save();
      
      console.log('');
    } catch (error) {
      console.error('[Agent] ✗ Registration failed. Will retry on next cycle.');
      console.error('');
    }

    // Start metrics collection loop
    this.isRunning = true;
    const reportInterval = this.config.get('agent.reportInterval') * 1000; // Convert to ms
    
    console.log('[Agent] Starting metrics collection...');
    console.log(`[Agent] Report interval: ${this.config.get('agent.reportInterval')} seconds`);
    console.log('');

    // Collect and send metrics immediately
    await this.collectAndReport();

    // Then set up interval
    this.intervalId = setInterval(async () => {
      await this.collectAndReport();
    }, reportInterval);

    console.log('[Agent] ✓ Agent started successfully');
    console.log('[Agent] Press Ctrl+C to stop');
    console.log('');
  }

  async collectAndReport() {
    try {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Collecting metrics...`);

      const metrics = await this.collectAllMetrics();
      
      // Log summary
      if (metrics.cpu) {
        console.log(`  CPU: ${metrics.cpu.usage}% | Load: ${metrics.cpu.load['1min']}, ${metrics.cpu.load['5min']}, ${metrics.cpu.load['15min']}`);
      }
      if (metrics.memory) {
        console.log(`  Memory: ${metrics.memory.usagePercent}% (${metrics.memory.used} MB / ${metrics.memory.total} MB)`);
      }
      if (metrics.disk) {
        const totalDisk = metrics.disk.disks.reduce((sum, d) => sum + d.total, 0);
        const usedDisk = metrics.disk.disks.reduce((sum, d) => sum + d.used, 0);
        console.log(`  Disk: ${((usedDisk / totalDisk) * 100).toFixed(2)}% (${usedDisk} MB / ${totalDisk} MB)`);
      }
      if (metrics.network) {
        const rxMB = (metrics.network.totals.rxBytes / 1024 / 1024).toFixed(2);
        const txMB = (metrics.network.totals.txBytes / 1024 / 1024).toFixed(2);
        console.log(`  Network: RX ${rxMB} MB | TX ${txMB} MB`);
      }

      // Submit to control panel
      const success = await this.reporter.submitMetrics(metrics);
      
      if (!success && !this.reporter.agentId) {
        // Try to re-register if not registered
        console.log('[Agent] Attempting re-registration...');
        const systemInfo = await this.getSystemInfo();
        await this.reporter.register(systemInfo);
      }
      
      console.log('');
    } catch (error) {
      console.error('[Agent] Error collecting/reporting metrics:', error.message);
      console.log('');
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('');
    console.log('[Agent] Stopped');
  }
}

// Create and start agent
const agent = new ServerAgent();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('[Agent] Received SIGINT, shutting down...');
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('[Agent] Received SIGTERM, shutting down...');
  agent.stop();
  process.exit(0);
});

// Start the agent
agent.start().catch((error) => {
  console.error('[Agent] Fatal error:', error);
  process.exit(1);
});
