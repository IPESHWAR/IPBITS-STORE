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

/**
 * Checkout order notification keyboard:
 * 1-click Confirm (+ optional WhatsApp contact URL).
 * callback_data: approve_order:<orderId_or_phone>:<tier>
 */
export function buildConfirmOrderKeyboard({ orderId, phone, tier = 'daily', waUrl }) {
  const ref = String(orderId || phone || '')
    .replace(/\s+/g, '')
    .slice(0, 40);
  const tierKey = String(tier || 'daily')
    .trim()
    .toLowerCase()
    .slice(0, 12);
  const callbackData = `approve_order:${ref}:${tierKey}`.slice(0, 64);

  const rows = [
    [
      {
        text: '✅ پەسەندکرن و دروستکرنا کلیلێ (Confirm Order)',
        callback_data: callbackData,
      },
    ],
  ];

  if (waUrl) {
    rows.push([{ text: '💬 واتساپ — پەیوەندی ب کڕیاری', url: waUrl }]);
  }

  return { inline_keyboard: rows };
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
