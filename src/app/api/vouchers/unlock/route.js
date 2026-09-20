import { NextResponse } from 'next/server';
import { getSupabaseAdmin, supabaseAdmin as supabaseAdminSingleton } from '@/lib/supabaseAdmin';
import { listSubscriptionPlans, computePlanExpiresAt } from '@/config/plans';
import {
  activateLicenseKey,
  isValidIpbitsLicenseFormat,
  normalizeLicenseKeyInput,
} from '@/lib/licenseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function db() {
  return getSupabaseAdmin() || supabaseAdminSingleton;
}

/** Map voucher IQD amount → closest AI Hub plan (duration / plan_type). */
function planFromAmountIqd(amountIqd) {
  const amount = Math.round(Number(amountIqd) || 0);
  const plans = listSubscriptionPlans();
  const exact = plans.find((p) => p.price_iqd === amount);
  if (exact) return exact;

  // Nearest plan by price (covers slight amount mismatches)
  let best = plans[0];
  let bestDiff = Math.abs(best.price_iqd - amount);
  for (const p of plans) {
    const d = Math.abs(p.price_iqd - amount);
    if (d < bestDiff) {
      best = p;
      bestDiff = d;
    }
  }
  return best || { plan_type: 'weekly_7d', duration_days: 7 };
}

/**
 * Unlock AI Hub with a vouchers.code, or with an IPBITS-* license key.
 * Body: { code | key }
 */
export async function POST(req) {
  try {
    if (!db()) {
      const error = { message: 'db_unavailable' };
      console.log('Unlock Error:', error);
      return NextResponse.json(
        { ok: false, success: false, error: 'Database unavailable' },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const enteredCode = normalizeLicenseKeyInput(body.code || body.key || '');

    if (!enteredCode) {
      const error = { message: 'missing_code' };
      console.log('Unlock Error:', error);
      return NextResponse.json(
        { ok: false, success: false, error: 'missing_code' },
        { status: 400 }
      );
    }

    // Chat gate primary path: licenses.license_code / license_keys.key_code
    // via activateLicenseKey (same as /api/licenses/verify).
    if (enteredCode.startsWith('IPBITS-') || isValidIpbitsLicenseFormat(enteredCode)) {
      const result = await activateLicenseKey({ keyCode: enteredCode });
      if (result.ok) {
        return NextResponse.json({
          ok: true,
          success: true,
          license: result.license,
        });
      }
      // Fall through to vouchers — bulk/script IPBITS codes live there
      // (code + is_used: false), matching generate-bulk-keys.mjs.
    }

    const supabaseAdmin = db();
    const { data: voucher, error } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('code', enteredCode)
      .eq('is_used', false)
      .single();

    if (error || !voucher) {
      console.log('Unlock Error:', error);
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error: 'invalid_or_used',
          detail: error?.message || null,
        },
        { status: 400 }
      );
    }

    // Mark voucher consumed (set MARK_VOUCHER_USED=false in env to leave unused while testing)
    const markUsed = process.env.MARK_VOUCHER_USED !== 'false';
    if (markUsed) {
      const { error: updateError } = await supabaseAdmin
        .from('vouchers')
        .update({ is_used: true })
        .eq('code', enteredCode)
        .eq('is_used', false);

      if (updateError) {
        console.log('Unlock Error:', updateError);
        // Still unlock if the row was valid — avoid locking users out on optional column issues
      }
    }

    const plan = planFromAmountIqd(voucher.amount_iqd);
    const durationDays = Number(plan.duration_days) || 7;
    const expiresAt = computePlanExpiresAt(durationDays);
    const limitUsd = Number(plan.credit_limit) || 0;
    const vipPoints = Math.round(limitUsd * 1000);

    const license = {
      key_code: voucher.code,
      plan_type: plan.plan_type || 'weekly_7d',
      duration_days: durationDays,
      expires_at: expiresAt,
      credits: durationDays,
      amount_iqd: voucher.amount_iqd,
      limit_usd: limitUsd,
      credit_limit_usd: limitUsd,
      vip_points_total: vipPoints,
      vip_points: vipPoints,
      source: 'voucher',
    };

    return NextResponse.json({
      ok: true,
      success: true,
      license,
      voucher: {
        code: voucher.code,
        amount_iqd: voucher.amount_iqd,
      },
    });
  } catch (error) {
    console.log('Unlock Error:', error);
    return NextResponse.json(
      { ok: false, success: false, error: error?.message || 'unlock_failed' },
      { status: 500 }
    );
  }
}
