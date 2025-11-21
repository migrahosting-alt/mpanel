/**
 * Network Metrics Collector
 * Collects network traffic statistics
 */

import si from 'systeminformation';

export async function collectNetworkMetrics() {
  try {
    // Get network interfaces
    const networkInterfaces = await si.networkInterfaces();
    
    // Get network stats
    const networkStats = await si.networkStats();
    
    const interfaces = networkInterfaces
      .filter(iface => !iface.internal && iface.operstate === 'up')
      .map(iface => {
        const stats = networkStats.find(s => s.iface === iface.iface) || {};
        
        return {
          name: iface.iface,
          ip4: iface.ip4,
          ip6: iface.ip6,
          mac: iface.mac,
          type: iface.type,
          speed: iface.speed || 0, // Mbps
          state: iface.operstate,
          rx: {
            bytes: stats.rx_bytes || 0,
            packets: stats.rx_sec || 0,
            errors: stats.rx_errors || 0,
            dropped: stats.rx_dropped || 0,
          },
          tx: {
            bytes: stats.tx_bytes || 0,
            packets: stats.tx_sec || 0,
            errors: stats.tx_errors || 0,
            dropped: stats.tx_dropped || 0,
          },
        };
      });
    
    // Calculate totals
    const totals = interfaces.reduce(
      (acc, iface) => ({
        rxBytes: acc.rxBytes + iface.rx.bytes,
        txBytes: acc.txBytes + iface.tx.bytes,
        rxPackets: acc.rxPackets + iface.rx.packets,
        txPackets: acc.txPackets + iface.tx.packets,
      }),
      { rxBytes: 0, txBytes: 0, rxPackets: 0, txPackets: 0 }
    );
    
    return {
      interfaces,
      totals,
    };
  } catch (error) {
    console.error('[Network Collector] Error:', error);
    return null;
  }
}
