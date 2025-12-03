import logger from '../../config/logger.js';

// Core infrastructure servers (10.1.10.100-220)
const CORE_SERVERS = [
  { id: '100', name: 'SRV1-WEB', ip: '10.1.10.100', type: 'WEB', services: ['nginx', 'node'] },
  { id: '101', name: 'SRV2-WEB', ip: '10.1.10.101', type: 'WEB', services: ['nginx', 'node'] },
  { id: '200', name: 'DB-CORE', ip: '10.1.10.200', type: 'DATABASE', services: ['postgresql', 'redis'] },
  { id: '201', name: 'DB-REPLICA', ip: '10.1.10.201', type: 'DATABASE', services: ['postgresql'] },
  { id: '206', name: 'MPANEL-CORE', ip: '10.1.10.206', type: 'APPLICATION', services: ['pm2', 'node'] },
  { id: '210', name: 'MAIL-CORE', ip: '10.1.10.210', type: 'MAIL', services: ['postfix', 'dovecot'] },
  { id: '215', name: 'DNS-CORE', ip: '10.1.10.215', type: 'DNS', services: ['bind9'] },
  { id: '220', name: 'CLOUD-CORE', ip: '10.1.10.220', type: 'ORCHESTRATION', services: ['docker', 'k3s'] },
];

interface ListServersParams {
  status?: string;
  type?: string;
}

export async function listServers(params: ListServersParams) {
  const { status, type } = params;

  let servers = CORE_SERVERS;

  if (type) {
    servers = servers.filter((s) => s.type === type);
  }

  // Mock status - in production, fetch from actual monitoring
  return servers.map((server) => ({
    ...server,
    status: 'ONLINE',
    uptime: Math.random() * 30 * 24 * 60 * 60,
    cpuUsage: Math.random() * 60,
    memoryUsage: Math.random() * 70,
    diskUsage: Math.random() * 50,
    lastHealthCheck: new Date(),
  }));
}

export async function getServer(id: string) {
  const server = CORE_SERVERS.find((s) => s.id === id);

  if (!server) {
    throw new Error('Server not found');
  }

  // Mock detailed metrics
  return {
    ...server,
    status: 'ONLINE',
    uptime: Math.random() * 30 * 24 * 60 * 60,
    cpuUsage: Math.random() * 60,
    memoryUsage: Math.random() * 70,
    diskUsage: Math.random() * 50,
    networkIn: Math.random() * 1000000,
    networkOut: Math.random() * 1000000,
    lastHealthCheck: new Date(),
    guardianAgent: {
      version: '1.0.0',
      status: 'CONNECTED',
      lastSeen: new Date(),
    },
  };
}

export async function getServerMetrics(serverId: string, timeRange: string) {
  const server = CORE_SERVERS.find((s) => s.id === serverId);

  if (!server) {
    throw new Error('Server not found');
  }

  // Mock time-series metrics
  const points = 60;
  const now = Date.now();
  const interval = timeRange === '1h' ? 60000 : 300000;

  const metrics = {
    cpu: Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * interval),
      value: Math.random() * 60,
    })),
    memory: Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * interval),
      value: Math.random() * 70,
    })),
    disk: Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * interval),
      value: Math.random() * 50,
    })),
    network: Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * interval),
      in: Math.random() * 1000000,
      out: Math.random() * 1000000,
    })),
  };

  return metrics;
}

export async function runHealthCheck(serverId: string) {
  const server = CORE_SERVERS.find((s) => s.id === serverId);

  if (!server) {
    throw new Error('Server not found');
  }

  logger.info('Running health check', { serverId });

  // Mock health check results
  return {
    timestamp: new Date(),
    status: 'HEALTHY',
    checks: {
      ping: { status: 'PASS', latency: Math.random() * 10 },
      ssh: { status: 'PASS', latency: Math.random() * 50 },
      services: server.services.map((service) => ({
        name: service,
        status: 'RUNNING',
        uptime: Math.random() * 30 * 24 * 60 * 60,
      })),
    },
  };
}

export async function restartService(serverId: string, serviceName: string) {
  const server = CORE_SERVERS.find((s) => s.id === serverId);

  if (!server) {
    throw new Error('Server not found');
  }

  if (!server.services.includes(serviceName)) {
    throw new Error('Service not found on this server');
  }

  logger.warn('Restarting service', { serverId, serviceName });

  // In production, execute actual SSH command via runCommand helper
  return {
    success: true,
    service: serviceName,
    timestamp: new Date(),
    message: `Service ${serviceName} restarted successfully`,
  };
}

export async function getGuardianStatus(serverId: string) {
  const server = CORE_SERVERS.find((s) => s.id === serverId);

  if (!server) {
    throw new Error('Server not found');
  }

  // Mock Guardian agent status
  return {
    agentVersion: '1.0.0',
    status: 'CONNECTED',
    lastSeen: new Date(),
    policyPack: 'default',
    policyVersion: 'v1',
    lastScan: new Date(Date.now() - 3600000),
    findings: {
      critical: Math.floor(Math.random() * 3),
      high: Math.floor(Math.random() * 5),
      medium: Math.floor(Math.random() * 10),
      low: Math.floor(Math.random() * 20),
    },
  };
}

export default {
  listServers,
  getServer,
  getServerMetrics,
  runHealthCheck,
  restartService,
  getGuardianStatus,
};
