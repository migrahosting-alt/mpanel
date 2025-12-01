/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Server Selection Service - Selects optimal servers for CloudPod provisioning.
 * 
 * Selection criteria:
 * - Available resources (memory, disk)
 * - Current load
 * - Region preference
 * - Server health status
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// ============================================
// TYPES
// ============================================

export interface Server {
  id: string;
  hostname: string;
  ipv4: string;
  region: string;
  status: string;
  totalMemoryMb: number;
  totalDiskGb: number;
  allocatedMemoryMb: number;
  allocatedDiskGb: number;
  currentCloudPods: number;
  maxCloudPods: number;
}

export interface ServerSelectionCriteria {
  requiredMemoryMb: number;
  requiredDiskGb: number;
  preferredRegion: string | null;
  excludeServerIds?: string[];
}

// ============================================
// CONFIGURATION
// ============================================

// Reserve 20% of resources for overhead
const MEMORY_RESERVE_PERCENT = 0.20;
const DISK_RESERVE_PERCENT = 0.10;

// SSH connection settings
const SSH_USER = process.env.PROXMOX_SSH_USER ?? 'root';
const SSH_KEY_PATH = process.env.PROXMOX_SSH_KEY ?? '/home/mpanel/.ssh/id_ed25519';

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Select the best server for a new CloudPod.
 * 
 * @returns The selected server, or null if no suitable server is available
 */
export async function selectServerForCloudPod(
  criteria: ServerSelectionCriteria
): Promise<Server | null> {
  const { requiredMemoryMb, requiredDiskGb, preferredRegion, excludeServerIds = [] } = criteria;

  // Get all active servers
  const servers = await prisma.server.findMany({
    where: {
      status: 'ACTIVE',
      id: { notIn: excludeServerIds },
    },
    orderBy: [
      { allocatedMemoryMb: 'asc' }, // Prefer servers with more free memory
    ],
  });

  if (servers.length === 0) {
    logger.warn('No active servers available');
    return null;
  }

  // Calculate available resources for each server
  const serversWithAvailability = servers.map(server => {
    const availableMemory = (server.totalMemoryMb * (1 - MEMORY_RESERVE_PERCENT)) - server.allocatedMemoryMb;
    const availableDisk = (server.totalDiskGb * (1 - DISK_RESERVE_PERCENT)) - server.allocatedDiskGb;
    const hasCapacity = server.currentCloudPods < server.maxCloudPods;

    return {
      ...server,
      availableMemory,
      availableDisk,
      hasCapacity,
      meetsRequirements: 
        availableMemory >= requiredMemoryMb &&
        availableDisk >= requiredDiskGb &&
        hasCapacity,
    };
  });

  // Filter to servers that meet requirements
  const eligibleServers = serversWithAvailability.filter(s => s.meetsRequirements);

  if (eligibleServers.length === 0) {
    logger.warn('No servers meet resource requirements', {
      requiredMemoryMb,
      requiredDiskGb,
      checkedServers: servers.length,
    });
    return null;
  }

  // Prefer servers in the requested region
  let selectedServer = preferredRegion
    ? eligibleServers.find(s => s.region === preferredRegion)
    : null;

  // If no server in preferred region, use best-fit algorithm
  if (!selectedServer) {
    // Sort by best fit (least waste of resources)
    eligibleServers.sort((a, b) => {
      // Prefer server with closest match to required resources (least waste)
      const wasteA = (a.availableMemory - requiredMemoryMb) + (a.availableDisk - requiredDiskGb) * 100;
      const wasteB = (b.availableMemory - requiredMemoryMb) + (b.availableDisk - requiredDiskGb) * 100;
      return wasteA - wasteB;
    });

    selectedServer = eligibleServers[0];
  }

  logger.info('Server selected for CloudPod', {
    serverId: selectedServer.id,
    hostname: selectedServer.hostname,
    region: selectedServer.region,
    availableMemory: selectedServer.availableMemory,
    availableDisk: selectedServer.availableDisk,
    currentCloudPods: selectedServer.currentCloudPods,
  });

  return selectedServer as Server;
}

/**
 * Get SSH command prefix for connecting to a server.
 */
export async function getServerSshCommand(serverHostname: string): Promise<string> {
  // Use Tailscale if available, otherwise direct IP
  const tailscaleHostname = serverHostname.includes('.ts.net') 
    ? serverHostname 
    : `${serverHostname.split('.')[0]}.tailnet-xxxx.ts.net`;

  return `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i ${SSH_KEY_PATH} ${SSH_USER}@${tailscaleHostname}`;
}

/**
 * Update server resource allocation after creating/destroying CloudPod.
 */
