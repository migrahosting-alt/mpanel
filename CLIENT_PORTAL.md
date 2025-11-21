# Client Portal - Documentation

## Overview
The Client Portal is a completely separate interface for end-user clients (customers) to manage their services, domains, invoices, billing, and support tickets. It provides a clean, customer-focused experience distinct from the admin panel.

## Architecture

### Separate Routing
```
/client/*          → Client Portal (ClientLayout)
/admin/*           → Admin Panel (Layout)
/                  → Auto-redirect based on role
```

### Access Control
- **Client role required**: All `/client/*` routes protected by `requireClient` middleware
- **JWT authentication**: Token validation on every request
- **Role-based UI**: Different experience for clients vs. admins

## Features

### 1. Client Dashboard (`/client`)
**File**: `frontend/src/pages/client/ClientDashboard.jsx`

#### Stats Overview
- **Active Services**: Count of running hosting services
- **Domains**: Total domains owned
- **Unpaid Invoices**: Outstanding payment count (highlighted in red)
- **Open Tickets**: Active support requests

#### Recent Activity
- Service status cards (active, suspended)
- Renewal dates and pricing
- Resource usage indicators

#### Quick Actions
- View Invoices
- Get Support
- Upgrade Plan

**API Endpoints**:
```javascript
GET /api/client/services      → Fetch user's services
GET /api/client/domains       → Fetch user's domains
GET /api/client/invoices      → Fetch user's invoices
GET /api/client/tickets       → Fetch support tickets
```

### 2. My Services (`/client/services`)
**File**: `frontend/src/pages/client/ClientServices.jsx`

#### Features
- **Service listing** with status badges (active, suspended, cancelled)
- **Resource usage** visualization:
  - Disk usage progress bars
  - Bandwidth usage progress bars
  - Color-coded warnings (red >80%)
- **Service details**:
  - Domain association
  - Pricing and renewal dates
  - Service type (Shared, VPS, Dedicated)
- **Actions**:
  - Manage service settings
  - Upgrade plan
  - View details

#### Filters
- All services
- Active only
- Suspended only

### 3. My Domains (`/client/domains`)
**File**: `frontend/src/pages/client/ClientDomains.jsx`

#### Features
- **Domain list** with registration/expiry dates
- **Auto-renew status** toggle
- **Domain management**:
  - DNS management link
  - Settings configuration
  - Registrar information
- **Actions**:
  - Register new domain
  - Transfer domain
  - Configure DNS

### 4. Invoices (`/client/invoices`)
**File**: `frontend/src/pages/client/ClientInvoices.jsx`

#### Features
- **Invoice table** with sortable columns:
  - Invoice ID
  - Description
  - Date issued
  - Due date
  - Amount
  - Status (paid, unpaid, overdue)
- **Actions**:
  - Pay now (for unpaid invoices)
  - Download PDF
  - View details

#### Filters
- All invoices
- Paid
- Unpaid
- Overdue

**API Endpoint**:
```javascript
GET /api/client/invoices
Response: { invoices: [...] }
```

### 5. Billing & Payment (`/client/billing`)
**File**: `frontend/src/pages/client/ClientBilling.jsx`

#### Payment Methods
- **Card list** with masked numbers (Visa •••• 4242)
- **Default card** indicator
- **Expiry dates** display
- **Actions**:
  - Add new card
  - Remove card (non-default)
  - Set as default

#### Billing Information
- Full name
- Email address
- Street address
- City, State, ZIP
- Country

**API Endpoint**:
```javascript
GET /api/client/billing
Response: {
  paymentMethods: [...],
  billingInfo: {...}
}
```

### 6. Support (`/client/support`)
**File**: `frontend/src/pages/client/ClientSupport.jsx`

#### Ticket Management
- **Ticket list** with:
  - Ticket ID
  - Subject
  - Status (open, in_progress, closed, cancelled)
  - Priority (low, medium, high, urgent)
  - Created/updated timestamps
  - Reply count
- **Create new ticket**:
  - Subject
  - Priority selection
  - Detailed description
- **Actions**:
  - View ticket thread
  - Reply to ticket
  - Close ticket

**API Endpoints**:
```javascript
GET /api/client/tickets           → Fetch user's tickets
POST /api/client/tickets          → Create new ticket
Body: { subject, priority, description }
```

## UI Components

