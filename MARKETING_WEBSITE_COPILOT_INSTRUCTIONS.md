# Marketing Website - GitHub Copilot Instructions

**Project**: MigraHosting Marketing Website  
**Control Panel Integration**: mPanel v1.0.0  
**Date**: November 17, 2025

---

## 🎯 Project Overview

This is the **marketing website** for MigraHosting - a modern hosting provider. The marketing website is a separate Next.js/React application that communicates with the **mPanel control panel** via a bidirectional REST API.

**Marketing Website Purpose**:
- Customer acquisition (landing pages, pricing pages, features showcase)
- Lead generation (contact forms, demo requests, newsletter signups)
- Customer onboarding (signup → payment → account creation in control panel)
- Product catalog synchronization with control panel
- Real-time system status display
- Marketing campaign tracking (UTM parameters, conversion analytics)

**Control Panel Integration**:
- mPanel control panel runs at: `https://panel.migrahosting.com`
- Marketing API base URL: `https://panel.migrahosting.com/api/marketing-api`
- Authentication: API key (`X-API-Key` header)
- All customer accounts created via marketing website are provisioned in mPanel

---

## 🏗️ Tech Stack

**Frontend**:
- **Framework**: Next.js 14+ (App Router) or React 18+ with Vite
- **Language**: TypeScript (preferred) or JavaScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui or Headless UI
- **Forms**: React Hook Form + Zod validation
- **State Management**: React Context + TanStack Query (React Query)
- **Analytics**: Google Analytics 4, Facebook Pixel
- **Payments**: Stripe Checkout (redirect flow)

**Backend (if applicable)**:
- **API Routes**: Next.js API routes or Express.js
- **Environment**: Node.js 20+
- **Validation**: Zod schemas

**Deployment**:
- **Hosting**: Vercel (recommended) or Netlify
- **CDN**: Cloudflare
- **Domain**: `https://migrahosting.com`

---

## 🔌 mPanel Control Panel Integration

### API Authentication

**API Key Location**: Store in environment variables
```env
# .env.local (Next.js) or .env (Vite)
NEXT_PUBLIC_MPANEL_API_URL=https://panel.migrahosting.com/api/marketing-api
MPANEL_API_KEY=mk_abc123...  # Server-side only, NEVER expose to client
```

**API Client Setup**:
```typescript
// lib/mpanel-api.ts
const MPANEL_API_URL = process.env.NEXT_PUBLIC_MPANEL_API_URL || 'http://localhost:2271/api/marketing-api';
const MPANEL_API_KEY = process.env.MPANEL_API_KEY;

async function mpanelFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${MPANEL_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': MPANEL_API_KEY,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }
  
  return response.json();
}

export const mpanelApi = {
  // Account creation
  createAccount: (data: CreateAccountData) => 
    mpanelFetch('/accounts/create', { method: 'POST', body: JSON.stringify(data) }),
  
  // Product catalog
  getProducts: (category?: string) => 
    mpanelFetch(`/products/catalog${category ? `?category=${category}` : ''}`),
  
  // System status
  getSystemStatus: () => 
    mpanelFetch('/status/system'),
  
  // Webhooks (admin only)
  registerWebhook: (data: WebhookData) =>
    mpanelFetch('/webhooks/register', { method: 'POST', body: JSON.stringify(data) }),
};
```

---

## 📋 API Endpoints Reference

### 1. Account Creation & Automation

#### Create Customer Account
**POST** `/accounts/create`

**Request**:
```typescript
interface CreateAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  planId?: string;  // Optional: auto-provision hosting
  billingCycle?: 'monthly' | 'oneYear' | 'twoYears' | 'threeYears';
  promoCode?: string;
  marketingSource?: string;  // e.g., 'google-ads', 'facebook', 'organic'
  utmParams?: {
    campaign?: string;
    source?: string;
    medium?: string;
    content?: string;
    term?: string;
  };
}
```

**Response**:
```typescript
interface CreateAccountResponse {
  success: true;
  data: {
    customerId: string;
    serviceId?: string;
    email: string;
    status: 'active';
    resetToken: string;  // For password setup redirect
    message: string;
  };
}
```

