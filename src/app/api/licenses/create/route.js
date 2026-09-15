import { NextResponse } from 'next/server';
import { createAutomatedLicense } from '@/lib/openRouterProvisioning';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['test', 'weekly', 'monthly', '3months', 'yearly']);

function adminSecret() {
  return process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || '';
}

/**
 * POST { packageType: 'test'|'weekly'|'monthly'|'3months'|'yearly', phone?, name?, orderId? }
 * Header: x-admin-secret
 * Returns short license_code for the customer (hands-free OpenRouter provisioning).
 *
 * Note: inventory/vouchers APIs are unrelated — they manage digital SKU stock and wallet cards.
 * AI Hub unlock codes live in `licenses` (+ mirrored `license_keys` for legacy reads).
 */
export async function POST(req) {
  try {
    const secret = adminSecret();
    const provided = req.headers.get('x-admin-secret') || '';
    if (!secret || provided !== secret) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const packageType = String(body.packageType || body.package_type || body.plan || '')
      .trim()
      .toLowerCase();
    if (!ALLOWED.has(packageType) && packageType !== 'three_months') {
      return NextResponse.json(
        { ok: false, error: 'invalid_package_type', allowed: [...ALLOWED] },
        { status: 400 }
      );
    }

    const result = await createAutomatedLicense(
      packageType === 'three_months' ? '3months' : packageType,
      {
        customerPhone: body.phone || body.customerPhone,
        customerName: body.name || body.customerName,
        orderId: body.orderId || body.order_id,
      }
    );

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error || result.code, code: result.code },
        { status: result.code === 'missing_management_key' ? 503 : 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      license_code: result.license_code,
      key_code: result.license_code,
      package_type: result.package_type,
      duration_days: result.duration_days,
      credit_limit_usd: result.credit_limit_usd,
      expires_at: result.expires_at,
    });
  } catch (error) {
    console.error('createAutomatedLicense error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'failed' }, { status: 500 });
  }
}