### ClientLayout Component
**File**: `frontend/src/components/ClientLayout.jsx`

#### Features
- **Separate sidebar** from admin layout
- **Client-specific navigation**:
  - Dashboard
  - My Services
  - Domains
  - Invoices
  - Billing
  - Support
- **Mobile responsive** with slide-out menu
- **User dropdown**:
  - Profile link
  - Sign out
- **Notifications** bell icon
- **Clean branding** optimized for clients

#### Desktop Sidebar (Fixed)
- Logo at top
- Navigation items with icons
- Sign out at bottom
- 288px width (`w-72`)

#### Mobile Sidebar (Slide-out)
- Full-screen overlay
- Gesture-friendly close
- Same navigation structure

#### Top Bar
- Mobile menu toggle
- "Client Portal" title
- Notifications icon
- User profile dropdown

## Backend API Routes

### File: `src/routes/clientRoutes.js`

All routes require `requireClient` middleware (client role authentication).

#### Endpoints

**GET /api/client/services**
```javascript
Response: {
  services: [
    {
      id, userId, name, type, status, price,
      renewDate, domain, diskUsage, bandwidthUsage
    }
  ]
}
```

**GET /api/client/domains**
```javascript
Response: {
  domains: [
    {
      id, userId, name, registrar,
      registrationDate, expiryDate, status, autoRenew
    }
  ]
}
```

**GET /api/client/invoices**
```javascript
Response: {
  invoices: [
    {
      id, userId, date, dueDate,
      amount, status, description
    }
  ]
}
```

**GET /api/client/billing**
```javascript
Response: {
  paymentMethods: [...],
  billingInfo: { name, email, address, city, state, zip, country }
}
```

**GET /api/client/tickets**
```javascript
Response: {
  tickets: [
    {
      id, userId, subject, status, priority,
      created, lastUpdate, replies
    }
  ]
}
```

**POST /api/client/tickets**
```javascript
Request: { subject, priority, description }
Response: { ticket: { id, ... } }
```

## Integration

### App.jsx Routes
```javascript
// Client Portal Routes (nested under ClientLayout)
<Route path="/client" element={<ProtectedRoute><ClientLayout /></ProtectedRoute>}>
  <Route index element={<ClientDashboard />} />
  <Route path="services" element={<ClientServices />} />
  <Route path="domains" element={<ClientDomains />} />
  <Route path="invoices" element={<ClientInvoices />} />
  <Route path="billing" element={<ClientBilling />} />
  <Route path="support" element={<ClientSupport />} />
</Route>
```

### Backend Routes (index.js)
```javascript
import clientRoutes from './clientRoutes.js';
router.use('/client', clientRoutes);
```

## Design Principles

### Client-Focused UX
1. **Simplified navigation**: Only 6 menu items vs. 20+ in admin
2. **Clear labels**: "My Services" instead of "Service Management"
3. **Visual feedback**: Color-coded status badges, progress bars
4. **Quick actions**: One-click access to common tasks
5. **Mobile-first**: Fully responsive design

### Separation from Admin
1. **Different layout**: ClientLayout vs. Layout
2. **Different branding**: Client-friendly language
3. **Limited features**: Only customer-facing functions
4. **Role-based access**: `requireClient` middleware
5. **Separate routes**: `/client/*` vs. `/admin/*`

### Data Isolation
1. **User-scoped queries**: Only fetch data for authenticated user
2. **No cross-tenant data**: Each client sees only their resources
3. **RBAC protection**: Backend validates client role on every request

## Security Features

### Authentication
- **JWT validation**: Token required on all endpoints
- **Role verification**: `requireClient` middleware checks role
- **User ID extraction**: `req.user.id` from JWT payload

### Authorization
- **Client-only access**: Admin cannot access `/client` routes (different interface)
- **Data scoping**: Queries filtered by `userId`
- **Permission checks**: Backend validates before data access

### Data Protection
- **Sensitive data masking**: Card numbers show only last 4 digits
- **HTTPS required**: All client portal traffic encrypted
- **CSRF protection**: Token-based request validation

## Mock Data (Temporary)

All client routes currently return mock data for demonstration. Replace with actual database queries:

### Services
```javascript
// TODO: Replace with actual query
const services = await db.query(
  'SELECT * FROM services WHERE user_id = $1 AND deleted_at IS NULL',
  [userId]
);
```

