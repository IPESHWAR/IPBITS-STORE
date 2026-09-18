import {
  buildTierToPlan,
  computePlanExpiresAt,
  inferPlanFromText,
  resolveSubscriptionPlan,
  SUBSCRIPTION_PLANS,
} from '@/config/plans';

/** Map storefront tier IDs to license plan metadata */
export const TIER_TO_PLAN = buildTierToPlan();

export const DEFAULT_PLAN = TIER_TO_PLAN['1_day'] || {
  planType: SUBSCRIPTION_PLANS.test.plan_type,
  durationDays: SUBSCRIPTION_PLANS.test.duration_days,
  planSuffix: SUBSCRIPTION_PLANS.test.plan_suffix,
  planId: SUBSCRIPTION_PLANS.test.id,
  creditLimit: SUBSCRIPTION_PLANS.test.credit_limit,
};

export function resolvePlanFromItems(items = [], itemsLabel = '') {
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
    const fromName = inferPlanFromText(`${item?.name || ''} ${item?.title || ''} ${id}`);
    if (fromName) {
      return {
        planType: fromName.plan_type,
        durationDays: fromName.duration_days,
        planSuffix: fromName.plan_suffix,
        planId: fromName.id,
        creditLimit: fromName.credit_limit,
      };
    }
  }

  const fromLabel = inferPlanFromText(itemsLabel);
  if (fromLabel) {
    return {
      planType: fromLabel.plan_type,
      durationDays: fromLabel.duration_days,
      planSuffix: fromLabel.plan_suffix,
      planId: fromLabel.id,
      creditLimit: fromLabel.credit_limit,
    };
  }

  return { ...DEFAULT_PLAN };
}

export function computeExpiresAt(durationDays) {
  return computePlanExpiresAt(durationDays);
}

export const LICENSE_STORAGE_KEY = 'ipbits_license_session';
