import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { normalizePhone } from '@/lib/orderValidation';

function approveSecret() {
  return process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || '';
}

async function fulfillOrder({ orderId, name, phone, items, planType, durationDays, planSuffix }) {
  const license = await generateLicenseForOrder({
    items: items || [],
    phone: phone ? normalizePhone(phone) : null,
    name: name ? String(name).trim() : null,
    planType,
    durationDays,
    planSuffix,
  });
  return { orderId: orderId || null, license };
}

async function answerTelegramCallback(callbackQueryId, text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !callbackQueryId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: String(text).slice(0, 180),
      show_alert: true,
    }),
  });
}

async function notifyTelegramApproved(chatId, messageId, license, customer) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;

  const text =
    `✅ *هاتە پەسەندکرن و چالاککرن*\n\n` +
    `👤 ${customer?.name || '—'}\n` +
    `📱 ${customer?.phone || '—'}\n` +
    `🔑 \`${license.key_code}\`\n` +
    `⏳ هەتا: ${license.expires_at || '—'}`;

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

      if (!data.startsWith('approve:')) {
        await answerTelegramCallback(cq.id, 'Unknown action');
        return NextResponse.json({ ok: true });
      }

      const payload = data.slice('approve:'.length);
      const [orderId, phone = '', name = '', planType = '', days = ''] = payload.split('|');

      try {
        const { license } = await fulfillOrder({
          orderId,
          phone: decodeURIComponent(phone),
          name: decodeURIComponent(name),
          planType: planType || undefined,
          durationDays: days ? Number(days) : undefined,
        });

        await answerTelegramCallback(cq.id, `✅ چالاک بوویە: ${license.key_code}`);
        await notifyTelegramApproved(chatId, messageId, license, {
          name: decodeURIComponent(name),
          phone: decodeURIComponent(phone),
        });
      } catch (err) {
        await answerTelegramCallback(cq.id, `❌ ${err.message || 'Failed'}`);
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
