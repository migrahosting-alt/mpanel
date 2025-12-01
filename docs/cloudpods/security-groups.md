# CloudPods Security Groups

> **Status**: Spec Complete  
> **Priority**: P1 - Critical for multi-tenant isolation  
> **Depends On**: Base CloudPods, RBAC  

---

## 1. Overview

AWS-style security groups for CloudPods. Define firewall rules per-tenant or per-pod, then sync to Proxmox/OS-level firewalls.

### Goals
- Per-tenant security group definitions
- Inbound/outbound rules with CIDR, port, protocol
- Default deny-all with explicit allows
- Automatic sync to container firewalls
- Enterprise-ready isolation

---

## 2. Database Schema

### 2.1 `cloud_pod_security_groups`

Security group definitions.

```sql
CREATE TABLE cloud_pod_security_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  
  is_default      BOOLEAN DEFAULT false,          -- auto-attach to new pods
  is_system       BOOLEAN DEFAULT false,          -- cannot be deleted
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID REFERENCES users(id),
  
  UNIQUE(tenant_id, name)
);

CREATE INDEX idx_security_groups_tenant ON cloud_pod_security_groups(tenant_id);
CREATE INDEX idx_security_groups_default ON cloud_pod_security_groups(tenant_id, is_default) WHERE is_default = true;
```

### 2.2 `cloud_pod_security_group_rules`

Individual firewall rules.

```sql
CREATE TABLE cloud_pod_security_group_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_group_id   UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
  
  direction           VARCHAR(10) NOT NULL,       -- 'ingress' | 'egress'
  protocol            VARCHAR(10) NOT NULL,       -- 'tcp' | 'udp' | 'icmp' | 'any'
  port_range          VARCHAR(20),                -- '22', '80-443', '*' (null for icmp)
  cidr                VARCHAR(50) NOT NULL,       -- '0.0.0.0/0', '10.0.0.0/8'
  
  description         VARCHAR(255),
  priority            INT DEFAULT 100,            -- lower = higher priority
  action              VARCHAR(10) DEFAULT 'allow', -- 'allow' | 'deny'
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT valid_direction CHECK (direction IN ('ingress', 'egress')),
  CONSTRAINT valid_protocol CHECK (protocol IN ('tcp', 'udp', 'icmp', 'any')),
  CONSTRAINT valid_action CHECK (action IN ('allow', 'deny'))
);

CREATE INDEX idx_sg_rules_group ON cloud_pod_security_group_rules(security_group_id);
```

### 2.3 `cloud_pod_security_group_assignments`

Links pods to security groups (many-to-many).

```sql
CREATE TABLE cloud_pod_security_group_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id              UUID NOT NULL REFERENCES cloud_pods(id) ON DELETE CASCADE,
  security_group_id   UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
  
  assigned_at         TIMESTAMPTZ DEFAULT NOW(),
  assigned_by         UUID REFERENCES users(id),
  
  UNIQUE(pod_id, security_group_id)
);

CREATE INDEX idx_sg_assignments_pod ON cloud_pod_security_group_assignments(pod_id);
CREATE INDEX idx_sg_assignments_group ON cloud_pod_security_group_assignments(security_group_id);
```

### 2.4 `cloud_pod_firewall_sync`

Track firewall sync status per pod.

```sql
CREATE TABLE cloud_pod_firewall_sync (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id          UUID NOT NULL REFERENCES cloud_pods(id) ON DELETE CASCADE,
  vmid            INT NOT NULL,
  
  last_sync_at    TIMESTAMPTZ,
  sync_status     VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'synced', 'failed'
  sync_error      TEXT,
  rules_hash      VARCHAR(64),                     -- hash of applied rules
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(pod_id)
);

CREATE INDEX idx_firewall_sync_status ON cloud_pod_firewall_sync(sync_status);
```

---

## 3. Default Security Groups

Every tenant gets these system security groups on creation:

