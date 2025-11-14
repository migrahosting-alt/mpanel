# Phase 4: Production Polish & Integration

## Overview
Phase 4 focuses on making MPanel production-ready by polishing existing features, ensuring consistency, and preparing for real-world deployment.

## Goals
1. ✅ Consistent codebase (all pages use TypeScript patterns)
2. ✅ Proper authentication flow
3. ✅ Better UX (loading states, error handling)
4. ✅ Integration testing foundation
5. ✅ Real provisioning preparation

---

## Week 1: Code Quality & Consistency (5 days)

### Day 1: Refactor Email Page to TypeScript
**Task**: Convert `Email.jsx` to use `apiClient.ts`

**Current Issues:**
- Uses hardcoded axios with `http://localhost:3000`
- No consistent error handling
- Loading states inconsistent

**Changes:**
- Import and use `apiClient` from `lib/apiClient.ts`
- Replace all `axios.get/post/delete` with `apiClient.get/post/delete`
- Add proper loading skeletons
- Standardize error messages with toast notifications
- Ensure cookie-based auth works

**Files to Update:**
- `frontend/src/pages/Email.jsx`

**Acceptance Criteria:**
- ✅ All API calls use `apiClient.ts`
- ✅ Loading states show skeleton loaders
- ✅ Errors display user-friendly messages
- ✅ Works with authentication

---

### Day 2: Refactor Databases Page to TypeScript
**Task**: Convert `DatabaseManagement.jsx` to use `apiClient.ts`

**Current Issues:**
- Uses direct axios calls
- Inconsistent with new TypeScript pattern
- No loading skeletons

**Changes:**
- Import `apiClient.ts`
- Replace axios calls with `apiClient` methods
- Add loading skeletons for database list
- Improve error handling
- Add success toast notifications

**Files to Update:**
- `frontend/src/pages/DatabaseManagement.jsx` (or create `Databases.tsx`)

**Acceptance Criteria:**
- ✅ Uses `apiClient.ts` for all API calls
- ✅ Loading skeletons during data fetch
- ✅ Toast notifications for success/error
- ✅ Consistent with other TypeScript pages

---

### Day 3: Refactor File Manager to TypeScript
**Task**: Update `FileManager.jsx` to use `apiClient.ts`

**Current Issues:**
- Uses custom API_URL constant
- Direct axios usage
- No standardized error handling

**Changes:**
- Import `apiClient.ts`
- Replace all axios calls with `apiClient` methods
- Handle multipart/form-data for file uploads
- Add loading states for file operations
- Improve error messages

**Files to Update:**
- `frontend/src/pages/FileManager.jsx`

**Acceptance Criteria:**
- ✅ All API calls use `apiClient.ts`
- ✅ File upload works with new pattern
- ✅ Loading states for operations
- ✅ Error handling improved

---

### Day 4: Authentication Flow & Persistence
**Task**: Implement proper login/logout flow

**Current Issues:**
- Authentication state not persisted
- No proper logout functionality
- Token refresh not implemented

**Changes:**
- Create `AuthContext.tsx` for global auth state
- Implement login page with proper flow
- Add logout functionality
- Persist auth state in localStorage/cookies
- Redirect to login when unauthorized
- Add loading state on app initialization

