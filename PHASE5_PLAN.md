# Phase 5: Billing UI + Customer Portal

**Start Date**: November 11, 2025  
**Estimated Duration**: 6-8 hours (at current velocity)  
**Goal**: Complete production-ready billing and customer-facing features

---

## 🎯 Objectives

### Primary Goals
1. ✅ Complete Billing UI (invoices, subscriptions, payments)
2. ✅ Build Customer Portal (dashboard, services, profile)
3. ✅ Product catalog and checkout flow
4. ✅ Email service integration
5. ✅ End-to-end user journey from signup to payment

### Success Criteria
- Customers can browse products, add to cart, checkout
- Customers can view/pay invoices
- Customers can manage subscriptions
- Customers can view/manage their services
- Email notifications work (invoice, verification, welcome)
- Admin can manage all billing operations

---

## 📅 Development Schedule

### Day 1: Billing UI - Invoices (90 min planned)
**Priority**: CRITICAL - Core revenue feature

#### Deliverables
- [ ] **InvoicesPage.tsx** (Admin)
  - Invoice list with filters (paid/unpaid/overdue)
  - Search by customer, invoice number, amount
  - Invoice detail modal
  - Download PDF button
  - Mark as paid/send reminder actions
  
- [ ] **InvoiceDetailPage.tsx** (Customer)
  - Customer-facing invoice view
  - Line items breakdown
  - Payment button (Stripe integration)
  - Download PDF
  - Payment history

- [ ] **Backend Enhancements**
  - `GET /api/invoices` - List invoices with filters
  - `GET /api/invoices/:id` - Invoice details
  - `GET /api/invoices/:id/pdf` - Generate PDF
  - `POST /api/invoices/:id/pay` - Create Stripe payment intent
  - `POST /api/invoices/:id/mark-paid` - Manual mark paid (admin)
  - PDF generation with invoice template (PDFKit or similar)

#### Estimated Time: 90 minutes
- Frontend (60 min): 2 pages, Stripe Elements integration
- Backend (30 min): PDF generation, payment endpoints

---

### Day 2: Billing UI - Subscriptions (90 min planned)
**Priority**: CRITICAL - Recurring revenue management

#### Deliverables
- [ ] **SubscriptionsPage.tsx** (Admin)
  - Active subscriptions list
  - Filter by status (active/trial/suspended/cancelled)
  - Quick actions (suspend, cancel, renew)
  - Subscription detail modal
  - Billing history

- [ ] **CustomerSubscriptionsPage.tsx** (Customer)
  - My subscriptions view
  - Upgrade/downgrade flow
  - Cancel subscription (with confirmation)
  - Renew early option
  - Add-ons management

- [ ] **Backend Enhancements**
  - `GET /api/subscriptions` - List with filters
  - `PUT /api/subscriptions/:id/upgrade` - Upgrade plan
  - `PUT /api/subscriptions/:id/downgrade` - Downgrade plan
  - `DELETE /api/subscriptions/:id` - Cancel (soft delete)
  - `POST /api/subscriptions/:id/renew` - Manual renewal
  - Proration calculation logic

#### Estimated Time: 90 minutes
- Frontend (50 min): 2 pages, upgrade/cancel flows
- Backend (40 min): Subscription modification logic

---

### Day 3: Customer Portal - Dashboard (75 min planned)
**Priority**: HIGH - Customer entry point

#### Deliverables
- [ ] **CustomerDashboard.tsx**
  - Welcome message with customer name
  - Quick stats (active services, unpaid invoices, domains expiring)
  - Recent invoices widget
  - Active subscriptions widget
  - Quick actions (pay invoice, renew domain, open ticket)
  - Usage alerts (disk space, bandwidth)

- [ ] **CustomerLayout.tsx**
  - Customer-specific navigation
  - Different from admin Layout
  - Profile dropdown
  - Support button
  - Logout

- [ ] **Backend Enhancements**
  - `GET /api/customer/dashboard` - Dashboard stats
  - `GET /api/customer/quick-stats` - Widget data

#### Estimated Time: 75 minutes
- Frontend (60 min): Dashboard with widgets
- Backend (15 min): Dashboard API endpoint

---

### Day 4: Customer Portal - Services (60 min planned)
**Priority**: HIGH - Service management

