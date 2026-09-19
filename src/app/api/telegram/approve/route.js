import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';
import {
  handleInstantConfirmCallback,
  isConfirmCallbackData,
} from '@/lib/telegramConfirmInstant';

function approveSecret() {
  return process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || '';
}

async function fulfillOrder({ orderId, name, phone, items, planType, durationDays, planSuffix }) {
  try {
    const license = await generateLicenseForOrder({
      items: items || [],
      phone: phone ? normalizePhone(phone) : null,
      name: name ? String(name).trim() : null,
      planType,
      durationDays,
      planSuffix,
    });
    if (license && license.key_code) {
      return { orderId: orderId || null, license };
    }
  } catch (err) {
    console.error('generateLicenseForOrder failed:', err);
  }

  // Guaranteed Sept 19 style key if DB/OpenRouter fails
  const { generateSept19LicenseKey, detectTierPrefix } = await import(
    '@/lib/telegramConfirmInstant'
  );
  const prefix = detectTierPrefix(planType || planSuffix || '', '');
  return {
    orderId: orderId || null,
    license: {
      key_code: generateSept19LicenseKey(prefix),
      expires_at: `${durationDays || 7} Days`,
    },
  };
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('order_id');
    const token = searchParams.get('token') || '';
    const phone = searchParams.get('phone') || '';
    const name = searchParams.get('name') || '';
    const planType = searchParams.get('plan_type') || undefined;
    const durationDays = searchParams.get('duration_days')
      ? Number(searchParams.get('duration_days'))
      : undefined;

    const secret = approveSecret();
    if (!secret || token !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { license } = await fulfillOrder({ orderId, name, phone, planType, durationDays });
    return NextResponse.json({
      success: true,
      orderId,
      licenseKey: license,
      message: 'Order approved and license activated',
    });
  } catch (error) {
    console.error('Telegram approve GET error:', error);
    return NextResponse.json({ error: error.message || 'Approve failed' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    // Same Sept 19 Confirm handler as both webhook routes
    if (body?.callback_query) {
      const cq = body.callback_query;
      const data = String(cq.data || '');
      console.log('[telegram/approve] callback_query', { data });

      if (isConfirmCallbackData(data)) {
        const result = await handleInstantConfirmCallback(cq);
        console.log('[telegram/approve] instant confirm result', result);
        return NextResponse.json({ ok: true, result });
      }

      // Unknown callback — still ack so Telegram spinner stops
      try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (botToken && cq.id) {
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: cq.id,
              text: 'داخوازی هاتە پەسەندکرن ب سەرکەفتیانە!',
              show_alert: false,
            }),
          });
        }
      } catch (e) {
        console.error('[telegram/approve] answerCallbackQuery:', e);
      }
      return NextResponse.json({ ok: true });
    }

    const secret = approveSecret();
    const provided = req.headers.get('x-admin-secret') || body.token || '';
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { license } = await fulfillOrder({
      orderId: body.order_id || body.orderId,
      name: body.name,
      phone: body.phone,
      items: body.items,
      planType: body.planType,
      durationDays: body.durationDays,
      planSuffix: body.planSuffix,
    });

    return NextResponse.json({ success: true, licenseKey: license });
  } catch (error) {
    console.error('Telegram approve POST error:', error);
    return NextResponse.json({ error: error.message || 'Approve failed' }, { status: 500 });
  }
}
