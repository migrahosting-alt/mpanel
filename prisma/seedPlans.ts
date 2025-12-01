// prisma/seedPlans.ts
import { PrismaClient } from '@prisma/client';
import {
  ALL_PLANS,
  CLOUDPOD_PLANS,
  WORDPRESS_PLANS,
  EMAIL_PLANS,
  VPS_PLANS,
  BACKUP_PLANS,
  ADDON_PLANS,
  type BasePlan,
} from '../src/config/plansConfig';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('Seeding plans from src/config/plansConfig.ts');

  for (const plan of ALL_PLANS) {
    const { code } = plan;

    const config: Record<string, unknown> = {
      family: plan.family,
      features: plan.features,
      tags: plan.tags ?? [],
    };

    // Attach family-specific details into config
    if (CLOUDPOD_PLANS.some((p) => p.code === code)) {
      const p = CLOUDPOD_PLANS.find((x) => x.code === code)!;
      config.resources = {
        vcpu: p.vcpu,
        ramMb: p.ramMb,
        storageGb: p.storageGb,
        bandwidthGb: p.bandwidthGb ?? null,
      };
    } else if (WORDPRESS_PLANS.some((p) => p.code === code)) {
      const p = WORDPRESS_PLANS.find((x) => x.code === code)!;
      config.wordpress = {
        sites: p.sites,
        storageGb: p.storageGb,
        bandwidth: p.bandwidth,
        includesStaging: p.includesStaging,
        includesUpdates: p.includesUpdates,
      };
    } else if (EMAIL_PLANS.some((p) => p.code === code)) {
      const p = EMAIL_PLANS.find((x) => x.code === code)!;
      config.email = {
        mailboxes: p.mailboxes,
        storagePerMailboxGb: p.storagePerMailboxGb,
        customDomain: p.customDomain,
      };
    } else if (VPS_PLANS.some((p) => p.code === code)) {
      const p = VPS_PLANS.find((x) => x.code === code)!;
      config.vps = {
        vcpu: p.vcpu,
        ramMb: p.ramMb,
        storageGb: p.storageGb,
        bandwidthTb: p.bandwidthTb,
      };
    } else if (BACKUP_PLANS.some((p) => p.code === code)) {
      const p = BACKUP_PLANS.find((x) => x.code === code)!;
      config.backup = {
        storageGb: p.storageGb,
        redundancy: p.redundancy,
        isForPods: p.isForPods ?? false,
        isForWebsites: p.isForWebsites ?? false,
      };
    } else if (ADDON_PLANS.some((p) => p.code === code)) {
      const p = ADDON_PLANS.find((x) => x.code === code)!;
      config.addon = {
        unit: p.unit ?? null,
        unitAmount: p.unitAmount ?? null,
      };
    }

    await prisma.plan.upsert({
      where: { code },
      update: {
        family: plan.family,
        name: plan.name,
        description: plan.description ?? null,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly ?? null,
        currency: plan.currency,
        isPublic: plan.isPublic,
        isFeatured: plan.isFeatured ?? false,
        sortOrder: plan.sortOrder,
        config,
      },
      create: {
        code,
        family: plan.family,
        name: plan.name,
        description: plan.description ?? null,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly ?? null,
        currency: plan.currency,
        isPublic: plan.isPublic,
        isFeatured: plan.isFeatured ?? false,
        sortOrder: plan.sortOrder,
        config,
      },
    });

    console.log(`✔ Upserted plan ${code}`);
  }

  console.log('Done seeding plans.');
}

seedPlans()
  .catch((err) => {
    console.error('Error seeding plans', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
