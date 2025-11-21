# Wave 1 Setup Instructions

## New Dependencies Required

### Kubernetes Client
```bash
npm install @kubernetes/client-node
```

### OpenTelemetry (Distributed Tracing)
```bash
npm install @opentelemetry/api
npm install @opentelemetry/sdk-trace-node
npm install @opentelemetry/resources
npm install @opentelemetry/semantic-conventions
npm install @opentelemetry/exporter-jaeger
npm install @opentelemetry/sdk-trace-base
```

### Or Install All at Once
```bash
npm install @kubernetes/client-node @opentelemetry/api @opentelemetry/sdk-trace-node @opentelemetry/resources @opentelemetry/semantic-conventions @opentelemetry/exporter-jaeger @opentelemetry/sdk-trace-base
```

## Database Migration

Run the Kubernetes and Monitoring migration:

```bash
# Using PostgreSQL CLI
psql -U your_user -d your_database -f prisma/migrations/20251112000005_add_kubernetes_monitoring/migration.sql

# Or using Node.js migration script (if available)
npm run migrate
```

## Environment Variables

Add these to your `.env` file:

```env
# Kubernetes Configuration
K8S_IN_CLUSTER=false  # Set to 'true' if running inside a K8s cluster
KUBECONFIG=/path/to/kubeconfig  # Path to kubeconfig file (dev only)

# Jaeger Distributed Tracing
JAEGER_ENDPOINT=http://localhost:14268/api/traces
JAEGER_AGENT_HOST=localhost
JAEGER_AGENT_PORT=6832
```

## Infrastructure Setup

### 1. Jaeger (Distributed Tracing) - Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    environment:
      - COLLECTOR_ZIPKIN_HOST_PORT=:9411
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "5775:5775/udp"   # Zipkin compact
      - "6831:6831/udp"   # Jaeger compact
      - "6832:6832/udp"   # Jaeger binary
      - "5778:5778"       # Serving configs
      - "16686:16686"     # Jaeger UI
      - "14250:14250"     # gRPC
      - "14268:14268"     # HTTP
      - "14269:14269"     # Admin
      - "9411:9411"       # Zipkin
    networks:
      - mpanel-network
```

Then run:

```bash
docker-compose up -d jaeger
```

Access Jaeger UI at: http://localhost:16686

### 2. Kubernetes Cluster (Optional - For Testing)

If you don't have a Kubernetes cluster, you can use Minikube for local testing:

```bash
# Install Minikube
brew install minikube  # macOS
# OR
choco install minikube  # Windows

# Start Minikube
minikube start

# Get kubeconfig path
minikube kubectl config view
```

For production, use:
- **GKE (Google Cloud):** `gcloud container clusters create`
- **EKS (AWS):** `eksctl create cluster`
- **AKS (Azure):** `az aks create`
- **DigitalOcean Kubernetes:** Use DigitalOcean web console

## Verification

### 1. Test Jaeger Connection

```bash
curl http://localhost:16686/api/services
```

Expected response: `{"data":[],"total":0,"limit":0,"offset":0,"errors":null}`

### 2. Test Kubernetes Connection

Create a test file `test-k8s.js`:

```javascript
const k8s = require('@kubernetes/client-node');

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

k8sApi.listNamespace()
  .then((res) => {
    console.log('✅ Kubernetes connection successful!');
    console.log('Namespaces:', res.body.items.map(ns => ns.metadata.name));
  })
  .catch((err) => {
    console.error('❌ Kubernetes connection failed:', err.message);
  });
```

Run:

```bash
node test-k8s.js
```

### 3. Test Database Migration

Check tables exist:

```sql
-- Check Kubernetes tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'k8s_%';

-- Expected: k8s_clusters, k8s_deployments, k8s_failover_events, k8s_scaling_events

-- Check Monitoring tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'apm_%';

-- Expected: apm_requests, apm_metrics
```

## API Testing

### Test Kubernetes Endpoint

```bash
# Create a cluster (requires auth token)
curl -X POST http://localhost:3000/api/kubernetes/clusters \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-cluster",
    "region": "us-central1",
    "provider": "gke",
    "nodeCount": 3,
    "autoScaling": true
  }'
```

### Test Monitoring Endpoint

```bash
# Get APM dashboard
curl http://localhost:3000/api/monitoring/apm/dashboard \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Troubleshooting

### Issue: Kubernetes client fails to load config

**Solution:**

```bash
# Verify kubeconfig exists
ls ~/.kube/config

# Or set explicit path
export KUBECONFIG=/path/to/kubeconfig
```

### Issue: Jaeger not receiving traces

**Solution:**

1. Check Jaeger is running: `docker ps | grep jaeger`
2. Check endpoint: `curl http://localhost:14268/api/traces`
3. Verify environment variables in `.env`

### Issue: OpenTelemetry errors

**Solution:**

Install missing dependencies:

```bash
npm install --save @opentelemetry/api @opentelemetry/sdk-trace-node
```

## Next Steps

1. ✅ Install dependencies
2. ✅ Run database migration
3. ✅ Configure environment variables
4. ✅ Start Jaeger (Docker Compose)
5. ✅ Test API endpoints
6. 🔜 Continue with Wave 2 (API Marketplace, White-Label)

---

**Ready to deploy Kubernetes auto-scaling and advanced monitoring!** 🚀