### 3.1 `default-web`
```json
{
  "name": "default-web",
  "description": "Allow HTTP/HTTPS from anywhere",
  "isDefault": true,
  "isSystem": true,
  "rules": [
    { "direction": "ingress", "protocol": "tcp", "portRange": "80", "cidr": "0.0.0.0/0", "description": "HTTP" },
    { "direction": "ingress", "protocol": "tcp", "portRange": "443", "cidr": "0.0.0.0/0", "description": "HTTPS" }
  ]
}
```

### 3.2 `default-ssh`
```json
{
  "name": "default-ssh",
  "description": "Allow SSH from anywhere (consider restricting)",
  "isDefault": false,
  "isSystem": true,
  "rules": [
    { "direction": "ingress", "protocol": "tcp", "portRange": "22", "cidr": "0.0.0.0/0", "description": "SSH" }
  ]
}
```

### 3.3 `allow-all-outbound`
```json
{
  "name": "allow-all-outbound",
  "description": "Allow all outbound traffic",
  "isDefault": true,
  "isSystem": true,
  "rules": [
    { "direction": "egress", "protocol": "any", "portRange": "*", "cidr": "0.0.0.0/0", "description": "All outbound" }
  ]
}
```

### 3.4 `internal-only`
```json
{
  "name": "internal-only",
  "description": "Allow traffic from internal network only",
  "isDefault": false,
  "isSystem": true,
  "rules": [
    { "direction": "ingress", "protocol": "any", "portRange": "*", "cidr": "10.0.0.0/8", "description": "Internal network" },
    { "direction": "ingress", "protocol": "any", "portRange": "*", "cidr": "192.168.0.0/16", "description": "Private network" }
  ]
}
```

---

## 4. Service Implementation

### 4.1 `src/services/securityGroupService.js`

