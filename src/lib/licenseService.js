import { generateLicenseKey } from '@/lib/generateKey';
import { computeExpiresAt, resolvePlanFromItems } from '@/lib/licensePlans';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  createAutomatedLicense,
  provisionOpenRouterKeyForLicense,
} from '@/lib/openRouterProvisioning';
import {
  computePlanExpiresAt,
  resolveSubscriptionPlan,
  resolvePlanFromOrderContext,
} from '@/config/plans';
import { VIP_POINTS_PER_USD } from '@/lib/vipPoints';

const MAX_RETRIES = 5;

/** Dynamic duration prefixes: 1D / 7D / 30D / 90D / 365D (+ legacy aliases). */
export const IPBITS_LICENSE_KEY_RE =
  /^IPBITS-(1D|7D|30D|90D|365D|1Y|TST|WK|MO|3M|YR)-[A-Z0-9]{4,}$/i;

export function normalizeLicenseKeyInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function isValidIpbitsLicenseFormat(raw) {
  return IPBITS_LICENSE_KEY_RE.test(normalizeLicenseKeyInput(raw));
}

function enrichActivatedLicense(license, cleanKey) {
  const plan = resolveSubscriptionPlan(
    license.plan_type || license.package_type || license._planHint || 'monthly'
  );
  const durationDays =
    Number(license.duration_days) || Number(plan.duration_days) || 1;
  const limitUsd =
    Number(license.credit_limit_usd ?? license.limit_usd) ||
    Number(plan.credit_limit) ||
    0;
  const vipPoints = Math.round(limitUsd * VIP_POINTS_PER_USD);
  let expiresAt = license.expires_at || null;
  if (!expiresAt && durationDays > 0) {
    expiresAt = computePlanExpiresAt(durationDays);
  }

  return {
    key_code: String(license.key_code || license.license_code || cleanKey).toUpperCase(),
    plan_type: license.plan_type || plan.plan_type || 'ai_hub',
    duration_days: durationDays,
    expires_at: expiresAt,
    credits: durationDays,
    credit_limit_usd: limitUsd,
    limit_usd: limitUsd,
    vip_points_total: vipPoints,
    vip_points: vipPoints,
    customer_phone: license.customer_phone || null,
    customer_name: license.customer_name || null,
    source: license._source || 'license',
  };
}

/** Map any plan / storefront id → automated package type for OpenRouter provisioning. */
export function toAutomatedPackageType(planType) {
  const plan = resolveSubscriptionPlan(planType);
  switch (plan.id) {
    case 'test':
      return 'test';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'three_months':
      return '3months';
    case 'yearly':
      return 'yearly';
    default:
      return 'monthly';
  }
}

/**
 * Issue a customer-facing AI Hub license + provision OpenRouter sub-key.
 * Primary path: `licenses` via createAutomatedLicense (mirrors license_keys).
 * Fallback: legacy license_keys-only if licenses table is unavailable.
 */
export async function createLicenseKey({
  planType,
  durationDays,
  planSuffix,
  customerPhone,
  customerName,
  orderId,
}) {
  if (!supabaseAdmin) {
    throw new Error('Supabase service role is not configured');
  }

  const subscription = resolveSubscriptionPlan(planType);
  const packageType = toAutomatedPackageType(planType || subscription.id);
  const resolvedSuffix = planSuffix || subscription.plan_suffix;

  const automated = await createAutomatedLicense(packageType, {
    customerPhone,
    customerName,
    orderId,
    planSuffix: resolvedSuffix,
  });

  if (automated.ok && automated.license_code) {
    return {
      key_code: automated.license_code,
      plan_type: subscription.plan_type,
      duration_days: automated.duration_days ?? subscription.duration_days,
      expires_at: automated.expires_at,
      created_at: new Date().toISOString(),
      order_id: orderId || null,
      customer_phone: customerPhone || null,
      customer_name: customerName || null,
      credit_limit_usd: automated.credit_limit_usd,
      package_type: automated.package_type,
      source: 'licenses',
    };
  }

  // Legacy fallback when `licenses` table is missing or OpenRouter admin key unset.
  console.warn(
    'createAutomatedLicense failed, falling back to license_keys:',
    automated.code || automated.error || 'unknown'
  );

  const resolvedDuration = durationDays || subscription.duration_days;
  const resolvedPlanType = subscription.plan_type || planType;
  const expiresAt = computeExpiresAt(resolvedDuration);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const keyCode = generateLicenseKey(resolvedSuffix);

    const { data, error } = await supabaseAdmin
      .from('license_keys')
      .insert({
        key_code: keyCode,
        plan_type: resolvedPlanType,
        duration_days: resolvedDuration,
        customer_phone: customerPhone || null,
        customer_name: customerName || null,
        order_id: orderId || null,
        is_active: true,
        expires_at: expiresAt,
      })
      .select('id, key_code, plan_type, duration_days, expires_at, created_at, order_id')
      .single();

    if (!error && data) {
      await provisionOpenRouterKeyForLicense({
        ...data,
        customer_phone: customerPhone || null,
        order_id: orderId || data.order_id,
      }).catch((err) => {
        console.error('OpenRouter provision after license failed:', err?.message || err);
      });
      return { ...data, source: 'license_keys' };
    }

    if (error?.code !== '23505') {
      throw new Error(error?.message || automated.error || 'Failed to create license key');
    }
  }

  throw new Error(automated.error || 'Could not generate a unique license key');
}