### Invoices
```javascript
// TODO: Replace with Stripe API integration
const invoices = await stripe.invoices.list({
  customer: user.stripeCustomerId,
});
```

### Tickets
```javascript
// TODO: Replace with ticket system query
const tickets = await db.query(
  'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created DESC',
  [userId]
);
```

## Usage Examples

### Client Login Flow
```
1. User logs in with email/password
2. Backend returns JWT with role: 'client'
3. Frontend checks role: isClient = true
4. Redirect to /client (ClientDashboard)
5. ClientLayout renders with client navigation
6. All API calls use /api/client/* endpoints
```

### Admin Cannot Access Client Portal
```
1. Admin logs in (role: 'admin')
2. Tries to navigate to /client
3. ProtectedRoute allows access (authenticated)
4. But admin sees admin Layout, not ClientLayout
5. Admin uses /admin/* routes instead
6. Backend /api/client/* returns 403 (requireClient fails)
```

### Client Support Ticket Flow
```
1. Client navigates to /client/support
2. Clicks "New Ticket" button
3. Modal opens with form
4. Fills subject, priority, description
5. Submits form
6. POST /api/client/tickets with JWT
7. Backend validates client role
8. Creates ticket with userId from JWT
9. Returns ticket object
10. Frontend shows success toast
11. Ticket appears in list
```

## Testing Checklist

### Frontend
- [ ] Dashboard loads with correct stats
- [ ] Services page shows user's services only
- [ ] Domains page displays with auto-renew toggle
- [ ] Invoices table filters work (paid/unpaid/overdue)
- [ ] Billing page shows payment methods
- [ ] Support ticket creation works
- [ ] Mobile responsive menu functions
- [ ] Navigation highlights current page
- [ ] User dropdown shows profile/logout

### Backend
- [ ] GET /api/client/services returns 200 with data
- [ ] GET /api/client/invoices filters by userId
- [ ] POST /api/client/tickets creates ticket
- [ ] All endpoints return 401 without JWT
- [ ] All endpoints return 403 for non-client roles
- [ ] Mock data includes userId matching JWT

### Integration
- [ ] Client login redirects to /client
- [ ] Admin login cannot access client portal
- [ ] Client cannot access /admin/* routes
- [ ] JWT token persists across page reloads
- [ ] Logout clears token and redirects to login

## Future Enhancements

### Planned Features
1. **Real-time notifications**: WebSocket for ticket updates
2. **Payment integration**: Stripe Elements for card management
3. **Usage analytics**: Charts for bandwidth/disk trends
4. **Service upgrades**: Self-service plan changes
5. **Domain transfer**: Automated domain migration
6. **Knowledge base**: Self-service support articles
7. **Live chat**: Instant support widget
8. **Mobile app**: React Native client portal

### Database Integration
1. Replace mock data with PostgreSQL queries
2. Add Stripe webhook handlers for invoice sync
3. Implement ticket system with message threading
4. Add audit logging for all client actions

### Performance Optimizations
1. **Pagination**: For long service/invoice lists
2. **Caching**: Redis cache for frequently accessed data
3. **Lazy loading**: Load ticket threads on-demand
4. **Image optimization**: Compress logos and icons

## Troubleshooting

### Common Issues

**Issue**: Client cannot access /client routes
- **Solution**: Verify JWT token contains `role: 'client'` in payload
- **Check**: `localStorage.getItem('token')` exists in browser

**Issue**: API returns empty arrays
- **Solution**: Mock data is filtered by `userId` - ensure JWT has valid user ID
- **Check**: Backend logs for `req.user` object

**Issue**: Payment methods not loading
- **Solution**: Stripe integration not yet implemented - showing mock data
- **Note**: Will be replaced with actual Stripe API calls

**Issue**: Mobile menu doesn't close
- **Solution**: Check Dialog component from Headless UI imported correctly
- **Verify**: `sidebarOpen` state toggling properly

## Support

For client portal issues:
1. Check browser console for errors
2. Verify JWT token in localStorage
3. Check backend logs in `mpanel-main/logs/`
4. Test API endpoints with Postman
5. Review RBAC middleware configuration

---

**Built with**: React 18, Tailwind CSS, Headless UI, Heroicons  
**Backend**: Express.js, PostgreSQL, JWT, RBAC  
**Version**: 1.0.0  
**Last Updated**: November 12, 2025
