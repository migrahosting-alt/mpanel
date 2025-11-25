# MPanel Architecture

## Overview

MPanel is a modern, cloud-native multi-tenant billing and hosting management platform designed to replace legacy solutions like WHMCS.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend Layer                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React + Vite + Tailwind CSS                         │   │
│  │  - Dashboard, Products, Invoices, Subscriptions      │   │
│  │  - Real-time updates via WebSocket (future)          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Gateway Layer                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express.js API                                      │   │
│  │  - Authentication & Authorization (JWT)              │   │
│  │  - Rate Limiting                                     │   │
│  │  - Request Validation                                │   │
│  │  - Metrics Collection (Prometheus)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┼─────────────┐
                │             │             │
                ▼             ▼             ▼
┌───────────────────┐ ┌──────────────┐ ┌──────────────┐
│  Product Service  │ │Billing Service│ │Domain Service│
│  - CRUD Products  │ │ - Invoicing   │ │ - Register   │
│  - TLD Management │ │ - Payments    │ │ - Renew      │
│  - Pricing        │ │ - Taxes       │ │ - ICANN Fees │
└───────────────────┘ └──────────────┘ └──────────────┘
        │                     │                 │
        └─────────────────────┼─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Data Layer                            │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────────┐     │
│  │ PostgreSQL   │  │   Redis   │  │   MinIO/S3       │     │
│  │ - Core Data  │  │ - Sessions│  │ - File Storage   │     │
│  │ - Billing    │  │ - Queues  │  │ - Backups        │     │
│  │ - Audit Logs │  │ - Cache   │  │ - Documents      │     │
│  └──────────────┘  └───────────┘  └──────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   External Integrations                      │
│  ┌──────────┐  ┌────────┐  ┌───────────┐  ┌─────────────┐  │
│  │  Stripe  │  │ Domain │  │   SMTP    │  │   Vault     │  │
│  │ Payments │  │Registrar│  │  Email    │  │  Secrets    │  │
│  └──────────┘  └────────┘  └───────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Observability Stack                       │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │ Prometheus   │  │ Grafana  │  │      Loki        │      │
│  │  Metrics     │  │Dashboards│  │   Log Aggregation│      │
│  └──────────────┘  └──────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Components

### Frontend Layer

**Technology**: React 18, Vite, Tailwind CSS

**Responsibilities**:
- User interface rendering
- Client-side routing
- State management
- API communication
- Real-time updates

**Key Features**:
- Server-side rendering ready
- Code splitting for performance
- Progressive Web App capable
- Responsive design
- Accessibility compliant

### API Gateway

**Technology**: Express.js, Node.js 20+

**Responsibilities**:
- Request routing
- Authentication & authorization
- Rate limiting
- Input validation
- Response formatting
- Error handling
- Metrics collection

**Security**:
- JWT token validation
- Role-based access control
- Helmet.js security headers
- CORS configuration
- Request sanitization

### Service Layer

#### Product Service
- Product catalog management
- TLD configurations
- Pricing rules
- Product bundling

#### Billing Service
- Invoice generation
- Payment processing
- Tax calculations
- Recurring billing automation
- Subscription lifecycle management

#### Domain Service
- Domain registration
- Renewal management
- ICANN fee tracking
- Nameserver management
- Transfer handling

### Data Layer

#### PostgreSQL
**Purpose**: Primary data store

**Schema**:
- Multi-tenant isolation
- Referential integrity
- Audit logging
- Optimized indexes

**Features**:
- Connection pooling
- Automatic backups
- Point-in-time recovery
- Read replicas (production)

#### Redis
**Purpose**: Caching and session management

**Usage**:
- Session storage
- API response caching
- Job queues
- Rate limiting counters
- Real-time data

#### MinIO/S3
**Purpose**: Object storage

**Storage**:
- Customer uploads
- Invoice PDFs
- Backup files
- SSL certificates
- Domain documents

### External Integrations

#### Stripe
- Payment processing
- Subscription management
- Webhook handling
- Refund processing

#### Domain Registrars
- Domain availability check
- Registration automation
- DNS management
- Transfer processing

#### SMTP
- Transactional emails
- Invoice notifications
- Subscription alerts
- System notifications

#### Vault
- Secrets management
- API key storage
- Certificate management
- Encryption keys

### Observability

#### Prometheus
- System metrics
- Application metrics
- Business metrics
- Custom counters/histograms

