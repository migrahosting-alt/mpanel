# MPanel Platform – Feature Overview

MPanel is a modern, multi-tenant billing and automation platform built for hosting providers and cloud businesses. It replaces legacy tools like WHMCS with a cloud-native, API-first stack.

---

## 🎯 Core Platform

### Multi-Tenant Architecture
- Full tenant isolation at the database level
- Tenant-specific configuration and branding
- Separate product catalogs and pricing per tenant
- Independent billing cycles and currency support
- Scales to thousands of tenants

### Billing & Invoicing
- Automated invoice generation and recurring billing
- Flexible billing cycles (monthly, quarterly, annual, custom)
- Proration support for mid-cycle changes
- Credit notes, adjustments, and refunds
- Draft / finalized invoice states
- Batch invoice processing
- Planned: invoice PDF templates and designer

### Payments
- Stripe integration out of the box
- Support for multiple payment methods
- Payment intent flow with strong customer authentication (SCA) ready
- Webhook handling for real-time payment events
- Refund and partial-refund workflows
- Account credit system
- Planned: payment retries, dunning flows, and automated reminders

### Products & Catalog
- Unlimited products and product families
- Product types: hosting, domains, SSL, email, add-ons, custom
- One-time, recurring, and usage-based pricing models
- Setup fees and discounts
- Product add-ons and upgrade paths
- Custom product attributes and metadata

### Domain Management
- Domain registration and transfer tracking
- ICANN fee handling and pass-through
- Domain renewal management and auto-renew
- Nameserver and DNS glue management
- TLD-level pricing and margins
- Expiry and grace-period notifications
- Planned: bulk domain updates and operations

### Subscription Management
- Recurring subscriptions linked to products
- Full lifecycle: trial → active → suspended → cancelled
- Auto-renew and manual renewal flows
- Suspension, cancellation, and reactivation workflows
- Planned: one-click upgrades/downgrades and trials

### Tax & Compliance
- Location-based tax rules
- Multiple tax rates and compound taxes
- Tax-exempt customers and tax IDs
- Planned: VAT/GST reports, tax ID validation, and export tooling

---

## 🔐 Security & Compliance

### Authentication & Authorization
- JWT-based auth with refresh tokens
- Role-based access control (RBAC) for admin/staff/customers
- Password hashing with bcrypt
- Session tracking with Redis
- Planned: API keys and 2FA support

### Data Protection
- Encryption in transit (TLS) and at rest
- Secrets managed via environment/Vault
- Hardened SQL access and query parameterization
- XSS and CSRF protections
- CORS configuration and rate-limiting
- Request validation via Joi

### Compliance-Ready
- Audit logging for key actions
- GDPR-ready data model
- PCI-DSS-friendly architecture (no raw card data stored)
- Planned: data retention policies, export, and “right to be forgotten”

---

## 📊 Analytics, Logging & Monitoring

### Metrics & Monitoring
- Prometheus metrics for system and business KPIs
- Latency and error metrics per endpoint
- Database performance metrics
- Pre-built Grafana dashboards

### Logging
- Centralized, structured logs (Winston + Loki)
- Correlation IDs for tracing requests
- Log search and filtering
- Planned: alerting and anomaly detection

### Reporting (Planned)
- Revenue and MRR/ARR dashboards
- Customer and churn reporting
- Tax and compliance reports
- Subscription analytics and exports (CSV/Excel)
- Custom report builder

---

## 💻 User Experience

### Modern Admin UI
- React 18 SPA with hooks
- Tailwind-based, responsive design
- Mobile-friendly layout
- Smooth micro-interactions and transitions
- Accessible components (WCAG-aware)
- Planned: dark mode and full theming

### Dashboard & Management
- Revenue and customer overview
- Recent payments and activity timeline
- Quick actions for common operations
- Management views for:
  - Products
  - Invoices
  - Subscriptions
  - Domains
  - Customers
- Planned: public customer portal, support tickets, and knowledge base

---

## 🔧 Developer & API

### API-First
- RESTful JSON API with consistent patterns
- API versioning strategy
- Strong error models and validation
- Built-in rate limiting and auth
- Planned: full Swagger/OpenAPI docs and SDKs

### Integrations
- Stripe webhooks
- External API integration ready (clean service layer)
- Planned:
  - Plugin / extension system
  - Event-driven architecture (Kafka/RabbitMQ)
  - GraphQL API
  - WebSockets for real-time updates

### Testing & CI
- Unit and integration test setup
- Test helpers and examples included
- CI/CD ready (GitHub Actions / GitLab CI templates)
- Planned: code coverage dashboards

---

## 🚀 DevOps & Scalability

### Deployment
- Dockerized services with Compose for dev
- Kubernetes-ready manifests and health checks
- Graceful shutdown and readiness probes
- Examples for blue/green and rolling deploys

### Scale
- Stateless API layer with horizontal scaling
- PostgreSQL with connection pooling and indexing
- Redis caching for hot paths
- CDN and load balancer friendly
- Planned: microservice decomposition and read replicas

---

## 💾 Data & Storage

- PostgreSQL for relational core data
- Redis for sessions and caching
- S3/MinIO for object and file storage
- Automated backups and migration tooling
- Point-in-time recovery support
- Planned: partitioning and advanced sharding strategies

---

## 📧 Communication & Notifications

### Email
- SMTP integration
- Transactional emails for invoices, payments, and subscriptions
- HTML templates with variables
- Planned: queuing, SendGrid/SES adapters, and template builder

### Notifications
- Email notifications and system alerts
- Planned:
  - SMS / push
  - Slack / webhook notifications
  - Customer notification preferences

---

## 🎨 Customization & Localization

### Branding & Customization
- Tenant-level settings and branding
- Email template customization
- Planned:
  - Custom logos and colors per tenant
  - Custom invoice templates
  - Feature flags per tenant

### Localization
- English by default
- Multi-currency support
- Planned:
  - Multi-language UI
  - RTL support
  - Localized dates, times, and formats

---

## 🤖 AI Capabilities (Current & Planned)

- AI-powered summaries of domains/accounts (internal tools)
- Planned:
  - Intelligent pricing suggestions
  - Churn prediction and revenue forecasting
  - Auto-triage for support requests
  - Recommendation engine (upsells/cross-sells)
  - Fraud/risk scoring

---

## 📈 MPanel vs WHMCS (High-Level)

| Feature          | MPanel          | WHMCS        |
|------------------|-----------------|-------------|
| Stack            | Modern (Node/React) | Legacy PHP  |
| Open Source      | ✅              | ❌          |
| Multi-tenant     | ✅              | Limited     |
| API-first        | ✅              | Partial     |
| Monitoring       | Built-in (Prom/Grafana) | Limited |
| Licensing        | Free / self-hosted | Paid sub   |
| Customization    | Full control    | Restricted  |
| Scalability      | Cloud-native    | OK          |

---

## 🔍 Why Teams Choose MPanel

1. Modern, cloud-native architecture instead of legacy billing software  
2. Full control over data, stack, and custom workflows  
3. No per-client licensing fees  
4. API-first design that plays well with your existing tools  
5. Built-in observability, metrics, and logging  
6. Designed for hosting providers, SaaS, and subscription businesses  
7. Scales from a single provider to multi-brand, multi-region setups  
