# Quick Start: Client Plan Access System

**Run this when you're back at your desk!**

---

## Step 1: Run Migration

```bash
cd /home/bonex/MigraWeb/MigraHosting/dev/migra-panel

# Run the migration
docker exec mpanel-postgres psql -U mpanel -d mpanel -f prisma/migrations/20251118_client_plan_access_system/migration.sql
```

**Expected output**: Creates 6 tables, inserts 4 default plans, 4 bundles, 3 security templates

---

## Step 2: Verify Plans Created

```bash
docker exec -it mpanel-postgres psql -U mpanel -d mpanel -c "
SELECT name, tier_level, price_monthly, 
       CASE WHEN advanced_waf THEN 'Yes' ELSE 'No' END as waf,
       CASE WHEN ssh_access THEN 'Yes' ELSE 'No' END as ssh,
       CASE WHEN white_label_enabled THEN 'Yes' ELSE 'No' END as white_label
FROM service_plans 
ORDER BY tier_level;
"
```

**Expected output**:
```
       name       | tier_level | price_monthly | waf | ssh | white_label
------------------+------------+---------------+-----+-----+-------------
 Starter          |          1 |          4.99 | No  | No  | No
 Professional     |          2 |         14.99 | No  | Yes | No
 Business         |          3 |         39.99 | Yes | Yes | No
 Enterprise       |          4 |         99.99 | Yes | Yes | Yes
```

---

## Step 3: Test API Endpoints

### Get Public Pricing (No Auth Required)

```bash
curl -s http://localhost:2271/api/plans/pricing | jq
```

### Get Premium Bundles

```bash
curl -s http://localhost:2271/api/plans/bundles | jq
```

### Get My Subscription (Requires Auth)

```bash
# First, get an auth token (login as client)
TOKEN="your-jwt-token-here"

curl -s http://localhost:2271/api/plans/my-subscription \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get My Feature Access

```bash
curl -s http://localhost:2271/api/plans/my-features \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Check Usage Stats

```bash
curl -s http://localhost:2271/api/plans/my-usage \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Step 4: Create Test Client Subscription

```sql
-- Connect to database
docker exec -it mpanel-postgres psql -U mpanel -d mpanel

-- Get a test customer
SELECT id, email FROM customers LIMIT 1;

-- Create subscription for that customer
INSERT INTO client_service_subscriptions (
  tenant_id, 
  customer_id, 
  service_plan_id, 
  billing_cycle, 
  price_paid, 
  next_billing_date,
  status
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'CUSTOMER_ID_FROM_ABOVE',
  (SELECT id FROM service_plans WHERE slug = 'professional' LIMIT 1),
  'yearly',
  149.99,
  CURRENT_DATE + INTERVAL '1 year',
  'active'
);

-- Verify it was created
SELECT css.*, sp.name as plan_name 
FROM client_service_subscriptions css
JOIN service_plans sp ON css.service_plan_id = sp.id
WHERE css.customer_id = 'CUSTOMER_ID_FROM_ABOVE';
```

---

## Step 5: Add Premium Bundle to Subscription

```sql
-- Add Security Pro bundle to the customer
INSERT INTO client_addon_subscriptions (
  tenant_id,
  customer_id,
  service_subscription_id,
  addon_type,
  bundle_id,
  billing_cycle,
  price_paid,
  status
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  'CUSTOMER_ID',
  (SELECT id FROM client_service_subscriptions WHERE customer_id = 'CUSTOMER_ID' LIMIT 1),
  'bundle',
  (SELECT id FROM premium_tool_bundles WHERE slug = 'security-pro' LIMIT 1),
  'monthly',
  29.99,
  'active'
);

-- Verify addon
SELECT cas.*, ptb.name as bundle_name, ptb.bundle_type
FROM client_addon_subscriptions cas
JOIN premium_tool_bundles ptb ON cas.bundle_id = ptb.id
WHERE cas.customer_id = 'CUSTOMER_ID';
```

---

## Step 6: Test Feature Gating Middleware

### Example: Protect SSH Access Route

```javascript
// Add to src/routes/sshRoutes.js
import { requirePlanFeature } from '../middleware/planAccess.js';

router.get('/ssh-keys', 
  authenticateToken,
  requirePlanFeature('ssh_access'),  // <-- Add this line
  getSSHKeys
);
```

**Test it**:

```bash
# If client has Starter plan (no SSH), they get 403 error
curl -s http://localhost:2271/api/ssh/ssh-keys \
  -H "Authorization: Bearer $TOKEN" | jq

