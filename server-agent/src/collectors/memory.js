/**
 * Memory Metrics Collector
 * Collects RAM usage and statistics
 */

import si from 'systeminformation';

export async function collectMemoryMetrics() {
  try {
    // Get memory info
    const mem = await si.mem();
    
    const totalMB = Math.floor(mem.total / 1024 / 1024);
    const usedMB = Math.floor(mem.used / 1024 / 1024);
    const freeMB = Math.floor(mem.free / 1024 / 1024);
    const availableMB = Math.floor(mem.available / 1024 / 1024);
    const cachedMB = Math.floor((mem.cached || 0) / 1024 / 1024);
    
    return {
      total: totalMB,
      used: usedMB,
      free: freeMB,
      available: availableMB,
      cached: cachedMB,
      usagePercent: parseFloat(((usedMB / totalMB) * 100).toFixed(2)),
      swap: {
        total: Math.floor(mem.swaptotal / 1024 / 1024),
        used: Math.floor(mem.swapused / 1024 / 1024),
        free: Math.floor(mem.swapfree / 1024 / 1024),
      },
    };
  } catch (error) {
    console.error('[Memory Collector] Error:', error);
    return null;
  }
}
