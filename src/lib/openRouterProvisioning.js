import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { contactLookupKeys, normalizeWalletId } from '@/lib/wallet';
import { decryptOpenRouterKey, encryptOpenRouterKey, maskOpenRouterKey } from '@/lib/openRouterKeyCrypto';
import { planTypeFromLicense, resolveOpenRouterPlan } from '@/lib/openRouterPlans';
import {
  computePlanExpiresAt,
  openRouterKeyName,
  packageCodeSuffix,
  resolveSubscriptionPlan,
} from '@/config/plans';
import { generateShortLicenseCode } from '@/lib/generateKey';

const KEYS_URL = 'https://openrouter.ai/api/v1/keys';
const MAX_CODE_RETRIES = 8;

/** @typedef {'test' | 'weekly' | 'monthly' | '3months' | 'yearly'} AutomatedPackageType */

/**
 * Exact OpenRouter USD spend caps + durations for automated licensing.
 * Kept in sync with SUBSCRIPTION_PLANS in @/config/plans.
 */
export const AUTOMATED_PACKAGE_LIMITS = {
  test: { limit: 0.75, expirationDays: 1 },
  weekly: { limit: 1.75, expirationDays: 7 },
  monthly: { limit: 4.0, expirationDays: 30 },
  '3months': { limit: 8.5, expirationDays: 90 },
  yearly: { limit: 18.0, expirationDays: 365 },
};

function managementKey() {
  return (
    process.env.OPENROUTER_ADMIN_KEY ||
    process.env.OPENROUTER_MANAGEMENT_API_KEY ||
    ''
  ).trim();
}

function isLive(expiresAt) {
  return !expiresAt || new Date(expiresAt).getTime() >= Date.now();
}

function normalizeAutomatedPackage(packageType) {
  const raw = String(packageType || '').trim().toLowerCase();
  if (raw === '3months' || raw === '3_months' || raw === 'three_months' || raw === 'quarterly') {
    return '3months';
  }
  if (AUTOMATED_PACKAGE_LIMITS[raw]) return raw;
  const plan = resolveSubscriptionPlan(raw);
  if (plan.id === 'three_months') return '3months';
  if (AUTOMATED_PACKAGE_LIMITS[plan.id]) return plan.id;
  return null;
}

export async function createOpenRouterSubKey({ name, creditLimitUsd, expiresAt }) {
  const adminKey = managementKey();
  if (!adminKey) {
    return { ok: false, code: 'missing_management_key' };
  }

  const body = {
    name: String(name || 'IPBITS AI Hub').slice(0, 64),
    limit: Number(creditLimitUsd),
  };
  if (expiresAt) body.expires_at = expiresAt;

  const res = await fetch(KEYS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      code: 'openrouter_create_failed',
      error: json?.error?.message || json?.error || `HTTP ${res.status}`,
    };
  }

  const data = json?.data || json;
  const key = data.key || data.api_key || '';
  if (!key) {
    return { ok: false, code: 'openrouter_missing_key' };
  }

  return {
    ok: true,
    key,
    hash: data.hash || null,
    label: data.label || maskOpenRouterKey(key),
    limit: data.limit ?? creditLimitUsd,
    expires_at: data.expires_at || expiresAt || null,
  };
}

