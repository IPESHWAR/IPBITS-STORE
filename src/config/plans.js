import { usdToIqd } from '@/lib/i18n';

/**
 * Canonical AI Hub subscription tiers.
 * Single source of truth for storefront price, license duration, and OpenRouter credit caps.
 */

export const SUBSCRIPTION_PLANS = {
  test: {
    id: 'test',
    name_badini: 'تێست (١ ڕۆژ)',
    price_iqd: 2500,
    price_usd: 1.7,
    credit_limit: 0.75, // $0.75
    duration_days: 1,
    storefront_id: '1_day',
    plan_type: 'test_1d',
    plan_suffix: '1D',
  },
  weekly: {
    id: 'weekly',
    name_badini: 'حەفتیانە (٧ ڕۆژ)',
    price_iqd: 5000,
    price_usd: 3.5,
    credit_limit: 1.75, // $1.75
    duration_days: 7,
    storefront_id: '7_days',
    plan_type: 'weekly_7d',
    plan_suffix: '7D',
  },
  monthly: {
    id: 'monthly',
    name_badini: 'مەهانە (٣٠ ڕۆژ)',
    price_iqd: 12000,
    price_usd: 8.0,
    credit_limit: 4.0, // $4.00
    duration_days: 30,
    storefront_id: '30_days',
    plan_type: 'monthly_30d',
    plan_suffix: '30D',
  },
  three_months: {
    id: 'three_months',
    name_badini: '٣ مەهانە (٩٠ ڕۆژ)',
    price_iqd: 25000,
    price_usd: 17.0,
    credit_limit: 8.5, // $8.50
    duration_days: 90,
    storefront_id: '90_days',
    plan_type: 'quarterly_90d',
    plan_suffix: '90D',
  },
  yearly: {
    id: 'yearly',
    name_badini: 'ساڵانە (١ ساڵ)',
    price_iqd: 50000,
    price_usd: 35.0,
    credit_limit: 18.0, // $18.00
    duration_days: 365,
    storefront_id: '1_year',
    plan_type: 'yearly_1y',
    plan_suffix: '1Y',
  },
};

/** Legacy / alternate identifiers → plan id */
const PLAN_ALIASES = {
  test: 'test',
  test_1d: 'test',
  '1_day': 'test',
  '1d': 'test',
  weekly: 'weekly',
  weekly_7d: 'weekly',
  '7_days': 'weekly',
  '7d': 'weekly',
  monthly: 'monthly',
  monthly_30d: 'monthly',
  '30_days': 'monthly',
  '30d': 'monthly',
  three_months: 'three_months',
  '3months': 'three_months',
  '3_months': 'three_months',
  quarterly_90d: 'three_months',
  '90_days': 'three_months',
  '90d': 'three_months',
  yearly: 'yearly',
  yearly_1y: 'yearly',
  '1_year': 'yearly',
  '1y': 'yearly',
};

export function listSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

export function resolveSubscriptionPlan(raw) {
  if (!raw) return SUBSCRIPTION_PLANS.monthly;

  if (typeof raw === 'object') {
    const candidates = [raw.id, raw.plan_type, raw.planType, raw.storefront_id, raw.planId];
    for (const c of candidates) {
      if (!c) continue;
      const key = PLAN_ALIASES[String(c).trim().toLowerCase()] || String(c).trim().toLowerCase();
      if (SUBSCRIPTION_PLANS[key]) return SUBSCRIPTION_PLANS[key];
    }
    return SUBSCRIPTION_PLANS.monthly;
  }

  const key = PLAN_ALIASES[String(raw).trim().toLowerCase()] || String(raw).trim().toLowerCase();
  return SUBSCRIPTION_PLANS[key] || SUBSCRIPTION_PLANS.monthly;
}

/** Expiration timestamp from now + plan.duration_days. */
export function computePlanExpiresAt(planOrDays) {
  const days =
    typeof planOrDays === 'number'
      ? planOrDays
      : Number(resolveSubscriptionPlan(planOrDays).duration_days || 30);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Storefront AI tier rows derived from SUBSCRIPTION_PLANS (keeps oldPrice ≈ 2×). */
export function buildAiTiersData() {
  return listSubscriptionPlans().map((plan) => {
    const priceUSD = Number(plan.price_usd) || 0;
    const priceIQD = priceUSD > 0 ? usdToIqd(priceUSD) : Number(plan.price_iqd) || 0;
    return {
      id: plan.storefront_id,
      planId: plan.id,
      priceIQD,
      priceUSD,
      oldPriceIQD: usdToIqd(priceUSD * 2) || Math.round(priceIQD * 2),
      oldPriceUSD: Math.round(priceUSD * 2 * 100) / 100,
      creditLimit: plan.credit_limit,
      durationDays: plan.duration_days,
      name_badini: plan.name_badini,
    };
  });
}

/** Map storefront tier id → license metadata (compat with licenseService). */
export function buildTierToPlan() {
  const map = {};
  for (const plan of listSubscriptionPlans()) {
    map[plan.storefront_id] = {
      planType: plan.plan_type,
      durationDays: plan.duration_days,
      planSuffix: plan.plan_suffix,
      planId: plan.id,
      creditLimit: plan.credit_limit,
    };
  }
  return map;
}

/** OpenRouter credit map keyed by plan_type (compat). */
export function buildOpenRouterPlanLimits() {
  const map = {};
  for (const plan of listSubscriptionPlans()) {
    map[plan.plan_type] = {
      creditLimitUsd: plan.credit_limit,
      durationDays: plan.duration_days,
      label: plan.name_badini,
      planId: plan.id,
    };
  }
  return map;
}

export function openRouterKeyName(plan, orderId) {
  const planId = resolveSubscriptionPlan(plan).id;
  const shortOrder = String(orderId || 'manual').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6) || 'manual';
  return `IPBITS-${planId}-${shortOrder}`.slice(0, 64);
}

/** Short package tags for customer-facing license codes (IPBITS-WK-XXXX). */
export const PACKAGE_CODE_SUFFIX = {
  test: 'TST',
  weekly: 'WK',
  monthly: 'MO',
  three_months: '3M',
  '3months': '3M',
  yearly: 'YR',
};

export function packageCodeSuffix(packageType) {
  const plan = resolveSubscriptionPlan(packageType);
  return PACKAGE_CODE_SUFFIX[plan.id] || PACKAGE_CODE_SUFFIX[String(packageType || '').toLowerCase()] || 'MO';
}
