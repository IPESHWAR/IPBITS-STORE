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
    plan_suffix: '365D',
  },
};

/** Legacy / alternate identifiers → plan id */
const PLAN_ALIASES = {
  test: 'test',
  test_1d: 'test',
  '1_day': 'test',
  '1d': 'test',
  '1day': 'test',
  trial: 'test',
  daily: 'test',
  tst: 'test',
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
  '365d': 'yearly',
};

/** Map duration prefix tags (1D/7D/…) → plan id */
const SUFFIX_TO_PLAN_ID = {
  '1D': 'test',
  '7D': 'weekly',
  '30D': 'monthly',
  '90D': 'three_months',
  '365D': 'yearly',
  '1Y': 'yearly',
};

/** Normalize multilingual order / plan text for matching. */
export function normalizePlanHaystack(text = '') {
  return String(text || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

/**
 * Infer plan from free-text (item labels, captions, Kurdish/Arabic/English names).
 * Order matters: trial/1D before monthly so "تێست" never becomes 30D.
 */
export function inferPlanFromText(text = '') {
  const hay = normalizePlanHaystack(text);
  if (!hay.trim()) return null;

  // 1 Day / Trial / تێست / تست
  if (
    /تێست|تیست|تست|تجرب|trial|test[_\s-]?1d|1_day|1day|\b1\s*d\b|1\s*day|١\s*ڕۆژ|١\s*رۆژ|1\s*ڕۆژ|1\s*رۆژ|\bdaily\b|\btst\b|ai_bundle_1_day|٢٤\s*دەمژمێر|24\s*hour/.test(
      hay
    )
  ) {
    return SUBSCRIPTION_PLANS.test;
  }

  // 1 Year / ساڵانە (before monthly)
  if (
    /ساڵانە|سالانە|سنوي|yearly|annual|1_year|\b1y\b|365d|ai_bundle_1_year|١\s*ساڵ|1\s*year|سالانه/.test(
      hay
    )
  ) {
    return SUBSCRIPTION_PLANS.yearly;
  }

  // 90 Days / ٣ مانگ
  if (
    /٣\s*مانگ|٣\s*مەه|3\s*months?|3months|3_months|90_days|\b90d\b|٩٠\s*ڕۆژ|٩٠\s*رۆژ|90\s*ڕۆژ|quarterly|ai_bundle_90/.test(
      hay
    )
  ) {
    return SUBSCRIPTION_PLANS.three_months;
  }

  // 7 Days / هەفتانە
  if (
    /هەفتانە|هفتانه|أسبوعي|weekly|7_days|\b7d\b|٧\s*ڕۆژ|٧\s*رۆژ|7\s*ڕۆژ|7\s*رۆژ|7\s*days?|ai_bundle_7_days/.test(
      hay
    )
  ) {
    return SUBSCRIPTION_PLANS.weekly;
  }

  // 30 Days / مانگانە / مەهانە
  if (
    /مانگانە|مەهانە|شهري|monthly|30_days|\b30d\b|٣٠\s*ڕۆژ|٣٠\s*رۆژ|30\s*ڕۆژ|30\s*رۆژ|30\s*days?|ai_bundle_30_days/.test(
      hay
    )
  ) {
    return SUBSCRIPTION_PLANS.monthly;
  }

  return null;
}

export function inferPlanFromPrice({ totalIQD = 0, totalUSD = 0 } = {}) {
  const iqd = Number(totalIQD) || 0;
  const usd = Number(totalUSD) || 0;
  const byIqd = [
    [2500, 'test'],
    [5000, 'weekly'],
    [12000, 'monthly'],
    [25000, 'three_months'],
    [50000, 'yearly'],
  ];
  for (const [price, id] of byIqd) {
    if (Math.abs(iqd - price) < 1) return SUBSCRIPTION_PLANS[id];
  }
  const byUsd = [
    [1.7, 'test'],
    [3.5, 'weekly'],
    [8, 'monthly'],
    [17, 'three_months'],
    [35, 'yearly'],
  ];
  for (const [price, id] of byUsd) {
    if (Math.abs(usd - price) < 0.2) return SUBSCRIPTION_PLANS[id];
  }
  return null;
}

export function inferPlanFromDurationDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n <= 1) return SUBSCRIPTION_PLANS.test;
  if (n <= 7) return SUBSCRIPTION_PLANS.weekly;
  if (n <= 30) return SUBSCRIPTION_PLANS.monthly;
  if (n <= 90) return SUBSCRIPTION_PLANS.three_months;
  return SUBSCRIPTION_PLANS.yearly;
}