export async function disableOpenRouterSubKey(hash) {
  const adminKey = managementKey();
  if (!adminKey || !hash) return { ok: false };
  const res = await fetch(`${KEYS_URL}/${encodeURIComponent(hash)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ disabled: true }),
  });
  return { ok: res.ok };
}

async function deactivateStoredKeys(phoneKeys, exceptId) {
  if (!supabaseAdmin || !phoneKeys.length) return;
  let query = supabaseAdmin
    .from('openrouter_keys')
    .update({ status: 'disabled', disabled_at: new Date().toISOString() })
    .in('customer_phone', phoneKeys)
    .eq('status', 'active');
  if (exceptId) query = query.neq('id', exceptId);
  const { data } = await query.select('or_hash');
  await Promise.all((data || []).map((row) => disableOpenRouterSubKey(row.or_hash).catch(() => null)));
}

async function allocateShortLicenseCode(packageType, planSuffixOverride) {
  const suffix =
    (planSuffixOverride && String(planSuffixOverride).toUpperCase().replace(/[^A-Z0-9]/g, '')) ||
    packageCodeSuffix(packageType === '3months' ? 'three_months' : packageType);
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const licenseCode = generateShortLicenseCode(suffix);
    const { data: hit } = await supabaseAdmin
      .from('licenses')
      .select('id')
      .eq('license_code', licenseCode)
      .maybeSingle();
    if (!hit) {
      const { data: legacy } = await supabaseAdmin
        .from('license_keys')
        .select('id')
        .eq('key_code', licenseCode)
        .maybeSingle();
      if (!legacy) return licenseCode;
    }
  }
  return null;
}

/**
 * Hands-free: create OpenRouter sub-key + short IPBITS license code, persist to Supabase.
 *
 * @param {AutomatedPackageType} packageType
 * @param {{ customerPhone?: string, customerName?: string, orderId?: string }} [options]
 * @returns {Promise<{ ok: boolean, license_code?: string, package_type?: string, duration_days?: number, credit_limit_usd?: number, expires_at?: string, code?: string, error?: string }>}
 */
export async function createAutomatedLicense(packageType, options = {}) {
  if (!supabaseAdmin) {
    return { ok: false, code: 'db_unavailable' };
  }

  const pkg = normalizeAutomatedPackage(packageType);
  if (!pkg || !AUTOMATED_PACKAGE_LIMITS[pkg]) {
    return { ok: false, code: 'invalid_package_type' };
  }

  const limits = AUTOMATED_PACKAGE_LIMITS[pkg];
  const plan = resolveSubscriptionPlan(pkg === '3months' ? 'three_months' : pkg);
  const expiresAt = computePlanExpiresAt(limits.expirationDays);
  const licenseCode = await allocateShortLicenseCode(pkg, options.planSuffix || plan.plan_suffix);
  if (!licenseCode) {
    return { ok: false, code: 'license_code_collision' };
  }

  const created = await createOpenRouterSubKey({
    name: openRouterKeyName(plan, options.orderId || licenseCode),
    creditLimitUsd: limits.limit,
    expiresAt,
  });

  if (!created.ok) {
    return created;
  }

  const licenseRow = {
    license_code: licenseCode,
    openrouter_key: encryptOpenRouterKey(created.key),
    openrouter_hash: created.hash,
    package_type: pkg,
    duration_days: limits.expirationDays,
    credit_limit_usd: limits.limit,
    expires_at: expiresAt,
    is_active: true,
  };

  const { data: insertedLicense, error: licenseErr } = await supabaseAdmin
    .from('licenses')
    .insert(licenseRow)
    .select('id, license_code, package_type, duration_days, credit_limit_usd, expires_at, is_active')
    .single();

  if (licenseErr) {
    console.error('licenses insert failed:', licenseErr.message);
    await disableOpenRouterSubKey(created.hash).catch(() => null);
    return { ok: false, code: 'licenses_persist_failed', error: licenseErr.message };
  }

  // Keep redeem/activate path working (legacy license_keys + encrypted openrouter_keys).
  const phone = normalizeWalletId(options.customerPhone || '') || options.customerPhone || null;
  const { error: mirrorLicenseErr } = await supabaseAdmin.from('license_keys').insert({
    key_code: licenseCode,
    plan_type: plan.plan_type,
    duration_days: limits.expirationDays,
    customer_phone: phone,
    customer_name: options.customerName || null,
    order_id: options.orderId || null,
    is_active: true,
    expires_at: expiresAt,
  });
  if (mirrorLicenseErr) {
    console.error('license_keys mirror failed:', mirrorLicenseErr.message);
  }

  const { data: orRow, error: orErr } = await supabaseAdmin
    .from('openrouter_keys')
    .insert({
      customer_phone: phone,
      license_key_code: licenseCode,
      order_id: options.orderId || null,
      plan_type: plan.plan_type,
      or_hash: created.hash,
      or_label: created.label,
      key_ciphertext: encryptOpenRouterKey(created.key),
      credit_limit_usd: limits.limit,
      expires_at: expiresAt,
      status: 'active',
    })
    .select('id')
    .single();

  if (orErr) {
    console.error('openrouter_keys mirror failed:', orErr.message);
  } else if (phone) {
    await deactivateStoredKeys(contactLookupKeys(phone), orRow?.id).catch(() => null);
  }

  return {
    ok: true,
    license_code: insertedLicense.license_code,
    package_type: insertedLicense.package_type,
    duration_days: insertedLicense.duration_days,
    credit_limit_usd: Number(insertedLicense.credit_limit_usd),
    expires_at: insertedLicense.expires_at,
    is_active: insertedLicense.is_active,
    id: insertedLicense.id,
  };
}

/**
 * On license/order completion: lookup SUBSCRIPTION_PLANS → create OpenRouter sub-key
 * with plan.credit_limit → encrypt with OPENROUTER_KEY_SECRET → store in openrouter_keys.
 */
export async function provisionOpenRouterKeyForLicense(license) {
  if (!supabaseAdmin || !license?.key_code) {
    return { ok: false, code: 'not_configured' };
  }

  const planType = planTypeFromLicense(license);
  const subscription = resolveSubscriptionPlan(planType);
  const plan = resolveOpenRouterPlan(planType);
  const phone = normalizeWalletId(license.customer_phone || '') || license.customer_phone || null;
  const expiresAt = license.expires_at || computePlanExpiresAt(subscription.duration_days);
  const phoneKeys = phone ? contactLookupKeys(phone) : [];
  const orderId = license.order_id || license.orderId || '';

  const { data: existing } = await supabaseAdmin
    .from('openrouter_keys')
    .select('id, or_hash, status, expires_at, license_key_code')
    .eq('license_key_code', license.key_code)
    .eq('status', 'active')
    .maybeSingle();

  if (existing && isLive(existing.expires_at)) {
    return { ok: true, reused: true, id: existing.id };
  }

  const created = await createOpenRouterSubKey({
    name: openRouterKeyName(subscription, orderId || license.key_code),
    creditLimitUsd: plan.creditLimitUsd,
    expiresAt,
  });

  if (!created.ok) {
    console.error('OpenRouter provision failed:', created.code, created.error || '');
    return created;
  }

  const row = {
    customer_phone: phone,
    license_key_code: license.key_code,
    order_id: orderId || null,
    plan_type: subscription.plan_type,
    or_hash: created.hash,
    or_label: created.label,
    key_ciphertext: encryptOpenRouterKey(created.key),
    credit_limit_usd: created.limit ?? subscription.credit_limit,
    expires_at: expiresAt,
    status: 'active',
  };

  const { data: inserted, error } = await supabaseAdmin
    .from('openrouter_keys')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('OpenRouter key persist failed:', error.message);
    await disableOpenRouterSubKey(created.hash).catch(() => null);
    return { ok: false, code: 'persist_failed', error: error.message };
  }

  if (phoneKeys.length) {
    await deactivateStoredKeys(phoneKeys, inserted.id).catch(() => null);
  }

  return {
    ok: true,
    id: inserted.id,
    label: created.label,
    credit_limit_usd: created.limit ?? subscription.credit_limit,
    plan_id: subscription.id,
  };
}

export async function resolveProvisionedOpenRouterKey({ phone, licenseKey } = {}) {
  if (!supabaseAdmin) return null;

  const candidates = [];
  if (phone) candidates.push(...contactLookupKeys(phone));
  const cleanLicense = String(licenseKey || '').trim().toUpperCase();

  const columns =
    'id, customer_phone, license_key_code, key_ciphertext, or_hash, credit_limit_usd, expires_at, status, plan_type';

  let query = supabaseAdmin.from('openrouter_keys').select(columns).eq('status', 'active').limit(8);
  const orParts = [];
  if (cleanLicense) orParts.push(`license_key_code.eq.${cleanLicense}`);
  if (candidates.length) orParts.push(...candidates.map((k) => `customer_phone.eq.${k}`));
  if (!orParts.length) return null;
  query = query.or(orParts.join(','));

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    if (/column|schema cache|does not exist|relation/i.test(error.message || '')) return null;
    return null;
  }

  const live = (data || []).find((row) => isLive(row.expires_at));
  if (!live?.key_ciphertext) return null;

  try {
    return {
      apiKey: decryptOpenRouterKey(live.key_ciphertext),
      hash: live.or_hash,
      creditLimitUsd: live.credit_limit_usd,
      expiresAt: live.expires_at,
      planType: live.plan_type,
      id: live.id,
    };
  } catch {
    return null;
  }
}

export async function resolveOrProvisionChatKey({ phone, license }) {
  const existing = await resolveProvisionedOpenRouterKey({
    phone: phone || license?.customer_phone,
    licenseKey: license?.key_code,
  });
  if (existing?.apiKey) return existing;

  if (license?.key_code) {
    await provisionOpenRouterKeyForLicense({
      ...license,
      customer_phone: phone || license.customer_phone,
    });
    return resolveProvisionedOpenRouterKey({
      phone: phone || license.customer_phone,
      licenseKey: license.key_code,
    });
  }

  return null;
}