```javascript
// src/services/securityGroupService.js
import { prisma } from '../config/database.js';
import { enqueueFirewallSync } from './cloudPodQueues.js';
import { logAuditEvent } from './auditService.js';
import crypto from 'crypto';

/**
 * Initialize default security groups for a new tenant
 */
export async function initializeTenantSecurityGroups(tenantId, createdBy = null) {
  const defaults = [
    {
      name: 'default-web',
      description: 'Allow HTTP/HTTPS from anywhere',
      isDefault: true,
      isSystem: true,
      rules: [
        { direction: 'ingress', protocol: 'tcp', portRange: '80', cidr: '0.0.0.0/0', description: 'HTTP' },
        { direction: 'ingress', protocol: 'tcp', portRange: '443', cidr: '0.0.0.0/0', description: 'HTTPS' },
      ],
    },
    {
      name: 'default-ssh',
      description: 'Allow SSH from anywhere',
      isDefault: false,
      isSystem: true,
      rules: [
        { direction: 'ingress', protocol: 'tcp', portRange: '22', cidr: '0.0.0.0/0', description: 'SSH' },
      ],
    },
    {
      name: 'allow-all-outbound',
      description: 'Allow all outbound traffic',
      isDefault: true,
      isSystem: true,
      rules: [
        { direction: 'egress', protocol: 'any', portRange: '*', cidr: '0.0.0.0/0', description: 'All outbound' },
      ],
    },
  ];
  
  for (const sg of defaults) {
    const group = await prisma.cloudPodSecurityGroup.create({
      data: {
        tenantId,
        name: sg.name,
        description: sg.description,
        isDefault: sg.isDefault,
        isSystem: sg.isSystem,
        createdBy,
      },
    });
    
    for (const rule of sg.rules) {
      await prisma.cloudPodSecurityGroupRule.create({
        data: {
          securityGroupId: group.id,
          direction: rule.direction,
          protocol: rule.protocol,
          portRange: rule.portRange,
          cidr: rule.cidr,
          description: rule.description,
        },
      });
    }
  }
}

/**
 * Create a new security group
 */
export async function createSecurityGroup(tenantId, { name, description, rules = [] }, createdBy) {
  // Check if name already exists
  const existing = await prisma.cloudPodSecurityGroup.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  
  if (existing) {
    throw new Error(`Security group '${name}' already exists`);
  }
  
  const group = await prisma.cloudPodSecurityGroup.create({
    data: {
      tenantId,
      name,
      description,
      isDefault: false,
      isSystem: false,
      createdBy,
    },
  });
  
  // Add rules
  for (const rule of rules) {
    await addRule(group.id, rule);
  }
  
  await logAuditEvent({
    tenantId,
    userId: createdBy,
    action: 'SECURITY_GROUP_CREATED',
    category: 'SECURITY',
    context: { groupName: name, rulesCount: rules.length },
  });
  
  return getSecurityGroup(group.id);
}

/**
 * Get security group with rules
 */
export async function getSecurityGroup(groupId) {
  return prisma.cloudPodSecurityGroup.findUnique({
    where: { id: groupId },
    include: {
      rules: { orderBy: { priority: 'asc' } },
      _count: { select: { assignments: true } },
    },
  });
}

/**
 * List security groups for tenant
 */
export async function listSecurityGroups(tenantId) {
  return prisma.cloudPodSecurityGroup.findMany({
    where: { tenantId },
    include: {
      rules: { orderBy: { priority: 'asc' } },
      _count: { select: { assignments: true } },
    },
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
  });
}

/**
 * Add a rule to security group
 */
export async function addRule(groupId, rule) {
  // Validate rule
  validateRule(rule);
  
  return prisma.cloudPodSecurityGroupRule.create({
    data: {
      securityGroupId: groupId,
      direction: rule.direction,
      protocol: rule.protocol,
      portRange: rule.portRange || null,
      cidr: rule.cidr,
      description: rule.description || null,
      priority: rule.priority || 100,
      action: rule.action || 'allow',
    },
  });
}

/**
 * Remove a rule
 */
export async function removeRule(ruleId) {
  return prisma.cloudPodSecurityGroupRule.delete({
    where: { id: ruleId },
  });
}

/**
 * Delete a security group
 */
export async function deleteSecurityGroup(groupId, userId) {
  const group = await prisma.cloudPodSecurityGroup.findUnique({
    where: { id: groupId },
    include: { assignments: true },
  });
  
  if (!group) {
    throw new Error('Security group not found');
  }
  
  if (group.isSystem) {
    throw new Error('Cannot delete system security group');
  }
  
  if (group.assignments.length > 0) {
    throw new Error(`Security group is attached to ${group.assignments.length} pod(s). Detach first.`);
  }
  
  await prisma.cloudPodSecurityGroup.delete({
    where: { id: groupId },
  });
  
  await logAuditEvent({
    tenantId: group.tenantId,
    userId,
    action: 'SECURITY_GROUP_DELETED',
    category: 'SECURITY',
    severity: 'WARN',
    context: { groupName: group.name },
  });
}

/**
 * Attach security group to pod
 */
export async function attachSecurityGroup(podId, groupId, userId) {
  const pod = await prisma.cloudPod.findUnique({ where: { id: podId } });
  const group = await prisma.cloudPodSecurityGroup.findUnique({ where: { id: groupId } });
  
  if (!pod || !group) {
    throw new Error('Pod or security group not found');
  }
  
  if (pod.tenantId !== group.tenantId) {
    throw new Error('Security group does not belong to this tenant');
  }
  
  const assignment = await prisma.cloudPodSecurityGroupAssignment.create({
    data: {
      podId,
      securityGroupId: groupId,
      assignedBy: userId,
    },
  });
  
  // Queue firewall sync
  await enqueueFirewallSync({
    podId,
    vmid: pod.vmid,
    tenantId: pod.tenantId,
    reason: 'security_group_attached',
  });
  
  await logAuditEvent({
    tenantId: pod.tenantId,
    userId,
    podId,
    vmid: pod.vmid,
    action: 'SECURITY_GROUP_ATTACHED',
    category: 'SECURITY',
    context: { groupName: group.name },
  });
  
  return assignment;
}

/**
 * Detach security group from pod
 */
export async function detachSecurityGroup(podId, groupId, userId) {
  const pod = await prisma.cloudPod.findUnique({ where: { id: podId } });
  
  await prisma.cloudPodSecurityGroupAssignment.delete({
    where: {
      podId_securityGroupId: { podId, securityGroupId: groupId },
    },
  });
  
  // Queue firewall sync
  await enqueueFirewallSync({
    podId,
    vmid: pod.vmid,
    tenantId: pod.tenantId,
    reason: 'security_group_detached',
  });
  
  await logAuditEvent({
    tenantId: pod.tenantId,
    userId,
    podId,
    vmid: pod.vmid,
    action: 'SECURITY_GROUP_DETACHED',
    category: 'SECURITY',
    severity: 'WARN',
    context: { groupId },
  });
}

/**
 * Get all security groups for a pod
 */
export async function getPodSecurityGroups(podId) {
  const assignments = await prisma.cloudPodSecurityGroupAssignment.findMany({
    where: { podId },
    include: {
      securityGroup: {
        include: { rules: { orderBy: { priority: 'asc' } } },
      },
    },
  });
  
  return assignments.map(a => a.securityGroup);
}

/**
 * Get compiled firewall rules for a pod
 */
export async function getCompiledRulesForPod(podId) {
  const groups = await getPodSecurityGroups(podId);
  
  // Merge all rules, sort by priority
  const allRules = groups.flatMap(g => g.rules);
  allRules.sort((a, b) => a.priority - b.priority);
  
  return allRules;
}

/**
 * Generate rules hash for change detection
 */
export function generateRulesHash(rules) {
  const normalized = rules.map(r => ({
    direction: r.direction,
    protocol: r.protocol,
    portRange: r.portRange,
    cidr: r.cidr,
    action: r.action,
  }));
  
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .substring(0, 16);
}

/**
 * Check if pod firewall needs sync
 */
export async function needsFirewallSync(podId) {
  const syncRecord = await prisma.cloudPodFirewallSync.findUnique({
    where: { podId },
  });
  
  if (!syncRecord || syncRecord.syncStatus === 'pending') {
    return true;
  }
  
  const currentRules = await getCompiledRulesForPod(podId);
  const currentHash = generateRulesHash(currentRules);
  
  return currentHash !== syncRecord.rulesHash;
}

/**
 * Auto-attach default security groups to new pod
 */
export async function attachDefaultSecurityGroups(podId, tenantId) {
  const defaults = await prisma.cloudPodSecurityGroup.findMany({
    where: { tenantId, isDefault: true },
  });
  
  for (const group of defaults) {
    await prisma.cloudPodSecurityGroupAssignment.create({
      data: {
        podId,
        securityGroupId: group.id,
      },
    });
  }
  
  return defaults;
}

// Validation helper
function validateRule(rule) {
  if (!['ingress', 'egress'].includes(rule.direction)) {
    throw new Error('Invalid direction. Must be "ingress" or "egress"');
  }
  
  if (!['tcp', 'udp', 'icmp', 'any'].includes(rule.protocol)) {
    throw new Error('Invalid protocol. Must be tcp, udp, icmp, or any');
  }
  
  if (rule.protocol !== 'icmp' && rule.portRange) {
    // Validate port range format
    const portPattern = /^(\d+|\d+-\d+|\*)$/;
    if (!portPattern.test(rule.portRange)) {
      throw new Error('Invalid port range format. Use "22", "80-443", or "*"');
    }
  }
  
  // Validate CIDR
  const cidrPattern = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  if (!cidrPattern.test(rule.cidr)) {
    throw new Error('Invalid CIDR format. Use "0.0.0.0/0" or "10.0.0.0/8"');
  }
}
```

