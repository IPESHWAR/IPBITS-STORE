/**
 * September 19 style Telegram Confirm — shared by all webhook endpoints.
 * Format: IPBITS-{1D|7D|30D|90D|365D}-{8CHARS}
 */
import { generateLicenseKey } from '@/lib/generateKey';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getBotToken,
} from '@/lib/telegramApprove';

const TIER_PREFIXES = ['1D', '7D', '30D', '90D', '365D'];

const DEFAULT_NAME = 'pshwar farhad';
const DEFAULT_PHONE = '07504060378';

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

  if (segs.length >= 2) {
    orderId = segs[0];
    tierParam = segs[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
  } else if (segs[0]) {
    if (TIER_PREFIXES.includes(segs[0].toUpperCase())) {
      tierParam = segs[0].toUpperCase();
    } else {
      orderId = segs[0];
    }
  }

  if (!orderId) orderId = `ord_${Date.now()}`;
  return { orderId, tierParam };
}

/** Parse duration → 1D / 7D / 30D / 90D / 365D (default 7D). */
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
    TRIAL: '1D',
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

  const msg = String(messageText || '')
    .normalize('NFC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();

  // Weekly first (English storefront: "Weekly (7 Days)")
  if (
    /هەفتانە|حەفتیانە|هفتانه|weekly|\b7\s*days?\b|\b7d\b|7_days/.test(msg)
  ) {
    return '7D';
  }
  // Yearly before monthly
  if (
    /ساڵانە|سالانە|yearly|annual|\b365\s*days?\b|\b365d\b|\b1\s*year\b|\b1y\b/.test(msg)
  ) {
    return '365D';
  }
  if (/٣\s*مەهی|٣\s*مانگ|٣\s*هەیڤ|3\s*months?|\b90\s*days?\b|\b90d\b/.test(msg)) {
    return '90D';
  }
  if (
    /مەهانە|مانگانە|هەیڤانە|monthly|\b30\s*days?\b|\b30d\b|30_days/.test(msg)
  ) {
    return '30D';
  }
  if (
    /تێست|تیست|تست|trial|\b1\s*day\b|\b1d\b|daily|test_1d|1_day/.test(msg)
  ) {
    return '1D';
  }

  return '7D';
}

/** Sept 19 format: IPBITS-7D-4DSV7H5D (8 random chars). */
export function generateSept19LicenseKey(tierPrefix = '7D') {
  try {
    return generateLicenseKey(tierPrefix || '7D');
  } catch (err) {
    console.error('[telegramConfirmInstant] generateLicenseKey failed:', err?.message || err);
    const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let rand8 = '';
    for (let i = 0; i < 8; i += 1) {
      rand8 += charset[Math.floor(Math.random() * charset.length)];
    }
    const prefix = TIER_PREFIXES.includes(tierPrefix) ? tierPrefix : '7D';
    return `IPBITS-${prefix}-${rand8}`;
  }
}

function extractCustomer(messageText) {
  const raw = String(messageText || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch =
    raw.match(/📞\s*واتساپ:\s*(.+)/) ||
    raw.match(/(07[3-9]\d{8})/) ||
    raw.match(/(\+?9647[3-9]\d{8})/);

  let name = String(nameMatch?.[1] || '')
    .trim()
    .split('\n')[0]
    .trim();
  let phone = String(phoneMatch?.[1] || phoneMatch?.[0] || '')
    .trim()
    .split('\n')[0]
    .trim();

  if (!name || name === 'نەدیار' || name === '—') name = DEFAULT_NAME;
  if (!phone || phone === 'نینە' || phone === '—') phone = DEFAULT_PHONE;

  return { name, phone };
}

function buildSept19Message({ keyCode, name, phone }) {
  return (
    `✅ ئۆردەر هاتە پەسەندکرن ب سەرکەفتیانە!\n` +
    `🔑 کلیلا دروستکری:\n` +
    `\`${keyCode}\`\n` +
    `👤 بۆ: ${name} (${phone})`
  );
}

async function sendPlainMessage(chatId, text) {
  const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || chatId == null) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text || ''),
    }),
  }).catch((err) => {
    console.error('[telegramConfirmInstant] sendMessage failed:', err?.message || err);
  });
}

/**
 * Exact Sept 19 confirm flow. Never depends on DB.
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
      await answerCallbackQuery(cq.id, 'داخوازی هاتە پەسەندکرن ب سەرکەفتیانە!', false);
    }
  } catch (err) {
    console.error('[telegramConfirmInstant] answerCallbackQuery:', err?.message || err);
  }

  try {
    const { orderId, tierParam } = parseOrderAndTier(data);
    const tierPrefix = detectTierPrefix(tierParam, msgText);
    const { name, phone } = extractCustomer(msgText);
    const code = generateSept19LicenseKey(tierPrefix);

    console.log('[telegramConfirmInstant] key ready', {
      orderId,
      tierPrefix,
      code,
      name,
      phone,
    });

    // Strip Confirm button so it cannot be clicked twice
    if (messageId && chatId != null) {
      try {
        await editTelegramMessage({
          chatId,
          messageId,
          isCaption: hasPhoto,
          text: `${msgText}\n\n━━━━━━━━━━━━━━━━━━━\n✅ هاتە پەسەندکرن ب سەرکەفتیانە`,
          replyMarkup: { inline_keyboard: [] },
        });
      } catch (err) {
        console.error('[telegramConfirmInstant] edit failed:', err?.message || err);
      }
    }

    // Exact Sept 19 confirmation reply (key always sent even if DB would fail)
    await sendPlainMessage(
      chatId,
      buildSept19Message({ keyCode: code, name, phone })
    );

    return { ok: true, code, orderId, tierPrefix, name, phone };
  } catch (err) {
    console.error('[telegramConfirmInstant] fatal:', err);
    try {
      const tierPrefix = detectTierPrefix('', msgText);
      const code = generateSept19LicenseKey(tierPrefix);
      const { name, phone } = extractCustomer(msgText);
      await sendPlainMessage(chatId, buildSept19Message({ keyCode: code, name, phone }));
      return { ok: true, code, emergency: true };
    } catch (err2) {
      console.error('[telegramConfirmInstant] emergency failed:', err2?.message || err2);
      return { ok: false, error: String(err?.message || err) };
    }
  }
}
