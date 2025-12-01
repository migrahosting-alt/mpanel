/**
 * Proxmox SSH Command Runner
 * 
 * Executes commands on Proxmox host via SSH using the mpanel-automation user.
 * This is the bridge between mPanel Control Plane and Proxmox Data Plane.
 * 
 * @see docs/migra-cloudpods-platform-spec.md Section 3
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

// Configuration from environment (defaults match INFRA_SOURCE_OF_TRUTH.md)
const PROXMOX_HOST = process.env.PROXMOX_HOST || '10.1.10.70';
const PROXMOX_USER = process.env.PROXMOX_SSH_USER || 'mpanel-automation';
const PROXMOX_SSH_KEY = process.env.PROXMOX_SSH_KEY_PATH || '/home/mhadmin/.ssh/id_ed25519';
const PROXMOX_SSH_OPTS = process.env.PROXMOX_SSH_OPTS || '-o StrictHostKeyChecking=no -o ConnectTimeout=30';

export interface ProxmoxCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CloudPodCreateResult {
  success: boolean;
  vmid: number;
  hostname: string;
  tenant: string;
  ip: string;
  ipCidr: string;
  gateway: string;
  storage: string;
  bridge: string;
  cores: number;
  memoryMb: number;
  swapMb: number;
  pool: string;
}

export interface CloudPodDestroyResult {
  success: boolean;
  action: string;
  vmid: number;
  hostname: string;
  ip: string;
  tenant: string;
}

export interface CloudPodBackupResult {
  success: boolean;
  action: string;
  vmid: number;
  hostname: string;
  snapshot: string;
}

export interface CloudPodHealthResult {
  vmid: number;
  hostname: string;
  status: string;
  ip: string;
  cpuPct: number;
  memMb: number;
  memMaxMb: number;
  memPct: number;
  diskGb: number;
  diskMaxGb: number;
  diskPct: number;
  uptimeSec: number;
  healthy: boolean;
  issues: string;
}

/**
 * Execute a raw SSH command on the Proxmox host
 */
export async function runProxmoxCommand(command: string): Promise<ProxmoxCommandResult> {
  // Build SSH command with key-based auth
  const sshCmd = `ssh ${PROXMOX_SSH_OPTS} -i ${PROXMOX_SSH_KEY} ${PROXMOX_USER}@${PROXMOX_HOST} ${JSON.stringify(command)}`;
  
  try {
    const { stdout, stderr } = await execAsync(sshCmd, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300000 // 5 minute timeout
    });
    
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    // exec throws on non-zero exit
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? error.message,
      exitCode: error.code ?? 1
    };
  }
}

/**
 * Parse JSON result from cloudpod scripts
 * Scripts output JSON between ### JSON_RESULT_START ### and ### JSON_RESULT_END ###
 */
function parseJsonResult<T>(stdout: string): T | null {
  const match = stdout.match(/### JSON_RESULT_START ###\s*([\s\S]*?)\s*### JSON_RESULT_END ###/);
  if (!match) return null;
  
  try {
    return JSON.parse(match[1].trim()) as T;
  } catch {
    return null;
  }
}

/**
 * Create a new CloudPod container
 */
export async function createCloudPod(params: {
  vmid: number;
  hostname: string;
  tenantId: string;
  autoIp?: boolean;
  ip?: string;
  cores?: number;
  memoryMb?: number;
  swapMb?: number;
  storage?: string;
  bridge?: string;
}): Promise<CloudPodCreateResult> {
  const {
    vmid,
    hostname,
    tenantId,
    autoIp = true,
    ip,
    cores = 2,
    memoryMb = 2048,
    swapMb = 512,
    storage = 'clients-main',
    bridge = 'vmbr0'
  } = params;

  const cmdParts = [
    'sudo /usr/local/sbin/cloudpod-create.sh',
    `--vmid ${vmid}`,
    `--host ${hostname}`,
    `--tenant ${tenantId}`,
    `--storage ${storage}`,
    `--bridge ${bridge}`,
    `--cores ${cores}`,
    `--mem ${memoryMb}`,
    `--swap ${swapMb}`
  ];

  if (autoIp) {
    cmdParts.push('--auto-ip');
  } else if (ip) {
    cmdParts.push(`--ip ${ip}`);
  }

  const command = cmdParts.join(' ');
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`CloudPod creation failed: ${result.stderr || result.stdout}`);
  }

  const jsonResult = parseJsonResult<CloudPodCreateResult>(result.stdout);
  if (!jsonResult) {
    throw new Error(`Failed to parse CloudPod creation result: ${result.stdout}`);
  }

  return jsonResult;
}

/**
 * Destroy a CloudPod container
 */
