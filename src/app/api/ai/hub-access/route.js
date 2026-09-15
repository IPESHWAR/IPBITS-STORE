import { NextResponse } from 'next/server';
import { resolveAiHubAccess, tokenFromLicense, verifyAiHubToken } from '@/lib/aiHubAccess';

const INVALID_MSG = 'ئەڤ کلیلە نەیا دروستە یان دەمێ وێ ب سەرڤە چوویە. هیڤیە پشتڕاست ببە.';

export async function GET(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const payload = verifyAiHubToken(auth);
    if (!payload) {
      return NextResponse.json({ ok: false, subscribed: false }, { status: 401 });
    }

    const fromToken = {
      key_code: payload.k,
      customer_phone: payload.p,
      expires_at: payload.exp,
      plan_type: 'ai_hub',
    };

    for (const identifier of [payload.k, payload.p].filter(Boolean)) {
      const live = await resolveAiHubAccess(identifier);
      if (live.ok) {
        return NextResponse.json({
          ok: true,
          subscribed: true,
          token,
          license: live.license,
          expires_at: live.license.expires_at,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      subscribed: true,
      token,
      license: fromToken,
      expires_at: payload.exp,
    });
  } catch {
    return NextResponse.json({ ok: false, subscribed: false }, { status: 401 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String(body.key || body.phone || body.identifier || '').trim();
    const result = await resolveAiHubAccess(identifier);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: INVALID_MSG, code: result.code }, { status: 400 });
    }

    const issued = tokenFromLicense(result.license);
    return NextResponse.json({
      ok: true,
      token: issued.token,
      license: issued.license,
      expires_at: issued.expires_at,
    });
  } catch {
    return NextResponse.json({ ok: false, error: INVALID_MSG, code: 'invalid_or_expired' }, { status: 400 });
  }
}
