import { listSubscriptionPlans, resolveSubscriptionPlan } from '@/config/plans';

/** $1.00 USD = 1,000 VIP points */
export const VIP_POINTS_PER_USD = 1000;

/** Fallback when OpenRouter omits usage.cost (~$0.50 / 1M tokens blended). */
const USD_PER_MILLION_TOKENS = 0.5;

export function usdToVipPoints(usd) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * VIP_POINTS_PER_USD);
}

export function vipPointsToUsd(points) {
  const n = Number(points);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / VIP_POINTS_PER_USD) * 1e6) / 1e6;
}

/** Resolve OpenRouter credit limit USD from a license / voucher session. */
export function limitUsdFromLicense(license) {
  if (!license) return 0;
  const direct = Number(license.limit_usd ?? license.credit_limit_usd ?? license.creditLimitUsd);
  if (Number.isFinite(direct) && direct > 0) return direct;

  if (license.plan_type || license.planId || license.package_type) {
    const plan = resolveSubscriptionPlan(
      license.plan_type || license.planId || license.package_type
    );
    if (plan?.credit_limit) return Number(plan.credit_limit);
  }

  const amountIqd = Math.round(Number(license.amount_iqd) || 0);
  if (amountIqd > 0) {
    const plans = listSubscriptionPlans();
    const exact = plans.find((p) => p.price_iqd === amountIqd);
    if (exact) return Number(exact.credit_limit);
    let best = plans[0];
    let bestDiff = Math.abs((best?.price_iqd || 0) - amountIqd);
    for (const p of plans) {
      const d = Math.abs(p.price_iqd - amountIqd);
      if (d < bestDiff) {
        best = p;
        bestDiff = d;
      }
    }
    if (best?.credit_limit) return Number(best.credit_limit);
  }

  return 0;
}

export function initialVipPointsFromLicense(license) {
  if (!license) return 0;
  if (license.vip_points_total != null && Number.isFinite(Number(license.vip_points_total))) {
    return Math.max(0, Math.round(Number(license.vip_points_total)));
  }
  return usdToVipPoints(limitUsdFromLicense(license));
}

export function getVipPoints(license) {
  if (!license) return 0;
  if (license.vip_points != null && Number.isFinite(Number(license.vip_points))) {
    return Math.max(0, Math.round(Number(license.vip_points)));
  }
  return initialVipPointsFromLicense(license);
}

/**
 * Prefer OpenRouter `usage.cost` (USD). Else estimate from token counts.
 */
export function estimateCostUsdFromUsage(usage, { isFreeModel = false } = {}) {
  if (!usage || typeof usage !== 'object') {
    return isFreeModel ? 0 : 0.001;
  }

  const reported = Number(usage.cost ?? usage.total_cost ?? usage.native_cost);
  if (Number.isFinite(reported) && reported >= 0) {
    return reported;
  }

  const tokens = Number(
    usage.total_tokens ??
      (Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0))
  );
  if (!Number.isFinite(tokens) || tokens <= 0) {
    return isFreeModel ? 0 : 0.001;
  }

  if (isFreeModel) {
    // Tiny non-zero so free models still tick the counter slightly
    return Math.max(0.0001, (tokens / 1_000_000) * 0.05);
  }

  return (tokens / 1_000_000) * USD_PER_MILLION_TOKENS;
}

export function vipPointsFromUsage(usage, opts = {}) {
  const costUsd = estimateCostUsdFromUsage(usage, opts);
  const points = usdToVipPoints(costUsd);
  // Always burn at least 1 point on a real completion so the badge moves
  if (costUsd > 0 && points < 1) return 1;
  return Math.max(0, points);
}

export function deductVipPoints(license, pointsToDeduct) {
  if (!license) return null;
  const total = initialVipPointsFromLicense(license) || getVipPoints(license);
  const current = getVipPoints(license);
  const spent = Math.max(0, Math.round(Number(pointsToDeduct) || 0));
  const next = Math.max(0, current - spent);
  return {
    ...license,
    limit_usd: limitUsdFromLicense(license) || license.limit_usd || null,
    vip_points_total: license.vip_points_total ?? total,
    vip_points: next,
  };
}