---

## 5. Firewall Sync Worker

### 5.1 `src/workers/firewallSyncWorker.js`

```javascript
// src/workers/firewallSyncWorker.js
import { Worker, Job } from 'bullmq';
import { prisma } from '../config/database.js';
import { redisConnection } from '../services/cloudPodQueues.js';
import { runProxmoxCommand } from '../services/proxmoxSsh.js';
import { getCompiledRulesForPod, generateRulesHash } from '../services/securityGroupService.js';
import { logAuditEvent } from '../services/auditService.js';

/**
 * Convert security group rules to iptables commands
 */
function rulesToIptables(rules, podIp) {
  const commands = [];
  
  // Flush existing rules
  commands.push('iptables -F INPUT');
  commands.push('iptables -F OUTPUT');
  
  // Default policies
  commands.push('iptables -P INPUT DROP');
  commands.push('iptables -P OUTPUT DROP');
  commands.push('iptables -P FORWARD DROP');
  
  // Allow loopback
  commands.push('iptables -A INPUT -i lo -j ACCEPT');
  commands.push('iptables -A OUTPUT -o lo -j ACCEPT');
  
  // Allow established connections
  commands.push('iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT');
  commands.push('iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT');
  
  // Add custom rules
  for (const rule of rules) {
    const chain = rule.direction === 'ingress' ? 'INPUT' : 'OUTPUT';
    const action = rule.action === 'allow' ? 'ACCEPT' : 'DROP';
    
    let cmd = `iptables -A ${chain}`;
    
    // Source/destination based on direction
    if (rule.direction === 'ingress') {
      cmd += ` -s ${rule.cidr}`;
    } else {
      cmd += ` -d ${rule.cidr}`;
    }
    
    // Protocol
    if (rule.protocol !== 'any') {
      cmd += ` -p ${rule.protocol}`;
      
      // Port
      if (rule.portRange && rule.protocol !== 'icmp') {
        if (rule.portRange.includes('-')) {
          cmd += ` --dport ${rule.portRange}`;
        } else if (rule.portRange !== '*') {
          cmd += ` --dport ${rule.portRange}`;
        }
      }
    }
    
    cmd += ` -j ${action}`;
    
    // Add comment for debugging
    if (rule.description) {
      cmd += ` -m comment --comment "${rule.description}"`;
    }
    
    commands.push(cmd);
  }
  
  // Save rules
  commands.push('iptables-save > /etc/iptables/rules.v4');
  
  return commands;
}

/**
 * Convert rules to Proxmox firewall format
 * Alternative to iptables - uses Proxmox's built-in firewall
 */
function rulesToProxmoxFirewall(rules, vmid) {
  const lines = [
    '[OPTIONS]',
    'enable: 1',
    'policy_in: DROP',
    'policy_out: ACCEPT',
    '',
    '[RULES]',
  ];
  
  for (const rule of rules) {
    const direction = rule.direction === 'ingress' ? 'IN' : 'OUT';
    const action = rule.action === 'allow' ? 'ACCEPT' : 'DROP';
    
    let ruleLine = `${direction} ${action}`;
    
    if (rule.protocol !== 'any') {
      ruleLine += ` -p ${rule.protocol}`;
    }
    
    if (rule.direction === 'ingress') {
      ruleLine += ` -source ${rule.cidr}`;
    } else {
      ruleLine += ` -dest ${rule.cidr}`;
    }
    
    if (rule.portRange && rule.protocol !== 'icmp' && rule.portRange !== '*') {
      ruleLine += ` -dport ${rule.portRange}`;
    }
    
    if (rule.description) {
      ruleLine += ` # ${rule.description}`;
    }
    
    lines.push(ruleLine);
  }
  
  return lines.join('\n');
}

