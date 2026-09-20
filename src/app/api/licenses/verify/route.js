import { NextResponse } from 'next/server';
import { activateLicenseKey } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ERROR_MESSAGES = {
  missing_key: 'هیڤیە کلیلێ بنڤیسە',
  invalid_key: 'ئەڤ کلیلە خەلەتە یان بوونی نینە',
  inactive_key: 'ئەڤ کلیلە نەچالاکە',
  expired_key: 'ئەڤ کلیلە بسەرچووە',
  phone_mismatch: 'ئەڤ کلیل بۆ ڤێ ژمارێ نینە',
  device_limit:
    'ئەڤ کلیلە گەهشتییە زۆرترین ڕێژەیا ئامیرێن ڕێگەپێدای بۆ ڤێ بەشداریکردنێ!',
};

/**
 * Verify / activate a customer license code.
 * Accepts: { key | code | license_code | licenseCode, deviceId? }
 * Looks up license_keys.key_code and licenses.license_code (case-insensitive).
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const raw =
      body.key ||
      body.code ||
      body.license_code ||
      body.licenseCode ||
      body.identifier ||
      '';

    const result = await activateLicenseKey({
      keyCode: raw,
      phone: body.phone ? normalizePhone(body.phone) : null,
      deviceId: body.deviceId || body.device_id || null,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          success: false,
          error:
            result.message ||
            ERROR_MESSAGES[result.code] ||
            'Activation failed',
          code: result.code,
          max_devices: result.max_devices,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      license: result.license,
      key_code: result.license.key_code,
    });
  } catch (error) {
    console.error('License verify error:', error);
    return NextResponse.json(
      { ok: false, success: false, error: error.message || 'Activation failed' },
      { status: 500 }
    );
  }
}
