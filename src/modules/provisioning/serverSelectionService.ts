/**
 * NOTE FOR COPILOT:
 * This project follows the architecture defined in docs/mpanel-modules-spec.md.
 * Server Selection Service - Selects optimal servers for CloudPod provisioning.
 * 
 * SCHEMA ALIGNMENT (from prisma/schema.prisma Server model):
 * - id, tenantId, name, hostname, role, ipAddress, internalIp
 * - location, provider, status, isActive
 * - cpu, ramGb, diskGb
 * - No allocatedMemoryMb, allocatedDiskGb, currentCloudPods, maxCloudPods
 * 
 * For resource tracking, use CloudPod aggregate queries.
 */

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';

// ============================================
// TYPES - Schema-aligned
// ============================================

/**
 * Server type matching actual Prisma schema.
 */
export interface Server {
  id: string;
  tenantId: string;
  name: string;
  hostname: string | null;
  role: string;
  ipAddress: string;
  internalIp: string | null;
  location: string | null;
  provider: string | null;
  status: string;
  isActive: boolean;
  cpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
  // Computed at runtime (not in DB)
  region?: string;
  availableRamGb?: number;
  availableDiskGb?: number;
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

// SSH connection settings - ALL from environment
const SSH_USER = process.env.PROXMOX_SSH_USER ?? 'root';
const SSH_KEY_PATH = process.env.PROXMOX_SSH_KEY ?? '/home/mpanel/.ssh/id_ed25519';
const TAILNET_DOMAIN = process.env.TAILNET_DOMAIN ?? 'tailnet.ts.net';

// Default limits when server doesn't have specs
const DEFAULT_MAX_CLOUDPODS_PER_SERVER = 50;

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Select the best server for a new CloudPod.
 * Uses actual Prisma schema fields and runtime CloudPod aggregation.
 * 
 * @returns The selected server, or null if no suitable server is available
 */
export async function selectServerForCloudPod(
  criteria: ServerSelectionCriteria
): Promise<Server | null> {
  const { requiredMemoryMb, requiredDiskGb, preferredRegion, excludeServerIds = [] } = criteria;

  // Get all active servers with Proxmox/CloudPod role
  const servers = await prisma.server.findMany({
    where: {
      isActive: true,
      role: { in: ['proxmox', 'cloudpod', 'web'] }, // Roles that can host CloudPods
      id: { notIn: excludeServerIds },
    },
    orderBy: [
      { ramGb: 'desc' }, // Prefer servers with more RAM
    ],
  });

  if (servers.length === 0) {
    logger.warn('No active servers available for CloudPod provisioning');
    return null;
  }

  // Calculate available resources for each server using CloudPod aggregation
  const serversWithAvailability = await Promise.all(
    servers.map(async (server) => {
      // Get current CloudPod usage for this server's tenant (or globally if needed)
      const usage = await prisma.cloudPod.aggregate({
        where: {
          tenantId: server.tenantId,
          status: { notIn: ['deleted', 'failed'] },
        },
        _sum: {
          memoryMb: true,
          diskGb: true,
        },
        _count: true,
      });

      const usedMemoryMb = usage._sum?.memoryMb ?? 0;
      const usedDiskGb = usage._sum?.diskGb ?? 0;
      const cloudPodCount = usage._count;

      // Convert server specs to MB for comparison
      const totalMemoryMb = (server.ramGb ?? 0) * 1024;
      const totalDiskGb = server.diskGb ?? 0;

      const availableMemoryMb = (totalMemoryMb * (1 - MEMORY_RESERVE_PERCENT)) - usedMemoryMb;
      const availableDiskGb = (totalDiskGb * (1 - DISK_RESERVE_PERCENT)) - usedDiskGb;
      const hasCapacity = cloudPodCount < DEFAULT_MAX_CLOUDPODS_PER_SERVER;

      return {
        ...server,
        region: server.location ?? 'default', // Map location to region
        availableMemoryMb,
        availableDiskGb,
        cloudPodCount,
        hasCapacity,
        meetsRequirements:
          availableMemoryMb >= requiredMemoryMb &&
          availableDiskGb >= requiredDiskGb &&
          hasCapacity,
      };
    })
  );

  // Filter to servers that meet requirements
  const eligibleServers = serversWithAvailability.filter((s) => s.meetsRequirements);

  if (eligibleServers.length === 0) {
    logger.warn('No servers meet resource requirements', {
      requiredMemoryMb,
      requiredDiskGb,
      checkedServers: servers.length,
    });
    return null;
  }

  // Prefer servers in the requested region (using location field)
  let selectedServer = preferredRegion
    ? eligibleServers.find((s) => s.region === preferredRegion || s.location === preferredRegion)
    : null;

  // If no server in preferred region, use best-fit algorithm
  if (!selectedServer) {
    // Sort by best fit (least waste of resources)
    eligibleServers.sort((a, b) => {
      const wasteA = (a.availableMemoryMb - requiredMemoryMb) + (a.availableDiskGb - requiredDiskGb) * 100;
      const wasteB = (b.availableMemoryMb - requiredMemoryMb) + (b.availableDiskGb - requiredDiskGb) * 100;
      return wasteA - wasteB;
    });

    selectedServer = eligibleServers[0];
  }

  logger.info('Server selected for CloudPod', {
    serverId: selectedServer.id,
    hostname: selectedServer.hostname,
    region: selectedServer.region,
    availableMemoryMb: selectedServer.availableMemoryMb,
    availableDiskGb: selectedServer.availableDiskGb,
    cloudPodCount: selectedServer.cloudPodCount,
  });

  return selectedServer as Server;
}

/**
 * Get SSH command prefix for connecting to a server.
 * Uses TAILNET_DOMAIN env var - no hardcoded values.
 */
export async function getServerSshCommand(serverHostname: string): Promise<string> {
  // Use Tailscale if available, otherwise direct IP/hostname
  const targetHost = serverHostname.includes('.ts.net')
    ? serverHostname
    : `${serverHostname.split('.')[0]}.${TAILNET_DOMAIN}`;

  return `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 -i ${SSH_KEY_PATH} ${SSH_USER}@${targetHost}`;
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
    where: { isActive: true },
    orderBy: [{ location: 'asc' }, { hostname: 'asc' }],
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

  if (!server || !server.hostname) {
    return { healthy: false, latencyMs: null, error: 'Server not found or no hostname' };
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

  if (!server || !server.hostname) {
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
 * Get CloudPod resource usage aggregated by tenant.
 * This replaces the old server-level allocation tracking.
 */
export async function getCloudPodUsageByTenant(tenantId: string): Promise<{
  totalCloudPods: number;
  totalMemoryMb: number;
  totalDiskGb: number;
  totalCores: number;
}> {
  const aggregation = await prisma.cloudPod.aggregate({
    where: {
      tenantId,
      status: { notIn: ['deleted', 'failed'] },
    },
    _sum: {
      memoryMb: true,
      diskGb: true,
      cores: true,
    },
    _count: true,
  });

  return {
    totalCloudPods: aggregation._count,
    totalMemoryMb: aggregation._sum?.memoryMb ?? 0,
    totalDiskGb: aggregation._sum?.diskGb ?? 0,
    totalCores: aggregation._sum?.cores ?? 0,
  };
}

export default {
  selectServerForCloudPod,
  getServerSshCommand,
  getServerById,
  getAllServers,
  checkServerHealth,
  getServerResourceUsage,
  getCloudPodUsageByTenant,
};
