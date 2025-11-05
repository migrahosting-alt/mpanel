# MPanel - Multi-Tenant Billing & Hosting Management Platform

A modern, comprehensive control panel for web hosting and billing that replaces WHMCS with a built-from-scratch solution using the latest technologies.

## 🚀 Features

### Billing System (WHMCS Replacement)
- **Multi-Tenant Architecture**: Full tenant isolation for hosting multiple clients
- **Comprehensive Billing**: Invoices, payments, tax calculations, and recurring billing
- **Product Management**: Hosting, domains, SSL, email, and custom products
- **TLD & ICANN Management**: Full domain lifecycle with ICANN fee tracking
- **Payment Gateway**: Stripe integration with webhook support
- **Tax Management**: Location-based tax rules with compound support
- **Subscription Management**: Recurring billing with automatic renewals

### Hosting Control Panel
- **Server Management**: Infrastructure nodes with metrics tracking and agent monitoring
- **Website/Application Management**: WordPress, PHP, Node.js, Python, static sites with SSL
- **DNS Management**: PowerDNS-compatible zones and records (A, AAAA, CNAME, MX, TXT, SRV, CAA)
- **Email Management**: Mailboxes with quotas, passwords, and forwarding
- **Database Management**: PostgreSQL & MySQL with auto-generated connection strings
- **FTP/SFTP**: Account management with directory permissions
- **Cron Jobs**: Scheduled tasks per website or server
- **Backups**: Website, database, and DNS backups with retention policies
- **Background Jobs**: Asynchronous task queue for provisioning and operations

### User Experience
- **Modern UI**: React-based frontend with Tailwind CSS and AI-inspired design
- **Command Palette**: Quick actions and navigation with Ctrl+K / Cmd+K
- **Real-time Monitoring**: Prometheus metrics and Grafana dashboards
- **Centralized Logging**: Loki integration for log aggregation
- **Smart Suggestions**: Dashboard intelligence for renewals, resources, and recommendations

### Infrastructure
- **Secure Storage**: MinIO/S3 for client assets and backups
- **Secrets Management**: Support for Vault or encrypted .env files
- **Role-Based Access**: Owner, Admin, Support, Client roles with permissions
- **Audit Logging**: Complete activity tracking across all operations

## 🛠 Technology Stack

### Backend
- **Node.js** with Express.js
- **PostgreSQL** for platform state and data
- **Redis** for caching, queues, and sessions
- **MinIO/S3** for object storage
- **Stripe** for payment processing

### Frontend
- **React 18** with modern hooks
- **Vite** for blazing fast development
- **Tailwind CSS** for utility-first styling
- **React Router** for navigation
- **Chart.js** for analytics visualization

### Infrastructure
- **Docker Compose** for local development
- **Prometheus** for metrics collection
- **Grafana** for monitoring dashboards
- **Loki** for log aggregation
- **Vault** (optional) for secrets management

## 📋 Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose
- PostgreSQL 16+ (or use Docker)
- Redis 7+ (or use Docker)

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/migrahosting-alt/mpanel.git
cd mpanel
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start infrastructure services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL (port 5432)
- Redis (port 6379)
- MinIO (port 9000, console 9001)
- Prometheus (port 9090)
- Grafana (port 3002)
- Loki (port 3100)
- Vault (port 8200)

### 4. Install backend dependencies

```bash
npm install
```

### 5. Run database migrations

```bash
npm run migrate
```

### 6. Start the backend API

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### 7. Install and start frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3001`

## 📚 API Documentation

### Health Check
```
GET /api/health
```

### Metrics (Prometheus)
```
GET /api/metrics
```

### Products

#### List Products
```
GET /api/products?type=hosting
Authorization: Bearer <token>
```

#### Create Product
```
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Premium Hosting",
  "type": "hosting",
  "billingCycle": "monthly",
  "price": 29.99,
  "description": "Premium hosting package"
}
```

### Invoices

#### Create Invoice
```
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "uuid",
  "invoiceNumber": "INV-2024-000001",
  "items": [
    {
      "description": "Premium Hosting - Monthly",
      "quantity": 1,
      "unitPrice": 29.99,
      "amount": 29.99,
      "taxable": true
    }
  ],
  "taxRate": 0.10,
  "dueDate": "2024-12-31"
}
```

### Subscriptions

#### Create Subscription
```
POST /api/subscriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "customerId": "uuid",
  "productId": "uuid",
  "billingCycle": "monthly",
  "price": 29.99,
  "nextBillingDate": "2024-12-01"
}
```

## 🗄 Database Schema

The platform uses a comprehensive PostgreSQL schema with the following main tables:

- **tenants**: Multi-tenant isolation
- **users**: User accounts and authentication
- **customers**: Customer profiles and billing information
- **products**: Service offerings (hosting, domains, SSL, etc.)
- **product_tlds**: TLD pricing and configurations
- **subscriptions**: Recurring service subscriptions
- **invoices**: Invoice records
- **invoice_items**: Line items for invoices
- **payments**: Payment transactions
- **tax_rules**: Location-based tax calculations
- **domains**: Domain registrations and renewals
- **icann_fees**: ICANN fee tracking
- **audit_logs**: System audit trail

## 📊 Monitoring & Observability

### Prometheus Metrics

The API exposes Prometheus metrics at `/api/metrics` including:
- HTTP request duration and counts
- Active connections
- Node.js process metrics
- Custom business metrics

### Grafana Dashboards

Access Grafana at `http://localhost:3002`:
- Username: `admin`
- Password: `admin`

### Loki Logs

Logs are automatically shipped to Loki at `http://localhost:3100` and can be queried through Grafana.

## 🔐 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on API endpoints
- Helmet.js for security headers
- Input validation with Joi
- SQL injection protection
- XSS prevention
- CORS configuration
- Encrypted secrets with Vault or sops/age

## 🔄 Recurring Billing

The platform includes automated recurring billing:

1. Daily cron job checks for due subscriptions
2. Generates invoices automatically
3. Processes payments (configurable)
4. Updates subscription billing dates
5. Sends notifications (email integration required)

To enable in production, set `NODE_ENV=production` in `.env`

## 🌍 Multi-Tenancy

Each tenant has isolated:
- User accounts
- Products and pricing
- Customers and subscriptions
- Invoices and payments
- Tax rules
- Domain registrations

## 💳 Payment Processing

### Stripe Integration

1. Set up Stripe account
2. Add keys to `.env`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Configure webhook endpoint: `https://your-domain.com/api/webhooks/stripe`

## 📦 MinIO Object Storage

MinIO is used for:
- Client uploaded files
- Backup storage
- Invoice PDFs
- Domain transfer documents
- SSL certificates

Access MinIO Console at `http://localhost:9001`:
- Username: `minioadmin`
- Password: `minioadmin`

## 📝 License

MIT License

## 🗺 Roadmap

- [ ] Email notification system
- [ ] SMS notifications
- [ ] Automated domain provisioning with registrars
- [ ] cPanel/Plesk integration
- [ ] Support ticket system
- [ ] Knowledge base
- [ ] Customer portal
- [ ] Mobile app
- [ ] Advanced analytics
- [ ] AI-powered insights
- [ ] Multi-currency support
- [ ] API documentation with Swagger

## 🌟 Why MPanel?

Unlike WHMCS and other legacy solutions:
- **Modern Stack**: Built with latest technologies
- **Full Control**: Own your billing platform
- **Customizable**: Extend and modify as needed
- **Cost Effective**: No per-client licensing
- **Open Source**: Transparent and auditable
- **Scalable**: Designed for growth
- **AI-Ready**: Modern architecture for AI integration

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md)
