import { NextResponse } from 'next/server';
import { activateLicenseKey } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';

const ERROR_MESSAGES = {
  missing_key: 'هیڤیە کلیلێ بنڤیسە',
  invalid_key: 'ئەڤ کلیلە خەلەتە یان بوونی نینە',
  inactive_key: 'ئەڤ کلیلە نەچالاکە',
  expired_key: 'ئەڤ کلیلە بسەرچووە',
  phone_mismatch: 'ئەڤ کلیل بۆ ڤێ ژمارێ نینە',
};

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.key || body.code || body.license_code || body.licenseCode || '';
    const result = await activateLicenseKey({
      keyCode: raw,
      phone: body.phone ? normalizePhone(body.phone) : null,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: ERROR_MESSAGES[result.code] || 'Activation failed', code: result.code },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      license: result.license,
      key_code: result.license.key_code,
    });
  } catch (error) {
    console.error('Key activate error:', error);
    return NextResponse.json({ error: error.message || 'Activation failed' }, { status: 500 });
  }
}
