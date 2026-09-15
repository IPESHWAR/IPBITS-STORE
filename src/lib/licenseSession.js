'use client';

import { LICENSE_STORAGE_KEY } from '@/lib/licensePlans';
import {
  getVipPoints,
  initialVipPointsFromLicense,
  limitUsdFromLicense,
} from '@/lib/vipPoints';

export function daysRemainingFromLicense(license) {
  if (!license) return 0;
  if (license.expires_at) {
    const ms = new Date(license.expires_at).getTime() - Date.now();
    if (!Number.isFinite(ms)) return 0;
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }
  if (license.credits != null) return Math.max(0, Number(license.credits) || 0);
  if (license.duration_days != null) return Math.max(0, Number(license.duration_days) || 0);
  return 0;
}

/** Remaining hub credits — days left on an active license (0 when expired/empty). */
export function getAccessCredits(license) {
  if (!license?.key_code) return 0;
  return daysRemainingFromLicense(license);
}

export function isLicenseActive(license) {
  if (!license?.key_code) return false;
  const daysOk = getAccessCredits(license) > 0;
  const points = getVipPoints(license);
  // Points gate when we have a known balance; otherwise fall back to days
  if (license.vip_points != null || license.limit_usd != null || license.credit_limit_usd != null) {
    return daysOk && points > 0;
  }
  return daysOk;
}

export function readLicenseSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.key_code) return null;
    const credits = getAccessCredits(session);
    const limitUsd = limitUsdFromLicense(session);
    const vipTotal = session.vip_points_total ?? initialVipPointsFromLicense(session);
    const vipPoints =
      session.vip_points != null ? Math.max(0, Math.round(Number(session.vip_points))) : vipTotal;
    return {
      ...session,
      credits,
      limit_usd: limitUsd || session.limit_usd || null,
      vip_points_total: vipTotal,
      vip_points: vipPoints,
      expired: credits <= 0 || vipPoints <= 0,
    };
  } catch {
    return null;
  }
}

export function writeLicenseSession(license) {
  if (typeof window === 'undefined' || !license) return null;
  const credits = getAccessCredits(license);
  const limitUsd = limitUsdFromLicense(license);
  const vipTotal =
    license.vip_points_total != null
      ? Math.max(0, Math.round(Number(license.vip_points_total)))
      : initialVipPointsFromLicense({ ...license, limit_usd: limitUsd });
  const vipPoints =
    license.vip_points != null
      ? Math.max(0, Math.round(Number(license.vip_points)))
      : vipTotal;

  const payload = {
    key_code: license.key_code,
    plan_type: license.plan_type || null,
    duration_days: license.duration_days ?? null,
    expires_at: license.expires_at || null,
    customer_phone: license.customer_phone || null,
    amount_iqd: license.amount_iqd ?? null,
    limit_usd: limitUsd || null,
    credit_limit_usd: limitUsd || license.credit_limit_usd || null,
    vip_points_total: vipTotal,
    vip_points: vipPoints,
    credits,
    activated_at: license.activated_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  window.localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

export function clearLicenseSession() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