#### Grafana
- Visualization dashboards
- Alerting rules
- Multi-datasource support
- Custom panels

#### Loki
- Log aggregation
- Query interface
- Log retention policies
- Integration with Grafana

## Data Flow

### Invoice Generation Flow

```
1. Cron Job triggers → BillingService.processRecurringBilling()
2. Query due subscriptions from database
3. For each subscription:
   a. Get customer details
   b. Calculate tax rate
   c. Create invoice with line items
   d. Generate invoice number
   e. Save to database
   f. Update subscription next billing date
4. Send invoice notifications (email)
5. Log metrics to Prometheus
```

### Payment Processing Flow

```
1. Customer initiates payment
2. API validates invoice status
3. Create payment intent with Stripe
4. Stripe processes payment
5. Webhook confirms payment
6. Update payment status in database
7. Update invoice status to 'paid'
8. Send payment confirmation email
9. Trigger fulfillment (if automated)
10. Log transaction
```

### Domain Registration Flow

```
1. Customer selects domain
2. Check availability via registrar API
3. Calculate total cost (registration + ICANN fee)
4. Create invoice
5. Process payment
6. Call registrar API to register domain
7. Create domain record in database
8. Set up nameservers
9. Schedule renewal reminder
10. Send confirmation email
```

## Multi-Tenancy

### Isolation Strategy

**Database Level**:
- Tenant ID in every table
- Row-level security policies
- Separate schemas (optional)

**Application Level**:
- Tenant context from JWT
- Middleware validation
- Query filtering

**Benefits**:
- Data isolation
- Customizable configurations
- Independent scaling
- Cost efficiency

## Security

### Authentication
- JWT tokens with expiration
- Refresh token rotation
- Password hashing (bcrypt)
- Two-factor authentication ready

### Authorization
- Role-based access control (RBAC)
- Resource-level permissions
- API key authentication
- IP whitelisting

### Data Protection
- Encryption at rest (database)
- Encryption in transit (TLS)
- Secrets management (Vault)
- PCI DSS compliance ready

### Monitoring
- Failed login attempts
- Suspicious activity detection
- Audit logging
- Security alerts

## Scalability

### Horizontal Scaling
- Stateless API design
- Load balancer compatible
- Shared session state (Redis)
- Database connection pooling

### Vertical Scaling
- Resource optimization
- Query optimization
- Caching strategies
- Lazy loading

### Database Scaling
- Read replicas
- Connection pooling
- Query optimization
- Partitioning strategies

### Caching Strategy
- API response caching
- Database query caching
- Static asset CDN
- Browser caching

## Performance

### Backend
- Response time < 100ms (p95)
- Connection pooling (2-10 connections)
- Async/await non-blocking I/O
- Efficient database queries

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Bundle size < 500KB

### Database
- Indexed queries
- Query optimization
- Connection reuse
- Prepared statements

## Deployment

### Development
```bash
docker-compose up -d
npm run dev
cd frontend && npm run dev
```

### Production
- Docker containers
- Kubernetes orchestration
- Load balancer (Nginx/HAProxy)
- CDN for static assets
- Database backups
- Monitoring alerts

## Future Enhancements

1. **Microservices**: Split into independent services
2. **Event-Driven**: Implement event bus (RabbitMQ/Kafka)
3. **GraphQL**: Alternative to REST API
4. **WebSocket**: Real-time updates
5. **AI Integration**: Intelligent insights and automation
6. **Mobile Apps**: Native iOS/Android apps
7. **API Gateway**: Kong/AWS API Gateway
8. **Service Mesh**: Istio for microservices
9. **Serverless**: AWS Lambda functions
10. **Multi-Region**: Global deployment

## Technology Decisions

### Why Node.js?
- JavaScript everywhere (frontend + backend)
- Large ecosystem (npm)
- Excellent async I/O
- Strong community support

### Why PostgreSQL?
- ACID compliance
- Rich data types (JSON, arrays)
- Full-text search
- Mature and stable

### Why Redis?
- Fast in-memory storage
- Pub/sub capabilities
- Session management
- Job queues

### Why React?
- Component reusability
- Virtual DOM performance
- Large ecosystem
- Corporate backing (Meta)

### Why Docker?
- Consistent environments
- Easy deployment
- Microservices ready
- Developer productivity

## Conclusion

MPanel provides a modern, scalable, and maintainable alternative to legacy billing platforms. The architecture supports growth from small deployments to enterprise-scale operations while maintaining code quality and developer productivity.