# Response (if no SSH access):
{
  "error": "This feature requires a higher plan tier",
  "feature": "ssh_access",
  "current_plan": "Starter",
  "current_tier": 1,
  "upgrade_url": "/client/plans/upgrade",
  "upgrade_required": true
}
```

---

## Step 7: Test Usage Limits

### Example: Check Website Limit Before Creating

```javascript
// Add to src/routes/websiteRoutes.js
import { checkUsageLimit } from '../middleware/planAccess.js';

router.post('/websites', 
  authenticateToken,
  checkUsageLimit('websites', 1),  // <-- Check if can add 1 more website
  createWebsite
);
```

---

## Common Use Cases

### 1. Client Portal: Show Feature Availability

```javascript
// Frontend component
const { data: features } = useQuery(['my-features'], () => 
  api.get('/plans/my-features')
);

return (
  <div>
    {features.features.ssh_access ? (
      <SSHKeysManager />
    ) : (
      <UpgradeBanner 
        feature="SSH Access" 
        currentPlan={features.plan.name}
        upgradeUrl="/client/plans/upgrade"
      />
    )}
  </div>
);
```

### 2. Admin: Update Client Usage

```bash
# Called by monitoring system when resources change
curl -X PUT http://localhost:2271/api/plans/admin/subscriptions/SUBSCRIPTION_ID/usage \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "disk_usage_gb": 8.5,
    "bandwidth_usage_gb": 45.2,
    "current_websites": 3
  }'
```

### 3. Admin: Suspend Client for Overage

```bash
curl -X PUT http://localhost:2271/api/plans/admin/subscriptions/SUBSCRIPTION_ID/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended",
    "reason": "Exceeded bandwidth limit"
  }'
```

---

## Integration with Existing Features

### Update Website Creation

```javascript
// src/controllers/websiteController.js
import { checkUsageLimit } from '../middleware/planAccess.js';

// In route definition
router.post('/websites', 
  authenticateToken,
  checkUsageLimit('websites', 1),
  async (req, res) => {
    // Create website logic
    // After creation, increment usage:
    await updateSubscriptionUsage(subscriptionId, tenantId, {
      current_websites: currentCount + 1
    });
  }
);
```

### Update Backup Features

```javascript
// src/routes/backupRoutes.js
import { requirePlanFeature } from '../middleware/planAccess.js';

router.post('/backups/hourly', 
  authenticateToken,
  requirePlanFeature('hourly_backups'),  // Tier 3+ only
  createHourlyBackup
);
```

### Update CDN Access

```javascript
// src/routes/cdnRoutes.js
router.get('/cdn/enable', 
  authenticateToken,
  requireMinimumTier(2),  // Professional or higher
  enableCDN
);
```

---

## Pricing Page Integration

### Marketing Website: Display Plans

```typescript
// app/pricing/page.tsx
export default async function PricingPage() {
  const plans = await fetch('http://panel.migrahosting.com/api/plans/pricing')
    .then(r => r.json());
  
  return (
    <div className="grid md:grid-cols-4 gap-8">
      {plans.data.map(plan => (
        <PricingCard 
          key={plan.id}
          name={plan.name}
          price={plan.price_monthly}
          features={plan.features_summary}
          tier={plan.tier_level}
          popular={plan.popular_badge}
        />
      ))}
    </div>
  );
}
```

---

## Next Steps

1. ✅ **Migration complete** - 6 tables created with defaults
2. ⏭️ **Build Client Portal UI** - Plan selection, upgrade flow, feature gates
3. ⏭️ **Integrate with Stripe** - Handle subscription billing
4. ⏭️ **Add Usage Tracking** - Monitor disk/bandwidth automatically
5. ⏭️ **Security Policy Automation** - Apply templates based on plan
6. ⏭️ **Admin Plan Manager** - UI to edit plans and bundles
7. ⏭️ **White-Label Implementation** - Branding customization for Tier 4

---

## Documentation Files

- `CLIENT_PLAN_ACCESS_SYSTEM.md` - Full system documentation
- `prisma/migrations/20251118_client_plan_access_system/migration.sql` - Database schema
- `src/services/planAccessService.js` - Business logic (17 functions)
- `src/routes/planAccessRoutes.js` - API endpoints (20+ routes)
- `src/middleware/planAccess.js` - Feature gating middleware

---

**Status**: ✅ Ready to test!

Run the migration and start testing the API endpoints above!
