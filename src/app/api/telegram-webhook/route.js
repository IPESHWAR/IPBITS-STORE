import { createClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getBotToken,
  isAuthorizedAdminChat,
  getAdminChatId,
} from '@/lib/telegramApprove';
import { normalizePhone } from '@/lib/orderValidation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_GEN_COUNT = 5;
const HARDCODED_AUTHORIZED_CHAT_ID = '5305335340';

/** Exact tiers from scripts/generate-bulk-keys.mjs */
const TIERS = [
  {
    id: 'test',
    name: 'تیست (١ ڕۆژ)',
    labelEn: 'Daily',
    durationEn: '1 Day',
    limit: 0.75,
    iqd: 2500,
    prefix: 'TST',
  },
  {
    id: 'weekly',
    name: 'هەفتانە (٧ ڕۆژ)',
    labelEn: 'Weekly',
    durationEn: '7 Days',
    limit: 1.75,
    iqd: 5000,
    prefix: 'WK',
  },
  {
    id: 'monthly',
    name: 'مەهانە (٣٠ ڕۆژ)',
    labelEn: 'Monthly',
    durationEn: '30 Days',
    limit: 4.0,
    iqd: 12000,
    prefix: 'MO',
  },
  {
    id: '3months',
    name: '٣ مەهی (٩٠ ڕۆژ)',
    labelEn: '3 Months',
    durationEn: '90 Days',
    limit: 8.5,
    iqd: 25000,
    prefix: '3M',
  },
  {
    id: 'yearly',
    name: 'ساڵانە (١ ساڵ)',
    labelEn: 'Yearly',
    durationEn: '1 Year',
    limit: 18.0,
    iqd: 50000,
    prefix: 'YR',
  },
];

const TIER_ALIASES = {
  daily: 'test',
  day: 'test',
  '1d': 'test',
  '1_day': 'test',
  tst: 'test',
  test: 'test',
  weekly: 'weekly',
  wk: 'weekly',
  monthly: 'monthly',
  mo: 'monthly',
  '3months': '3months',
  '3m': '3months',
  yearly: 'yearly',
  yr: 'yearly',
};

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

/** Same as scripts/generate-bulk-keys.mjs createOpenRouterKey */
async function createOpenRouterKey(name, limit) {
  const openrouterAdminKey = process.env.OPENROUTER_MANAGEMENT_API_KEY;
  if (!openrouterAdminKey) {
    throw new Error('OPENROUTER_MANAGEMENT_API_KEY missing');
  }

  const res = await fetch('https://openrouter.ai/api/v1/keys', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openrouterAdminKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, limit }),
  });
  const data = await res.json().catch(() => ({}));
  const key = data?.key || data?.data?.key;
  if (!key) {
    const detail = data?.error?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(`OpenRouter key create failed: ${detail}`);
  }
  return key;
}

/**
 * Exact generation loop from scripts/generate-bulk-keys.mjs:
 * IPBITS-{PREFIX}-{1000-9999} → OpenRouter key → vouchers insert
 */
async function generateKeysLikeScript(tier, count) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase URL/key missing');
  }

  const codes = [];
  for (let i = 1; i <= count; i += 1) {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `IPBITS-${tier.prefix}-${randomNum}`;

    await createOpenRouterKey(`${code}-${Date.now()}`, tier.limit);

    const { error } = await supabase.from('vouchers').insert([
      {
        code,
        amount_iqd: tier.iqd,
        is_used: false,
      },
    ]);

    if (error) {
      throw new Error(`Supabase: ${error.message}`);
    }

    codes.push(code);
  }

  return codes;
}

function resolveTier(raw) {
  const key = String(raw || 'daily')
    .trim()
    .toLowerCase();
  const mapped = TIER_ALIASES[key] || key;
  return (
    TIERS.find((t) => t.id === mapped || t.prefix.toLowerCase() === mapped) || null
  );
}

function parseGenArgs(text) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  const rest = normalized.replace(/^\/gen(?:@[A-Za-z0-9_]+)?/i, '').trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  const tierRaw = parts[0] || 'daily';
  const countRaw = parts[1] ? Number.parseInt(parts[1], 10) : 1;
  const count =
    Number.isFinite(countRaw) && countRaw > 0 ? Math.min(MAX_GEN_COUNT, countRaw) : 1;
  return { tier: resolveTier(tierRaw), tierRaw, count };
}