#### Deliverables
- [ ] **CustomerServicesPage.tsx**
  - Tabbed interface: Hosting | Domains | Email | Databases
  - Service cards with status, expiry, quick actions
  - Manage service button (links to specific management page)
  - Service usage stats
  - Add new service button

- [ ] **ServiceDetailPage.tsx** (Customer view)
  - Service overview
  - Management options (limited compared to admin)
  - Invoices related to this service
  - Upgrade options

#### Estimated Time: 60 minutes
- Frontend (50 min): Services page with tabs
- Backend (10 min): Customer-filtered service endpoints

---

### Day 5: Product Catalog + Cart (120 min planned)
**Priority**: CRITICAL - Revenue generation

#### Deliverables
- [ ] **ProductCatalogPage.tsx**
  - Product grid with categories
  - Product cards (name, price, features)
  - Add to cart button
  - Filter by category (hosting, domains, email, SSL)
  - Search products

- [ ] **CartPage.tsx**
  - Cart items list
  - Quantity adjustment
  - Remove items
  - Subtotal, tax, total calculation
  - Promo code input
  - Proceed to checkout button

- [ ] **CheckoutPage.tsx**
  - Order summary
  - Billing information form
  - Payment method (Stripe Elements)
  - Terms acceptance checkbox
  - Place order button
  - Stripe payment processing

- [ ] **Backend Enhancements**
  - `GET /api/products/catalog` - Public product listing
  - `POST /api/cart/add` - Add to cart (session-based)
  - `GET /api/cart` - Get cart
  - `DELETE /api/cart/:itemId` - Remove from cart
  - `POST /api/checkout/session` - Create Stripe checkout
  - `POST /api/checkout/complete` - Finalize order

#### Estimated Time: 120 minutes
- Frontend (80 min): 3 pages with Stripe integration
- Backend (40 min): Cart + checkout logic

---

### Day 6: Email Integration (60 min planned)
**Priority**: HIGH - Critical for production

#### Deliverables
- [ ] **Email Service Setup**
  - SendGrid or Mailgun integration
  - Email templates (HTML + Text)
  - Template engine (Handlebars or similar)

- [ ] **Email Templates**
  - Welcome email
  - Invoice email (with PDF attachment)
  - Payment confirmation
  - Subscription renewal reminder
  - Password reset
  - Email verification (upgrade from console.log)

- [ ] **Backend Implementation**
  - `src/services/emailService.js` - Real SMTP
  - Template rendering
  - Queue integration for async sending
  - Email tracking (sent, opened, failed)

#### Estimated Time: 60 minutes
- Email setup (20 min): SendGrid/Mailgun config
- Templates (30 min): HTML email templates
- Integration (10 min): Replace console.log with real sends

---

## 🏗️ Technical Architecture

### Frontend Structure
```
frontend/src/
├── pages/
│   ├── admin/
│   │   ├── InvoicesPage.tsx          ✅ NEW
│   │   ├── SubscriptionsPage.tsx     ✅ NEW
│   │   └── (existing admin pages)
│   └── customer/
│       ├── Dashboard.tsx              ✅ NEW
│       ├── ServicesPage.tsx           ✅ NEW
│       ├── InvoiceDetailPage.tsx      ✅ NEW
│       ├── SubscriptionsPage.tsx      ✅ NEW
│       ├── ProductCatalogPage.tsx     ✅ NEW
│       ├── CartPage.tsx               ✅ NEW
│       └── CheckoutPage.tsx           ✅ NEW
├── components/
│   ├── customer/
│   │   ├── CustomerLayout.tsx         ✅ NEW
│   │   ├── ServiceCard.tsx            ✅ NEW
│   │   ├── InvoiceCard.tsx            ✅ NEW
│   │   └── ProductCard.tsx            ✅ NEW
│   └── billing/
│       ├── StripePaymentForm.tsx      ✅ NEW
│       └── InvoicePDFViewer.tsx       ✅ NEW
└── hooks/
    ├── useCart.ts                     ✅ NEW
    ├── useInvoices.ts                 ✅ NEW
    └── useSubscriptions.ts            ✅ NEW
```

