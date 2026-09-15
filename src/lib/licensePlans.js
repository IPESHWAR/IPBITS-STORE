import {
  buildTierToPlan,
  computePlanExpiresAt,
  resolveSubscriptionPlan,
  SUBSCRIPTION_PLANS,
} from '@/config/plans';

/** Map storefront tier IDs to license plan metadata */
export const TIER_TO_PLAN = buildTierToPlan();

export const DEFAULT_PLAN = TIER_TO_PLAN['30_days'] || buildTierToPlan()[SUBSCRIPTION_PLANS.monthly.storefront_id];

export function resolvePlanFromItems(items = []) {
  for (const item of items) {
    const id = String(item?.id || item?.name || '');
    const match = id.match(/ai_bundle_(\d+_days?|\d+_day|1_year|90_days)/);
    if (match) {
      return TIER_TO_PLAN[match[1]] || DEFAULT_PLAN;
    }
    if (id.includes('ai_bundle')) {
      const tierId = id.replace(/^ai_bundle_/, '');
      return TIER_TO_PLAN[tierId] || DEFAULT_PLAN;
    }
    // Direct plan id / plan_type on cart line
    if (item?.planId || item?.plan_type || item?.planType) {
      const plan = resolveSubscriptionPlan(item.planId || item.plan_type || item.planType);
      return {
        planType: plan.plan_type,
        durationDays: plan.duration_days,
        planSuffix: plan.plan_suffix,
        planId: plan.id,
        creditLimit: plan.credit_limit,
      };
    }
  }
  return { ...DEFAULT_PLAN, planSuffix: 'VIP' };
}

export function computeExpiresAt(durationDays) {
  return computePlanExpiresAt(durationDays);
}

export const LICENSE_STORAGE_KEY = 'ipbits_license_session';
