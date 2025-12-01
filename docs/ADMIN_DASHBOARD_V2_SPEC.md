# 🏢 Admin Dashboard V2 – Enterprise Spec

## Goal

Replace the simple stats + quick actions layout with a **provider-grade admin console** that gives staff a real-time picture of:

- Users / customers / revenue
- Servers + CloudPods + workers
- Security posture (logins / failures)
- Tenant usage
- Recent system events

This page is read-only (no forms), but **all cards are clickable** shortcuts into their modules.

---

## Layout Overview

The page is structured into 4 main blocks:

1. **System Overview (top stats row)**
2. **Operations & Cloud Overview (two columns)**
3. **Revenue & Tenant Usage**
4. **Recent Activity & System Events**

Each block is responsive:

- On desktop: 3–4 cards per row.
- On tablet: 2 per row.
- On mobile: 1 per row.

---

## 1. System Overview (top cards)

Row of 6 compact statistic cards:

1. `Total Users`
2. `Total Customers`
3. `Monthly Recurring Revenue`
4. `Active Servers`
5. `Active CloudPods`
6. `System Health`

Each card shows:

```ts
interface StatCard {
  id: string;           // "totalUsers"
  label: string;        // "Total Users"
  value: string;        // "17"
  icon?: string;        // optional icon name for UI
  trend?: "up" | "down" | "flat";
  changeText?: string;  // e.g. "+3 this week"
  status?: "ok" | "warn" | "error";
  href?: string;        // where to go when the card is clicked
}
```

### Behaviour

- Clicking Total Users → `/admin/users`
- Total Customers → `/admin/customers`
- Active Servers → `/admin/servers`
- Active CloudPods → `/admin/cloudpods`
- System Health → `/admin/system-health`

---

## 2. Operations & Cloud Overview

### Left column: Operations Pulse

Card title: **Operations Pulse**

Content:
- Jobs pending (all queues)
- Failed jobs (last 24h)
- Workers online
- Average queue delay

Optional mini-sparkline for jobs (Copilot can add later).

### Right column: Cloud Infra Overview

Card title: **Cloud Infrastructure**

Content:
- Total Pods
- Pods running
- Pods in error
- Unhealthy pods
- Auto-heal events (24h)

---

## 3. Revenue & Tenant Usage

### A. Revenue & Billing (left, wide card)

Card title: **Revenue & Billing**

- Current MRR value
- Small note: +X% vs last month
- Simple 7- or 30-day revenue chart (bars or line) – placeholder component, no heavy chart lib required.

Data shape:

```ts
interface RevenuePoint {
  date: string;  // ISO date
  amount: number;
}
```

### B. Tenant Usage (right, table)

Card title: **Top Tenants by Usage**

Table columns:
- Tenant
- Pods
- vCPU
- RAM
- Disk

Data shape:

```ts
interface TenantUsageRow {
  tenantId: string;
  name: string;
  pods: number;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}
```

Row click → `/admin/tenants/:id` (or `/admin/customers/:id`).

---

## 4. Recent Activity & System Events

Two side-by-side cards.

### A. Recent Activity (left)

Business-level events, newest first:
- New user signup
- New customer
- New pod
- Pod destroyed
- Backup created/failed
- Quota exceeded

```ts
interface ActivityItem {
  id: string;
  timestamp: string;         // ISO
  relativeTime: string;      // "8 hours ago"
  actor?: string;            // "admin@migrahosting.com"
  description: string;       // "Created CloudPod 'dev-01'"
  category: "user" | "customer" | "cloudpods" | "billing" | "security" | "system";
  href?: string;             // detail link
}
```

### B. System Events (right)

More technical events:
- Worker errors
- Webhook failures
- Node offline
- DNS issues

```ts
interface SystemEventItem {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  service: string;       // "cloudpods-worker", "api"
  message: string;
}
```

---

## API Contract

Single endpoint the dashboard page calls:

```
GET /api/admin/dashboard
```

Response:

```ts
interface AdminDashboardResponse {
  stats: {
    totalUsers: number;
    totalCustomers: number;
    monthlyRecurringRevenue: number;
    activeServers: number;
    activeCloudPods: number;
    systemHealth: "healthy" | "degraded" | "down";
  };
  operations: {
    pendingJobs: number;
    failedJobs24h: number;
    workersOnline: number;
    averageQueueDelaySeconds: number;
  };
  cloud: {
    totalPods: number;
    runningPods: number;
    errorPods: number;
    unhealthyPods: number;
    autoHealEvents24h: number;
  };
  revenue: {
    currentMrr: number;
    currency: string;
    changePercentMonth: number;
    history: RevenuePoint[];
  };
  tenants: TenantUsageRow[];
  recentActivity: ActivityItem[];
  systemEvents: SystemEventItem[];
}
```

### Error handling:

If the endpoint fails, the UI shows skeletons + a small toast "Unable to load dashboard data" but page still renders.

---

## RBAC

Access requires:
- `dashboard.view` **and**
- Either `admin`/`super_admin` OR a role with `admin_dashboard.view` if you add that permission.

No client/tenant users should ever see this page.

---

## Future Enhancements

- Add CloudPods sidebar entries that point to new modules (CloudPods Inventory, Plans, Templates, etc.)
- Build the Tenant CloudPods Dashboard to match this level
- Add real-time WebSocket updates for live stats
- Add mini-sparklines for trends
