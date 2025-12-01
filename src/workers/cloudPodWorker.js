// src/workers/cloudPodWorker.js
// ============================================================================
// Cloud Pod Provisioning Worker (v2 - SSH-based)
// Uses SSH + sudo cloudpod-create.sh for container provisioning
// 
// Based on: docs/cloudpods-proxmox-spec.md
// 
// Environment Variables:
//   PROXMOX_SSH_HOST          - 10.1.10.70 (Proxmox node IP)
//   PROXMOX_SSH_USER          - mpanel-automation (sudoers user)
//   PROXMOX_SSH_KEY_PATH      - ~/.ssh/id_ed25519 (path to SSH key)
//   DATABASE_URL              - postgres://user:pass@host:port/db
//   PDNS_API_KEY              - PowerDNS API key
// ============================================================================

import pg from 'pg';
const { Pool } = pg;

import { spawn } from 'child_process';
import path from 'path';
import fetch from 'node-fetch';

// Database connection - DATABASE_URL is REQUIRED
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Simple logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${new Date().toISOString()} ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg, data) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, data ? JSON.stringify(data) : ''),
  warn: (msg, data) => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, data ? JSON.stringify(data) : ''),
};

// Configuration from spec - all values from environment with sensible defaults
const CONFIG = {
  proxmox: {
    sshHost: process.env.PROXMOX_SSH_HOST || process.env.PROXMOX_HOST || 'proxmox-host',
    sshUser: process.env.PROXMOX_SSH_USER || 'mpanel-automation',
    sshKeyPath: process.env.PROXMOX_SSH_KEY_PATH || path.join(process.env.HOME || '/home/mhadmin', '.ssh', 'id_ed25519'),
    provisionScript: '/usr/local/sbin/cloudpod-create.sh',
    destroyScript: '/usr/local/sbin/cloudpod-destroy.sh',
  },
  // Network managed by Proxmox IPAM (auto-ip)
  network: {
    prefix: process.env.CLOUDPOD_NETWORK_PREFIX || '10.1.10',
    gateway: process.env.CLOUDPOD_NETWORK_GATEWAY || '10.1.10.1',
  },
  plans: {
    CLOUD_POD_STUDENT: { cores: 1, memMb: 1024, swapMb: 256 },
    CLOUD_POD_STARTER: { cores: 1, memMb: 1024, swapMb: 512 },
    CLOUD_POD_PREMIUM: { cores: 2, memMb: 2048, swapMb: 512 },
    CLOUD_POD_BUSINESS: { cores: 3, memMb: 4096, swapMb: 1024 },
  },
  dns: {
    apiUrl: process.env.PDNS_API_URL || process.env.POWERDNS_API_URL || 'http://dns-core:8081/api/v1',
    apiKey: process.env.PDNS_API_KEY || process.env.POWERDNS_API_KEY,
  },
};

// ============================================================================
// SSH Command Runner
// ============================================================================

