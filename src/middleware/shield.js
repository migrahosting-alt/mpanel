import logger from '../config/logger.js';
import { getActivePolicyForTenant, recordShieldDecision } from '../services/shieldService.js';

const REPORT_ONLY = 'report_only';
const ENFORCE = 'enforce';

let otelApi;
import('@opentelemetry/api')
  .then(module => {
    otelApi = module;
    logger.debug('OpenTelemetry detected for Shield instrumentation');
  })
  .catch(error => {
    logger.debug('OpenTelemetry not available for Shield instrumentation', {
      error: error.message,
    });
  });

function resolveTenantId(req) {
  return (
    req.user?.tenantId ||
    req.headers['x-tenant-id'] ||
    req.headers['x-tenant'] ||
    req.query?.tenantId ||
    null
  );
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0];
  }
  return req.ip || req.connection?.remoteAddress || null;
}

function evaluateRules(rules = {}, context) {
  const reasons = [];
  let allowed = true;

  if (Array.isArray(rules.blockedOrigins) && rules.blockedOrigins.length && context.origin) {
    if (rules.blockedOrigins.includes(context.origin)) {
      allowed = false;
      reasons.push('origin_blocked');
    }
  }

  if (Array.isArray(rules.allowedOrigins) && rules.allowedOrigins.length && context.origin) {
    if (!rules.allowedOrigins.includes(context.origin)) {
      allowed = false;
      reasons.push('origin_not_allowed');
    }
  }

  if (Array.isArray(rules.blockedIps) && rules.blockedIps.length && context.clientIp) {
    if (rules.blockedIps.includes(context.clientIp)) {
      allowed = false;
      reasons.push('ip_blocked');
    }
  }

  if (Array.isArray(rules.allowedIps) && rules.allowedIps.length && context.clientIp) {
    if (!rules.allowedIps.includes(context.clientIp)) {
      allowed = false;
      reasons.push('ip_not_allowed');
    }
  }

  if (rules.requiredHeaders && typeof rules.requiredHeaders === 'object') {
    for (const [headerKey, expectedValue] of Object.entries(rules.requiredHeaders)) {
      const actual = context.headers[headerKey];
      if (actual === undefined) {
        allowed = false;
        reasons.push(`header_missing:${headerKey}`);
        continue;
      }
      if (expectedValue && actual !== expectedValue) {
        allowed = false;
        reasons.push(`header_mismatch:${headerKey}`);
      }
    }
  }

  return { allowed, reasons };
}

function emitShieldTelemetry({ tenantId, policy, evaluation, context, bypassReason }) {
  if (!otelApi?.trace || !otelApi?.context) {
    return;
  }

  const span = otelApi.trace.getSpan(otelApi.context.active());
  if (!span) {
    return;
  }

  const normalizedReasons = evaluation?.reasons?.length
    ? evaluation.reasons.join(',')
    : 'ok';

  const baseAttributes = {
    'shield.tenant.id': tenantId ?? 'global',
    'shield.request.id': context?.requestId ?? 'unknown',
    'shield.request.path': context?.path ?? 'unknown',
    'shield.request.method': context?.method ?? 'unknown',
    'shield.request.ip': context?.clientIp ?? 'unknown',
    'shield.request.origin': context?.origin ?? 'unknown',
  };

  if (bypassReason) {
    span.setAttributes({
      ...baseAttributes,
      'shield.policy.active': false,
      'shield.bypass.reason': bypassReason,
    });
    span.addEvent('shield.bypass', {
      reason: bypassReason,
      requestId: context?.requestId ?? null,
    });
    return;
  }

  if (!policy || !evaluation) {
    return;
  }

  span.setAttributes({
    ...baseAttributes,
    'shield.policy.active': true,
    'shield.policy.id': policy.id,
    'shield.policy.version': policy.version,
    'shield.policy.mode': policy.mode,
    'shield.decision.allowed': evaluation.allowed,
    'shield.decision.reasons': normalizedReasons,
  });

  span.addEvent('shield.decision', {
    allowed: evaluation.allowed,
    mode: policy.mode,
    reasons: normalizedReasons,
    policyVersion: policy.version,
    requestId: context?.requestId ?? null,
  });

  if (otelApi?.SpanStatusCode && !evaluation.allowed && policy.mode === ENFORCE) {
    span.setStatus({
      code: otelApi.SpanStatusCode.ERROR,
      message: 'Request blocked by Shield',
    });
  }
}

async function persistDecision({ policy, tenantId, requestId, evaluation, context }) {
  try {
    await recordShieldDecision({
      policyId: policy.id,
      tenantId,
      requestId,
      result: evaluation.allowed ? 'allow' : 'deny',
      reason: evaluation.reasons.join(', ') || 'ok',
      mode: policy.mode,
      policyVersion: policy.version,
      context,
    });
  } catch (error) {
    logger.error('Failed to persist shield decision', { error: error.message });
  }
}

export async function shieldMiddleware(req, res, next) {
  try {
    const tenantId = resolveTenantId(req);
    const requestId = req.id || req.headers['x-request-id'] || null;
    const context = {
      requestId,
      tenantId,
      method: req.method,
      path: req.originalUrl,
      origin: req.headers.origin || req.headers.host || null,
      clientIp: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
      headers: {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-tenant-id': req.headers['x-tenant-id'],
        'x-api-key': req.headers['x-api-key'],
      },
    };

    const policy = await getActivePolicyForTenant(tenantId);

    if (!policy || policy.status !== 'active') {
      res.setHeader('X-mPanel-Shield', 'bypass');
       const bypassReason = policy ? 'policy_inactive' : 'no_policy';
       emitShieldTelemetry({ tenantId, context, bypassReason });
      return next();
    }

    const evaluation = evaluateRules(policy.ruleset, context);
    res.setHeader('X-mPanel-Shield', `${policy.mode}:${evaluation.allowed ? 'allow' : 'deny'}`);
    req.shieldDecision = {
      policyId: policy.id,
      tenantId,
      allowed: evaluation.allowed,
      mode: policy.mode,
      reasons: evaluation.reasons,
    };

    emitShieldTelemetry({ tenantId, policy, evaluation, context });
    persistDecision({ policy, tenantId, requestId, evaluation, context });

    if (!evaluation.allowed && policy.mode === ENFORCE) {
      logger.warn('Shield blocked request', {
        tenantId,
        reasons: evaluation.reasons,
        path: req.originalUrl,
      });
      return res.status(403).json({
        error: 'Request blocked by Shield',
        reasons: evaluation.reasons,
      });
    }

    // In report-only mode we annotate but continue
    next();
  } catch (error) {
    logger.error('Shield middleware error', { error: error.message });
    next();
  }
}

export default shieldMiddleware;