**Usage Example**:
```typescript
// app/api/signup/route.ts (Next.js API route)
export async function POST(request: Request) {
  const formData = await request.json();
  
  const result = await mpanelApi.createAccount({
    email: formData.email,
    firstName: formData.firstName,
    lastName: formData.lastName,
    planId: formData.selectedPlan,
    billingCycle: formData.billingCycle,
    marketingSource: 'website',
    utmParams: {
      campaign: formData.utmCampaign,
      source: formData.utmSource,
      medium: formData.utmMedium,
    },
  });
  
  // Redirect to control panel for password setup
  return Response.json({
    redirectUrl: `https://panel.migrahosting.com/set-password?token=${result.data.resetToken}`
  });
}
```

---

### 2. Product Catalog Synchronization

#### Get Product Catalog
**GET** `/products/catalog?category=shared-hosting&active=true`

**Response**:
```typescript
interface Product {
  id: string;
  name: string;
  type: 'shared-hosting' | 'wordpress' | 'vps' | 'dedicated';
  description: string;
  features: string[];
  pricing: {
    monthly: number;
    oneYear: number;
    twoYears: number;
    threeYears: number;
  };
  stock_quantity: number;
  is_active: boolean;
  display_order: number;
}

interface CatalogResponse {
  success: true;
  count: number;
  data: Product[];
}
```

**Usage Example**:
```typescript
// app/pricing/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { mpanelApi } from '@/lib/mpanel-api';

export default function PricingPage() {
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', 'shared-hosting'],
    queryFn: () => mpanelApi.getProducts('shared-hosting'),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  if (isLoading) return <PricingCardsSkeleton />;
  
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
      {products?.data.map(plan => (
        <PricingCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
```

**Auto-Sync Pattern**:
```typescript
// hooks/use-product-sync.ts
export function useProductSync() {
  const { data, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: () => mpanelApi.getProducts(),
    staleTime: 1000 * 60 * 60, // 1 hour
    refetchInterval: 1000 * 60 * 60, // Auto-sync every hour
  });
  
  return { products: data?.data, refetch };
}
```

---

### 3. System Status for Status Page

#### Get System Status
**GET** `/status/system`

**Response**:
```typescript
interface SystemStatus {
  success: true;
  data: {
    status: 'operational' | 'degraded' | 'major_outage';
    servers: {
      total_servers: number;
      online_servers: number;
      avg_cpu: number;
      avg_memory: number;
      avg_uptime: number;
    };
    recentIncidents: Array<{
      id: string;
      title: string;
      severity: 'minor' | 'major' | 'critical';
      status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
      created_at: string;
      resolved_at: string | null;
    }>;
    lastUpdated: string;
  };
}
```

**Usage Example**:
```typescript
// components/status-badge.tsx
export function StatusBadge() {
  const { data } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => mpanelApi.getSystemStatus(),
    refetchInterval: 30000, // 30 seconds
  });
  
  const status = data?.data.status;
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
      status === 'operational' && "bg-green-100 text-green-800",
      status === 'degraded' && "bg-yellow-100 text-yellow-800",
      status === 'major_outage' && "bg-red-100 text-red-800"
    )}>
      <span className={cn(
        "h-2 w-2 rounded-full",
        status === 'operational' && "bg-green-500",
        status === 'degraded' && "bg-yellow-500",
        status === 'major_outage' && "bg-red-500"
      )} />
      {status === 'operational' ? 'All Systems Operational' : 
       status === 'degraded' ? 'Degraded Performance' : 
       'Major Outage'}
    </div>
  );
}
```

---

### 4. Webhook Integration (Optional)

#### Register Webhook
**POST** `/webhooks/register`

**Request**:
```typescript
interface RegisterWebhookRequest {
  url: string;  // Your marketing website webhook endpoint
  events: string[];  // e.g., ['customer.created', 'invoice.paid']
  secret?: string;  // Auto-generated if not provided
}
```

**Events Available**:
- `customer.created` - New customer account created
- `service.activated` - Hosting service activated
- `invoice.paid` - Payment received
- `service.suspended` - Service suspended
- `service.upgraded` - Plan upgraded

**Webhook Handler Example**:
```typescript
// app/api/webhooks/mpanel/route.ts
import crypto from 'crypto';

