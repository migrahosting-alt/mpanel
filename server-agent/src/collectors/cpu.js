/**
 * CPU Metrics Collector
 * Collects CPU usage and load average
 */

import os from 'os';
import si from 'systeminformation';

export async function collectCPUMetrics() {
  try {
    // Get current load
    const currentLoad = await si.currentLoad();
    
    // Get load average (1min, 5min, 15min)
    const loadAvg = os.loadavg();
    
    // Get CPU info
    const cpuInfo = await si.cpu();
    
    return {
      usage: parseFloat(currentLoad.currentLoad.toFixed(2)), // Overall CPU usage %
      cores: os.cpus().length,
      load: {
        '1min': parseFloat(loadAvg[0].toFixed(2)),
        '5min': parseFloat(loadAvg[1].toFixed(2)),
        '15min': parseFloat(loadAvg[2].toFixed(2)),
      },
      info: {
        manufacturer: cpuInfo.manufacturer,
        brand: cpuInfo.brand,
        speed: cpuInfo.speed, // GHz
        cores: cpuInfo.cores,
        physicalCores: cpuInfo.physicalCores,
      },
    };
  } catch (error) {
    console.error('[CPU Collector] Error:', error);
    return null;
  }
}
