/**
 * Client unlock helper: try license keys (Telegram / AI Hub), then gift vouchers.
 * License keys look like IPBITS-1D-XXXX; vouchers are separate codes in `vouchers`.
 */

export const IPBITS_LICENSE_KEY_RE =
  /^IPBITS-(1D|7D|30D|90D|365D|1Y|TST|WK|MO|3M|YR)-[A-Z0-9]{4,}$/i;

export function normalizeAccessKeyInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    // Strip Telegram markdown backticks / quotes when pasting from Confirm reply
    .replace(/[`'"“”‘’]/g, '')
    .replace(/\s+/g, '');
}

export function looksLikeIpbitsLicenseKey(raw) {
  return IPBITS_LICENSE_KEY_RE.test(normalizeAccessKeyInput(raw));
}

async function unlockWithLicense(cleanKey) {
  const res = await fetch('/api/licenses/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: cleanKey, code: cleanKey }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !(data.ok || data.success) || !data.license) {
    return { ok: false, error: data.error || data.code, code: data.code };
  }
  return { ok: true, license: data.license, source: 'license' };
}

async function unlockWithVoucher(cleanKey) {
  const res = await fetch('/api/vouchers/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: cleanKey, key: cleanKey }),
  });
  const data = await res.json().catch((err) => {
    console.log('Unlock Error:', err);
    return {};
  });
  if (!res.ok || !(data.ok || data.success) || !data.license) {
    console.log('Unlock Error:', data.error || data.detail || data);
    return { ok: false, error: data.error || data.code, code: data.code };
  }
  return { ok: true, license: data.license, source: 'voucher' };
}

/**
 * Unlock chat / redeem with either a Telegram license key or a gift voucher.
 */
export async function unlockAccessKey(rawKey) {
  const cleanKey = normalizeAccessKeyInput(rawKey);
  if (!cleanKey) return { ok: false, code: 'missing_key' };

  // Prefer license path for IPBITS-* (and always try licenses first for those prefixes).
  if (cleanKey.startsWith('IPBITS-') || looksLikeIpbitsLicenseKey(cleanKey)) {
    const licenseResult = await unlockWithLicense(cleanKey);
    if (licenseResult.ok) return licenseResult;
    // Fall through to voucher only if license miss (some gift codes may share prefix in tests)
  }

  const voucherResult = await unlockWithVoucher(cleanKey);
  if (voucherResult.ok) return voucherResult;

  // Non-IPBITS codes: also try licenses (legacy keys without matching regex)
  if (!cleanKey.startsWith('IPBITS-')) {
    const licenseResult = await unlockWithLicense(cleanKey);
    if (licenseResult.ok) return licenseResult;
  }

  return { ok: false, error: voucherResult.error || 'invalid_or_used', code: 'invalid_or_used' };
}
