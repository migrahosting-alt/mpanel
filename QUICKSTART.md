# MPanel Quick Start Guide

Get up and running with MPanel in 5 minutes!

## Prerequisites

- Docker & Docker Compose installed
- Node.js 20+ installed
- Git installed

## Installation

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/migrahosting-alt/mpanel.git
cd mpanel

# Run automated setup
chmod +x setup.sh
./setup.sh
```

The setup script will:
- Create `.env` file from template
- Start all infrastructure services (PostgreSQL, Redis, MinIO, etc.)
- Install backend dependencies
- Run database migrations
- Install frontend dependencies

### 2. Configure Environment

Edit `.env` file with your settings (optional for development):

```bash
nano .env
```

Key settings to review:
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `STRIPE_SECRET_KEY` - Payment processing (optional)
- `SMTP_*` - Email settings (optional)

### 3. Start the Application

**Terminal 1 - Backend API:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Access the Application

Once started, access:

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/api/health
- **Metrics**: http://localhost:3000/api/metrics

## Infrastructure Services

All services are running via Docker Compose:

- **PostgreSQL**: localhost:5432
  - Database: `mpanel`
  - User: `mpanel`
  - Password: `mpanel`

- **Redis**: localhost:6379

- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin`

- **Grafana**: http://localhost:3002
  - Username: `admin`
  - Password: `admin`

- **Prometheus**: http://localhost:9090

- **Loki**: http://localhost:3100

- **Vault**: http://localhost:8200

## First Steps

### 1. Create a Product

```bash
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Starter Hosting",
    "type": "hosting",
    "billingCycle": "monthly",
    "price": 9.99,
    "description": "Basic hosting package"
  }'
```

### 2. Create a Subscription

```bash
curl -X POST http://localhost:3000/api/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "your-customer-id",
    "productId": "your-product-id",
    "billingCycle": "monthly",
    "price": 9.99,
    "nextBillingDate": "2024-12-01"
  }'
```

### 3. Generate an Invoice

```bash
curl -X POST http://localhost:3000/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customerId": "your-customer-id",
    "invoiceNumber": "INV-2024-000001",
    "items": [{
      "description": "Starter Hosting - Monthly",
      "quantity": 1,
      "unitPrice": 9.99,
      "amount": 9.99,
      "taxable": true
    }],
    "taxRate": 0.10,
    "currency": "USD",
    "dueDate": "2024-12-31"
  }'
```

## Exploring the UI

The frontend provides an intuitive interface:

1. **Dashboard** - Overview of revenue, customers, and activity
2. **Products** - Manage hosting, domains, and services
3. **Invoices** - Create and track invoices
4. **Subscriptions** - Monitor recurring services

## Monitoring

### View Metrics in Grafana

1. Go to http://localhost:3002
2. Login with `admin`/`admin`
3. Navigate to Dashboards
4. Explore Prometheus metrics

### Check Logs in Loki

1. In Grafana, go to Explore
2. Select Loki as datasource
3. Query logs: `{service="mpanel-api"}`

## Development Workflow

### Making Changes

1. Edit source files in `src/` (backend) or `frontend/src/` (frontend)
2. Both servers auto-reload on changes
3. Test your changes
4. Commit and push

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Database Migrations

```bash
npm run migrate
```

## Common Tasks

### Reset Database

```bash
docker-compose down -v
docker-compose up -d postgres
npm run migrate
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Stop All Services

```bash
docker-compose down
```

### Restart Services

```bash
docker-compose restart
```

## Troubleshooting

### Port Already in Use

If ports are already in use, edit `docker-compose.yml` to change port mappings.

### Database Connection Error

Check if PostgreSQL is running:
```bash
docker-compose ps postgres
```

### Redis Connection Error

Check if Redis is running:
```bash
docker-compose ps redis
```

### Cannot Connect to MinIO

Ensure MinIO is running and bucket is created:
```bash
docker-compose logs minio
```

## Next Steps

- Read [README.md](README.md) for complete documentation
- Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- See [API_EXAMPLES.md](API_EXAMPLES.md) for API usage
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- Read [CONTRIBUTING.md](CONTRIBUTING.md) to contribute

## Getting Help

- Check documentation in `/docs`
- Review code examples
- Open an issue on GitHub
- Check logs for errors

## Production Deployment

For production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

Key differences for production:
- Set `NODE_ENV=production`
- Use managed databases (AWS RDS, etc.)
- Configure SSL/TLS certificates
- Set up proper monitoring and alerts
- Use strong secrets and passwords
- Enable backups
- Configure CDN for static assets

## What's Next?

Now that you have MPanel running:

1. ✅ Explore the UI at http://localhost:3001
2. ✅ Create test products and subscriptions
3. ✅ Generate sample invoices
4. ✅ Check monitoring dashboards
5. ✅ Read the architecture documentation
6. ✅ Start building your billing platform!

Happy coding! 🚀