/** Resolve plan from callback planId / suffix (1D, test_1d, weekly, …). */
export function resolvePlanFromPlanId(planId) {
  if (!planId) return null;
  const raw = String(planId).trim();
  const upper = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (SUFFIX_TO_PLAN_ID[upper]) return SUBSCRIPTION_PLANS[SUFFIX_TO_PLAN_ID[upper]];
  const lower = raw.toLowerCase();
  const alias = PLAN_ALIASES[lower];
  if (alias && SUBSCRIPTION_PLANS[alias]) return SUBSCRIPTION_PLANS[alias];
  if (SUBSCRIPTION_PLANS[lower]) return SUBSCRIPTION_PLANS[lower];
  return inferPlanFromText(raw);
}

/**
 * Resolve the correct subscription plan for license prefix generation.
 * Priority: callback planId → message/item text (تێست…) → price → duration → DB plan_type.
 * Never let a stale monthly DB field override an explicit "تێست" in the order text.
 */
export function resolvePlanFromOrderContext({
  planId,
  planType,
  durationDays,
  items,
  itemsLabel,
  messageText,
  productTitle,
  totalIQD,
  totalUSD,
} = {}) {
  const fromCallback = resolvePlanFromPlanId(planId);
  if (fromCallback) return fromCallback;

  const list = Array.isArray(items) ? items : [];
  const itemHay = list
    .map((i) => `${i?.id || ''} ${i?.planId || ''} ${i?.plan_type || ''} ${i?.name || ''} ${i?.title || ''}`)
    .join(' ');
  const hay = [itemsLabel, productTitle, messageText, itemHay].filter(Boolean).join(' ');
  const fromText = inferPlanFromText(hay);
  if (fromText) return fromText;

  const fromPrice = inferPlanFromPrice({ totalIQD, totalUSD });
  if (fromPrice) return fromPrice;

  const fromDays = inferPlanFromDurationDays(durationDays);
  if (fromDays) return fromDays;

  const explicit = planType && String(planType).trim();
  if (explicit && explicit !== 'account_service') {
    const fromExplicit = resolvePlanFromPlanId(explicit);
    if (fromExplicit) return fromExplicit;
  }

  return SUBSCRIPTION_PLANS.test;
}

export function listSubscriptionPlans() {
  return Object.values(SUBSCRIPTION_PLANS);
}

export function resolveSubscriptionPlan(raw) {
  if (!raw) return SUBSCRIPTION_PLANS.monthly;

  if (typeof raw === 'object') {
    const candidates = [raw.id, raw.plan_type, raw.planType, raw.storefront_id, raw.planId, raw.name];
    for (const c of candidates) {
      if (!c) continue;
      const key = PLAN_ALIASES[String(c).trim().toLowerCase()] || String(c).trim().toLowerCase();
      if (SUBSCRIPTION_PLANS[key]) return SUBSCRIPTION_PLANS[key];
      const fromText = inferPlanFromText(String(c));
      if (fromText) return fromText;
    }
    return SUBSCRIPTION_PLANS.monthly;
  }

  const str = String(raw).trim();
  const key = PLAN_ALIASES[str.toLowerCase()] || str.toLowerCase();
  if (SUBSCRIPTION_PLANS[key]) return SUBSCRIPTION_PLANS[key];
  const fromText = inferPlanFromText(str);
  if (fromText) return fromText;
  return SUBSCRIPTION_PLANS.monthly;
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

/** Duration tags for customer-facing license codes (IPBITS-30D-XXXXXXXX). */
export const PACKAGE_CODE_SUFFIX = {
  test: '1D',
  weekly: '7D',
  monthly: '30D',
  three_months: '90D',
  '3months': '90D',
  yearly: '365D',
};

export function packageCodeSuffix(packageType) {
  const plan = resolveSubscriptionPlan(packageType);
  return PACKAGE_CODE_SUFFIX[plan.id] || PACKAGE_CODE_SUFFIX[String(packageType || '').toLowerCase()] || '30D';
}
