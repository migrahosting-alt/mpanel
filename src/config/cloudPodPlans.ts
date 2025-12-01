import {
  CLOUDPOD_PLANS,
  type CloudPodPlan,
  getPlanByCode,
} from './plansConfig';

export type { CloudPodPlan } from './plansConfig';

export const CLOUDPOD_PLAN_BY_CODE: Record<string, CloudPodPlan> =
  CLOUDPOD_PLANS.reduce((acc, plan) => {
    acc[plan.code] = plan;
    return acc;
  }, {} as Record<string, CloudPodPlan>);

export function getCloudPodPlan(code: string): CloudPodPlan | undefined {
  const plan = getPlanByCode(code);
  if (!plan || plan.family !== 'cloudpods') return undefined;
  return plan as CloudPodPlan;
}

export function listCloudPodPlans(): CloudPodPlan[] {
  return CLOUDPOD_PLANS.slice().sort((a, b) => a.sortOrder - b.sortOrder);
}
