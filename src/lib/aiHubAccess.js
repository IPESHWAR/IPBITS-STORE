import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { activateLicenseKey, findActiveLicenseByPhone } from '@/lib/licenseService';
import { contactLookupKeys, normalizeWalletId } from '@/lib/wallet';

function signingSecret() {
  return process.env.AI_HUB_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ipbits-ai-hub';
}

export function signAiHubToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', signingSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAiHubToken(token) {
  const raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', signingSecret()).update(body).digest('base64url');
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && new Date(payload.exp).getTime() < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function asSession(license) {
  return {
    key_code: license.key_code,
    plan_type: license.plan_type || 'ai_hub',
    duration_days: license.duration_days || null,
    expires_at: license.expires_at || null,
    customer_phone: license.customer_phone || license.phone || null,
  };
}

function isLive(expiresAt) {
  return !expiresAt || new Date(expiresAt).getTime() >= Date.now();
}

async function matchSubscriptions(identifier, keys) {
  if (!supabaseAdmin) return null;
  const selects = [
    'id, phone, access_key, package_type, status, expires_at, plan_type',
    'id, phone, status, expires_at, plan_type, package_type',
    'id, phone, status, expires_at',
  ];

  for (const columns of selects) {
    let query = supabaseAdmin.from('subscriptions').select(columns).limit(20);
    if (columns.includes('package_type')) {
      query = query.eq('package_type', 'ai_hub');
    }
    if (columns.includes('status')) {
      query = query.eq('status', 'active');
    }
    const orParts = [];
    if (columns.includes('access_key') && identifier) {
      orParts.push(`access_key.eq.${identifier}`);
    }
    if (keys.length) {
      orParts.push(...keys.map((k) => `phone.eq.${k}`));
    }
    if (orParts.length) query = query.or(orParts.join(','));

    const { data, error } = await query;
    if (error) {
      if (/column|schema cache|does not exist|relation/i.test(error.message || '')) continue;
      return null;
    }
    const live = (data || []).find((row) => String(row.status || 'active').toLowerCase() === 'active' && isLive(row.expires_at));
    if (live) {
      return asSession({
        key_code: live.access_key || `SUB-${live.id}`,
        plan_type: live.package_type || live.plan_type || 'ai_hub',
        expires_at: live.expires_at,
        customer_phone: live.phone,
      });
    }
  }
  return null;
}

async function matchOrders(identifier, keys) {
  if (!supabaseAdmin) return null;
  const selects = [
    'id, status, customer_phone, phone, license_key, items, created_at, package_type, expires_at',
    'id, status, customer_phone, license_key, items, created_at',
    'id, status, customer_phone, license_key, created_at',
  ];

  for (const columns of selects) {
    let query = supabaseAdmin.from('orders').select(columns).limit(20);
    if (columns.includes('status')) query = query.eq('status', 'approved');
    const orParts = [];
    if (columns.includes('license_key') && identifier) orParts.push(`license_key.eq.${identifier}`);
    if (keys.length && columns.includes('customer_phone')) {
      orParts.push(...keys.map((k) => `customer_phone.eq.${k}`));
    }
    if (keys.length && columns.includes('phone')) {
      orParts.push(...keys.map((k) => `phone.eq.${k}`));
    }
    if (orParts.length) query = query.or(orParts.join(','));

    const { data, error } = await query;
    if (error) {
      if (/column|schema cache|does not exist|relation/i.test(error.message || '')) continue;
      return null;
    }

    const row = (data || []).find((item) => {
      const approved = String(item.status || '').toLowerCase() === 'approved';
      const hubItem = JSON.stringify(item.items || '').includes('ai_bundle') || item.package_type === 'ai_hub';
      const keyMatch = identifier && String(item.license_key || '').toUpperCase() === identifier;
      return approved && (hubItem || keyMatch) && isLive(item.expires_at);
    });
    if (!row) continue;

    if (row.license_key) {
      const vip = await activateLicenseKey({ keyCode: row.license_key }).catch(() => ({ ok: false }));
      if (vip.ok) return asSession(vip.license);
    }

    const created = row.created_at ? new Date(row.created_at) : new Date();
    const expires = row.expires_at || new Date(created.getTime() + 30 * 86400000).toISOString();
    if (!isLive(expires)) continue;
    return asSession({
      key_code: row.license_key || `ORD-${row.id}`,
      plan_type: 'ai_hub',
      expires_at: expires,
      customer_phone: row.customer_phone || row.phone,
    });
  }
  return null;
}

function sanitizeLookup(value) {
  return String(value || '').replace(/[,()]/g, '').trim();
}

export async function resolveAiHubAccess(rawInput) {
  try {
    const identifier = sanitizeLookup(rawInput);
    if (!identifier) return { ok: false, code: 'missing_key' };

    const looksLikeKey = /IPBITS|SUB-|ORD-|[A-Z0-9]{6,}-[A-Z0-9]{4,}/i.test(identifier);
    if (looksLikeKey) {
      const vip = await activateLicenseKey({ keyCode: identifier.toUpperCase() }).catch(() => ({ ok: false }));
      if (vip.ok) return { ok: true, license: asSession(vip.license) };
    }

    const phone = normalizeWalletId(identifier);
    const keys = contactLookupKeys(identifier).map(sanitizeLookup).filter(Boolean);

    const [byPhone, fromSubs, fromOrders] = await Promise.all([
      phone ? findActiveLicenseByPhone(phone).catch(() => ({ ok: false })) : Promise.resolve({ ok: false }),
      matchSubscriptions(identifier.toUpperCase(), keys),
      matchOrders(identifier.toUpperCase(), keys),
    ]);

    if (byPhone.ok) return { ok: true, license: asSession(byPhone.license) };
    if (fromSubs) return { ok: true, license: fromSubs };
    if (fromOrders) return { ok: true, license: fromOrders };

    return { ok: false, code: 'invalid_or_expired' };
  } catch {
    return { ok: false, code: 'invalid_or_expired' };
  }
}

export function tokenFromLicense(license) {
  const payload = {
    t: 'ai_hub',
    k: license.key_code,
    p: license.customer_phone || '',
    exp: license.expires_at || null,
    iat: new Date().toISOString(),
  };
  return {
    token: signAiHubToken(payload),
    license,
    expires_at: license.expires_at,
  };
}
