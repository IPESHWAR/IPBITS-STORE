/**
 * Instant Telegram Confirm handler — no DB / OpenRouter required.
 * Used by both /api/telegram-webhook and /api/telegram/webhook.
 */
import {
  answerCallbackQuery,
  editTelegramMessage,
  getBotToken,
  getOrderReceiptUrl,
} from '@/lib/telegramApprove';

const TIER_PREFIXES = ['1D', '7D', '30D', '90D', '365D'];

const TIER_LABELS = {
  '1D': '1 Day / Trial',
  '7D': 'Weekly (7 Days)',
  '30D': 'Monthly (30 Days)',
  '90D': '3 Months (90 Days)',
  '365D': 'Annual (365 Days)',
};

export function isConfirmCallbackData(data) {
  const d = String(data || '');
  return (
    d.startsWith('confirm_order') ||
    d.startsWith('approve_order') ||
    d.startsWith('confirm:') ||
    d.startsWith('approve:') ||
    d === 'confirm_test' ||
    d.startsWith('confirm_test')
  );
}

function parseOrderAndTier(data) {
  const raw = String(data || '');
  let rest = '';
  if (raw.startsWith('confirm_order:')) rest = raw.slice('confirm_order:'.length);
  else if (raw.startsWith('approve_order:')) rest = raw.slice('approve_order:'.length);
  else if (raw.startsWith('confirm:')) rest = raw.slice('confirm:'.length);
  else if (raw.startsWith('approve:')) rest = raw.slice('approve:'.length);
  else rest = '';

  const segs = rest.split(':').filter(Boolean);
  let orderId = '';
  let tierParam = '';

  if (segs.length >= 2 && TIER_PREFIXES.includes(segs[1].toUpperCase().replace(/[^A-Z0-9]/g, ''))) {
    orderId = segs[0];
    tierParam = segs[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
  } else if (segs.length >= 1 && /^ord_/i.test(segs[0])) {
    orderId = segs[0];
    tierParam = (segs[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  } else if (segs.length === 1 && TIER_PREFIXES.includes(segs[0].toUpperCase())) {
    tierParam = segs[0].toUpperCase();
  } else if (segs[0]) {
    orderId = segs[0];
    tierParam = (segs[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  if (!orderId) orderId = `ord_${Date.now()}`;
  return { orderId, tierParam };
}

export function detectTierPrefix(tierParam, messageText) {
  const param = String(tierParam || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (TIER_PREFIXES.includes(param)) return param;

  const aliases = {
    TEST: '1D',
    TEST1D: '1D',
    TST: '1D',
    DAILY: '1D',
    WEEKLY: '7D',
    WK: '7D',
    MONTHLY: '30D',
    MO: '30D',
    '3M': '90D',
    QUARTERLY: '90D',
    YEARLY: '365D',
    YR: '365D',
    '1Y': '365D',
    ANNUAL: '365D',
  };
  if (aliases[param]) return aliases[param];

  const msg = String(messageText || '').toLowerCase();

  if (
    msg.includes('weekly') ||
    msg.includes('7 day') ||
    msg.includes('7d') ||
    msg.includes('هەفتانە') ||
    msg.includes('حەفتیانە')
  ) {
    return '7D';
  }
  if (
    msg.includes('annual') ||
    msg.includes('yearly') ||
    msg.includes('365 day') ||
    msg.includes('1 year') ||
    msg.includes('ساڵانە') ||
    msg.includes('سالانە')
  ) {
    return '365D';
  }
  if (
    msg.includes('3 month') ||
    msg.includes('90 day') ||
    msg.includes('90d') ||
    msg.includes('٣ مەهی') ||
    msg.includes('٣ مانگ')
  ) {
    return '90D';
  }
  if (
    msg.includes('monthly') ||
    msg.includes('30 day') ||
    msg.includes('30d') ||
    msg.includes('مانگانە') ||
    msg.includes('مەهانە') ||
    msg.includes('هەیڤانە')
  ) {
    return '30D';
  }
  if (
    msg.includes('تێست') ||
    msg.includes('تیست') ||
    msg.includes('trial') ||
    msg.includes('1 day') ||
    msg.includes('1d') ||
    msg.includes('daily')
  ) {
    return '1D';
  }

  return '7D';
}

export function generateInstantLicenseKey(tierPrefix = '7D') {
  const prefix = TIER_PREFIXES.includes(tierPrefix) ? tierPrefix : '7D';
  const rand = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IPBITS-${prefix}-${rand()}-${rand()}`;
}

async function sendPlainMessage(chatId, text, replyMarkup) {
  const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || chatId == null) return;
  const payload = { chat_id: chatId, text: String(text || '') };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.error('[telegramConfirmInstant] sendMessage failed:', err?.message || err);
  });
}

/**
 * Bulletproof confirm: answer → detect tier → generate key → reply.
 * Never throws to the caller for DB/auth issues.
 */
export async function handleInstantConfirmCallback(cq) {
  const data = String(cq?.data || '');
  const chatId = cq?.message?.chat?.id;
  const messageId = cq?.message?.message_id;
  const hasPhoto = !!(cq?.message?.photo && cq.message.photo.length);
  const msgText = String(cq?.message?.caption || cq?.message?.text || '');

  console.log('[telegramConfirmInstant] callback', {
    data,
    chatId: String(chatId || ''),
    messageId,
  });

  // 1) Acknowledge immediately
  try {
    if (cq?.id) {
      await answerCallbackQuery(cq.id, 'داخوازی هاتە پەسەندکرن', false);
    }
  } catch (err) {
    console.error('[telegramConfirmInstant] answerCallbackQuery:', err?.message || err);
  }

  try {
    const { orderId, tierParam } = parseOrderAndTier(data);
    const tierPrefix = detectTierPrefix(tierParam, msgText);
    const planLabel = TIER_LABELS[tierPrefix] || tierPrefix;
    const code = generateInstantLicenseKey(tierPrefix);

    console.log('[telegramConfirmInstant] key ready', { orderId, tierPrefix, code });

    const text =
      `✅ داخوازی هاتە پەسەندکرن!\n\n` +
      `🔑 کلیل: ${code}\n` +
      `📦 بەرهەم: ${planLabel}\n` +
      `🆔 ئۆردەر: ${orderId}\n\n` +
      `🖨 وەسڵ حازرە.`;

    const receiptUrl =
      getOrderReceiptUrl(orderId) || `https://www.ipbits.store/orders/${orderId}/receipt`;
    const replyMarkup = {
      inline_keyboard: [[{ text: '🖨 چاپکرنا وەسڵێ', url: receiptUrl }]],
    };

    // Strip confirm button (best effort)
    if (messageId && chatId != null) {
      try {
        await editTelegramMessage({
          chatId,
          messageId,
          isCaption: hasPhoto,
          text: `${msgText}\n\n━━━━━━━━━━━━━━━━━━━\n✅ هاتە پەسەندکرن`,
          replyMarkup: { inline_keyboard: [] },
        });
      } catch (err) {
        console.error('[telegramConfirmInstant] edit failed:', err?.message || err);
      }
    }

    await sendPlainMessage(chatId, text, replyMarkup);

    return { ok: true, code, orderId, tierPrefix };
  } catch (err) {
    console.error('[telegramConfirmInstant] fatal:', err);
    // Emergency: still try to send a key
    try {
      const tierPrefix = detectTierPrefix('', msgText);
      const code = generateInstantLicenseKey(tierPrefix);
      const orderId = `ord_${Date.now()}`;
      await sendPlainMessage(
        chatId,
        `✅ داخوازی هاتە پەسەندکرن!\n\n🔑 کلیل: ${code}\n📦 بەرهەم: ${TIER_LABELS[tierPrefix]}\n\n🖨 وەسڵ حازرە.`,
        {
          inline_keyboard: [
            [
              {
                text: '🖨 چاپکرنا وەسڵێ',
                url: `https://www.ipbits.store/orders/${orderId}/receipt`,
              },
            ],
          ],
        }
      );
      return { ok: true, code, emergency: true };
    } catch (err2) {
      console.error('[telegramConfirmInstant] emergency failed:', err2?.message || err2);
      return { ok: false, error: String(err?.message || err) };
    }
  }
}
