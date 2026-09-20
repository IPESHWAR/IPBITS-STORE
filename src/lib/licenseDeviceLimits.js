/**
 * Device binding limits for IPBITS license keys.
 * Used only by license verification / activation — not pricing or UI.
 */

export const DEVICE_LIMIT_MESSAGE =
  'ئەڤ کلیلە گەهشتییە زۆرترین ڕێژەیا ئامیرێن ڕێگەپێدای بۆ ڤێ بەشداریکردنێ!';

/** Plan prefix → max concurrent devices */
export const DEVICE_LIMIT_BY_PREFIX = {
  '1D': 1,
  TST: 1,
  '7D': 2,
  WK: 2,
  '30D': 2,
  MO: 2,
  '90D': 3,
  '3M': 3,
  '365D': 4,
  '1Y': 4,
  YR: 4,
};

/** duration_days → max devices (fallback when prefix unavailable) */
export const DEVICE_LIMIT_BY_DURATION = {
  1: 1,
  7: 2,
  30: 2,
  90: 3,
  365: 4,
};

const CLIENT_DEVICE_STORAGE_KEY = 'ipbits_device_id';

/**
 * Extract tier prefix from IPBITS-{PREFIX}-... keys.
 */
export function prefixFromLicenseKey(keyCode) {
  const raw = String(keyCode || '')
    .trim()
    .toUpperCase();
  const m = raw.match(/^IPBITS-([A-Z0-9]+)-/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Resolve max devices from key prefix, plan_type, package_type, or duration_days.
 */
export function maxDevicesForLicense(license, keyCode) {
  const prefix = prefixFromLicenseKey(keyCode || license?.key_code || license?.license_code);

  if (prefix && DEVICE_LIMIT_BY_PREFIX[prefix] != null) {
    return DEVICE_LIMIT_BY_PREFIX[prefix];
  }

  const planHint = String(
    license?.plan_type || license?.package_type || license?.plan || ''
  ).toLowerCase();

  if (/test|trial|1[_-]?d|1_day|daily/.test(planHint)) return 1;
  if (/week|7[_-]?d|7_day/.test(planHint)) return 2;
  if (/(^|[^0-9])30[_-]?d|month|30_day/.test(planHint) && !/3\s*month|90/.test(planHint)) {
    return 2;
  }
  if (/3\s*month|quarter|90[_-]?d|90_day/.test(planHint)) return 3;
  if (/year|365|1y/.test(planHint)) return 4;

  const days = Number(license?.duration_days);
  if (Number.isFinite(days) && DEVICE_LIMIT_BY_DURATION[days] != null) {
    return DEVICE_LIMIT_BY_DURATION[days];
  }
  if (Number.isFinite(days)) {
    if (days <= 1) return 1;
    if (days <= 7) return 2;
    if (days <= 30) return 2;
    if (days <= 90) return 3;
    return 4;
  }

  return 2;
}

export function normalizeDeviceId(raw) {
  const id = String(raw || '').trim();
  if (!id || id.length > 128) return '';
  return id;
}

/**
 * Stable browser device id (localStorage). Used by unlock helpers only.
 */
export function getOrCreateClientDeviceId() {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(CLIENT_DEVICE_STORAGE_KEY);
    if (id && id.length <= 128) return id;
    id =
      (typeof crypto !== 'undefined' && crypto.randomUUID && crypto.randomUUID()) ||
      `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CLIENT_DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return '';
  }
}

function readDeviceIdsFromRow(row) {
  if (!row) return [];
  if (Array.isArray(row.device_ids)) return row.device_ids.map(String).filter(Boolean);
  if (Array.isArray(row.bound_devices)) return row.bound_devices.map(String).filter(Boolean);

  let meta = row.metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = null;
    }
  }
  if (meta && typeof meta === 'object') {
    if (Array.isArray(meta.device_ids)) return meta.device_ids.map(String).filter(Boolean);
    if (Array.isArray(meta.bound_devices)) return meta.bound_devices.map(String).filter(Boolean);
  }
  return [];
}

function mergeMetadata(row, deviceIds) {
  let meta = row?.metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) meta = {};
  return { ...meta, device_ids: deviceIds };
}

/**
 * Enforce device limit for a license key. Persists bindings on license_keys.metadata.device_ids.
 *
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, device_ids: string[], max_devices: number, skipped?: boolean }>}
 */
export async function enforceLicenseDeviceBinding(supabase, { keyCode, deviceId, license }) {
  const cleanDevice = normalizeDeviceId(deviceId);
  const cleanKey = String(keyCode || '')
    .trim()
    .toUpperCase();
  const maxDevices = maxDevicesForLicense(license, cleanKey);

  // No device id → skip (backward compatible for non-browser / server callers)
  if (!cleanDevice || !supabase || !cleanKey) {
    return { ok: true, device_ids: [], max_devices: maxDevices, skipped: true };
  }

  const { data: existing } = await supabase
    .from('license_keys')
    .select('id, key_code, metadata, plan_type, duration_days, is_active')
    .eq('key_code', cleanKey)
    .maybeSingle();

  let deviceIds = readDeviceIdsFromRow(existing);

  if (deviceIds.includes(cleanDevice)) {
    return { ok: true, device_ids: deviceIds, max_devices: maxDevices, already_bound: true };
  }

  if (deviceIds.length >= maxDevices) {
    return {
      ok: false,
      code: 'device_limit',
      message: DEVICE_LIMIT_MESSAGE,
      device_ids: deviceIds,
      max_devices: maxDevices,
    };
  }

  const nextIds = [...deviceIds, cleanDevice];
  const metadata = mergeMetadata(existing, nextIds);

  if (!existing) {
    const { error: insertErr } = await supabase.from('license_keys').insert({
      key_code: cleanKey,
      plan_type: license?.plan_type || license?.package_type || 'ai_hub',
      duration_days: Number(license?.duration_days) || null,
      is_active: true,
      metadata,
    });

    if (insertErr && /duplicate|unique|23505/i.test(insertErr.message || '')) {
      // Concurrent insert — re-read and decide
      const { data: raced } = await supabase
        .from('license_keys')
        .select('id, metadata')
        .eq('key_code', cleanKey)
        .maybeSingle();
      const racedIds = readDeviceIdsFromRow(raced);
      if (racedIds.includes(cleanDevice)) {
        return { ok: true, device_ids: racedIds, max_devices: maxDevices, already_bound: true };
      }
      if (racedIds.length >= maxDevices) {
        return {
          ok: false,
          code: 'device_limit',
          message: DEVICE_LIMIT_MESSAGE,
          device_ids: racedIds,
          max_devices: maxDevices,
        };
      }
      const racedNext = [...racedIds, cleanDevice];
      const { error: updErr } = await supabase
        .from('license_keys')
        .update({ metadata: mergeMetadata(raced, racedNext) })
        .eq('key_code', cleanKey);
      if (updErr) {
        console.warn('[licenseDeviceLimits] race update failed:', updErr.message);
      }
      return { ok: true, device_ids: racedNext, max_devices: maxDevices, bound: true };
    }

    if (insertErr) {
      console.warn('[licenseDeviceLimits] insert failed:', insertErr.message);
      // Fail open on unexpected schema errors so valid keys still activate
      return { ok: true, device_ids: nextIds, max_devices: maxDevices, persist_failed: true };
    }

    return { ok: true, device_ids: nextIds, max_devices: maxDevices, bound: true };
  }

  const { error: updateErr } = await supabase
    .from('license_keys')
    .update({ metadata })
    .eq('key_code', cleanKey);

  if (updateErr) {
    console.warn('[licenseDeviceLimits] update failed:', updateErr.message);
    return { ok: true, device_ids: nextIds, max_devices: maxDevices, persist_failed: true };
  }

  return { ok: true, device_ids: nextIds, max_devices: maxDevices, bound: true };
}
