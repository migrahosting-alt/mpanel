# MPanel Deployment Guide

This guide covers deploying MPanel to production environments.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- Domain name with SSL certificate
- Cloud storage (S3 or MinIO)

## Environment Setup

### 1. Production Environment Variables

Create a `.env` file with production values:

```bash
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database - Use managed PostgreSQL service
DATABASE_URL=postgresql://user:password@db-host:5432/mpanel
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis - Use managed Redis service
REDIS_URL=redis://redis-host:6379

# MinIO/S3 - Use AWS S3 or managed MinIO
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-aws-access-key
MINIO_SECRET_KEY=your-aws-secret-key
MINIO_BUCKET=mpanel-production-assets

# JWT - Generate strong secrets
JWT_SECRET=your-super-secret-production-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key

# Stripe Production
STRIPE_SECRET_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret

# Tax Configuration
TAX_ENABLED=true
DEFAULT_TAX_RATE=0.10

# ICANN
ICANN_ENABLED=true
ICANN_FEE_PER_YEAR=0.18

# Email - Use SendGrid, AWS SES, or similar
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com

# Monitoring
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
LOKI_URL=http://loki:3100

# Vault (if using)
VAULT_ENABLED=true
VAULT_ADDR=https://vault.yourdomain.com
VAULT_TOKEN=your-vault-token
VAULT_SECRET_PATH=secret/mpanel

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/mpanel/mpanel.log
```

## Deployment Options

### Option 1: Docker Compose (Simple)

1. **Build the application**:
```bash
docker build -t mpanel-api:latest .
```

2. **Create docker-compose.prod.yml**:
```yaml
version: '3.8'

services:
  api:
    image: mpanel-api:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: mpanel
      POSTGRES_USER: mpanel
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api

volumes:
  postgres_data:
  redis_data:
```

3. **Deploy**:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Kubernetes (Recommended for Scale)

1. **Create Kubernetes manifests**:

**deployment.yaml**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mpanel-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mpanel-api
  template:
    metadata:
      labels:
        app: mpanel-api
    spec:
      containers:
      - name: api
        image: mpanel-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - secretRef:
            name: mpanel-secrets
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**service.yaml**:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: mpanel-api
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: mpanel-api
```

2. **Deploy to Kubernetes**:
```bash
kubectl apply -f k8s/
```

### Option 3: Cloud Platforms

#### AWS

1. **Use Elastic Beanstalk or ECS**
2. **Configure RDS for PostgreSQL**
3. **Use ElastiCache for Redis**
4. **Use S3 for object storage**
5. **Set up CloudWatch for monitoring**

#### Google Cloud Platform

1. **Use Cloud Run or GKE**
2. **Configure Cloud SQL for PostgreSQL**
3. **Use Memorystore for Redis**
4. **Use Cloud Storage for objects**
5. **Set up Cloud Monitoring**

#### Azure

1. **Use Azure Container Instances or AKS**
2. **Configure Azure Database for PostgreSQL**
3. **Use Azure Cache for Redis**
4. **Use Azure Blob Storage**
5. **Set up Azure Monitor**

## Database Migration

Run migrations on production:

```bash
npm run migrate
```

For zero-downtime migrations:
1. Run new migration on replica
2. Test thoroughly
3. Promote replica to primary
4. Complete migration

## SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
```

### Nginx Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Monitoring Setup

### Prometheus

1. Configure Prometheus to scrape metrics:
```yaml
scrape_configs:
  - job_name: 'mpanel-api'
    static_configs:
      - targets: ['api:3000']
```

### Grafana

1. Add Prometheus datasource
2. Import MPanel dashboards
3. Configure alerts

### Loki

1. Configure log shipping
2. Set retention policies
3. Create queries in Grafana

## Backup Strategy

### Database Backups

```bash
# Daily automated backups
0 2 * * * pg_dump -U mpanel mpanel > /backups/mpanel_$(date +\%Y\%m\%d).sql
```

### Object Storage Backups

Use S3 versioning or regular snapshots

### Configuration Backups

Version control all configuration files

## Security Checklist

- [ ] Use HTTPS everywhere
- [ ] Strong passwords and secrets
- [ ] Firewall configured (only necessary ports)
- [ ] Database access restricted
- [ ] Regular security updates
- [ ] Secrets in Vault, not in code
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Security headers enabled
- [ ] Regular security audits
- [ ] Backup encryption
- [ ] Access logs enabled
- [ ] Intrusion detection configured

## Performance Optimization

### Database

- Connection pooling (min: 5, max: 20)
- Query optimization with EXPLAIN
- Proper indexing
- Regular VACUUM and ANALYZE

### API

- Enable compression
- Use CDN for static assets
- Implement caching headers
- Use Redis for hot data

### Frontend

- Build with production mode
- Enable gzip compression
- Use CDN
- Lazy load components

## Scaling

### Horizontal Scaling

Add more API instances:
```bash
docker-compose -f docker-compose.prod.yml up -d --scale api=5
```

### Load Balancing

Use Nginx, HAProxy, or cloud load balancers

### Database Scaling

1. Read replicas for read operations
2. Connection pooling
3. Query optimization
4. Partitioning for large tables

## Troubleshooting

### Check logs
```bash
docker-compose logs -f api
```

### Database connection issues
```bash
docker-compose exec postgres psql -U mpanel
```

### Redis issues
```bash
docker-compose exec redis redis-cli
```

### Health check
```bash
curl http://localhost:3000/api/health
```

## Rollback Procedure

1. Stop new deployment
2. Revert to previous image
3. Restore database from backup if needed
4. Verify system health

## Maintenance Windows

Schedule for:
- Database updates
- Security patches
- Major version upgrades
- Schema changes

## Support

For production issues:
- Check monitoring dashboards
- Review error logs
- Check database performance
- Verify external service status
- Contact support if needed

## Continuous Deployment

### GitHub Actions Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and push Docker image
        run: |
          docker build -t mpanel-api:${{ github.sha }} .
          docker push mpanel-api:${{ github.sha }}
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/mpanel-api api=mpanel-api:${{ github.sha }}
```

## Cost Optimization

- Use spot/preemptible instances where possible
- Right-size your resources
- Enable auto-scaling
- Use reserved instances for stable workloads
- Monitor and optimize database queries
- Implement caching aggressively
- Use CDN for static content

## Compliance

Ensure compliance with:
- PCI DSS (for payment processing)
- GDPR (for EU customers)
- SOC 2 (for enterprise customers)
- HIPAA (if applicable)

## Post-Deployment

- [ ] Verify all services are running
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify backups are running
- [ ] Test disaster recovery
- [ ] Update documentation
- [ ] Notify team of deployment