async function sendTelegramMessage(chatId, text, parseMode, replyMarkup) {
  const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const payload = {
    chat_id: chatId,
    text,
  };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function formatSuccessMessage(codes, tier) {
  const keysBlock = codes.map((code) => `<code>${code}</code>`).join('\n');
  return (
    `✅ کلیل هاتە دروستکرن:\n` +
    `${keysBlock}\n` +
    `(Tier: ${tier.labelEn} | ${tier.durationEn})`
  );
}

function toWhatsAppDigits(phone) {
  const digits = normalizePhone(phone).replace(/^\+/, '');
  if (/^07[3-9]\d{8}$/.test(digits)) return `964${digits.slice(1)}`;
  return digits.replace(/\D/g, '');
}

function buildCustomerWaMessage(code, tier) {
  return (
    `سڵاو! داخوازییا تە هاتە پەسەندکرن ژ IPBITS STORE.\n\n` +
    `🔑 کلیلێ چالاککرنێ:\n${code}\n\n` +
    `📦 ${tier.labelEn} (${tier.durationEn})\n` +
    `تکایە ڤێ کلیلێ د AI Hub دا بکاربینە.`
  );
}

function isAuthorizedChatId(chatId) {
  return (
    String(chatId) === HARDCODED_AUTHORIZED_CHAT_ID ||
    String(chatId) === String(process.env.TELEGRAM_CHAT_ID || '') ||
    String(chatId) === String(process.env.ADMIN_CHAT_ID || '')
  );
}

/**
 * 1-click Confirm Order: generate voucher, mark order completed, WhatsApp deep link.
 * callback_data: approve_order:<orderId_or_phone>:<tier>
 */
async function handleApproveOrderCallback(cq) {
  const data = String(cq.data || '');
  const chat = cq.message?.chat || {};
  const chatId = chat.id;
  const messageId = cq.message?.message_id;
  const hasPhoto = !!(cq.message?.photo && cq.message.photo.length);
  const originalText = cq.message?.caption || cq.message?.text || '';

  if (!isAuthorizedChatId(chatId) && !isAuthorizedAdminChat(chat, getAdminChatId())) {
    await answerCallbackQuery(cq.id, '❌ Unauthorized', true);
    return;
  }

  const parts = data.split(':');
  // approve_order : ref : tier
  const ref = String(parts[1] || '').trim();
  const tierRaw = String(parts[2] || 'daily').trim();
  const tier = resolveTier(tierRaw) || resolveTier('daily');

  if (!ref) {
    await answerCallbackQuery(cq.id, '❌ Missing order ref', true);
    return;
  }

  const supabase = getSupabase();
  let order = null;
  if (supabase) {
    const byId = await supabase.from('orders').select('*').eq('id', ref).maybeSingle();
    if (byId.data) {
      order = byId.data;
    } else {
      const phoneGuess = normalizePhone(ref);
      const byPhone = await supabase
        .from('orders')
        .select('*')
        .eq('customer_phone', phoneGuess)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      order = byPhone.data || null;
    }
  }

  if (order && (order.status === 'completed' || order.status === 'sent' || order.status === 'approved') && order.license_key) {
    const phone = order.customer_phone || ref;
    const waDigits = toWhatsAppDigits(phone);
    const waText = buildCustomerWaMessage(order.license_key, tier);
    const waUrl = waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
      : '';
    await answerCallbackQuery(cq.id, 'ئۆردەر بەری نھا هاتە پەسەندکرن ✅', true);
    await editTelegramMessage({
      chatId,
      messageId,
      isCaption: hasPhoto,
      text:
        `✅ داخوازی هاتە پەسەندکرن!\n` +
        `کلیل: <code>${order.license_key}</code>\n` +
        (waUrl
          ? `<a href="${waUrl}">📲 کلیک ل ڤێرە بکە بۆ هنارتنا کلیلێ ب واتساپێ</a>`
          : ''),
      replyMarkup: waUrl
        ? { inline_keyboard: [[{ text: '📲 هنارتنا کلیلێ ب واتساپێ', url: waUrl }]] }
        : { inline_keyboard: [] },
    });
    return;
  }

  try {
    const codes = await generateKeysLikeScript(tier, 1);
    const code = codes[0];
    if (!code) throw new Error('generation_failed');

    const phone = order?.customer_phone || (/^\d+$/.test(ref) ? ref : '');
    const waDigits = toWhatsAppDigits(phone);
    const waText = buildCustomerWaMessage(code, tier);
    const waUrl = waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`
      : '';

    if (supabase && order?.id) {
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          license_key: code,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);
    } else if (supabase && phone) {
      await supabase
        .from('orders')
        .update({
          status: 'completed',
          license_key: code,
          updated_at: new Date().toISOString(),
        })
        .eq('customer_phone', normalizePhone(phone))
        .eq('status', 'pending');
    }

    const approvedBody =
      `✅ داخوازی هاتە پەسەندکرن!\n` +
      `کلیل: <code>${code}</code>\n` +
      `(Tier: ${tier.labelEn} | ${tier.durationEn})\n` +
      (waUrl
        ? `<a href="${waUrl}">📲 کلیک ل ڤێرە بکە بۆ هنارتنا کلیلێ ب واتساپێ</a>`
        : '⚠️ ژمارا واتساپی نەهاتە دیتن');

    const replyMarkup = waUrl
      ? {
          inline_keyboard: [[{ text: '📲 هنارتنا کلیلێ ب واتساپێ', url: waUrl }]],
        }
      : { inline_keyboard: [] };

    await editTelegramMessage({
      chatId,
      messageId,
      isCaption: hasPhoto,
      text: `${originalText ? `${originalText}\n\n━━━━━━━━━━━━━━━━━━━\n` : ''}${approvedBody}`,
      replyMarkup,
    });

    await answerCallbackQuery(cq.id, '✅ هاتە پەسەندکرن', false);
  } catch (err) {
    console.error('[telegram-webhook] approve_order failed:', err);
    await answerCallbackQuery(cq.id, `❌ ${err?.message || 'Failed'}`, true);
  }
}

async function handleAuthorizedText(message) {
  const chatId = message.chat.id;
  const text = (message.text || '').trim();

  if (text.toLowerCase().startsWith('/gen')) {
    try {
      const { tier, tierRaw, count } = parseGenArgs(text);
      if (!tier) {
        await sendTelegramMessage(
          chatId,
          `❌ خەلەتی: unknown tier "${tierRaw}"\nبۆ چێکرنا کلیلێ بنڤیسە: /gen daily`
        );
        return;
      }

      const codes = await generateKeysLikeScript(tier, count);
      if (!codes.length) throw new Error('generation_failed');
      await sendTelegramMessage(chatId, formatSuccessMessage(codes, tier), 'HTML');
    } catch (err) {
      await sendTelegramMessage(chatId, `❌ خەلەتی: ${err?.message || err}`);
    }
    return;
  }

  await sendTelegramMessage(
    chatId,
    'بۆت کار دکەت! بۆ چێکرنا کلیلێ بنڤیسە: /gen daily'
  );
}

/**
 * Telegram webhook — /gen keys + 1-click order Confirm.
 * Top-up / legacy callbacks are forwarded to /api/telegram/webhook.
 */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return okResponse();

    // ── callback_query (Confirm Order button) ──
    if (body.callback_query) {
      const cq = body.callback_query;
      const data = String(cq.data || '');

      if (data.startsWith('approve_order:')) {
        await handleApproveOrderCallback(cq);
        return okResponse();
      }

      // Preserve existing top-up / reject / legacy order handlers
      try {
        const { POST: handleApprovalWebhook } = await import(
          '@/app/api/telegram/webhook/route'
        );
        const forwarded = new Request(req.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        await handleApprovalWebhook(forwarded);
      } catch (err) {
        console.error('[telegram-webhook] callback forward error:', err);
        await answerCallbackQuery(cq.id, '❌ Handler error', true);
      }
      return okResponse();
    }

    const message = body.message || body.channel_post || body.edited_message;
    if (!message || !message.text) {
      return okResponse();
    }

    const chatId = message.chat.id;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN missing');
      return okResponse();
    }

    if (!isAuthorizedChatId(chatId)) {
      await sendTelegramMessage(chatId, `Unauthorized ID: ${chatId}`);
      return okResponse();
    }

    await handleAuthorizedText(message);
    return okResponse();
  } catch (error) {
    console.error('[telegram-webhook] error:', error);
    return okResponse();
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: '/api/telegram-webhook',
      features: ['/gen', 'approve_order callback'],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
