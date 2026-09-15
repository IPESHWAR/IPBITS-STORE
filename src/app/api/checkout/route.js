import { NextResponse } from 'next/server';
import { getAdminChatId, getBotToken } from '@/lib/telegramApprove';
import { validateOrderPayload, normalizePhone } from '@/lib/orderValidation';

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbz6cPrMaQLa-3W5opaOCN8Scq5DS-OBUIM1wIzjS7oVS9JYk9EdGvYvLY-EWgCjb7j3/exec';

function toWhatsAppDigits(phone) {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  if (/^07[3-9]\d{8}$/.test(digits)) return `964${digits.slice(1)}`;
  return digits.replace(/\D/g, '');
}

function buildCaption({ name, phone, itemsFormatted, finalIQD, paymentMethod, transactionId, note }) {
  return (
    `🛍 داخوازیەکا نوی گەهشت! (IPBITS STORE)\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `👤 کڕیار: ${name || 'نەدیار'}\n` +
    `📞 واتساپ: ${phone || 'نینە'}\n` +
    `💳 ڕێکا پارەدانێ: ${paymentMethod || 'نەدیار'}\n` +
    `💰 کۆژمێ گشتی: IQD ${Number(finalIQD || 0).toLocaleString()}\n` +
    `📦 بەرهەم: ${itemsFormatted || '—'}\n` +
    `🔢 کۆدێ وەسڵی: ${transactionId || 'نینە'}` +
    (note ? `\n📝 تێبینی: ${note}` : '') +
    `\n━━━━━━━━━━━━━━━━━━━`
  );
}

async function dispatchTelegram({ botToken, chatId, caption, image, replyMarkup }) {
  if (image?.base64) {
    const buffer = Buffer.from(image.base64, 'base64');
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    formData.append('photo', new Blob([buffer], { type: image.type || 'image/jpeg' }), 'receipt.jpg');
    if (replyMarkup) formData.append('reply_markup', JSON.stringify(replyMarkup));
    return fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
  }

  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: caption,
      reply_markup: replyMarkup,
    }),
  });
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

    const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = getAdminChatId() || process.env.TELEGRAM_CHAT_ID;
    const caption = buildCaption({
      name: customerName,
      phone: cleanPhone,
      itemsFormatted,
      finalIQD,
      paymentMethod,
      transactionId: String(transactionId || '').trim() || 'نینە',
      note: customerNote,
    });

    const waDigits = toWhatsAppDigits(cleanPhone);
    const waUrl = `https://wa.me/${waDigits}?text=${encodeURIComponent('سڵاو، داخوازییا تە گەهشت ژ IPBITS STORE')}`;
    const replyMarkup = waDigits
      ? {
          inline_keyboard: [[{ text: '💬 واتساپ — پەیوەندی ب کڕیاری', url: waUrl }]],
        }
      : undefined;

    let telegramOk = false;
    if (botToken && chatId) {
      try {
        const tgRes = await dispatchTelegram({
          botToken,
          chatId,
          caption,
          image,
          replyMarkup,
        });
        telegramOk = tgRes.ok;
        if (!tgRes.ok) {
          const errText = await tgRes.text().catch(() => '');
          console.error('Telegram dispatch failed:', tgRes.status, errText);
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
        message: 'داخوازی ب سەرکەفتیانە گەهشت',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Checkout Route Error:', error);
    return NextResponse.json({ error: error.message || 'server_error' }, { status: 500 });
  }
}