**Files to Create/Update:**
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/pages/Login.jsx` (enhance existing)
- `frontend/src/App.jsx` (add auth wrapper)
- `frontend/src/lib/apiClient.ts` (handle 401 redirects)

**Acceptance Criteria:**
- ✅ User can login and stay logged in
- ✅ 401 responses redirect to login
- ✅ Logout clears session properly
- ✅ Auth state persists across page reloads

---

### Day 5: Loading States & Error Handling
**Task**: Add consistent loading and error UX across all pages

**Current Issues:**
- Inconsistent loading indicators
- Error messages not user-friendly
- No global error boundary

**Changes:**
- Create `LoadingSkeleton` component
- Create `ErrorBoundary` component
- Add toast notification system (react-hot-toast)
- Standardize error messages
- Add retry logic for failed requests

**Files to Create/Update:**
- `frontend/src/components/LoadingSkeleton.tsx`
- `frontend/src/components/ErrorBoundary.tsx`
- Update all pages to use new components
- Add toast notifications throughout

**Acceptance Criteria:**
- ✅ All pages show loading skeletons
- ✅ Errors caught by error boundary
- ✅ Toast notifications for user actions
- ✅ Retry buttons for failed requests

---

## Week 2-3: Production Preparation (10 days)

### Day 6-7: Integration Testing Setup
**Task**: Add integration tests for API endpoints

**Tools:**
- Jest for test runner
- Supertest for API testing
- Testing Library for React components

**Tests to Write:**
1. Authentication tests (login, logout, token validation)
2. Customer CRUD tests
3. User CRUD tests (admin-only)
4. Domains CRUD tests
5. Websites CRUD tests
6. DNS management tests
7. Email management tests
8. Database management tests
9. AI endpoints tests (with mocked OpenAI)

**Files to Create:**
- `backend/src/tests/auth.test.js`
- `backend/src/tests/customers.test.js`
- `backend/src/tests/users.test.js`
- `backend/src/tests/domains.test.js`
- `backend/src/tests/ai.test.js`
- `frontend/src/__tests__/` (component tests)

**Acceptance Criteria:**
- ✅ 80%+ test coverage on critical paths
- ✅ All API endpoints have tests
- ✅ Tests run in CI/CD pipeline
- ✅ Mock external services (Stripe, OpenAI)

---

### Day 8-9: Real Provisioning Foundation
**Task**: Prepare for actual resource provisioning

**Current State:** APIs exist but don't create real resources

**Changes:**

1. **Database Provisioning:**
   - Create PostgreSQL provisioning script
   - Add MySQL/MariaDB provisioning
   - Generate and store secure credentials
   - Test database creation/deletion

2. **Email Provisioning:**
   - Research Postfix/Dovecot integration
   - Create mailbox provisioning script
   - Add quota management scripts
   - Test email account creation

3. **DNS Provisioning:**
   - Set up PowerDNS or Cloudflare API
   - Implement zone creation
   - Add record propagation
   - Test DNS updates

**Files to Create:**
- `backend/src/provisioning/database.js`
- `backend/src/provisioning/email.js`
- `backend/src/provisioning/dns.js`
- `backend/src/workers/provisioning-worker.js`

**Acceptance Criteria:**
- ✅ Can create real PostgreSQL databases
- ✅ Can create real email accounts (or mock)
- ✅ Can create/update DNS records
- ✅ Rollback on failure

---

### Day 10-12: Server Agent Foundation
**Task**: Build basic server agent for monitoring

**Purpose:** Enable real server monitoring and provisioning

**Agent Features:**
1. Health reporting (CPU, RAM, disk, network)
2. Metrics collection (send to control panel)
3. Command execution (secure, authenticated)
4. Log shipping to control panel
5. Auto-registration with control panel

**Files to Create:**
- `agent/` directory (new)
- `agent/src/agent.js` (main agent)
- `agent/src/metrics.js` (metrics collection)
- `agent/src/api-client.js` (talk to control panel)
- `agent/package.json`
- `agent/Dockerfile`

**Acceptance Criteria:**
- ✅ Agent collects and reports metrics
- ✅ Agent authenticates with control panel
- ✅ Metrics appear in dashboard
- ✅ Agent can be deployed on remote servers

---

### Day 13-14: Security Hardening
**Task**: Production security improvements

**Changes:**

1. **Add 2FA Support:**
   - Install `speakeasy` for TOTP
   - Add 2FA setup page
   - Require 2FA for admin users
   - QR code generation

2. **Email Verification:**
   - Send verification email on signup
   - Token-based verification
   - Resend verification option
   - Block unverified users from critical actions

3. **Audit Log Viewing:**
   - Create audit log page
   - Filter by user, action, date
   - Export audit logs
   - Admin-only access

4. **Rate Limiting Improvements:**
   - Per-user rate limits
   - API key rate limits
   - Stricter limits on auth endpoints
   - Redis-based rate limiting

**Files to Create/Update:**
- `frontend/src/pages/Security.tsx` (2FA setup)
- `frontend/src/pages/AuditLogs.tsx`
- `backend/src/routes/auth.js` (add 2FA endpoints)
- `backend/src/routes/audit.js` (audit log viewing)
- `backend/src/middleware/rateLimiter.js` (enhance)

**Acceptance Criteria:**
- ✅ 2FA works for admin users
- ✅ Email verification flow complete
- ✅ Audit logs viewable by admins
- ✅ Rate limiting prevents abuse

---

### Day 15: CI/CD Setup
**Task**: Set up automated testing and deployment

**Changes:**

1. **GitHub Actions Workflow:**
   - Run tests on pull requests
   - Lint code automatically
   - Build Docker images
   - Deploy to staging on merge to `develop`
   - Deploy to production on merge to `main`

2. **Docker Compose for Production:**
   - Production-ready compose file
   - Health checks for all services
   - Automatic restarts
   - Volume management
   - Environment-based configuration

**Files to Create:**
- `.github/workflows/test.yml`
- `.github/workflows/deploy.yml`
- `docker-compose.prod.yml`
- `Dockerfile.prod` (multi-stage build)

**Acceptance Criteria:**
- ✅ Tests run automatically on PRs
- ✅ Docker images build successfully
- ✅ Can deploy to staging/production
- ✅ Rollback strategy in place

---

## Success Metrics

**Code Quality:**
- 🎯 All pages use TypeScript patterns
- 🎯 80%+ test coverage
- 🎯 Zero critical security vulnerabilities
- 🎯 All linting errors resolved

**User Experience:**
- 🎯 Consistent loading states across all pages
- 🎯 User-friendly error messages
- 🎯 Toast notifications for all actions
- 🎯 Smooth authentication flow

**Production Readiness:**
- 🎯 CI/CD pipeline functional
- 🎯 Real provisioning for at least 2 resources (DB, Email or DNS)
- 🎯 Server agent deployed and reporting
- 🎯 2FA and email verification working
- 🎯 Audit logs viewable

---

## Phase 4 Deliverables

### Week 1 Deliverables:
1. ✅ Email.jsx refactored to use apiClient.ts
2. ✅ DatabaseManagement.jsx refactored to use apiClient.ts
3. ✅ FileManager.jsx refactored to use apiClient.ts
4. ✅ AuthContext and proper login/logout flow
5. ✅ LoadingSkeleton and ErrorBoundary components

### Week 2-3 Deliverables:
1. ✅ Integration test suite (80%+ coverage)
2. ✅ Real database provisioning (PostgreSQL)
3. ✅ Real email provisioning (Postfix/Dovecot or mock)
4. ✅ DNS integration (PowerDNS or Cloudflare)
5. ✅ Basic server agent (metrics reporting)
6. ✅ 2FA support for admins
7. ✅ Email verification flow
8. ✅ Audit log viewing page
9. ✅ CI/CD pipeline with GitHub Actions
10. ✅ Production-ready Docker setup

---

## Priority Order (If Time-Constrained)

**Must-Have (Critical):**
1. Refactor 3 pages to apiClient.ts (Day 1-3)
2. Authentication flow (Day 4)
3. Loading/error handling (Day 5)
4. Integration tests (Day 6-7)

**Should-Have (Important):**
5. Real provisioning (database at minimum) (Day 8-9)
6. Security hardening (2FA, email verification) (Day 13-14)
7. CI/CD setup (Day 15)

**Nice-to-Have (Enhancement):**
8. Server agent (Day 10-12)
9. Audit log viewing
10. Advanced rate limiting

---

## Next Actions

**Starting Now:**
1. Refactor `Email.jsx` to use `apiClient.ts`
2. Test all email management functions
3. Move to `DatabaseManagement.jsx`
4. Continue through Day 1-5 tasks

**Ready to begin Phase 4?** Let's start with **Day 1: Refactor Email Page** 🚀
