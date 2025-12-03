# FRONTEND-WIRING-GUIDE.md

**mPanel Frontend Wiring Guide (v1)**

This file defines exactly how each frontend module communicates with the backend API.  
It tells Copilot what endpoint to call, what payload to expect, and what UI states to handle.

**Last Updated:** December 3, 2025  
**Version:** 1.0.0

---

## 0. Framework & Conventions

**Frontend:** Vite + React + TypeScript  
**State:** Zustand or React Query  
**HTTP:** Axios with JWT interceptors  

**Root env:**
```bash
VITE_API_URL=https://api.migrahosting.com/api
```

**UI must handle 4 states:**
1. **loading** (spinner)
2. **ready** (data displayed)
3. **empty** (0 items)
4. **error** (with retry button)

---

## 1. AUTH MODULE

### Login Page

**POST** `/auth/login`

**Flow:**
1. Collect email/password
2. Call backend
3. Save JWT + RefreshToken
4. Redirect to `/dashboard`

**UI States:**
- `[loading]` Logging in…
- `[error]` Invalid login

### Current Session Info

**GET** `/auth/me`

**Used On:**
- navbar
- sidebar avatar
- page guards

---

## 2. DASHBOARD MODULE

### System Overview

**GET** `/status`

**Display:**
- API version
- uptime
- database/redis/proxmox status

**Errors:**
- If offline → show "Backend unavailable" with retry.

---

## 3. CUSTOMERS MODULE

### List Customers

**GET** `/customers?search=&page=&pageSize=`

**UI:**
- Table view
- Search bar
- Pagination

### Customer Detail

**GET** `/customers/:id`

**Subsections:**
- Subscriptions → `/subscriptions?customerId=`
- Invoices → `/invoices?customerId=`
- Domains → `/domains?customerId=`
- CloudPods → `/cloudpods?customerId=`

### Create Customer

**POST** `/customers`

**Form includes:**
- name
- email
- phone
- address

---

## 4. PRODUCTS MODULE

### List Products

**GET** `/products?type=&activeOnly=`

**Grouped by:**
- cloudpod
- domain
- email
- backup
- addon

### Product Detail

**GET** `/products/:id`

**Fields:**
- name
- type
- billingCycles
- metadata (cpu, ram, disk)

### Create/Edit Product

**POST** `/products`  
**PUT** `/products/:id`

**Form includes:**
- base info
- pricing cycles
- metadata for cloudpods
- addons (child products)

---

## 5. CHECKOUT FLOW

### Start Order

**POST** `/orders`

**Payload from UI:**
```json
{
  "customerId": "cust-uuid",
  "items": [
    { 
      "productId": "prod-uuid",
      "billingCycle": "monthly",
      "quantity": 1,
      "addons": []
    }
  ]
}
```

### Display Invoice

After creating order → redirect to:

**GET** `/invoices/:id`

**Show:**
- line items
- subtotal/total
- pay button

### Stripe Payment Session

**POST** `/payments/session`

Redirect user to: `checkoutUrl`

---

## 6. INVOICES MODULE

### List Invoices

**GET** `/invoices?status=&customerId=`

**UI:**
- table
- filter by status (paid, unpaid, cancelled)

### Invoice Detail

**GET** `/invoices/:id`

### Admin Update Status

**PATCH** `/invoices/:id/status`

---

## 7. PAYMENTS MODULE

### After Stripe Payment

User lands on:
- `/billing/success`
- `/billing/cancel`

**Frontend must poll the invoice:**  
**GET** `/invoices/:id`

- If `paid` → show success.
- If `unpaid` → show retry.

---

## 8. SUBSCRIPTIONS MODULE

### List Subscriptions

**GET** `/subscriptions?customerId=&status=`

### Subscription Detail

**GET** `/subscriptions/:id`

**Subsections:**
- product
- invoices
- cloudpod (if type = cloudpod)

### Cancel Subscription

**POST** `/subscriptions/:id/cancel`

---

## 9. CLOUDPODS MODULE

### List CloudPods

