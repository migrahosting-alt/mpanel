/**
 * CloudPods Security Groups Service
 * AWS-style security groups with firewall rules applied to CloudPods
 */

import { prisma } from '../config/database.js';
import { CloudPodsAuditService, createAuditContext } from './cloudPodsAuditService';
import type {
  SecurityGroupCreateInput,
  SecurityGroupUpdateInput,
  SecurityGroupRuleInput,
  CloudPodAuditContext,
} from './cloudPodsEnterpriseTypes';

/**
 * List all security groups for a tenant
 */
export async function listSecurityGroups(tenantId: string) {
  return prisma.cloudPodSecurityGroup.findMany({
    where: { tenantId },
    include: {
      rules: true,
      assignments: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single security group by ID
 */
export async function getSecurityGroup(id: string, tenantId: string) {
  return prisma.cloudPodSecurityGroup.findFirst({
    where: { id, tenantId },
    include: {
      rules: true,
      assignments: true,
    },
  });
}

/**
 * Create a new security group with rules
 */
export async function createSecurityGroup(
  input: SecurityGroupCreateInput,
  auditCtx?: CloudPodAuditContext
) {
  const { tenantId, name, description, isDefault, rules } = input;

  const securityGroup = await prisma.cloudPodSecurityGroup.create({
    data: {
      tenantId,
      name,
      description,
      isDefault: isDefault ?? false,
      rules: rules ? {
        create: rules.map(r => ({
          direction: r.direction,
          protocol: r.protocol,
          portRange: r.portRange,
          cidr: r.cidr,
          description: r.description,
        })),
      } : undefined,
    },
    include: { rules: true },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_CREATED',
      category: 'security',
      ctx: auditCtx,
      details: { securityGroupId: securityGroup.id, name, rulesCount: rules?.length || 0 },
    });
  }

  return securityGroup;
}

/**
 * Update a security group and its rules
 */
export async function updateSecurityGroup(
  id: string,
  tenantId: string,
  input: SecurityGroupUpdateInput,
  auditCtx?: CloudPodAuditContext
) {
  const { name, description, isDefault, rules } = input;

  // If rules are provided, delete existing and create new ones
  if (rules) {
    await prisma.cloudPodSecurityGroupRule.deleteMany({
      where: { securityGroupId: id },
    });
  }

  const securityGroup = await prisma.cloudPodSecurityGroup.update({
    where: { id },
    data: {
      name,
      description,
      isDefault,
      rules: rules ? {
        create: rules.map(r => ({
          direction: r.direction,
          protocol: r.protocol,
          portRange: r.portRange,
          cidr: r.cidr,
          description: r.description,
        })),
      } : undefined,
    },
    include: { rules: true },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_UPDATED',
      category: 'security',
      ctx: auditCtx,
      details: { securityGroupId: id, changes: input },
    });
  }

  return securityGroup;
}

/**
 * Delete a security group
 */
export async function deleteSecurityGroup(
  id: string,
  tenantId: string,
  auditCtx?: CloudPodAuditContext
) {
  // Verify ownership
  const sg = await prisma.cloudPodSecurityGroup.findFirst({
    where: { id, tenantId },
  });

  if (!sg) {
    throw new Error('Security group not found or access denied');
  }

  await prisma.cloudPodSecurityGroup.delete({
    where: { id },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_DELETED',
      category: 'security',
      ctx: auditCtx,
      details: { securityGroupId: id, name: sg.name },
    });
  }

  return { success: true };
}

/**
 * Get security groups assigned to a pod
 */
export async function getPodSecurityGroups(podId: string, tenantId: string) {
  const assignments = await prisma.cloudPodSecurityGroupAssignment.findMany({
    where: { podId },
    include: {
      securityGroup: {
        include: { rules: true },
      },
    },
  });

  return assignments.map(a => a.securityGroup);
}

/**
 * Set security groups for a pod (replaces existing assignments)
 */
export async function setPodSecurityGroups(
  podId: string,
  tenantId: string,
  securityGroupIds: string[],
  auditCtx?: CloudPodAuditContext
) {
  // Remove existing assignments
  await prisma.cloudPodSecurityGroupAssignment.deleteMany({
    where: { podId },
  });

  // Create new assignments
  if (securityGroupIds.length > 0) {
    await prisma.cloudPodSecurityGroupAssignment.createMany({
      data: securityGroupIds.map(sgId => ({
        podId,
        securityGroupId: sgId,
      })),
    });
  }

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_ASSIGNED',
      category: 'security',
      ctx: { ...auditCtx, podId },
      details: { securityGroupIds },
    });
  }

  return getPodSecurityGroups(podId, tenantId);
}

/**
 * Add a security group to a pod
 */
export async function addSecurityGroupToPod(
  podId: string,
  tenantId: string,
  securityGroupId: string,
  auditCtx?: CloudPodAuditContext
) {
  // Check if already assigned
  const existing = await prisma.cloudPodSecurityGroupAssignment.findUnique({
    where: {
      podId_securityGroupId: { podId, securityGroupId },
    },
  });

  if (existing) {
    return { alreadyAssigned: true };
  }

  await prisma.cloudPodSecurityGroupAssignment.create({
    data: { podId, securityGroupId },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_ASSIGNED',
      category: 'security',
      ctx: { ...auditCtx, podId },
      details: { securityGroupId },
    });
  }

  return { success: true };
}

/**
 * Remove a security group from a pod
 */
export async function removeSecurityGroupFromPod(
  podId: string,
  tenantId: string,
  securityGroupId: string,
  auditCtx?: CloudPodAuditContext
) {
  await prisma.cloudPodSecurityGroupAssignment.delete({
    where: {
      podId_securityGroupId: { podId, securityGroupId },
    },
  });

  // Audit log
  if (auditCtx) {
    await CloudPodsAuditService.log({
      action: 'SECURITY_GROUP_UNASSIGNED',
      category: 'security',
      ctx: { ...auditCtx, podId },
      details: { securityGroupId },
    });
  }

  return { success: true };
}

/**
 * Generate Proxmox firewall rules from security groups
 * This would be used to apply rules to VMs
 */
export function generateProxmoxFirewallRules(
  securityGroups: Array<{ rules: SecurityGroupRuleInput[] }>
): string[] {
  const rules: string[] = [];

  for (const sg of securityGroups) {
    for (const rule of sg.rules) {
      // Convert to Proxmox firewall format
      // Format: [DIRECTION] [ACTION] -i [IFACE] -p [PROTO] --dport [PORT] -s [CIDR] -j ACCEPT
      const direction = rule.direction === 'ingress' ? 'IN' : 'OUT';
      const proto = rule.protocol === 'any' ? '' : `-p ${rule.protocol}`;
      const port = rule.portRange === '*' ? '' : `--dport ${rule.portRange}`;
      const cidr = rule.cidr === '0.0.0.0/0' ? '' : `-s ${rule.cidr}`;

      rules.push(`${direction} ACCEPT ${proto} ${port} ${cidr}`.trim().replace(/\s+/g, ' '));
    }
  }

  return rules;
}

export const CloudPodsSecurityGroupsService = {
  listSecurityGroups,
  getSecurityGroup,
  createSecurityGroup,
  updateSecurityGroup,
  deleteSecurityGroup,
  getPodSecurityGroups,
  setPodSecurityGroups,
  addSecurityGroupToPod,
  removeSecurityGroupFromPod,
  generateProxmoxFirewallRules,
};

export default CloudPodsSecurityGroupsService;