/**
 * Firewall sync worker
 */
export const firewallSyncWorker = new Worker(
  'cloudpods-firewall-sync',
  async (job) => {
    const { podId, vmid, tenantId, reason } = job.data;
    
    console.log(`[FIREWALL] Syncing firewall for VMID ${vmid} (${reason})`);
    
    try {
      // Get compiled rules
      const rules = await getCompiledRulesForPod(podId);
      const rulesHash = generateRulesHash(rules);
      
      // Check if already synced
      const syncRecord = await prisma.cloudPodFirewallSync.findUnique({
        where: { podId },
      });
      
      if (syncRecord?.rulesHash === rulesHash && syncRecord.syncStatus === 'synced') {
        console.log(`[FIREWALL] VMID ${vmid} already synced, skipping`);
        return { skipped: true, rulesHash };
      }
      
      // Generate Proxmox firewall config
      const firewallConfig = rulesToProxmoxFirewall(rules, vmid);
      
      // Write firewall config via SSH
      const escapedConfig = firewallConfig.replace(/'/g, "'\\''");
      const command = `echo '${escapedConfig}' | sudo tee /etc/pve/firewall/${vmid}.fw`;
      
      await runProxmoxCommand(command);
      
      // Enable firewall on the container
      await runProxmoxCommand(`sudo pct set ${vmid} --firewall 1`);
      
      // Update sync record
      await prisma.cloudPodFirewallSync.upsert({
        where: { podId },
        create: {
          podId,
          vmid,
          syncStatus: 'synced',
          rulesHash,
          lastSyncAt: new Date(),
        },
        update: {
          syncStatus: 'synced',
          rulesHash,
          lastSyncAt: new Date(),
          syncError: null,
        },
      });
      
      await logAuditEvent({
        tenantId,
        podId,
        vmid,
        action: 'FIREWALL_SYNCED',
        category: 'SECURITY',
        context: {
          rulesCount: rules.length,
          rulesHash,
          reason,
        },
      });
      
      console.log(`[FIREWALL] VMID ${vmid} synced successfully (${rules.length} rules)`);
      
      return { success: true, rulesCount: rules.length, rulesHash };
      
    } catch (error) {
      console.error(`[FIREWALL] Sync failed for VMID ${vmid}:`, error);
      
      // Update sync record with error
      await prisma.cloudPodFirewallSync.upsert({
        where: { podId },
        create: {
          podId,
          vmid,
          syncStatus: 'failed',
          syncError: error.message,
        },
        update: {
          syncStatus: 'failed',
          syncError: error.message,
        },
      });
      
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 3 }
);

// Queue definition
export const firewallSyncQueue = new Queue('cloudpods-firewall-sync', {
  connection: redisConnection,
});

export async function enqueueFirewallSync(payload) {
  return firewallSyncQueue.add('sync', payload, {
    jobId: `firewall-${payload.vmid}-${Date.now()}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
```

---

## 6. API Routes

### 6.1 `src/routes/securityGroupRoutes.js`

```javascript
// src/routes/securityGroupRoutes.js
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import * as sgService from '../services/securityGroupService.js';

const router = express.Router();

/**
 * GET /api/cloud-pods/security-groups
 * List all security groups for tenant
 */
router.get('/',
  authenticateToken,
  requirePermission('cloudpods.view'),
  async (req, res) => {
    try {
      const groups = await sgService.listSecurityGroups(req.user.tenantId);
      res.json({ success: true, securityGroups: groups });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/cloud-pods/security-groups
 * Create a new security group
 */
router.post('/',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      const { name, description, rules } = req.body;
      
      if (!name) {
        return res.status(400).json({ success: false, error: 'Name is required' });
      }
      
      const group = await sgService.createSecurityGroup(
        req.user.tenantId,
        { name, description, rules },
        req.user.id
      );
      
      res.status(201).json({ success: true, securityGroup: group });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/cloud-pods/security-groups/:groupId
 * Get security group details
 */
router.get('/:groupId',
  authenticateToken,
  requirePermission('cloudpods.view'),
  async (req, res) => {
    try {
      const group = await sgService.getSecurityGroup(req.params.groupId);
      
      if (!group || group.tenantId !== req.user.tenantId) {
        return res.status(404).json({ success: false, error: 'Security group not found' });
      }
      
      res.json({ success: true, securityGroup: group });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/cloud-pods/security-groups/:groupId
 * Delete a security group
 */
router.delete('/:groupId',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      await sgService.deleteSecurityGroup(req.params.groupId, req.user.id);
      res.json({ success: true, message: 'Security group deleted' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/cloud-pods/security-groups/:groupId/rules
 * Add a rule to security group
 */
router.post('/:groupId/rules',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      const rule = await sgService.addRule(req.params.groupId, req.body);
      
      // Queue sync for all pods using this group
      const group = await sgService.getSecurityGroup(req.params.groupId);
      // ... queue sync jobs
      
      res.status(201).json({ success: true, rule });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/cloud-pods/security-groups/:groupId/rules/:ruleId
 * Remove a rule
 */
router.delete('/:groupId/rules/:ruleId',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      await sgService.removeRule(req.params.ruleId);
      res.json({ success: true, message: 'Rule removed' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/cloud-pods/:vmid/security-groups
 * Attach security group to pod
 */
router.post('/:vmid/security-groups',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      const { securityGroupId } = req.body;
      const { vmid } = req.params;
      
      // Find pod
      const pod = await prisma.cloudPod.findFirst({
        where: { vmid: parseInt(vmid), tenantId: req.user.tenantId },
      });
      
      if (!pod) {
        return res.status(404).json({ success: false, error: 'Pod not found' });
      }
      
      await sgService.attachSecurityGroup(pod.id, securityGroupId, req.user.id);
      
      res.json({ success: true, message: 'Security group attached' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * DELETE /api/cloud-pods/:vmid/security-groups/:groupId
 * Detach security group from pod
 */
router.delete('/:vmid/security-groups/:groupId',
  authenticateToken,
  requirePermission('cloudpods.security.manage'),
  async (req, res) => {
    try {
      const { vmid, groupId } = req.params;
      
      const pod = await prisma.cloudPod.findFirst({
        where: { vmid: parseInt(vmid), tenantId: req.user.tenantId },
      });
      
      if (!pod) {
        return res.status(404).json({ success: false, error: 'Pod not found' });
      }
      
      await sgService.detachSecurityGroup(pod.id, groupId, req.user.id);
      
      res.json({ success: true, message: 'Security group detached' });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * GET /api/cloud-pods/:vmid/security-groups
 * List security groups for a pod
 */
router.get('/:vmid/security-groups',
  authenticateToken,
  requirePermission('cloudpods.view'),
  async (req, res) => {
    try {
      const pod = await prisma.cloudPod.findFirst({
        where: { vmid: parseInt(req.params.vmid), tenantId: req.user.tenantId },
      });
      
      if (!pod) {
        return res.status(404).json({ success: false, error: 'Pod not found' });
      }
      
      const groups = await sgService.getPodSecurityGroups(pod.id);
      
      res.json({ success: true, securityGroups: groups });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
```

---

## 7. Prisma Schema Addition

```prisma
// Add to prisma/schema.prisma

model CloudPodSecurityGroup {
  id          String   @id @default(uuid())
  tenantId    String   @map("tenant_id")
  name        String
  description String?
  isDefault   Boolean  @default(false) @map("is_default")
  isSystem    Boolean  @default(false) @map("is_system")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdBy   String?  @map("created_by")
  
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  creator     User?    @relation(fields: [createdBy], references: [id])
  rules       CloudPodSecurityGroupRule[]
  assignments CloudPodSecurityGroupAssignment[]
  
  @@unique([tenantId, name])
  @@map("cloud_pod_security_groups")
}

model CloudPodSecurityGroupRule {
  id              String   @id @default(uuid())
  securityGroupId String   @map("security_group_id")
  direction       String   // 'ingress' | 'egress'
  protocol        String   // 'tcp' | 'udp' | 'icmp' | 'any'
  portRange       String?  @map("port_range")
  cidr            String
  description     String?
  priority        Int      @default(100)
  action          String   @default("allow") // 'allow' | 'deny'
  createdAt       DateTime @default(now()) @map("created_at")
  
  securityGroup   CloudPodSecurityGroup @relation(fields: [securityGroupId], references: [id], onDelete: Cascade)
  
  @@map("cloud_pod_security_group_rules")
}

model CloudPodSecurityGroupAssignment {
  id              String   @id @default(uuid())
  podId           String   @map("pod_id")
  securityGroupId String   @map("security_group_id")
  assignedAt      DateTime @default(now()) @map("assigned_at")
  assignedBy      String?  @map("assigned_by")
  
  pod             CloudPod @relation(fields: [podId], references: [id], onDelete: Cascade)
  securityGroup   CloudPodSecurityGroup @relation(fields: [securityGroupId], references: [id], onDelete: Cascade)
  assigner        User?    @relation(fields: [assignedBy], references: [id])
  
  @@unique([podId, securityGroupId])
  @@map("cloud_pod_security_group_assignments")
}

model CloudPodFirewallSync {
  id         String    @id @default(uuid())
  podId      String    @unique @map("pod_id")
  vmid       Int
  lastSyncAt DateTime? @map("last_sync_at")
  syncStatus String    @default("pending") @map("sync_status")
  syncError  String?   @map("sync_error")
  rulesHash  String?   @map("rules_hash")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")
  
  pod        CloudPod  @relation(fields: [podId], references: [id], onDelete: Cascade)
  
  @@map("cloud_pod_firewall_sync")
}
```

---

## 8. Test Checklist

```bash
#!/bin/bash
# Security Groups Test Checklist

BASE="http://100.97.213.11:2271"

# 1. List security groups
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/cloud-pods/security-groups" | jq

# 2. Create security group
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom-mysql",
    "description": "Allow MySQL from internal network",
    "rules": [
      {
        "direction": "ingress",
        "protocol": "tcp",
        "portRange": "3306",
        "cidr": "10.0.0.0/8",
        "description": "MySQL internal"
      }
    ]
  }' \
  "$BASE/api/cloud-pods/security-groups" | jq

# 3. Add rule to security group
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "ingress",
    "protocol": "tcp",
    "portRange": "8080",
    "cidr": "0.0.0.0/0",
    "description": "HTTP alt port"
  }' \
  "$BASE/api/cloud-pods/security-groups/GROUP_ID/rules" | jq

# 4. Attach security group to pod
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"securityGroupId": "GROUP_ID"}' \
  "$BASE/api/cloud-pods/107/security-groups" | jq

# 5. List pod's security groups
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/cloud-pods/107/security-groups" | jq

# 6. Detach security group
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/cloud-pods/107/security-groups/GROUP_ID" | jq

# 7. Delete security group (must detach first)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/cloud-pods/security-groups/GROUP_ID" | jq
```

---

## 9. Migration Script

```sql
-- migrations/YYYYMMDD_add_security_groups.sql

-- Security groups
CREATE TABLE IF NOT EXISTS cloud_pod_security_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(tenant_id, name)
);

-- Security group rules
CREATE TABLE IF NOT EXISTS cloud_pod_security_group_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  security_group_id UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('ingress', 'egress')),
  protocol VARCHAR(10) NOT NULL CHECK (protocol IN ('tcp', 'udp', 'icmp', 'any')),
  port_range VARCHAR(20),
  cidr VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  priority INT DEFAULT 100,
  action VARCHAR(10) DEFAULT 'allow' CHECK (action IN ('allow', 'deny')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security group assignments
CREATE TABLE IF NOT EXISTS cloud_pod_security_group_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL,
  security_group_id UUID NOT NULL REFERENCES cloud_pod_security_groups(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID,
  UNIQUE(pod_id, security_group_id)
);

-- Firewall sync tracking
CREATE TABLE IF NOT EXISTS cloud_pod_firewall_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id UUID NOT NULL UNIQUE,
  vmid INT NOT NULL,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'pending',
  sync_error TEXT,
  rules_hash VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_security_groups_tenant ON cloud_pod_security_groups(tenant_id);
CREATE INDEX idx_sg_rules_group ON cloud_pod_security_group_rules(security_group_id);
CREATE INDEX idx_sg_assignments_pod ON cloud_pod_security_group_assignments(pod_id);
CREATE INDEX idx_sg_assignments_group ON cloud_pod_security_group_assignments(security_group_id);
CREATE INDEX idx_firewall_sync_status ON cloud_pod_firewall_sync(sync_status);
```
