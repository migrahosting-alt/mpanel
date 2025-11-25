# mPanel AI Coding Agent Instructions

## Project Overview

**mPanel** is a production-ready, multi-tenant hosting control panel and billing platform (WHMCS replacement). Built with Node.js/Express backend + React/Vite frontend, it combines billing automation, hosting management, and 20 enterprise features (AI, GraphQL, Kubernetes, WebSocket, White-Label, CDN, etc.).

**Status**: 100% feature-complete, ready for production deployment. 15,000+ lines of code, 272+ API endpoints, 130 database tables.

## Architecture Essentials

### Tech Stack
- **Backend**: Node.js 20+ (ESM modules), Express.js, PostgreSQL 16, Redis 7, MinIO/S3
- **Frontend**: React 18, Vite, Tailwind CSS, React Router 6
- **Infrastructure**: Docker Compose (local), Kubernetes-ready, Prometheus/Grafana/Loki monitoring
- **Payments**: Stripe integration with webhooks
- **AI**: OpenAI GPT-4 integration for code generation, debugging, forecasting

### Key Patterns

**Multi-Tenancy**: Every table has `tenant_id` (except system tables). All queries MUST filter by `tenant_id` from JWT token (`req.user.tenantId`).

**Authentication Flow**:
```javascript
// 1. JWT extraction: src/middleware/auth.js (authenticateToken)
// 2. RBAC check: src/middleware/authorization.js (requirePermission, requireResourcePermission)
// 3. All routes: authenticateToken → (optional) RBAC middleware → controller
```

**RBAC Hierarchy** (8 roles, 54 permissions across 12 resources):
- `super_admin` (level 0) → `admin` (level 1) → `manager` (level 2) → ... → `client` (level 7)
- Middleware: `requirePermission('servers.create')`, `requireResourcePermission('websites', 'update')`
- Frontend: `hasPermission('servers.read')` from `AuthContext`

**Database Conventions**:
- Tables: `snake_case` (e.g., `dns_zones`, `role_permissions`)
- UUIDs for IDs (NOT integers, except legacy tables like `servers`)
- Timestamps: `created_at`, `updated_at` (auto-updated via triggers)
- Indexes: Always add for foreign keys and frequently queried columns

**API Response Format**:
```javascript
// Success
res.json({ data: {...}, message: 'Success' });

// Error
res.status(400).json({ error: 'Validation failed', details: {...} });
```

## Critical Developer Workflows

### Running the System

**Backend** (port 2271):
```bash
# Development (auto-reload with --watch flag)
npm run dev

# Production
npm start

# SSL worker (background)
npm run ssl-worker:dev
```

**Frontend** (port 2272):
```bash
cd frontend
npm run dev
```

**Infrastructure**:
```bash
# Start all services (PostgreSQL:5433, Redis:6380, MinIO:9000, Prometheus:2273, Grafana:2274, Loki:2275)
docker compose up -d

# Check health
docker compose ps

# View logs
docker compose logs -f
```

### Database Migrations

**Running Migrations**:
```bash
# Run migrations via npm script
npm run migrate

# Or manually with Docker exec (from project root)
docker exec mpanel-postgres psql -U mpanel -d mpanel -f prisma/migrations/MIGRATION_NAME/migration.sql
```

**Creating Migrations**: Always create in `prisma/migrations/TIMESTAMP_description/migration.sql`:
```sql
-- Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create table
CREATE TABLE IF NOT EXISTS my_new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_my_new_table_tenant_id ON my_new_table(tenant_id);

-- Trigger for updated_at
CREATE TRIGGER update_my_new_table_updated_at
  BEFORE UPDATE ON my_new_table
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Testing

```bash
# Run all tests (Node.js built-in test runner)
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check
```

**Test Location**: `src/tests/**/*.test.js` (105 tests exist as examples)

## Project-Specific Conventions

### File Organization

**Backend**:
- `src/controllers/` - Request handlers (thin layer, delegate to services)
- `src/services/` - Business logic (e.g., `billingService.js`, `aiService.js`)
- `src/routes/` - Express route definitions (must use `authenticateToken`)
- `src/middleware/` - Auth (`auth.js`), RBAC (`authorization.js`), validation (`validation.js`)
- `src/db/` - Database migrations and connection setup

**Frontend**:
- `src/pages/` - Full-page components (e.g., `Dashboard.jsx`, `Websites.tsx`)
- `src/components/` - Reusable UI components
- `src/services/` - API clients (legacy: `api.js`; modern: `apiClient.ts` with TypeScript)
- `src/context/` - React contexts (e.g., `AuthContext.jsx`)

### Naming Conventions

**Routes**: RESTful, plural nouns
```javascript
// Good
router.get('/api/servers', listServers);
router.post('/api/websites/:id/deploy', deployWebsite);