export async function POST(request: Request) {
  const signature = request.headers.get('x-webhook-signature');
  const payload = await request.text();
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.MPANEL_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex');
  
  if (`sha256=${expectedSignature}` !== signature) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }
  
  const event = JSON.parse(payload);
  
  // Handle different events
  switch (event.event) {
    case 'customer.created':
      // Track conversion in Google Analytics
      await trackConversion(event.data.email);
      break;
      
    case 'invoice.paid':
      // Send to marketing automation
      await sendToMailchimp(event.data.customerId);
      break;
  }
  
  return Response.json({ received: true });
}
```

---

## 🎨 Component Examples

### Pricing Cards with Live Data

```typescript
// components/pricing-card.tsx
import { Product } from '@/types/mpanel';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface PricingCardProps {
  plan: Product;
  billingCycle: 'monthly' | 'oneYear' | 'twoYears' | 'threeYears';
  onSelect: (planId: string) => void;
}

export function PricingCard({ plan, billingCycle, onSelect }: PricingCardProps) {
  const price = plan.pricing[billingCycle];
  const savings = billingCycle !== 'monthly' 
    ? Math.round((1 - (price / plan.pricing.monthly)) * 100)
    : 0;
  
  return (
    <div className="border rounded-lg p-6 hover:shadow-xl transition-shadow">
      <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
      <p className="text-gray-600 mb-4">{plan.description}</p>
      
      <div className="mb-4">
        <div className="text-4xl font-bold text-blue-600">
          ${price.toFixed(2)}
        </div>
        <div className="text-sm text-gray-600">
          per {billingCycle === 'monthly' ? 'month' : 'year'}
          {savings > 0 && (
            <span className="ml-2 text-green-600 font-medium">
              Save {savings}%
            </span>
          )}
        </div>
      </div>
      
      <ul className="space-y-2 mb-6">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      
      <Button 
        onClick={() => onSelect(plan.id)}
        className="w-full"
        disabled={!plan.is_active || plan.stock_quantity === 0}
      >
        {plan.stock_quantity === 0 ? 'Out of Stock' : 'Get Started'}
      </Button>
    </div>
  );
}
```

---

### Signup Form with mPanel Integration

```typescript
// app/signup/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

const signupSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().optional(),
  selectedPlan: z.string(),
  billingCycle: z.enum(['monthly', 'oneYear', 'twoYears', 'threeYears']),
  promoCode: z.string().optional(),
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      selectedPlan: searchParams.get('plan') || 'shared-starter',
      billingCycle: 'oneYear',
    },
  });
  
  const onSubmit = async (data: SignupFormData) => {
    setIsSubmitting(true);
    
    try {
      // 1. Get UTM parameters from cookies/localStorage
      const utmParams = {
        campaign: localStorage.getItem('utm_campaign') || undefined,
        source: localStorage.getItem('utm_source') || undefined,
        medium: localStorage.getItem('utm_medium') || undefined,
      };
      
      // 2. Call API route to create account in mPanel
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          marketingSource: 'website',
          utmParams,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }
      
      // 3. Redirect to control panel for password setup
      window.location.href = result.redirectUrl;
      
    } catch (error) {
      console.error('Signup error:', error);
      alert(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Your Account</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            {...register('email')}
            type="email"
            className="w-full px-3 py-2 border rounded-md"
          />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">First Name</label>
            <input
              {...register('firstName')}
              className="w-full px-3 py-2 border rounded-md"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Last Name</label>
            <input
              {...register('lastName')}
              className="w-full px-3 py-2 border rounded-md"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
            )}
          </div>
        </div>
        
        {/* More fields... */}
        
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </div>
    </form>
  );
}
```

---

## 🔐 Security Best Practices

### Environment Variables

```env
# .env.local (Next.js)

# NEVER expose API key to client - server-side only
MPANEL_API_KEY=mk_production_key_here

