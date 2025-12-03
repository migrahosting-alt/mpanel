import logger from '../../config/logger.js';

// Mock data structures - replace with actual database tables in production
const policies: any[] = [];
const wafRules: any[] = [];
const securityEvents: any[] = [];

interface ListPoliciesParams {
  type?: string;
  status?: string;
}

interface CreatePolicyParams {
  name: string;
  type: string;
  rules: any[];
}

interface CreateWAFRuleParams {
  name: string;
  pattern: string;
  action: string;
}

interface ListSecurityEventsParams {
  severity?: string;
  page?: number;
  pageSize?: number;
}

export async function listPolicies(params: ListPoliciesParams) {
  let filtered = [...policies];

  if (params.type) {
    filtered = filtered.filter((p) => p.type === params.type);
  }

  if (params.status) {
    filtered = filtered.filter((p) => p.status === params.status);
  }

  return filtered;
}

export async function getPolicy(id: string) {
  return policies.find((p) => p.id === id);
}

export async function createPolicy(params: CreatePolicyParams) {
  const policy = {
    id: `policy_${Date.now()}`,
    name: params.name,
    type: params.type,
    rules: params.rules,
    status: 'ACTIVE',
    createdAt: new Date(),
  };

  policies.push(policy);

  logger.info('Shield policy created', { policyId: policy.id, name: policy.name });

  return policy;
}

export async function updatePolicy(id: string, data: any) {
  const index = policies.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error('Policy not found');
  }

  policies[index] = {
    ...policies[index],
    ...data,
    updatedAt: new Date(),
  };

  logger.info('Shield policy updated', { policyId: id });

  return policies[index];
}

export async function deletePolicy(id: string) {
  const index = policies.findIndex((p) => p.id === id);

  if (index === -1) {
    throw new Error('Policy not found');
  }

  policies.splice(index, 1);

  logger.warn('Shield policy deleted', { policyId: id });
}

export async function listWAFRules() {
  return wafRules;
}

export async function createWAFRule(params: CreateWAFRuleParams) {
  const rule = {
    id: `waf_${Date.now()}`,
    name: params.name,
    pattern: params.pattern,
    action: params.action,
    enabled: true,
    createdAt: new Date(),
  };

  wafRules.push(rule);

  logger.info('WAF rule created', { ruleId: rule.id, name: rule.name });

  return rule;
}

export async function deleteWAFRule(id: string) {
  const index = wafRules.findIndex((r) => r.id === id);

  if (index === -1) {
    throw new Error('WAF rule not found');
  }

  wafRules.splice(index, 1);

  logger.warn('WAF rule deleted', { ruleId: id });
}

export async function listSecurityEvents(params: ListSecurityEventsParams) {
  const { severity, page = 1, pageSize = 50 } = params;

  let filtered = [...securityEvents];

  if (severity) {
    filtered = filtered.filter((e) => e.severity === severity);
  }

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const data = filtered.slice(start, end);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
  };
}

export async function getSecurityEvent(id: string) {
  return securityEvents.find((e) => e.id === id);
}

export async function getShieldAnalytics(timeRange: string) {
  // Mock analytics data
  return {
    timeRange,
    totalEvents: securityEvents.length,
    blockedRequests: Math.floor(Math.random() * 1000),
    allowedRequests: Math.floor(Math.random() * 10000),
    topThreats: [
      { type: 'SQL Injection', count: Math.floor(Math.random() * 50) },
      { type: 'XSS', count: Math.floor(Math.random() * 30) },
      { type: 'Path Traversal', count: Math.floor(Math.random() * 20) },
    ],
    severityBreakdown: {
      critical: Math.floor(Math.random() * 10),
      high: Math.floor(Math.random() * 30),
      medium: Math.floor(Math.random() * 50),
      low: Math.floor(Math.random() * 100),
    },
  };
}

export default {
  listPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listWAFRules,
  createWAFRule,
  deleteWAFRule,
  listSecurityEvents,
  getSecurityEvent,
  getShieldAnalytics,
};