// Bad
router.get('/api/server', ...);  // Should be plural
router.post('/api/deploy-website', ...);  // Should be nested
```

**Controllers**: Action-oriented, match HTTP verbs
```javascript
export async function listServers(req, res) { ... }
export async function createServer(req, res) { ... }
export async function getServerById(req, res) { ... }
export async function updateServer(req, res) { ... }
export async function deleteServer(req, res) { ... }
```

**Services**: Business-focused function names
```javascript
// src/services/provisioningService.js
export async function provisionWebsite(customerId, websiteData) { ... }
export async function deprovisionWebsite(websiteId) { ... }
```

### Authentication & Authorization Pattern

**Every protected route**:
```javascript
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';

router.post(
  '/api/servers',
  authenticateToken,              // Step 1: Verify JWT
  requirePermission('servers.create'),  // Step 2: Check RBAC
  createServer                    // Step 3: Controller
);
```

**Multi-tenant filtering** (ALWAYS in services):
```javascript
// CORRECT
const servers = await pool.query(
  'SELECT * FROM servers WHERE tenant_id = $1',
  [req.user.tenantId]  // From JWT
);

// WRONG - security vulnerability!
const servers = await pool.query('SELECT * FROM servers');
```

### Frontend TypeScript Migration (In Progress)

**Modern Pattern** (TypeScript, `apiClient.ts`, `useCrudResource` hook):
```typescript
// src/pages/CustomersPage.tsx
import { useCrudResource } from '../hooks/useCrudResource';

const { items, loading, create, update, delete: deleteItem } = useCrudResource('customers');
```

**Legacy Pattern** (JavaScript, direct `api.js`):
```javascript
// src/pages/Websites.jsx
import api from '../services/api';

const response = await api.get('/websites');
```

**Preference**: Use TypeScript for new components. Refactor legacy pages when touching them.

### Environment Variables

**Critical for development** (see `.env.example`):
```env
# Database (Docker Compose uses port 5433 to avoid conflicts)
DATABASE_URL=postgresql://mpanel:mpanel@localhost:5433/mpanel

# Redis (port 6380)
REDIS_URL=redis://localhost:6380

# JWT (MUST be strong in production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Stripe (test keys for dev)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Never commit** `.env` files. Use `generate-secrets.sh` for production secrets.

## Common Patterns & Examples

### Creating a New Feature (Full Stack)

**1. Backend Service** (`src/services/myService.js`):
```javascript
import pool from '../db/index.js';

export async function createResource(tenantId, data) {
  const result = await pool.query(
    'INSERT INTO resources (tenant_id, name, config) VALUES ($1, $2, $3) RETURNING *',
    [tenantId, data.name, data.config]
  );
  return result.rows[0];
}
```

**2. Controller** (`src/controllers/myController.js`):
```javascript
import * as myService from '../services/myService.js';

export async function createResource(req, res) {
  try {
    const resource = await myService.createResource(req.user.tenantId, req.body);
    res.status(201).json({ data: resource, message: 'Resource created' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
```

**3. Routes** (`src/routes/myRoutes.js`):
```javascript
import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import * as myController from '../controllers/myController.js';

const router = express.Router();

router.post('/', authenticateToken, requirePermission('resources.create'), myController.createResource);

export default router;
```

**4. Register in `src/server.js`**:
```javascript
import myRoutes from './routes/myRoutes.js';
app.use('/api/my-resources', myRoutes);
```

**5. Frontend API Client** (`src/services/apiClient.ts`):
```typescript
export const myResourcesApi = {
  create: (data: MyResourceData) => apiClient.post('/my-resources', data),
};
```

**6. Frontend Page** (`src/pages/MyResources.tsx`):
```typescript
import { useCrudResource } from '../hooks/useCrudResource';

export default function MyResourcesPage() {
  const { items, loading, create } = useCrudResource('my-resources');
  // ... render UI
}
```