# Public URLs (safe for client-side)
NEXT_PUBLIC_MPANEL_API_URL=https://panel.migrahosting.com/api/marketing-api
NEXT_PUBLIC_CONTROL_PANEL_URL=https://panel.migrahosting.com

# Stripe (payment processing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...

# Webhook secret for signature verification
MPANEL_WEBHOOK_SECRET=whsec_...

# Analytics
NEXT_PUBLIC_GA_TRACKING_ID=G-...
NEXT_PUBLIC_FB_PIXEL_ID=...
```

### API Route Protection

```typescript
// middleware.ts (Next.js)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only allow API routes to access MPANEL_API_KEY
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Verify referer or origin
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    if (!origin && !referer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }
  
  return NextResponse.next();
}
```

---

## 📊 Analytics Integration

### UTM Parameter Tracking

```typescript
// lib/utm-tracking.ts
export function captureUTMParams() {
  if (typeof window === 'undefined') return;
  
  const params = new URLSearchParams(window.location.search);
  const utmParams = {
    utm_campaign: params.get('utm_campaign'),
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_content: params.get('utm_content'),
    utm_term: params.get('utm_term'),
  };
  
  // Store in localStorage (30 day cookie alternative)
  Object.entries(utmParams).forEach(([key, value]) => {
    if (value) {
      localStorage.setItem(key, value);
    }
  });
  
  return utmParams;
}

// Call in root layout
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { captureUTMParams } from '@/lib/utm-tracking';

export default function RootLayout({ children }) {
  useEffect(() => {
    captureUTMParams();
  }, []);
  
  return <html>{children}</html>;
}
```

### Conversion Tracking

```typescript
// lib/analytics.ts
export function trackConversion(email: string, planId: string, amount: number) {
  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: crypto.randomUUID(),
      value: amount,
      currency: 'USD',
      items: [{
        item_id: planId,
        item_name: planId,
        price: amount,
      }],
    });
  }
  
  // Facebook Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Purchase', {
      value: amount,
      currency: 'USD',
    });
  }
}
```

---

## 🚀 Deployment Checklist

### Environment Setup

**Vercel**:
```bash
# Install Vercel CLI
npm i -g vercel

# Set environment variables
vercel env add MPANEL_API_KEY production
vercel env add MPANEL_WEBHOOK_SECRET production
vercel env add STRIPE_SECRET_KEY production

# Deploy
vercel --prod
```

**Environment Variables to Set**:
- ✅ `MPANEL_API_KEY` - mPanel marketing API key
- ✅ `MPANEL_WEBHOOK_SECRET` - Webhook verification secret
- ✅ `STRIPE_SECRET_KEY` - Stripe payment processing
- ✅ `NEXT_PUBLIC_MPANEL_API_URL` - API URL (https://panel.migrahosting.com/api/marketing-api)
- ✅ `NEXT_PUBLIC_CONTROL_PANEL_URL` - Control panel URL
- ✅ `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe public key
- ✅ `NEXT_PUBLIC_GA_TRACKING_ID` - Google Analytics
- ✅ `NEXT_PUBLIC_FB_PIXEL_ID` - Facebook Pixel

---

## 📦 TypeScript Types

```typescript
// types/mpanel.ts

export interface Product {
  id: string;
  name: string;
  type: 'shared-hosting' | 'wordpress' | 'vps' | 'dedicated';
  description: string;
  features: string[];
  pricing: {
    monthly: number;
    oneYear: number;
    twoYears: number;
    threeYears: number;
  };
  stock_quantity: number;
  is_active: boolean;
  display_order: number;
}

export interface CreateAccountRequest {
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  planId?: string;
  billingCycle?: 'monthly' | 'oneYear' | 'twoYears' | 'threeYears';
  promoCode?: string;
  marketingSource?: string;
  utmParams?: {
    campaign?: string;
    source?: string;
    medium?: string;
    content?: string;
    term?: string;
  };
}

export interface SystemStatus {
  status: 'operational' | 'degraded' | 'major_outage';
  servers: {
    total_servers: number;
    online_servers: number;
    avg_cpu: number;
    avg_memory: number;
    avg_uptime: number;
  };
  recentIncidents: Array<{
    id: string;
    title: string;
    severity: 'minor' | 'major' | 'critical';
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    created_at: string;
    resolved_at: string | null;
  }>;
  lastUpdated: string;
}
```