### Backend Structure
```
src/
├── routes/
│   ├── invoiceRoutes.js               ✅ NEW
│   ├── subscriptionRoutes.js          ✅ ENHANCE
│   ├── cartRoutes.js                  ✅ NEW
│   ├── checkoutRoutes.js              ✅ NEW
│   └── customerRoutes.js              ✅ NEW
├── controllers/
│   ├── invoiceController.js           ✅ NEW
│   ├── subscriptionController.js      ✅ ENHANCE
│   ├── cartController.js              ✅ NEW
│   └── checkoutController.js          ✅ NEW
├── services/
│   ├── pdfService.js                  ✅ NEW (Invoice PDF)
│   ├── emailService.js                ✅ ENHANCE (Real SMTP)
│   ├── cartService.js                 ✅ NEW
│   └── checkoutService.js             ✅ NEW
└── templates/
    └── emails/
        ├── invoice.html               ✅ NEW
        ├── welcome.html               ✅ NEW
        ├── payment-confirmation.html  ✅ NEW
        └── subscription-reminder.html ✅ NEW
```

---

## 🔌 External Integrations

### Stripe Integration
- **Payment Intents**: For one-time invoice payments
- **Checkout Sessions**: For product purchases
- **Subscriptions**: For recurring billing
- **Webhooks**: Payment confirmations, subscription events
- **Stripe Elements**: Frontend payment forms

### Email Service (Choose One)
**Option 1: SendGrid** (Recommended)
- 100 emails/day free tier
- Excellent deliverability
- Template management
- Analytics dashboard

**Option 2: Mailgun**
- 5,000 emails/month free
- Good for transactional emails
- EU data residency option

**Option 3: AWS SES**
- Ultra-low cost ($0.10/1000 emails)
- Requires SMTP setup
- Good for high volume

---

## 📊 Database Schema Updates

### New Tables Needed
```sql
-- Cart (session-based shopping cart)
CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER DEFAULT 1,
  configuration JSONB,  -- Addon selections, custom options
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email tracking
CREATE TABLE email_logs (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  template_name VARCHAR(100),
  status VARCHAR(50),  -- sent, delivered, opened, failed
  sent_at TIMESTAMP,
  opened_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB
);
```

---

## 🧪 Testing Strategy

### Unit Tests (Day 1-6)
- Cart service logic
- Checkout flow
- Invoice PDF generation
- Email template rendering
- Subscription modifications

### Integration Tests
- End-to-end checkout flow
- Stripe payment processing
- Email delivery
- Invoice generation and payment
- Subscription lifecycle

### Manual QA Checklist
- [ ] Browse products as guest
- [ ] Add products to cart
- [ ] Complete checkout with test card
- [ ] View invoice as customer
- [ ] Pay invoice with Stripe
- [ ] Receive invoice email
- [ ] Manage subscription (upgrade/cancel)
- [ ] Customer dashboard loads correctly
- [ ] Admin can view all invoices
- [ ] PDF generation works

---

## 🚀 Deployment Checklist

### Environment Variables Needed
```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Service (SendGrid example)
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@migrahosting.com
SENDGRID_FROM_NAME=MigraHosting

# App URLs
FRONTEND_URL=https://panel.migrahosting.com
BACKEND_URL=https://api.migrahosting.com
```

### Pre-Launch Tasks
- [ ] Configure Stripe production keys
- [ ] Set up SendGrid account + verify domain
- [ ] Create email templates in SendGrid
- [ ] Test payment flow with live mode
- [ ] Configure webhook endpoints
- [ ] Update CORS settings for production
- [ ] SSL certificates for custom domain

---

## 📈 Success Metrics

### Technical Metrics
- All 6 days completed
- 10+ new frontend pages
- 20+ new API endpoints
- Real email delivery working
- Stripe payments processing
- PDF generation functional

### User Experience Metrics
- Customer can complete signup → purchase → payment in < 5 min
- Invoice payment < 30 seconds
- Email delivery < 1 minute
- Cart checkout success rate > 95%

### Business Metrics
- Invoice generation automated
- Payment collection automated
- Subscription renewals automated
- Customer self-service enabled

---

## 🎯 Next Steps After Phase 5

### Phase 6 Candidates (Advanced Features)
1. Support ticket system
2. Knowledge base
3. Domain search + registration (live WHOIS)
4. Advanced reporting + analytics
5. Multi-currency support
6. API keys for customers
7. Affiliate system
8. White-label capabilities

---

**Ready to Start Day 1?** Let's build the Invoice UI! 🚀
