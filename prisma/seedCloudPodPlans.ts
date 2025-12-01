// prisma/seedCloudPodPlans.ts
/**
 * CloudPods-only seeder.
 *
 * Syncs the CloudPods plan definitions from src/config/plansConfig.ts
 * into the cloud_pod_plans table via Prisma.
 *
 * This should be run AFTER you update CLOUDPOD_PLANS in plansConfig.ts.
 *
 * Maps plansConfig fields to existing CloudPodPlan model:
 *   code -> slug
 *   vcpu -> defaultCores
 *   ramMb -> defaultRamMb
 *   storageGb -> defaultDiskGb
 *   priceMonthly -> monthlyPriceCents (converted to cents)
 *   isPublic -> isActive
 */

import { PrismaClient } from '@prisma/client';
import {
  CLOUDPOD_PLANS,
  type CloudPodPlan as ConfigCloudPodPlan,
} from '../src/config/plansConfig';

const prisma = new PrismaClient();

async function seedCloudPodPlans() {
  console.log('Seeding CloudPod plans from src/config/plansConfig.ts');

  for (const plan of CLOUDPOD_PLANS) {
    await upsertCloudPodPlan(plan);
  }

  console.log('Done seeding CloudPod plans.');
}

async function upsertCloudPodPlan(plan: ConfigCloudPodPlan) {
  const {
    code,
    name,
    description,
    vcpu,
    ramMb,
    storageGb,
    priceMonthly,
    currency,
    isPublic,
  } = plan;

  // Map config fields to existing Prisma model fields
  const slug = code;
  const monthlyPriceCents = Math.round(priceMonthly * 100);

  await prisma.cloudPodPlan.upsert({
    where: { slug },
    create: {
      slug,
      name,
      description: description ?? null,
      defaultCores: vcpu,
      defaultRamMb: ramMb,
      defaultDiskGb: storageGb,
      // Set reasonable quota limits based on plan tier
      maxCloudPods: vcpu <= 1 ? 2 : vcpu <= 2 ? 5 : 10,
      maxCpuCores: vcpu * 4,
      maxRamMb: ramMb * 4,
      maxDiskGb: storageGb * 4,
      monthlyPriceCents,
      currency: currency.toLowerCase(),
      isActive: isPublic,
    },
    update: {
      name,
      description: description ?? null,
      defaultCores: vcpu,
      defaultRamMb: ramMb,
      defaultDiskGb: storageGb,
      maxCloudPods: vcpu <= 1 ? 2 : vcpu <= 2 ? 5 : 10,
      maxCpuCores: vcpu * 4,
      maxRamMb: ramMb * 4,
      maxDiskGb: storageGb * 4,
      monthlyPriceCents,
      currency: currency.toLowerCase(),
      isActive: isPublic,
    },
  });

  console.log(`✔ Upserted CloudPod plan ${slug}`);
}

seedCloudPodPlans()
  .catch((err) => {
    console.error('Error seeding CloudPod plans', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