**GET** `/cloudpods?customerId=&status=`

**Fields displayed:**
- name
- template
- IP/hostname
- status (pending / provisioning / active / error)

### CloudPod Detail

**GET** `/cloudpods/:id`

**Tabs:**
- Overview
- Networking
- DNS
- Metrics (future)
- Jobs

### Provision CloudPod (Manual/Admin)

**POST** `/cloudpods`

---

## 10. PROVISIONING JOBS MODULE

### List Jobs

**GET** `/jobs?status=&type=&targetId=`

**Used in:**
- admin `/cloudpods/:id/jobs`
- global jobs view

### Retry Job

**POST** `/jobs/:id/retry`

### Job Detail

**GET** `/jobs/:id`

**Show:**
- logs
- error detail
- timestamps

---

## 11. SERVERS MODULE

### List Servers

**GET** `/servers`

**Show:**
- hostname
- role
- IP
- status (online/offline)
- last heartbeat

### Server Detail

**GET** `/servers/:id`

---

## 12. DOMAINS MODULE

### Search Domain

**GET** `/domains/search?q=domain.com&tld=com`

### List Domains

**GET** `/domains?customerId=`

### Register Domain

**POST** `/domains/register`

**UI flow:**
1. search
2. select
3. show pricing
4. confirm
5. checkout → invoice → payment → register call → done

### Renew Domain

**POST** `/domains/:id/renew`

---

## 13. DNS MODULE

### List Zones

**GET** `/dns/zones?customerId=&domainId=`

### List Records

**GET** `/dns/zones/:id/records`

### Create Record

**POST** `/dns/zones/:id/records`

### Update Record

**PUT** `/dns/zones/:id/records/:recordId`

### Delete Record

**DELETE** `/dns/zones/:id/records/:recordId`

---

## 14. EMAIL MODULE

### List Email Domains

**GET** `/email/domains?customerId=`

### Create Mailbox

**POST** `/email/mailboxes`

**Inputs:**
- domainId
- localPart
- password
- quotaMb

### Update Mailbox

**PUT** `/email/mailboxes/:id`

### Delete Mailbox

**DELETE** `/email/mailboxes/:id`

---

## 15. SSL MODULE

### List Certificates

**GET** `/ssl/certificates?targetId=`

### Request Certificate

**POST** `/ssl/certificates`

### Renew Certificate

**POST** `/ssl/certificates/:id/renew`

---

## 16. GUARDIAN AI MODULE (Security Dashboard)

### Summary

**GET** `/guardian/summary`

### Instance Config

**GET** `/guardian/instance`  
**POST** `/guardian/instance`

### Start Scan

**POST** `/guardian/scan`

### List Scans / Findings / Tasks

**GET** `/guardian/scans`  
**GET** `/guardian/findings`  
**GET** `/guardian/remediations`

### Approve Remediation

**POST** `/guardian/remediations/:id/approve-tenant`  
**POST** `/guardian/remediations/:id/approve-platform`

---

## 17. AUDIT LOG MODULE

### Audit List

**GET** `/audit?resourceType=&resourceId=&actorId=&since=`

**Display:**
- actor
- action
- resource
- timestamp

---

## 18. SYSTEM HEALTH MODULE

### Backend Status

**GET** `/health`

### System Dependencies Overview

**GET** `/status`

---

## 19. FRONTEND ERROR HANDLING STANDARDS

**All modules must show these 4 states:**

### 1. Loading
Skeleton loader or spinner.

### 2. Empty
"Nothing here yet."  
Provide CTA: Create product, Add domain, Add mailbox, etc.

### 3. Error
Box with:
- error message
- retry button
- expanded debug in console

### 4. Ready
Successful data render.

---

## 20. FRONTEND WIRING RULES (For Copilot)

1. **Always use `useQuery()` for GET endpoints.**
2. **Always use `useMutation()` for actions (POST/PUT/DELETE).**
3. **All endpoints must support:**
   - `retry: false` on GET (we show custom retry button)
   - `cache time: 0` for data that must be always fresh
