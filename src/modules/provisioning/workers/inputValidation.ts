/**
 * Provisioning Input Validation - P0.3 Security Fix
 * 
 * Provides strict input validation for all user-derived values
 * used in shell commands and provisioning operations.
 * 
 * NEVER pass user input directly to shell commands.
 * Always validate and sanitize using these helpers.
 */

import logger from '../../../config/logger.js';
import { writeAuditEvent } from '../../security/auditService.js';

// ============================================
// VALIDATION PATTERNS
// ============================================

/**
 * Hostname pattern: alphanumeric, hyphens, dots.
 * Max 253 chars, labels max 63 chars each.
 * No leading/trailing hyphens.
 */
const HOSTNAME_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})*$/i;

/**
 * Domain pattern: similar to hostname but must have at least one dot.
 */
const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i;

/**
 * Pod ID pattern: alphanumeric and hyphens, 1-64 chars.
 */
const POD_ID_PATTERN = /^[a-z0-9-]{1,64}$/i;

/**
 * Plan code pattern: alphanumeric, hyphens, underscores.
 */
const PLAN_CODE_PATTERN = /^[a-z0-9_-]{1,64}$/i;

/**
 * VMID pattern: positive integer, reasonable range.
 */
const VMID_PATTERN = /^[1-9][0-9]{0,5}$/;

/**
 * IPv4 pattern.
 */
const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Shell-unsafe characters to reject.
 * Even if validated, we double-check for these.
 */
const SHELL_UNSAFE_CHARS = /[;&|`$(){}[\]<>\\'"!#%^*?\n\r\t]/;

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export interface ValidationResult {
  valid: boolean;
  sanitized?: string;
  error?: string;
}

/**
 * Validate a hostname for use in provisioning.
 */
export function validateHostname(hostname: string): ValidationResult {
  if (!hostname || typeof hostname !== 'string') {
    return { valid: false, error: 'Hostname is required' };
  }

  const trimmed = hostname.trim().toLowerCase();

  if (trimmed.length > 253) {
    return { valid: false, error: 'Hostname exceeds maximum length (253 chars)' };
  }

  if (SHELL_UNSAFE_CHARS.test(trimmed)) {
    return { valid: false, error: 'Hostname contains unsafe characters' };
  }

  if (!HOSTNAME_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid hostname format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate a domain name for use in provisioning.
 */
export function validateDomainName(domain: string): ValidationResult {
  if (!domain || typeof domain !== 'string') {
    return { valid: false, error: 'Domain name is required' };
  }

  const trimmed = domain.trim().toLowerCase();

  if (trimmed.length > 253) {
    return { valid: false, error: 'Domain exceeds maximum length (253 chars)' };
  }

  if (SHELL_UNSAFE_CHARS.test(trimmed)) {
    return { valid: false, error: 'Domain contains unsafe characters' };
  }

  if (!DOMAIN_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid domain format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate a pod/container ID.
 */
export function validatePodId(podId: string): ValidationResult {
  if (!podId || typeof podId !== 'string') {
    return { valid: false, error: 'Pod ID is required' };
  }

  const trimmed = podId.trim();

  if (SHELL_UNSAFE_CHARS.test(trimmed)) {
    return { valid: false, error: 'Pod ID contains unsafe characters' };
  }

  if (!POD_ID_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid pod ID format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate a plan code.
 */
export function validatePlanCode(planCode: string): ValidationResult {
  if (!planCode || typeof planCode !== 'string') {
    return { valid: false, error: 'Plan code is required' };
  }

  const trimmed = planCode.trim().toLowerCase();

  if (SHELL_UNSAFE_CHARS.test(trimmed)) {
    return { valid: false, error: 'Plan code contains unsafe characters' };
  }

  if (!PLAN_CODE_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid plan code format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate a VMID (Proxmox virtual machine ID).
 */
export function validateVmid(vmid: number | string): ValidationResult {
  const vmidStr = String(vmid);

  if (!VMID_PATTERN.test(vmidStr)) {
    return { valid: false, error: 'Invalid VMID format (must be positive integer 1-999999)' };
  }

  const vmidNum = parseInt(vmidStr, 10);
  if (vmidNum < 100 || vmidNum > 999999) {
    return { valid: false, error: 'VMID must be between 100 and 999999' };
  }

  return { valid: true, sanitized: vmidStr };
}

/**
 * Validate an IPv4 address.
 */
export function validateIpv4(ip: string): ValidationResult {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address is required' };
  }

  const trimmed = ip.trim();

  if (!IPV4_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Invalid IPv4 address format' };
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validate a generic string for shell safety.
 * Only allows alphanumeric, hyphens, underscores, dots.
 */
export function validateShellSafeString(
  value: string,
  fieldName: string,
  maxLength = 256
): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: `${fieldName} is required` };
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    return { valid: false, error: `${fieldName} exceeds maximum length (${maxLength} chars)` };
  }

  if (SHELL_UNSAFE_CHARS.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains unsafe characters` };
  }

  // Must be alphanumeric with allowed separators
  if (!/^[a-z0-9._-]+$/i.test(trimmed)) {
    return { valid: false, error: `${fieldName} contains invalid characters` };
  }

  return { valid: true, sanitized: trimmed };
}

