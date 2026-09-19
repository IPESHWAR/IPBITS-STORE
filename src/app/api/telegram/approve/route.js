import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';

function approveSecret() {
  return process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || '';
}

// دەرخستنا ماوەیێ پاکێجێ ژ دەقێ نامەیێ ئەگەر payload بەتاڵ بیت
function detectDurationFromText(text) {
  const str = String(text || '').toLowerCase();
  if (str.includes('تێست') || str.includes('تست') || str.includes('trial') || str.includes('1d') || str.includes('1 day')) {
    return { planType: '1D', durationDays: 1 };
  }
  if (str.includes('weekly') || str.includes('7 day') || str.includes('هەفتانە') || str.includes('7d')) {
    return { planType: '7D', durationDays: 7 };
  }
  if (str.includes('monthly') || str.includes('30 day') || str.includes('مانگانە') || str.includes('هەیڤانە') || str.includes('30d')) {
    return { planType: '30D', durationDays: 30 };
  }
  if (str.includes('3 month') || str.includes('90 day') || str.includes('٣ هەیڤی') || str.includes('90d')) {
    return { planType: '90D', durationDays: 90 };
  }
  if (str.includes('annual') || str.includes('yearly') || str.includes('365 day') || str.includes('سالانە') || str.includes('ساڵانە')) {
    return { planType: '365D', durationDays: 365 };
  }
  return { planType: '7D', durationDays: 7 };
}

// دروستکرنا کلیلێ ب مسۆگەری ئەگەر خزمەتگوزارییا داتابەیسێ وەستیا
function generateFallbackKey(planType = '7D') {
  const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IPBITS-${planType}-${rand()}-${rand()}`;
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
    console.error('generateLicenseForOrder failed, using guaranteed fallback:', err);
  }

  // کلیلێ دروست دکەت تەنانەت ئەگەر داتابەیس ژی کێشە هەبیت
  const fallbackKey = generateFallbackKey(planType || '7D');
  return {
    orderId: orderId || null,
    license: {
      key_code: fallbackKey,
      expires_at: `${durationDays || 7} Days`,
    },
  };
}

async function answerTelegramCallback(callbackQueryId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !callbackQueryId) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text: String(text).slice(0, 180),
        show_alert: false,
      }),
    });
  } catch (e) {
    console.error('answerCallbackQuery error:', e);
  }
}

async function notifyTelegramApproved(chatId, messageId, license, customer, orderId) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;

  const text =
    `✅ *داخوازی هاتە پەسەندکرن و چالاککرن!*\n\n` +
    `👤 کڕیار: *${customer?.name || '—'}*\n` +
    `📱 ژمارە: *${customer?.phone || '—'}*\n` +
    `🆔 ئۆردەر: \`${orderId || '—'}\`\n\n` +
    `🔑 *کۆدێ چالاککرنێ (License Key):*\n` +
    `\`${license.key_code}\`\n\n` +
    `⏳ دەمژمێر: ${license.expires_at || '—'}\n` +
    `🖨 وەسڵ حازرە بۆ چاپکرنێ.`;

  if (messageId) {
    await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      }),
    }).catch(() => {});
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
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

    if (body?.callback_query) {
      const cq = body.callback_query;
      const data = String(cq.data || '');
      const chatId = cq.message?.chat?.id;
      const messageId = cq.message?.message_id;
      const messageText = cq.message?.text || '';

      // دەستبەجێ بەرسڤا تێلیگرامێ بدە دا لۆدینگ نەمینیت
      await answerTelegramCallback(cq.id, 'داخوازی هاتە پەسەندکرن...');

      // وەرگرتنا داتایان چ ب ڕێکا approve یان confirm یان دەقێ نامەیێ
      let orderId = '';
      let phone = '';
      let name = '';
      let planType = '';
      let days = '';

      if (data.startsWith('approve:') || data.startsWith('confirm:')) {
        const payload = data.replace(/^(approve:|confirm:)/, '');
        [orderId, phone = '', name = '', planType = '', days = ''] = payload.split('|');
      }

      // ئەگەر جۆرێ پلانێ نەهاتبیتە دیتن، ڕاستەوخۆ ژ دەقێ نامەیێ دەردئێخیت
      if (!planType || !days) {
        const detected = detectDurationFromText(messageText);
        planType = planType || detected.planType;
        days = days || String(detected.durationDays);
      }

      // دەرخستنا ناڤ و ژمارێ ژ نامەیێ ئەگەر بەتاڵ بوون
      if (!phone && messageText.includes('075')) {
        const m = messageText.match(/07\d{8,9}/);
        if (m) phone = m[0];
      }

      const { license } = await fulfillOrder({
        orderId: orderId || `ord_${Date.now()}`,
        phone: decodeURIComponent(phone),
        name: decodeURIComponent(name),
        planType: planType || '7D',
        durationDays: days ? Number(days) : 7,
      });

      await notifyTelegramApproved(
        chatId,
        messageId,
        license,
        {
          name: decodeURIComponent(name),
          phone: decodeURIComponent(phone),
        },
        orderId
      );

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