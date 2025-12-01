# CloudPods – Plans

CloudPods plans describe the **commercial product** a tenant buys.

## Plan Config

Source file: `src/config/cloudPods.js`

Exports `CLOUD_POD_PLANS`, an object keyed by `planCode`:

```js
export const CLOUD_POD_PLANS = {
  student: {
    code: 'student',
    name: 'Student',
    priceMonthly: 0,
    vcpu: 1,
    ramMb: 1024,
    storageGb: 2,
    bandwidthGb: 50,
  },
  starter: { ... },
  premium: { ... },
  business: { ... },
};
```

The plans API reads from this object and exposes:

- `GET /api/cloud-pods/plans` – List all plans.
- `GET /api/cloud-pods/plans/:code` – Single plan details.
- `GET /api/cloud-pods/compare` – Comparison table.

## Usage in Create Flow

When creating a CloudPod:

1. Route reads `planCode` from request.
2. Looks up `CLOUD_POD_PLANS[planCode]`.
3. Uses plan values as:
   - VM resources (CPU/RAM/disk).
   - Input for quota calculation (`checkTenantQuota`).

Plan codes must be:

- **Stable** (do not rename existing ones without migration).
- **Unique** per commercial product.

The plan configuration is the **single source of truth** for VM sizing.
