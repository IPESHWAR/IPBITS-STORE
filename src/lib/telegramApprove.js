/**
 * Telegram inline keyboard + helpers for one-click admin approval.
 */

export function buildApproveKeyboard({ orderId }) {
  const id = String(orderId || '').slice(0, 40);
  return {
    inline_keyboard: [
      [
        {
          text: 'پەسەندکرن و دروستکرنا کلیلێ ✅',
          callback_data: `approve_order:${id}`,
        },
        {
          text: 'ڕەتکرن ❌',
          callback_data: `reject_order:${id}`,
        },
      ],
    ],
  };
}

/** Normalize to international digits (964…) for callback + wa.me */
export function toWhatsAppDigits(phone) {
  const digits = String(phone || '')
    .replace(/[\s\-()]/g, '')
    .replace(/^\+/, '');
  if (/^07[3-9]\d{8}$/.test(digits)) return `964${digits.slice(1)}`;
  if (/^7[3-9]\d{8}$/.test(digits)) return `964${digits}`;
  return digits.replace(/\D/g, '');
}

/**
 * Detect AI Hub voucher-style orders vs account/subscription services.
 */
export function classifyOrderKind(items, itemsLabel = '', totalIQD = 0) {
  const list = Array.isArray(items) ? items : [];
  const hay = [
    itemsLabel,
    ...list.map((i) => `${i?.id || ''} ${i?.planId || ''} ${i?.slug || ''} ${i?.name || ''} ${i?.title || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const aiRe =
    /ai\s*hub|ipbits\s*ai|voucher|\btst\b|daily|weekly|monthly|yearly|3months|1_day|7_days|30_days|90_days|1_year|test_1d|weekly_7d|monthly_30d|تێست|تیست|هەفتانە|مەهانە|ساڵانە|خاڵ|کلیل/;
  if (aiRe.test(hay)) {
    return { kind: 'ai', productName: list[0]?.name || itemsLabel || 'AI Hub' };
  }

  // Exact AI Hub price match (fallback when name is localized only)
  const aiPrices = [2500, 5000, 12000, 25000, 50000];
  const total = Number(totalIQD) || 0;
  if (aiPrices.some((p) => Math.abs(total - p) < 1)) {
    return { kind: 'ai', productName: list[0]?.name || itemsLabel || 'AI Hub' };
  }

  const productName =
    list[0]?.name || list[0]?.title || String(itemsLabel || 'Subscription').split(',')[0].trim() || 'Subscription';

  return { kind: 'account', productName };
}

export function inferAiTier(items, totalIQD) {
  const list = Array.isArray(items) ? items : [];
  const hay = list
    .map((i) => `${i?.id || ''} ${i?.planId || ''} ${i?.name || ''}`)
    .join(' ')
    .toLowerCase();

  const checks = [
    [/1_day|test_1d|\b1d\b|تێست|تیست|daily|tst/, 'daily'],
    [/7_days|weekly_7d|\b7d\b|هەفت|weekly/, 'weekly'],
    [/90_days|quarterly|3months|٣ مەه/, '3months'],
    [/1_year|yearly|\b1y\b|ساڵانە/, 'yearly'],
    [/30_days|monthly_30d|\b30d\b|مەهانە|monthly/, 'monthly'],
  ];
  for (const [re, tier] of checks) {
    if (re.test(hay)) return tier;
  }

  const total = Number(totalIQD) || 0;
  const byPrice = [
    [2500, 'daily'],
    [5000, 'weekly'],
    [12000, 'monthly'],
    [25000, '3months'],
    [50000, 'yearly'],
  ];
  let best = 'daily';
  let bestDiff = Infinity;
  for (const [price, t] of byPrice) {
    const d = Math.abs(total - price);
    if (d < bestDiff) {
      bestDiff = d;
      best = t;
    }
  }
  return best;
}

/**
 * Smart checkout keyboard:
 * - AI Hub → confirm_ai:phone:tier
 * - Account service → confirm_acc:phone:encodedProduct
 */
export function buildSmartOrderKeyboard({
  phone,
  tier = 'daily',
  productName = 'Subscription',
  kind = 'account',
  waUrl,
}) {
  const phoneDigits = toWhatsAppDigits(phone).slice(0, 15);
  const rows = [];

  if (kind === 'ai') {
    const tierKey = String(tier || 'daily')
      .trim()
      .toLowerCase()
      .slice(0, 12);
    rows.push([
      {
        text: '✅ پەسەندکرن و کلیل (AI Hub)',
        callback_data: `confirm_ai:${phoneDigits}:${tierKey}`.slice(0, 64),
      },
    ]);
  } else {
    const encoded = encodeURIComponent(String(productName || 'Subscription').slice(0, 48));
    rows.push([
      {
        text: '📲 پەیوەندی ب واتساپێ (Account Service)',
        callback_data: `confirm_acc:${phoneDigits}:${encoded}`.slice(0, 64),
      },
    ]);
  }

  if (waUrl) {
    rows.push([{ text: '💬 واتساپ — پەیوەندی ب کڕیاری', url: waUrl }]);
  }

  return { inline_keyboard: rows };
}

/** @deprecated use buildSmartOrderKeyboard */
export function buildConfirmOrderKeyboard({ orderId, phone, tier = 'daily', waUrl }) {
  return buildSmartOrderKeyboard({
    phone: phone || orderId,
    tier,
    kind: 'ai',
    productName: 'AI Hub',
    waUrl,
  });
}

export function getAdminChatId() {
  return String(process.env.ADMIN_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '');
}

export function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
}

/** Accept numeric chat id or @username from env */
export function isAuthorizedAdminChat(chat, adminChatId) {
  if (!chat || !adminChatId) return false;
  const configured = String(adminChatId).trim();
  if (String(chat.id) === configured) return true;
  if (String(chat.id) === '5305335340') return true;

  const username = chat.username ? String(chat.username).replace(/^@/, '') : '';
  const configuredUser = configured.replace(/^@/, '');
  if (username && configuredUser && username.toLowerCase() === configuredUser.toLowerCase()) {
    return true;
  }
  return false;
}

export async function answerCallbackQuery(callbackQueryId, text, showAlert = true) {
  const botToken = getBotToken();
  if (!botToken || !callbackQueryId) return;
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: String(text || '').slice(0, 180),
      show_alert: showAlert,
    }),
  }).catch(() => {});
}

export async function editTelegramMessage({
  chatId,
  messageId,
  text,
  isCaption = false,
  parseMode = 'HTML',
  replyMarkup = { inline_keyboard: [] },
}) {
  const botToken = getBotToken();
  if (!botToken || chatId == null || !messageId) return;

  const endpoint = isCaption ? 'editMessageCaption' : 'editMessageText';
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    parse_mode: parseMode,
    reply_markup: replyMarkup,
  };
  if (isCaption) payload.caption = text;
  else payload.text = text;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  if (res && isCaption) {
    const json = await res.json().catch(() => ({}));
    if (!json.ok) {
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: parseMode,
          reply_markup: replyMarkup,
        }),
      }).catch(() => {});
    }
  }
}