export async function destroyCloudPod(vmid: number): Promise<CloudPodDestroyResult> {
  // Use echo "yes" to auto-confirm the destruction
  const command = `echo "yes" | sudo /usr/local/sbin/cloudpod-destroy.sh ${vmid}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`CloudPod destruction failed: ${result.stderr || result.stdout}`);
  }

  const jsonResult = parseJsonResult<CloudPodDestroyResult>(result.stdout);
  if (!jsonResult) {
    throw new Error(`Failed to parse CloudPod destruction result: ${result.stdout}`);
  }

  return jsonResult;
}

/**
 * Create a backup/snapshot of a CloudPod
 */
export async function backupCloudPod(vmid: number, snapshotName?: string): Promise<CloudPodBackupResult> {
  const command = snapshotName
    ? `sudo /usr/local/sbin/cloudpod-backup.sh ${vmid} ${snapshotName}`
    : `sudo /usr/local/sbin/cloudpod-backup.sh ${vmid}`;
  
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`CloudPod backup failed: ${result.stderr || result.stdout}`);
  }

  const jsonResult = parseJsonResult<CloudPodBackupResult>(result.stdout);
  if (!jsonResult) {
    throw new Error(`Failed to parse CloudPod backup result: ${result.stdout}`);
  }

  return jsonResult;
}

/**
 * List snapshots for a CloudPod
 */
export async function listCloudPodSnapshots(vmid: number): Promise<string> {
  const command = `sudo /usr/local/sbin/cloudpod-backup.sh --list ${vmid}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to list snapshots: ${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

/**
 * Delete a CloudPod snapshot
 */
export async function deleteCloudPodSnapshot(vmid: number, snapshotName: string): Promise<void> {
  const command = `sudo /usr/local/sbin/cloudpod-backup.sh --delete ${vmid} ${snapshotName}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to delete snapshot: ${result.stderr || result.stdout}`);
  }
}

/**
 * Get health status of a CloudPod
 */
export async function getCloudPodHealth(vmid: number): Promise<CloudPodHealthResult> {
  const command = `sudo /usr/local/sbin/cloudpod-health.sh --json ${vmid}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to get CloudPod health: ${result.stderr || result.stdout}`);
  }

  try {
    // Health script outputs JSON directly (no markers)
    return JSON.parse(result.stdout.trim()) as CloudPodHealthResult;
  } catch {
    throw new Error(`Failed to parse CloudPod health result: ${result.stdout}`);
  }
}

/**
 * Get health status of all CloudPods in ClientPods pool
 */
export async function getAllCloudPodsHealth(): Promise<{
  pods: CloudPodHealthResult[];
  total: number;
  healthy: number;
}> {
  const command = `sudo /usr/local/sbin/cloudpod-health.sh --json --all`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to get all CloudPods health: ${result.stderr || result.stdout}`);
  }

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error(`Failed to parse all CloudPods health result: ${result.stdout}`);
  }
}

/**
 * Scale a CloudPod (change CPU/RAM)
 * Note: This runs pct set directly, not through a script
 */
export async function scaleCloudPod(vmid: number, cores: number, memoryMb: number): Promise<void> {
  // Scaling requires stopping the container first for memory changes
  const stopCmd = `sudo pct stop ${vmid} 2>/dev/null || true`;
  const setCmd = `sudo pct set ${vmid} --cores ${cores} --memory ${memoryMb}`;
  const startCmd = `sudo pct start ${vmid}`;
  
  const command = `${stopCmd} && ${setCmd} && sleep 2 && ${startCmd}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to scale CloudPod: ${result.stderr || result.stdout}`);
  }
}

/**
 * Get the next available VMID from Proxmox
 */
export async function getNextVmid(): Promise<number> {
  const command = `sudo pvesh get /cluster/nextid`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to get next VMID: ${result.stderr || result.stdout}`);
  }

  const vmid = parseInt(result.stdout.trim(), 10);
  if (isNaN(vmid)) {
    throw new Error(`Invalid VMID returned: ${result.stdout}`);
  }

  return vmid;
}

/**
 * Check if a container exists
 */
export async function containerExists(vmid: number): Promise<boolean> {
  const command = `sudo pct status ${vmid} 2>/dev/null`;
  const result = await runProxmoxCommand(command);
  return result.exitCode === 0;
}

/**
 * Get container status
 */
export async function getContainerStatus(vmid: number): Promise<string> {
  const command = `sudo pct status ${vmid}`;
  const result = await runProxmoxCommand(command);
  
  if (result.exitCode !== 0) {
    throw new Error(`Failed to get container status: ${result.stderr || result.stdout}`);
  }

  // Output: "status: running" or "status: stopped"
  const match = result.stdout.match(/status:\s*(\w+)/);
  return match?.[1] ?? 'unknown';
}
