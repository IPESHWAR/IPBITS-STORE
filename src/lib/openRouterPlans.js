import {
  buildOpenRouterPlanLimits,
  resolveSubscriptionPlan,
} from '@/config/plans';

/** @deprecated Prefer resolveSubscriptionPlan from @/config/plans — kept for callers. */
export const OPENROUTER_PLAN_LIMITS = buildOpenRouterPlanLimits();

const TIER_ALIAS = {
  '1_day': 'test_1d',
  '7_days': 'weekly_7d',
  '30_days': 'monthly_30d',
  '90_days': 'quarterly_90d',
  '1_year': 'yearly_1y',
  test: 'test_1d',
  weekly: 'weekly_7d',
  monthly: 'monthly_30d',
  three_months: 'quarterly_90d',
  '3months': 'quarterly_90d',
  yearly: 'yearly_1y',
};

export function resolveOpenRouterPlan(planType) {
  const plan = resolveSubscriptionPlan(planType || TIER_ALIAS[String(planType || '').trim()] || planType);
  return {
    creditLimitUsd: plan.credit_limit,
    durationDays: plan.duration_days,
    label: plan.name_badini,
    planId: plan.id,
  };
}

export function planTypeFromLicense(license) {
  return license?.plan_type || license?.planType || 'monthly_30d';
}