export function generateLicenseForOrder({
  items,
  phone,
  name,
  planType,
  durationDays,
  planSuffix,
  orderId,
  itemsLabel,
}) {
  const resolved = resolvePlanFromOrderContext({
    planType,
    durationDays,
    items,
    itemsLabel,
  });
  const fromItems = !planType ? resolvePlanFromItems(items, itemsLabel) : null;

  const plan = {
    planType: resolved.plan_type || fromItems?.planType || planType,
    durationDays:
      durationDays || resolved.duration_days || fromItems?.durationDays || resolved.duration_days,
    planSuffix:
      planSuffix || resolved.plan_suffix || fromItems?.planSuffix || resolved.plan_suffix,
  };

  return createLicenseKey({
    planType: plan.planType,
    durationDays: plan.durationDays,
    planSuffix: plan.planSuffix,
    customerPhone: phone,
    customerName: name,
    orderId,
  });
}

async function lookupLicensesTable(cleanKey) {
  const selects = [
    'id, license_code, package_type, duration_days, expires_at, is_active, credit_limit_usd, customer_phone, customer_name',
    'id, license_code, package_type, duration_days, expires_at, is_active, credit_limit_usd',
    'id, license_code, key_code, package_type, duration_days, expires_at, is_active, credit_limit_usd',
  ];

  for (const columns of selects) {
    // Prefer exact eq after normalize (keys are stored uppercase).
    let query = supabaseAdmin.from('licenses').select(columns).eq('license_code', cleanKey).limit(1);
    let { data, error } = await query.maybeSingle();

    if (error && /column|schema cache|does not exist|relation/i.test(error.message || '')) {
      continue;
    }

    // Fallback: case-insensitive match if eq miss (legacy mixed-case rows)
    if (!data && !error) {
      query = supabaseAdmin.from('licenses').select(columns).ilike('license_code', cleanKey).limit(1);
      ({ data, error } = await query.maybeSingle());
      if (error && /column|schema cache|does not exist|relation/i.test(error.message || '')) {
        continue;
      }
    }

    if (error) {
      if (/column|schema cache|does not exist|relation/i.test(error.message || '')) continue;
      return null;
    }
    if (data) {
      return {
        key_code: data.license_code || data.key_code || cleanKey,
        plan_type: data.package_type || data.plan_type || 'ai_hub',
        package_type: data.package_type || null,
        duration_days: data.duration_days,
        expires_at: data.expires_at,
        credit_limit_usd: data.credit_limit_usd,
        customer_phone: data.customer_phone || null,
        customer_name: data.customer_name || null,
        is_active: data.is_active !== false,
        _source: 'licenses',
      };
    }
  }
  return null;
}

async function lookupLicenseKeysTable(cleanKey) {
  const { data, error } = await supabaseAdmin
    .from('license_keys')
    .select('*')
    .eq('key_code', cleanKey)
    .maybeSingle();

  if (!error && data) {
    return { ...data, _source: 'license_keys' };
  }

  // Case-insensitive fallback
  const { data: data2, error: error2 } = await supabaseAdmin
    .from('license_keys')
    .select('*')
    .ilike('key_code', cleanKey)
    .maybeSingle();

  if (!error2 && data2) {
    return { ...data2, _source: 'license_keys' };
  }
  return null;
}

