/**
 * Disk Metrics Collector
 * Collects disk usage for all mount points
 */

import si from 'systeminformation';

export async function collectDiskMetrics() {
  try {
    // Get file system info
    const fsSize = await si.fsSize();
    
    const disks = fsSize.map(disk => ({
      mount: disk.mount,
      fs: disk.fs,
      type: disk.type,
      total: Math.floor(disk.size / 1024 / 1024), // MB
      used: Math.floor(disk.used / 1024 / 1024), // MB
      free: Math.floor((disk.size - disk.used) / 1024 / 1024), // MB
      usagePercent: parseFloat(disk.use.toFixed(2)),
    }));
    
    // Get disk I/O stats
    const diskIO = await si.disksIO();
    
    return {
      disks,
      io: {
        rIO: diskIO.rIO || 0, // Read operations
        wIO: diskIO.wIO || 0, // Write operations
        tIO: diskIO.tIO || 0, // Total operations
        rIO_sec: diskIO.rIO_sec || 0, // Read ops/sec
        wIO_sec: diskIO.wIO_sec || 0, // Write ops/sec
      },
    };
  } catch (error) {
    console.error('[Disk Collector] Error:', error);
    return null;
  }
}
