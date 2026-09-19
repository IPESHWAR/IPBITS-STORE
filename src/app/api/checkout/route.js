import { NextResponse } from 'next/server';
import {
  classifyOrderKind,
  getAdminChatId,
  getBotToken,
  inferAiTier,
} from '@/lib/telegramApprove';
import { validateOrderPayload, normalizePhone } from '@/lib/orderValidation';
import { createClient } from '@supabase/supabase-js';
import { resolveSubscriptionPlan } from '@/config/plans';

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz6cPrMaQLa-3W5opaOCN8Scq5DS-OBUIM1wIzjS7oVS9JYk9EdGvYvLY-EWgCjb7j3/exec';

function makeOrderId() {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function buildCaption({
  name,
  phone,
  itemsFormatted,
  finalIQD,
  totalUSD,
  paymentMethod,
  transactionId,
  note,
  orderId,
  kind,
  planSuffix,
}) {
  const kindLabel = kind === 'ai' ? 'AI Hub' : 'Account Service';
  const usdLine =
    Number(totalUSD) > 0 ? `\n💵 USD: $${Number(totalUSD).toFixed(2)}` : '';
  const planLine = planSuffix ? `\n🏷 پلان: ${planSuffix}` : '';
  return (
    `🛍 داخوازیەکا نوی گەهشت! (IPBITS STORE)\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `🏷 جۆر: ${kindLabel}` +
    planLine +
    `\n` +
    `👤 کڕیار: ${name || 'نەدیار'}\n` +
    `📞 واتساپ: ${phone || 'نینە'}\n` +
    `💳 ڕێکا پارەدانێ: ${paymentMethod || 'نەدیار'}\n` +
    `💰 کۆژمێ گشتی: IQD ${Number(finalIQD || 0).toLocaleString('en-US')}` +
    usdLine +
    `\n` +
    `📦 بەرهەم: ${itemsFormatted || '—'}\n` +
    `🔢 کۆدێ وەسڵی: ${transactionId || 'نینە'}` +
    (note ? `\n📝 تێبینی: ${note}` : '') +
    `\n━━━━━━━━━━━━━━━━━━━`
  );
}

async function dispatchTelegram({ botToken, chatId, caption, image, orderId, planId }) {
  const targetChatId = '5305335340';
  const id = String(orderId || '').slice(0, 40);
  const planTag = planId
    ? String(planId)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8)
    : '';
  // Keep under Telegram's 64-byte callback_data limit.
  // Account services omit plan tag so confirm does not force AI key generation.
  const callbackData = (planTag ? `confirm_order:${id}:${planTag}` : `confirm_order:${id}`).slice(
    0,
    64
  );

  const keyboardObj = {
    inline_keyboard: [
      [
        {
          text: '✅ پەسەندکرن (Confirm)',
          callback_data: callbackData,
        },
      ],
    ],
  };
  let res;
  if (image?.base64) {
    const buffer = Buffer.from(image.base64, 'base64');
    const formData = new FormData();
    formData.append('chat_id', String(targetChatId));
    formData.append('caption', caption);
    formData.append('photo', new Blob([buffer], { type: image.type || 'image/jpeg' }), 'receipt.jpg');
    formData.append('reply_markup', JSON.stringify(keyboardObj));
    res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
  } else {
    res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(targetChatId),
        text: caption,
        reply_markup: keyboardObj,
      }),
    });
  }

  const tgResText = await res.text();
  console.log('=== TELEGRAM API RESPONSE ===', res.status, tgResText);
  return { ok: res.ok, status: res.status, text: tgResText };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      phone,
      note,
      email,
      items,
      totalIQD,
      totalPrice,
      totalUSD,
      paymentMethod,
      transactionId,
      image,
    } = body;

    const finalIQD = Number(totalIQD || totalPrice || 0);
    const cleanPhone = phone ? normalizePhone(phone) : '';
    const customerName = String(name || '').trim();
    const customerNote = String(note || email || '').trim();
    const itemsFormatted = Array.isArray(items)
      ? items.map((i) => `${i.name || i.title || 'بەرهەم'} (x${i.quantity || 1})`).join(', ')
      : String(items || '');

    const validation = validateOrderPayload({
      name: customerName,
      phone: cleanPhone,
      totalIQD: finalIQD,
      items,
      paymentMethod,
    });

    if (!validation.ok) {
      return NextResponse.json({ success: false, code: validation.code, error: validation.code }, { status: 400 });
    }

    const orderId = makeOrderId();
    const { kind } = classifyOrderKind(items, itemsFormatted, finalIQD);
    const tier = kind === 'ai' ? inferAiTier(items, finalIQD, itemsFormatted) : 'daily';
    const plan = resolveSubscriptionPlan(
      tier === 'daily' ? 'test' : tier === '3months' ? 'three_months' : tier
    );

    const supabase = getSupabaseAdmin();
    if (supabase) {
      const baseOrderData = {
        id: orderId,
        phone: cleanPhone,
        status: 'pending',
      };
      // Try comprehensive insert first
      const fullPayload = {
        ...baseOrderData,
        customer_name: customerName,
        customer_phone: cleanPhone,
        items: Array.isArray(items) ? items : [{ name: itemsFormatted }],
        items_label: itemsFormatted,
        total_iqd: finalIQD,
        total_usd: Number(totalUSD) || 0,
        payment_method: paymentMethod || null,
        transaction_id: String(transactionId || '').trim() || null,
        plan_type: kind === 'ai' ? (plan?.plan_type || 'test_1d') : 'account_service',
        duration_days: kind === 'ai' ? (plan?.duration_days || 1) : null,
      };
      let { error: insertErr } = await supabase.from('orders').insert(fullPayload);

      // If failed due to extra column mismatch, fallback to minimal safe schema
      if (insertErr) {
        console.warn('Retrying with minimal order schema due to:', insertErr.message);
        const { error: retryErr } = await supabase.from('orders').insert({
          id: orderId,
          phone: cleanPhone,
          status: 'pending',
        });
        if (retryErr) {
          console.error('Critical: minimal order insert also failed:', retryErr.message);
        }
      }
    }

    const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = getAdminChatId() || process.env.TELEGRAM_CHAT_ID;
    const caption = buildCaption({
      name: customerName,
      phone: cleanPhone,
      itemsFormatted,
      finalIQD,
      totalUSD: Number(totalUSD) || 0,
      paymentMethod,
      transactionId: String(transactionId || '').trim() || 'نینە',
      note: customerNote,
      orderId,
      kind,
      planSuffix: kind === 'ai' ? plan?.plan_suffix || '1D' : '',
    });

    let telegramOk = false;
    if (botToken && chatId) {
      try {
        const tgRes = await dispatchTelegram({
          botToken,
          chatId,
          caption,
          image,
          orderId,
          planId: kind === 'ai' ? plan?.plan_suffix || '1D' : undefined,
        });
        telegramOk = tgRes.ok;
        if (!tgRes.ok) {
          console.error('Telegram dispatch failed:', tgRes.status, tgRes.text);
        } else if (supabase) {
          let tgJson = {};
          try {
            tgJson = JSON.parse(tgRes.text || '{}');
          } catch {
            tgJson = {};
          }
          const msgId = tgJson?.result?.message_id;
          if (msgId) {
            await supabase
              .from('orders')
              .update({
                telegram_chat_id: String(chatId),
                telegram_message_id: msgId,
                updated_at: new Date().toISOString(),
              })
              .eq('id', orderId);
          }
        }
      } catch (tgErr) {
        console.error('Telegram Error:', tgErr);
      }
    } else {
      console.error('Telegram env missing: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID');
    }

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          name: customerName,
          phone: cleanPhone,
          note: customerNote,
          items: itemsFormatted,
          totalIQD: finalIQD,
          totalUSD: totalUSD || '',
          paymentMethod: paymentMethod || 'نەدیار',
          transactionId: transactionId || 'نینە',
          orderId,
          kind,
          image: image || null,
        }),
        redirect: 'follow',
      });
    } catch (sheetErr) {
      console.error('Google Sheet Error:', sheetErr);
    }

    return NextResponse.json(
      {
        success: true,
        telegramOk,
        orderId,
        kind,
        message: 'داخوازی ب سەرکەفتیانە گەهشت',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Checkout Route Error:', error);
    return NextResponse.json({ error: error.message || 'server_error' }, { status: 500 });
  }
}
