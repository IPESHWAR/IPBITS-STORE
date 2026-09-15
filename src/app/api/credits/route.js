import { NextResponse } from 'next/server';
import { verifyAiHubToken } from '@/lib/aiHubAccess';
import { resolveProvisionedOpenRouterKey } from '@/lib/openRouterProvisioning';
import { normalizeWalletId } from '@/lib/wallet';

/**
 * Live usage for the subscriber's allocated OpenRouter sub-key.
 * Never accepts a client-supplied OpenRouter secret.
 */
export async function GET(req) {
  try {
    const hub = verifyAiHubToken(req.headers.get('authorization') || '');
    const phone = normalizeWalletId(req.nextUrl.searchParams.get('phone') || hub?.p || '');
    const licenseKey = req.nextUrl.searchParams.get('key') || hub?.k || '';

    const provisioned = await resolveProvisionedOpenRouterKey({ phone, licenseKey });
    const activeApiKey = provisioned?.apiKey || process.env.OPENROUTER_API_KEY || '';

    if (!activeApiKey) {
      return NextResponse.json({ error: 'no_key' }, { status: 400 });
    }

    const keyRes = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${activeApiKey}` },
      cache: 'no-store',
    });
    const keyJson = await keyRes.json().catch(() => ({}));
    if (!keyRes.ok) {
      return NextResponse.json(
        { error: keyJson?.error?.message || 'credits_failed' },
        { status: keyRes.status }
      );
    }

    const keyData = keyJson?.data || {};
    const limit = Number(keyData.limit ?? provisioned?.creditLimitUsd ?? 0);
    const usage = Number(keyData.usage ?? 0);
    const remaining =
      typeof keyData.limit_remaining === 'number'
        ? Math.max(0, keyData.limit_remaining)
        : Math.max(0, limit - usage);

    return NextResponse.json({
      total_credits: limit,
      total_usage: usage,
      remaining,
      allocated: Boolean(provisioned?.apiKey),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'credits_failed' }, { status: 500 });
  }
}