4. **Never hardcode `tenantId`** — always derive from JWT/session.

### Error Handling

**On 401:**
- remove tokens
- redirect to `/login`

**On 403:**
- show "insufficient permissions"

**On 404:**
- show friendly message
- `console.log` the actual payload

**On success mutation:**
- invalidate relevant queries
- toast success message

---

## 21. Example Wiring (CloudPods)

### List Pods

```typescript
useQuery({
  queryKey: ["cloudpods"],
  queryFn: () => api.get("/cloudpods").then(r => r.data.items),
  staleTime: 0
});
```

### Create Pod

```typescript
const createPod = useMutation({
  mutationFn: (payload) => api.post("/cloudpods", payload),
  onSuccess: () => {
    queryClient.invalidateQueries(["cloudpods"]);
    toast.success("CloudPod provision started");
  }
});
```

---

## 22. API Client Setup

### Axios Configuration

```typescript
// src/lib/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:2271/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 23. React Query Setup

### QueryClient Configuration

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
```

---

## 24. Module-Specific Hooks

### Products Module

```typescript
// src/hooks/useProducts.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { queryClient } from '@/lib/queryClient';

export const useProducts = (filters?: { type?: string; activeOnly?: boolean }) => {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.type) params.append('type', filters.type);
      if (filters?.activeOnly) params.append('activeOnly', 'true');
      
      const response = await api.get(`/products?${params}`);
      return response.data.items;
    },
  });
};

export const useCreateProduct = () => {
  return useMutation({
    mutationFn: (product: any) => api.post('/products', product),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created successfully');
    },
  });
};
```

### Customers Module

```typescript
// src/hooks/useCustomers.ts
export const useCustomers = (search?: string, page = 1, pageSize = 20) => {
  return useQuery({
    queryKey: ['customers', search, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', String(page));
      params.append('pageSize', String(pageSize));
      
      const response = await api.get(`/customers?${params}`);
      return response.data;
    },
  });
};
```

### CloudPods Module

```typescript
// src/hooks/useCloudPods.ts
export const useCloudPods = (filters?: { customerId?: string; status?: string }) => {
  return useQuery({
    queryKey: ['cloudpods', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.customerId) params.append('customerId', filters.customerId);
      if (filters?.status) params.append('status', filters.status);
      
      const response = await api.get(`/cloudpods?${params}`);
      return response.data.items;
    },
  });
};

export const useProvisionCloudPod = () => {
  return useMutation({
    mutationFn: (payload: any) => api.post('/cloudpods', payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['cloudpods'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(`CloudPod provision started: ${data.data.job.id}`);
    },
  });
};
```

---

## 25. Component State Pattern

### Standard Component Structure

```typescript
// Example: CloudPodsPage.tsx
import { useCloudPods } from '@/hooks/useCloudPods';

export const CloudPodsPage = () => {
  const { data: pods, isLoading, error, refetch } = useCloudPods();

  // 1. Loading state
  if (isLoading) {
    return <Spinner />;
  }

  // 2. Error state
  if (error) {
    return (
      <ErrorBox
        message={error.message}
        onRetry={refetch}
      />
    );
  }

  // 3. Empty state
  if (pods.length === 0) {
    return (
      <EmptyState
        title="No CloudPods yet"
        description="Create your first CloudPod to get started"
        action={<Button>Create CloudPod</Button>}
      />
    );
  }

  // 4. Ready state
  return (
    <CloudPodsTable pods={pods} />
  );
};
```

---

## 📝 Notes

1. **This guide is authoritative for frontend development.**
2. **All UI components must implement 4-state pattern** (loading, empty, error, ready).
3. **Never bypass error handling** - always show user-friendly errors.
4. **Always invalidate queries** after mutations to keep UI fresh.
5. **Use TypeScript** for all API payloads and responses.

---

**Maintained By:** MigraHosting Engineering  
**Related Docs:** `BACKEND-API-CONTRACT.md`, `MONEY_ENGINE_TEST_CHECKLIST.md`