function runSSH(command) {
  return new Promise((resolve, reject) => {
    const sshArgs = [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'BatchMode=yes',
      '-i', CONFIG.proxmox.sshKeyPath,
      `${CONFIG.proxmox.sshUser}@${CONFIG.proxmox.sshHost}`,
      command,
    ];
    
    logger.info(`SSH: ${command.substring(0, 100)}...`);
    
    const proc = spawn('ssh', sshArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`SSH command failed (code ${code}): ${stderr || stdout}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(new Error(`SSH spawn error: ${err.message}`));
    });
  });
}

// ============================================================================
// IP Address Manager
// ============================================================================

async function getNextIpOctet() {
  // Get all used IP octets from database
  const result = await pool.query(`
    SELECT ip_address FROM cloud_pod_queue 
    WHERE ip_address IS NOT NULL
  `);
  
  const usedOctets = new Set();
  result.rows.forEach(row => {
    const ip = row.ip_address;
    if (ip) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        usedOctets.add(parseInt(parts[3], 10));
      }
    }
  });
  
  // Reserve 90 for template
  usedOctets.add(90);
  
  // Find next available octet
  for (let octet = CONFIG.network.startOctet; octet <= CONFIG.network.maxOctet; octet++) {
    if (!usedOctets.has(octet)) {
      return octet;
    }
  }
  
  throw new Error('No available IP addresses in the CloudPod range');
}

async function getNextVmId() {
  // Get used VMIDs from database
  const result = await pool.query(`
    SELECT vmid FROM cloud_pod_queue WHERE vmid IS NOT NULL
  `);
  
  const usedVmids = new Set(result.rows.map(r => r.vmid));
  
  // Also get from Proxmox
  try {
    const sshResult = await runSSH('sudo pct list | tail -n +2 | awk \'{print $1}\'');
    sshResult.stdout.split('\n').filter(Boolean).forEach(id => {
      usedVmids.add(parseInt(id, 10));
    });
  } catch (err) {
    logger.warn('Could not get VMIDs from Proxmox, using database only');
  }
  
  // Start from 107 and find next available
  for (let vmid = 107; vmid < 10000; vmid++) {
    if (!usedVmids.has(vmid)) {
      return vmid;
    }
  }
  
  throw new Error('No available VMIDs');
}

// ============================================================================
// Container Provisioning via SSH
// ============================================================================

async function provisionContainer(task) {
  const { id: taskId, plan_code, primary_domain, customer_id } = task;
  
  logger.info(`Provisioning CloudPod`, { taskId, plan: plan_code, domain: primary_domain, tenant: customer_id });
  
  // Get plan resources
  const planResources = CONFIG.plans[plan_code];
  if (!planResources) {
    throw new Error(`Unknown plan: ${plan_code}`);
  }
  
  // Allocate VMID (IP will be auto-allocated by the script)
  const vmid = await getNextVmId();
  
  // Generate hostname from domain or customer ID
  const hostname = primary_domain && primary_domain !== '1'
    ? primary_domain.replace(/[^a-z0-9-]/gi, '-').substring(0, 32)
    : `pod-${customer_id || taskId}`.substring(0, 32);
  
  // Tenant ID for tracking
  const tenantId = customer_id || `tenant-${taskId}`;
  
  logger.info(`Allocated VMID`, { vmid, hostname, tenant: tenantId });
  
  // Update task with allocated VMID (IP comes from script output)
  await pool.query(`
    UPDATE cloud_pod_queue 
    SET vmid = $1, status = 'provisioning', updated_at = NOW()
    WHERE id = $2
  `, [vmid, taskId]);
  
  // Build the provisioning command with --auto-ip and --tenant
  const scriptCmd = [
    `sudo ${CONFIG.proxmox.provisionScript}`,
    `--vmid ${vmid}`,
    `--host ${hostname}`,
    `--auto-ip`,
    `--cores ${planResources.cores}`,
    `--mem ${planResources.memMb}`,
    `--swap ${planResources.swapMb}`,
    `--tenant ${tenantId}`,
  ].join(' ');
  
  logger.info(`Running provisioning script`, { vmid, hostname, tenant: tenantId });
  
  try {
    const result = await runSSH(scriptCmd);
    
    // Parse JSON result from script output (v3 format)
    let provisionResult = null;
    let ip = null;
    
    // Try to extract IP from the script output
    const ipMatch = result.stdout.match(/IP\s*:\s*(\d+\.\d+\.\d+\.\d+)/);
    if (ipMatch) {
      ip = ipMatch[1];
    }
    
    // Also try JSON result block if present
    const jsonMatch = result.stdout.match(/### JSON_RESULT_START ###\s*([\s\S]*?)\s*### JSON_RESULT_END ###/);
    if (jsonMatch) {
      try {
        provisionResult = JSON.parse(jsonMatch[1]);
        ip = provisionResult.ip || ip;
      } catch (e) {
        logger.warn('Could not parse JSON result from script');
      }
    }
    
    logger.info(`Container provisioned successfully`, { vmid, ip, tenant: tenantId, result: provisionResult });
    
    // Update task as completed with the IP from the script
    await pool.query(`
      UPDATE cloud_pod_queue 
      SET status = 'active', 
          vmid = $1, 
          ip_address = $2, 
          completed_at = NOW(), 
          updated_at = NOW()
      WHERE id = $3
    `, [vmid, ip, taskId]);
    
    return { vmid, ip, hostname, tenant: tenantId, output: result.stdout };
    
  } catch (error) {
    logger.error(`Provisioning failed`, { vmid, tenant: tenantId, error: error.message });
    
    // Update task with error
    await pool.query(`
      UPDATE cloud_pod_queue 
      SET status = 'failed', 
          error_message = $1, 
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = $2
    `, [error.message, taskId]);
    
    throw error;
  }
}

// ============================================================================
// DNS Setup (PowerDNS)
// ============================================================================

async function setupDns(domain, ip) {
  if (!CONFIG.dns.apiKey) {
    logger.warn('PowerDNS API key not configured, skipping DNS setup');
    return null;
  }
  
  const baseUrl = CONFIG.dns.apiUrl;
  const headers = {
    'X-API-Key': CONFIG.dns.apiKey,
    'Content-Type': 'application/json',
  };
  
  try {
    // Create zone
    const createZoneRes = await fetch(`${baseUrl}/servers/localhost/zones`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `${domain}.`,
        kind: 'Native',
        nameservers: ['ns1.migrahosting.com.', 'ns2.migrahosting.com.'],
        soa_edit_api: 'INCEPTION-INCREMENT',
      }),
    });
    
    if (!createZoneRes.ok && createZoneRes.status !== 409) {
      const err = await createZoneRes.text();
      if (!err.includes('already exists')) {
        throw new Error(`Failed to create zone: ${err}`);
      }
    }
    
    // Add A records
    const rrsets = [
      { name: `${domain}.`, type: 'A', ttl: 3600, changetype: 'REPLACE', records: [{ content: ip, disabled: false }] },
      { name: `www.${domain}.`, type: 'A', ttl: 3600, changetype: 'REPLACE', records: [{ content: ip, disabled: false }] },
      { name: `${domain}.`, type: 'MX', ttl: 3600, changetype: 'REPLACE', records: [{ content: '10 mail.migrahosting.com.', disabled: false }] },
      { name: `${domain}.`, type: 'TXT', ttl: 3600, changetype: 'REPLACE', records: [{ content: '"v=spf1 include:mail.migrahosting.com ~all"', disabled: false }] },
    ];
    
    const patchRes = await fetch(`${baseUrl}/servers/localhost/zones/${domain}.`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ rrsets }),
    });
    
    if (!patchRes.ok) {
      const err = await patchRes.text();
      throw new Error(`Failed to add records: ${err}`);
    }
    
    logger.info(`DNS configured for ${domain} -> ${ip}`);
    return { domain, ip };
    
  } catch (error) {
    logger.error(`DNS setup failed for ${domain}`, { error: error.message });
    throw error;
  }
}

// ============================================================================
// Main Worker Loop
// ============================================================================

async function processNextTask() {
  const client = await pool.connect();
  
  try {
    // Get next pending task with lock
    const result = await client.query(`
      UPDATE cloud_pod_queue 
      SET status = 'processing', updated_at = NOW()
      WHERE id = (
        SELECT id FROM cloud_pod_queue 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);
    
    if (result.rows.length === 0) {
      return null; // No tasks
    }
    
    const task = result.rows[0];
    logger.info(`Processing task`, { taskId: task.id, plan: task.plan_code });
    
    // Provision the container
    const provisionResult = await provisionContainer(task);
    
    // Setup DNS if domain is provided
    if (task.primary_domain && task.primary_domain !== '1') {
      try {
        await setupDns(task.primary_domain, provisionResult.ip);
      } catch (dnsError) {
        logger.error(`DNS setup failed, container still active`, { error: dnsError.message });
      }
    }
    
    return provisionResult;
    
  } finally {
    client.release();
  }
}

async function runWorker() {
  const workerId = `cloudpod-worker-${process.pid}`;
  logger.info(`Cloud Pod Worker started`, { workerId });
  
  // Test SSH connectivity
  try {
    const testResult = await runSSH('echo "SSH OK" && whoami');
    logger.info(`SSH connectivity verified`, { user: testResult.stdout.trim() });
  } catch (error) {
    logger.error(`SSH connectivity test failed`, { error: error.message });
    logger.error(`Ensure SSH key is configured: ${CONFIG.proxmox.sshKeyPath}`);
    process.exit(1);
  }
  
  // Main loop
  while (true) {
    try {
      const result = await processNextTask();
      
      if (result) {
        logger.info(`Task completed`, { vmid: result.vmid, ip: result.ip });
      } else {
        // No tasks, wait before checking again
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
    } catch (error) {
      logger.error(`Worker error`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

// Export for module use
export { runWorker, provisionContainer, setupDns, runSSH };

// Run if executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('cloudPodWorker.js') ||
  process.argv[1].includes('cloudPodWorker')
);

if (isMainModule) {
  runWorker().catch(error => {
    logger.error(`Worker crashed`, { error: error.message, stack: error.stack });
    process.exit(1);
  });
}