---

## 🎓 Key Concepts for Copilot

**When implementing marketing website features, remember**:

1. **API Key Security**: NEVER expose `MPANEL_API_KEY` to client-side code. Only use in Next.js API routes or server components.

2. **Product Sync**: Use TanStack Query (React Query) with 1-hour stale time to keep pricing synchronized.

3. **UTM Tracking**: Always capture and pass UTM parameters to mPanel for attribution tracking.

4. **Conversion Flow**: Marketing website → Stripe payment → mPanel account creation → Redirect to control panel for password setup.

5. **Error Handling**: All API calls should handle errors gracefully and show user-friendly messages.

6. **Rate Limiting**: Be aware of rate limits (10-100 req/min). Use caching to minimize API calls.

7. **Webhooks**: Verify webhook signatures using HMAC-SHA256 to prevent unauthorized access.

8. **Real-time Updates**: Use webhooks or polling (30s interval) for system status display.

---

## 📚 Complete API Reference

See full documentation: `MARKETING_API_INTEGRATION.md` in mPanel repository

**All Available Endpoints**:
- `POST /accounts/create` - Create customer account
- `POST /services/provision` - Provision hosting service
- `GET /reports/revenue` - Revenue metrics
- `GET /reports/customers` - Customer acquisition
- `GET /reports/usage` - Usage statistics
- `GET /products/catalog` - Product catalog
- `GET /products/:id/availability` - Stock check
- `GET /customers/:id/services` - Customer services
- `POST /services/:id/upgrade` - Upgrade plan
- `GET /status/system` - System status
- `POST /webhooks/register` - Register webhook
- `POST /admin/api-keys` - Create API key (admin)
- `GET /admin/api-keys` - List API keys (admin)
- `DELETE /admin/api-keys/:id` - Revoke API key (admin)

---

## 🤖 Prompt for Marketing Website Copilot

**Copy and paste this into your marketing website `.github/copilot-instructions.md`**:

```markdown
# Marketing Website - GitHub Copilot Instructions

You are building the marketing website for MigraHosting, a modern hosting provider. The marketing website integrates with the mPanel control panel via REST API.

## Key Architecture

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **API Integration**: mPanel control panel at https://panel.migrahosting.com/api/marketing-api
- **Authentication**: API key in `MPANEL_API_KEY` environment variable (server-side only)
- **Payment**: Stripe Checkout (redirect flow)

## Critical Rules

1. **NEVER expose MPANEL_API_KEY to client-side** - Only use in Next.js API routes
2. **Always track UTM parameters** - Store in localStorage and pass to mPanel
3. **Use TanStack Query for API calls** - With 1-hour stale time for product catalog
4. **Verify webhook signatures** - HMAC-SHA256 with MPANEL_WEBHOOK_SECRET
5. **Handle rate limits** - 10-100 requests/minute depending on endpoint

## Common Patterns

### Product Catalog Sync
```typescript
const { data: products } = useQuery({
  queryKey: ['products'],
  queryFn: () => mpanelApi.getProducts(),
  staleTime: 1000 * 60 * 60, // 1 hour
});
```

### Account Creation Flow
1. User fills signup form
2. Call Next.js API route `/api/signup`
3. API route calls mPanel `/accounts/create`
4. Redirect user to control panel with reset token

### System Status Display
```typescript
const { data: status } = useQuery({
  queryKey: ['system-status'],
  queryFn: () => mpanelApi.getSystemStatus(),
  refetchInterval: 30000, // 30 seconds
});
```

## TypeScript Types

Use types from `types/mpanel.ts` for all API interactions.

## Security

- API keys in environment variables only
- Validate all user input with Zod schemas
- Use HTTPS for all API calls
- Verify webhook signatures before processing
```

---

**END OF MARKETING WEBSITE COPILOT INSTRUCTIONS**

Save this file to your marketing website repository as `.github/copilot-instructions.md`