export async function updateServerAllocation(
  serverId: string,
  memoryChange: number,
  diskChange: number,
  cloudPodCountChange: number
): Promise<void> {
  await prisma.server.update({
    where: { id: serverId },
    data: {
      allocatedMemoryMb: { increment: memoryChange },
      allocatedDiskGb: { increment: diskChange },
      currentCloudPods: { increment: cloudPodCountChange },
      updatedAt: new Date(),
    },
  });

  logger.debug('Server allocation updated', {
    serverId,
    memoryChange,
    diskChange,
    cloudPodCountChange,
  });
}

/**
 * Get server by ID.
 */
export async function getServerById(serverId: string): Promise<Server | null> {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
  });

  return server as Server | null;
}

/**
 * Get all servers with their current status.
 */
export async function getAllServers(): Promise<Server[]> {
  const servers = await prisma.server.findMany({
    orderBy: [{ region: 'asc' }, { hostname: 'asc' }],
  });

  return servers as Server[];
}

/**
 * Check server health by attempting SSH connection.
 */
export async function checkServerHealth(serverId: string): Promise<{
  healthy: boolean;
  latencyMs: number | null;
  error: string | null;
}> {
  const server = await getServerById(serverId);

  if (!server) {
    return { healthy: false, latencyMs: null, error: 'Server not found' };
  }

  const sshCmd = await getServerSshCommand(server.hostname);
  const { execSync } = await import('child_process');

  const startTime = Date.now();

  try {
    execSync(`${sshCmd} 'echo ok'`, {
      timeout: 10_000,
      encoding: 'utf-8',
    });

    const latencyMs = Date.now() - startTime;

    return { healthy: true, latencyMs, error: null };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get server resource usage from Proxmox.
 */
export async function getServerResourceUsage(serverId: string): Promise<{
  cpuPercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
} | null> {
  const server = await getServerById(serverId);

  if (!server) {
    return null;
  }

  const sshCmd = await getServerSshCommand(server.hostname);
  const { execSync } = await import('child_process');

  try {
    // Get resource stats via SSH
    const output = execSync(
      `${sshCmd} 'cat /proc/stat /proc/meminfo && df -BG /' | head -50`,
      { timeout: 15_000, encoding: 'utf-8' }
    );

    // Parse memory info
    const memTotal = parseInt(output.match(/MemTotal:\s+(\d+)/)?.[1] ?? '0') / 1024;
    const memFree = parseInt(output.match(/MemAvailable:\s+(\d+)/)?.[1] ?? '0') / 1024;

    // Parse disk info (simplified)
    const diskMatch = output.match(/(\d+)G\s+(\d+)G\s+(\d+)G\s+\d+%\s+\/$/m);
    const diskTotal = parseInt(diskMatch?.[1] ?? '0');
    const diskUsed = parseInt(diskMatch?.[2] ?? '0');

    return {
      cpuPercent: 0, // Would need to calculate from /proc/stat
      memoryUsedMb: Math.round(memTotal - memFree),
      memoryTotalMb: Math.round(memTotal),
      diskUsedGb: diskUsed,
      diskTotalGb: diskTotal,
    };
  } catch (error) {
    logger.error('Failed to get server resource usage', {
      serverId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

/**
 * Sync server resource allocation from actual CloudPods.
 * Run periodically to fix any allocation drift.
 */
export async function syncServerAllocations(): Promise<void> {
  const servers = await prisma.server.findMany();

  for (const server of servers) {
    // Get actual allocations from CloudPods
    const aggregation = await prisma.cloudPod.aggregate({
      where: {
        serverId: server.id,
        status: { notIn: ['DELETED', 'FAILED'] },
      },
      _sum: {
        memoryMb: true,
        diskGb: true,
      },
      _count: true,
    });

    const actualMemory = aggregation._sum.memoryMb ?? 0;
    const actualDisk = aggregation._sum.diskGb ?? 0;
    const actualCount = aggregation._count;

    // Update if different
    if (
      server.allocatedMemoryMb !== actualMemory ||
      server.allocatedDiskGb !== actualDisk ||
      server.currentCloudPods !== actualCount
    ) {
      await prisma.server.update({
        where: { id: server.id },
        data: {
          allocatedMemoryMb: actualMemory,
          allocatedDiskGb: actualDisk,
          currentCloudPods: actualCount,
          updatedAt: new Date(),
        },
      });

      logger.info('Server allocation synced', {
        serverId: server.id,
        hostname: server.hostname,
        oldMemory: server.allocatedMemoryMb,
        newMemory: actualMemory,
        oldDisk: server.allocatedDiskGb,
        newDisk: actualDisk,
        oldCount: server.currentCloudPods,
        newCount: actualCount,
      });
    }
  }
}

export default {
  selectServerForCloudPod,
  getServerSshCommand,
  updateServerAllocation,
  getServerById,
  getAllServers,
  checkServerHealth,
  getServerResourceUsage,
  syncServerAllocations,
};