async function lookupOrdersLicense(cleanKey) {
  const selects = [
    'id, license_key, plan_type, duration_days, customer_phone, customer_name, status, expires_at',
    'id, license_key, plan_type, customer_phone, customer_name, status',
  ];

  for (const columns of selects) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select(columns)
      .eq('license_key', cleanKey)
      .limit(1)
      .maybeSingle();

    if (error) {
      if (/column|schema cache|does not exist|relation/i.test(error.message || '')) continue;
      return null;
    }
    if (data?.license_key) {
      const plan = resolveSubscriptionPlan(data.plan_type);
      return {
        key_code: String(data.license_key).toUpperCase(),
        plan_type: data.plan_type || plan.plan_type,
        duration_days: data.duration_days || plan.duration_days,
        expires_at: data.expires_at || null,
        customer_phone: data.customer_phone || null,
        customer_name: data.customer_name || null,
        is_active: String(data.status || 'active').toLowerCase() !== 'cancelled',
        _source: 'orders',
      };
    }
  }
  return null;
}

export async function activateLicenseKey({ keyCode, phone }) {
  if (!supabaseAdmin) {
    throw new Error('Supabase service role is not configured');
  }

  const cleanKey = normalizeLicenseKeyInput(keyCode);
  if (!cleanKey) {
    return { ok: false, code: 'missing_key' };
  }

  // Soft format check — still allow DB lookup for legacy shapes
  if (cleanKey.startsWith('IPBITS-') && !isValidIpbitsLicenseFormat(cleanKey)) {
    return { ok: false, code: 'invalid_key' };
  }

  // 1) Canonical `licenses` table (automated OpenRouter provisioning)
  let license = await lookupLicensesTable(cleanKey);

  // 2) Legacy `license_keys` (older order fulfillment codes)
  if (!license) {
    license = await lookupLicenseKeysTable(cleanKey);
  }

  // 3) Order row that already received a Telegram-issued key
  if (!license) {
    license = await lookupOrdersLicense(cleanKey);
  }

  if (!license) {
    return { ok: false, code: 'invalid_key' };
  }

  if (license.is_active === false || license.is_active === 0) {
    return { ok: false, code: 'inactive_key' };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { ok: false, code: 'expired_key' };
  }

  const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
  if (license.customer_phone && cleanPhone) {
    const stored = String(license.customer_phone).replace(/\D/g, '');
    if (stored && stored !== cleanPhone) {
      return { ok: false, code: 'phone_mismatch' };
    }
  }

  return {
    ok: true,
    license: enrichActivatedLicense(license, cleanKey),
  };
}

export async function findActiveLicenseByPhone(phone) {
  if (!supabaseAdmin || !phone) return { ok: false, code: 'missing_phone' };

  const raw = String(phone).trim();
  const digits = raw.replace(/\D/g, '');
  const candidates = [...new Set([raw, digits, digits ? `0${digits.replace(/^0/, '')}` : ''])].filter(
    Boolean
  );

  const { data, error } = await supabaseAdmin
    .from('license_keys')
    .select('key_code, plan_type, duration_days, expires_at, customer_phone, customer_name, is_active')
    .eq('is_active', true)
    .in('customer_phone', candidates)
    .order('expires_at', { ascending: false, nullsFirst: false })
    .limit(5);

  if (!error && data?.length) {
    const live = data.find((row) => !row.expires_at || new Date(row.expires_at) >= new Date());
    if (live) {
      return {
        ok: true,
        license: {
          key_code: live.key_code,
          plan_type: live.plan_type,
          duration_days: live.duration_days,
          expires_at: live.expires_at,
          customer_phone: live.customer_phone,
          customer_name: live.customer_name,
        },
      };
    }
  }

  const subSelects = [
    'id, status, expires_at, plan_type, package_type, phone',
    'id, status, expires_at, plan_type, phone',
  ];
  let subs = [];
  for (const columns of subSelects) {
    let query = supabaseAdmin.from('subscriptions').select(columns).in('phone', candidates).limit(8);
    if (columns.includes('package_type')) {
      query = query.eq('package_type', 'ai_hub');
    }
    const { data: subData, error: subErr } = await query;
    if (subErr) {
      if (/column|schema cache|does not exist|relation/i.test(subErr.message || '')) continue;
      break;
    }
    subs = subData || [];
    break;
  }

  const activeSub = (subs || []).find(
    (row) =>
      String(row.status || '').toLowerCase() === 'active' &&
      (!row.expires_at || new Date(row.expires_at) >= new Date())
  );
  if (activeSub) {
    return {
      ok: true,
      license: {
        key_code: `SUB-${activeSub.id}`,
        plan_type: activeSub.package_type || activeSub.plan_type || 'ai_hub',
        expires_at: activeSub.expires_at,
        customer_phone: activeSub.phone,
      },
    };
  }

  return { ok: false, code: 'not_found' };
}