// ============================================
// SAFE SHELL EXECUTION HELPER
// ============================================

/**
 * Allowed provisioning scripts - whitelist only.
 * NEVER execute arbitrary scripts from user input.
 */
const ALLOWED_SCRIPTS = new Set([
  'cloudpod-create.sh',
  'cloudpod-delete.sh',
  'cloudpod-start.sh',
  'cloudpod-stop.sh',
  'cloudpod-restart.sh',
  'issue-ssl.sh',
  'revoke-ssl.sh',
]);

/**
 * Run a provisioning script safely.
 * Uses spawn() with argument array to prevent shell injection.
 * 
 * @param scriptName - Must be in ALLOWED_SCRIPTS whitelist
 * @param args - Pre-validated arguments
 * @param options - Execution options
 */
export async function runProvisioningScript(
  scriptName: string,
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    tenantId?: string;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import('child_process');

  // Validate script name is in whitelist
  if (!ALLOWED_SCRIPTS.has(scriptName)) {
    const error = `Script not in whitelist: ${scriptName}`;
    logger.error('Provisioning script rejected', { scriptName, reason: 'not_in_whitelist' });

    if (options.tenantId) {
      await writeAuditEvent({
        actorUserId: null,
        tenantId: options.tenantId,
        type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
        severity: 'error',
        metadata: {
          scriptName,
          reason: 'script_not_in_whitelist',
        },
      });
    }

    throw new Error(error);
  }

  // Validate all arguments are shell-safe
  for (let i = 0; i < args.length; i++) {
    if (SHELL_UNSAFE_CHARS.test(args[i])) {
      const error = `Unsafe character in argument ${i}`;
      logger.error('Provisioning argument rejected', { scriptName, argIndex: i });

      if (options.tenantId) {
        await writeAuditEvent({
          actorUserId: null,
          tenantId: options.tenantId,
          type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
          severity: 'error',
          metadata: {
            scriptName,
            argIndex: i,
            reason: 'unsafe_characters',
          },
        });
      }

      throw new Error(error);
    }
  }

  const scriptPath = `/opt/migra-scripts/${scriptName}`;
  const timeout = options.timeout ?? 300_000; // 5 minutes default
  const cwd = options.cwd ?? '/opt/migra-scripts';

  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const child = spawn(scriptPath, args, {
      cwd,
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      // IMPORTANT: shell: false to prevent shell interpretation
      shell: false,
    });

    child.stdout?.on('data', (data) => {
      stdout.push(data.toString());
    });

    child.stderr?.on('data', (data) => {
      stderr.push(data.toString());
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        exitCode: code ?? -1,
      });
    });
  });
}

/**
 * Execute a remote command via SSH safely.
 * Uses spawn() with argument array.
 */
export async function runSshCommand(
  sshTarget: string,
  command: string,
  args: string[],
  options: {
    sshKeyPath?: string;
    sshUser?: string;
    timeout?: number;
    tenantId?: string;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { spawn } = await import('child_process');

  const sshKeyPath = options.sshKeyPath ?? process.env.PROXMOX_SSH_KEY ?? '/home/mpanel/.ssh/id_ed25519';
  const sshUser = options.sshUser ?? process.env.PROXMOX_SSH_USER ?? 'root';
  const timeout = options.timeout ?? 60_000;

  // Validate SSH target
  const targetValidation = validateShellSafeString(sshTarget, 'SSH target');
  if (!targetValidation.valid) {
    throw new Error(targetValidation.error);
  }

  // Validate command
  const cmdValidation = validateShellSafeString(command, 'Command');
  if (!cmdValidation.valid) {
    throw new Error(cmdValidation.error);
  }

  // Validate all arguments
  for (let i = 0; i < args.length; i++) {
    if (SHELL_UNSAFE_CHARS.test(args[i])) {
      const error = `Unsafe character in SSH argument ${i}`;
      logger.error('SSH argument rejected', { command, argIndex: i });

      if (options.tenantId) {
        await writeAuditEvent({
          actorUserId: null,
          tenantId: options.tenantId,
          type: 'CLOUDPOD_PROVISIONING_INPUT_REJECTED',
          severity: 'error',
          metadata: {
            command,
            argIndex: i,
            reason: 'unsafe_characters',
          },
        });
      }

      throw new Error(error);
    }
  }

  // Build the remote command with properly escaped arguments
  const remoteCommand = [command, ...args].join(' ');

  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const child = spawn('ssh', [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=30',
      '-i', sshKeyPath,
      `${sshUser}@${targetValidation.sanitized}`,
      remoteCommand,
    ], {
      timeout,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    child.stdout?.on('data', (data) => {
      stdout.push(data.toString());
    });

    child.stderr?.on('data', (data) => {
      stderr.push(data.toString());
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      resolve({
        stdout: stdout.join(''),
        stderr: stderr.join(''),
        exitCode: code ?? -1,
      });
    });
  });
}

export default {
  validateHostname,
  validateDomainName,
  validatePodId,
  validatePlanCode,
  validateVmid,
  validateIpv4,
  validateShellSafeString,
  runProvisioningScript,
  runSshCommand,
};
