# Enterprise Infrastructure - Quick Reference

## 🚀 New Endpoints

```bash
# Prometheus metrics (scrape every 30s)
curl http://localhost:2271/metrics

# Detailed health check
curl http://localhost:2271/api/health | jq .

# Kubernetes readiness probe (checks DB)
curl http://localhost:2271/api/ready

# Kubernetes liveness probe
curl http://localhost:2271/api/live
```

## 📊 Key Metrics Available

**HTTP**: `http_request_duration_seconds`, `http_requests_total`, `http_active_connections`  
**Database**: `db_pool_size_total`, `db_pool_size_idle`, `db_pool_size_active`  
**Business**: `user_signups_total`, `revenue_total`, `invoice_status_total`  
**Security**: `rate_limit_hits_total`, `auth_failures_total`  
**Messaging**: `emails_sent_total`, `sms_sent_total`

## 🔧 Circuit Breakers

```javascript
import { stripeCircuitBreaker } from './utils/circuitBreaker.js';

// Wrap external API calls
const result = await stripeCircuitBreaker.execute(async () => {
  return await stripe.someMethod();
});

// Check breaker status
const status = stripeCircuitBreaker.getStatus();
// Returns: { state: 'CLOSED', failures: 0, successes: 42, lastFailure: null }
```

**Available Breakers**: `stripeCircuitBreaker`, `twilioCircuitBreaker`, `nameSiloCircuitBreaker`, `openAICircuitBreaker`

## 🔍 Request Tracing

Every request now has a unique ID:

```bash
# Make request
curl -H "X-Request-ID: my-custom-id" http://localhost:2271/api/health

# Response includes
X-Request-ID: my-custom-id

# Search logs by request ID
grep "my-custom-id" logs.txt
# Shows complete request trace
```

## 📈 Grafana Dashboard Queries

```promql
# Average latency by endpoint
rate(http_request_duration_seconds_sum{route="/api/customers"}[5m]) / 
rate(http_request_duration_seconds_count{route="/api/customers"}[5m])

# Database pool utilization
(db_pool_size_active / db_pool_size_total) * 100

# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Revenue per minute
rate(revenue_total[1m])
```

## 🛡️ Production Features

✅ **Graceful Shutdown** - Zero dropped requests during deployments  
✅ **Request ID Tracking** - Full distributed tracing  
✅ **20+ Prometheus Metrics** - Complete observability  
✅ **Circuit Breakers** - Resilience against external failures  
✅ **Database Health Checks** - Auto pool monitoring every 30s  
✅ **K8s Health Probes** - /api/ready, /api/live  

## 🎯 Health Check Response

```json
{
  "status": "healthy",
  "version": "v1",
  "uptime": 36,
  "uptimeHuman": "36s",
  "memory": { "rss": 154, "heapTotal": 83, "unit": "MB" },
  "cpu": { "user": 3098, "system": 452, "unit": "ms" },
  "system": {
    "cpus": 16,
    "totalMemory": 31,
    "freeMemory": 21,
    "unit": "GB"
  },
  "features": [
    "billing", "hosting", "dns", "email", "databases",
    "sms", "webhooks", "ai", "graphql", "websockets",
    "white-label", "rbac"
  ]
}
```

## 🚨 Alerts to Configure

```promql
# High latency (p95 > 500ms)
histogram_quantile(0.95, http_request_duration_seconds) > 0.5

# Database pool saturation (>80%)
(db_pool_size_active / db_pool_size_total) > 0.8

# Circuit breaker open
circuit_breaker_state{service="stripe"} == 1  # OPEN

# High error rate (>5%)
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
```

## 📝 Test Script

```bash
# Run all infrastructure tests
./test-infrastructure.sh

# Individual tests
curl http://localhost:2271/metrics | grep http_request
curl http://localhost:2271/api/health | jq '.memory'
curl http://localhost:2271/api/ready
```

## 🔄 Graceful Shutdown

```bash
# Send SIGTERM to server
kill -SIGTERM <pid>

# Server will:
# 1. Stop accepting new requests (returns 503)
# 2. Drain existing connections (5s grace period)
# 3. Execute cleanup callbacks
# 4. Close database pool, Redis, WebSocket
# 5. Exit gracefully (or force exit after 30s)
```

---

**See full documentation**: `ENTERPRISE_INFRASTRUCTURE_COMPLETE.md`