### Error Handling Pattern

**Backend**:
```javascript
try {
  const result = await someOperation();
  res.json({ data: result });
} catch (error) {
  logger.error('Operation failed:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: process.env.NODE_ENV === 'development' ? error.message : undefined 
  });
}
```

**Frontend** (with react-hot-toast):
```javascript
import toast from 'react-hot-toast';

try {
  await api.post('/endpoint', data);
  toast.success('Operation successful!');
} catch (error) {
  toast.error(error.response?.data?.error || 'Operation failed');
}
```

## Integration Points

### Stripe Webhooks
- Endpoint: `POST /api/webhooks/stripe`
- Verify signature using `STRIPE_WEBHOOK_SECRET`
- Handle events: `payment_intent.succeeded`, `customer.subscription.*`, `invoice.*`
- See `src/routes/webhookRoutes.js` for implementation

### OpenAI Integration
- Service: `src/services/aiService.js`
- API calls use `OPENAI_API_KEY`
- Features: Code generation, debugging, resource forecasting, churn prediction
- Routes: `src/routes/aiRoutes.js` (15 endpoints)

### WebSocket Real-time
- Service: `src/services/websocketService.js`
- Socket.io with Redis pub/sub for scaling
- Frontend: Connect via `socket.io-client` to `/socket.io`
- Events: `notification`, `presence`, `collaboration`

## Deployment

**Production Deployment** (automated):
```bash
# One-command deployment
curl -fsSL https://raw.githubusercontent.com/migrahosting-alt/mpanel/main/deploy-production.sh -o deploy.sh
chmod +x deploy.sh
sudo bash deploy.sh
```

**Manual Steps**:
1. Set up infrastructure: `docker compose -f docker-compose.prod.yml up -d`
2. Run migrations: `npm run migrate`
3. Build frontend: `cd frontend && npm run build`
4. Start backend with PM2: `pm2 start src/server.js --name mpanel-backend`
5. Configure Nginx (see `nginx-loadbalancer.conf`)

**Health Check**:
```bash
curl http://localhost:2271/api/health
# Returns: { status: 'ok', features: [...] }
```

## Gotchas & Important Notes

1. **Port Conflicts**: Docker Compose uses non-standard ports (PostgreSQL: 5433, Redis: 6380) to avoid conflicts with local installations.

2. **ESM Modules**: All backend code uses `import`/`export` (NOT `require`). Package.json has `"type": "module"`.

3. **Current Ports**: Backend: 2271, Frontend: 2272, Prometheus: 2273, Grafana: 2274, Loki: 2275

4. **Database UUIDs**: Most tables use UUIDs for IDs. Use `uuid_generate_v4()` or let PostgreSQL auto-generate.

5. **RBAC Permissions**: Don't hardcode role checks (`if (user.role === 'admin')`). Use permission checks (`hasPermission('resource.action')`).

6. **Frontend Routing**: Admin routes use `/admin/*`, client portal uses `/client/*`. See `src/App.jsx` for routing structure.

7. **API Versioning**: All API routes start with `/api/` (no version prefix yet, but planned as `/api/v1/`).

8. **Documentation**: Extensive markdown docs exist in root. Always check `IMPLEMENTATION_SUMMARY.md`, `100_PERCENT_COMPLETE.md`, and feature-specific docs before implementing.

## Quick Reference

**Find existing patterns**:
- Authentication: `src/middleware/auth.js`
- RBAC: `src/middleware/authorization.js`
- Database queries: `src/services/*.js`
- API examples: `API_EXAMPLES.md`
- Architecture: `ARCHITECTURE.md`

**Common Commands**:
```bash
# Backend dev
npm run dev

# Frontend dev
cd frontend && npm run dev

# Run migrations
npm run migrate

# Test
npm test

# Lint/format
npm run lint:fix
npm run format

# Docker services
docker compose up -d
docker compose ps
docker compose logs -f
```

**Key Files**:
- Main server: `src/server.js`
- DB connection: `src/db/index.js`
- Frontend entry: `frontend/src/main.jsx`
- Frontend routing: `frontend/src/App.jsx`
- Auth context: `frontend/src/context/AuthContext.jsx`

---

*Last Updated: November 15, 2025 | mPanel v1.0.0 - 100% Feature Complete*
