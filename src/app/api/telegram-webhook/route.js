import { createClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getBotToken,
  isAuthorizedAdminChat,
  getAdminChatId,
  toWhatsAppDigits,
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
    prefix: '1D',
  },
  {
    id: 'weekly',
    name: 'هەفتانە (٧ ڕۆژ)',
    labelEn: 'Weekly',
    durationEn: '7 Days',
    limit: 1.75,
    iqd: 5000,
    prefix: '7D',
  },
  {
    id: 'monthly',
    name: 'مەهانە (٣٠ ڕۆژ)',
    labelEn: 'Monthly',
    durationEn: '30 Days',
    limit: 4.0,
    iqd: 12000,
    prefix: '30D',
  },
  {
    id: '3months',
    name: '٣ مەهی (٩٠ ڕۆژ)',
    labelEn: '3 Months',
    durationEn: '90 Days',
    limit: 8.5,
    iqd: 25000,
    prefix: '90D',
  },
  {
    id: 'yearly',
    name: 'ساڵانە (١ ساڵ)',
    labelEn: 'Yearly',
    durationEn: '1 Year',
    limit: 18.0,
    iqd: 50000,
    prefix: '365D',
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
  '7d': 'weekly',
  monthly: 'monthly',
  mo: 'monthly',
  '30d': 'monthly',
  '3months': '3months',
  '3m': '3months',
  '90d': '3months',
  yearly: 'yearly',
  yr: 'yearly',
  '1y': 'yearly',
  '365d': 'yearly',
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

async function generateKeysLikeScript(tier, count) {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase URL/key missing');
  }

  const { generateLicenseKey } = await import('@/lib/generateKey');
  const codes = [];
  for (let i = 1; i <= count; i += 1) {
    const code = generateLicenseKey(tier.prefix);

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

function isAuthorizedChatId(chatId) {
  return (
    String(chatId) === HARDCODED_AUTHORIZED_CHAT_ID ||
    String(chatId) === String(process.env.TELEGRAM_CHAT_ID || '') ||
    String(chatId) === String(process.env.ADMIN_CHAT_ID || '')
  );
}

function assertCallbackAuthorized(cq) {
  const chat = cq.message?.chat || {};
  const chatId = chat.id;
  return isAuthorizedChatId(chatId) || isAuthorizedAdminChat(chat, getAdminChatId());
}

function buildAiWaText(key) {
  return (
    `سڵاو بەڕێزم، فەرموو کلیلی ئەکتیڤکردن بۆ AI Hub:\n` +
    `${key}\n` +
    `سوپاس بۆ کڕینەکەت!`
  );
}

function buildAccWaText(productName) {
  return (
    `سڵاو بەڕێزم، پەیوەست بە داخوازییا تە یا ${productName}:\n` +
    `ئەکاونتێ تە یێ ئامادەیە...`
  );
}

async function markOrderCompleted(phone, code) {
  const supabase = getSupabase();
  if (!supabase || !phone) return;

  const variants = [
    normalizePhone(phone),
    toWhatsAppDigits(phone),
    String(phone).replace(/^964/, '0'),
  ].filter(Boolean);

  for (const p of [...new Set(variants)]) {
    await supabase
      .from('orders')
      .update({
        status: 'completed',
        license_key: code || null,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_phone', p)
      .eq('status', 'pending');
  }
}

/** confirm_ai:phone:tier — generate voucher + WhatsApp key link */
async function handleConfirmAi(cq) {
  const data = String(cq.data || '');
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const hasPhoto = !!(cq.message?.photo && cq.message.photo.length);
  const originalText = cq.message?.caption || cq.message?.text || '';

  await answerCallbackQuery(cq.id, 'دروستکرنا کلیلێ…', false);

  if (!assertCallbackAuthorized(cq)) {
    await sendTelegramMessage(chatId, '❌ Unauthorized');
    return;
  }

  const parts = data.split(':');
  const phoneRaw = String(parts[1] || '').trim();
  const tierRaw = String(parts[2] || 'daily').trim();
  const phone = toWhatsAppDigits(phoneRaw);
  const tier = resolveTier(tierRaw) || resolveTier('daily');

  try {
    const codes = await generateKeysLikeScript(tier, 1);
    const code = codes[0];
    if (!code) throw new Error('generation_failed');

    await markOrderCompleted(phone || phoneRaw, code);

    const waText = buildAiWaText(code);
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
      : '';

    const body =
      `✅ داخوازی هاتە پەسەندکرن!\n` +
      `کلیل: <code>${code}</code>\n` +
      `(Tier: ${tier.labelEn} | ${tier.durationEn})\n` +
      (waUrl
        ? `<a href="${waUrl}">📲 کلیک ل ڤێرە بکە بۆ هنارتنا کلیلێ ب واتساپێ</a>`
        : '⚠️ ژمارا واتساپی نەهاتە دیتن');

    const replyMarkup = waUrl
      ? { inline_keyboard: [[{ text: '📲 هنارتنا کلیلێ ب واتساپێ', url: waUrl }]] }
      : { inline_keyboard: [] };

    await editTelegramMessage({
      chatId,
      messageId,
      isCaption: hasPhoto,
      text: `${originalText ? `${originalText}\n\n━━━━━━━━━━━━━━━━━━━\n` : ''}${body}`,
      replyMarkup,
    });

    await sendTelegramMessage(chatId, body, 'HTML', replyMarkup);
  } catch (err) {
    console.error('[telegram-webhook] confirm_ai failed:', err);
    await sendTelegramMessage(chatId, `❌ خەلەتی: ${err?.message || err}`);
  }
}

/** confirm_acc:phone:encodedProduct — WhatsApp handoff for account services */
async function handleConfirmAcc(cq) {
  const data = String(cq.data || '');
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const hasPhoto = !!(cq.message?.photo && cq.message.photo.length);
  const originalText = cq.message?.caption || cq.message?.text || '';

  await answerCallbackQuery(cq.id, 'ئامادەکرنا واتساپێ…', false);

  if (!assertCallbackAuthorized(cq)) {
    await sendTelegramMessage(chatId, '❌ Unauthorized');
    return;
  }

  const parts = data.split(':');
  const phoneRaw = String(parts[1] || '').trim();
  const encodedProduct = parts.slice(2).join(':');
  let productName = 'Subscription';
  try {
    productName = decodeURIComponent(encodedProduct || 'Subscription') || 'Subscription';
  } catch {
    productName = encodedProduct || 'Subscription';
  }

  const phone = toWhatsAppDigits(phoneRaw);
  const waText = buildAccWaText(productName);
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
    : '';

  await markOrderCompleted(phone || phoneRaw, null);

  const body =
    `✅ Account Service — ئامادەیە بۆ ناردن\n` +
    `📦 ${productName}\n` +
    `📞 ${phone || phoneRaw || '—'}\n` +
    (waUrl
      ? `<a href="${waUrl}">📲 کلیک ل ڤێرە بکە بۆ دانوستاندن و ناردنی ئەکاونت بۆ کڕیار</a>`
      : '⚠️ ژمارا واتساپی نەهاتە دیتن');

  const replyMarkup = waUrl
    ? {
        inline_keyboard: [
          [{ text: '📲 کلیک ل ڤێرە بکە بۆ دانوستاندن و ناردنی ئەکاونت بۆ کڕیار', url: waUrl }],
        ],
      }
    : { inline_keyboard: [] };

  await editTelegramMessage({
    chatId,
    messageId,
    isCaption: hasPhoto,
    text: `${originalText ? `${originalText}\n\n━━━━━━━━━━━━━━━━━━━\n` : ''}${body}`,
    replyMarkup,
  });

  await sendTelegramMessage(chatId, body, 'HTML', replyMarkup);
}

/** confirm:phone:productName — smart route to AI Hub key or account WhatsApp */
async function handleConfirmGeneric(cq) {
  const data = String(cq.data || '');

  // Debug / smoke-test button from checkout: confirm_test / confirm:test
  if (
    data === 'confirm_test' ||
    data === 'confirm:test' ||
    data.startsWith('confirm:test') ||
    data.startsWith('confirm_test')
  ) {
    await answerCallbackQuery(cq.id, '✅ Confirm button کار دکەت', false);
    const chatId = cq.message?.chat?.id;
    await sendTelegramMessage(
      chatId,
      '✅ دوگمەیا Confirm هاتە وەرگرتن (confirm_test). سیستەم ئامادەیە.'
    );
    return;
  }

  const parts = data.split(':');
  const phoneRaw = String(parts[1] || '').trim();
  const productName = parts.slice(2).join(':') || 'order';
  const phone = toWhatsAppDigits(phoneRaw);
  const hay = productName.toLowerCase();

  const isAi =
    /ai\s*hub|voucher|daily|weekly|monthly|yearly|tst|تێست|تیست|هەفت|مەهانە|ساڵانە|کلیل|خاڵ/.test(
      hay
    );

  if (isAi) {
    let tier = 'daily';
    if (/week|هەفت|7/.test(hay)) tier = 'weekly';
    else if (/year|ساڵ/.test(hay)) tier = 'yearly';
    else if (/3\s*m|٩٠|90/.test(hay)) tier = '3months';
    else if (/month|مەه|30/.test(hay)) tier = 'monthly';
    cq.data = `confirm_ai:${phone || phoneRaw}:${tier}`;
    await handleConfirmAi(cq);
    return;
  }

  cq.data = `confirm_acc:${phone || phoneRaw}:${encodeURIComponent(productName)}`;
  await handleConfirmAcc(cq);
}

/** Legacy approve_order:<ref>:<tier> → confirm_ai */
async function handleApproveOrderCallback(cq) {
  const data = String(cq.data || '');
  const parts = data.split(':');
  const ref = String(parts[1] || '').trim();
  const tierRaw = String(parts[2] || 'daily').trim();

  const supabase = getSupabase();
  let phone = /^\d+$/.test(ref) ? ref : '';
  if (!phone && supabase) {
    const { data: order } = await supabase
      .from('orders')
      .select('customer_phone')
      .eq('id', ref)
      .maybeSingle();
    phone = order?.customer_phone || '';
  }

  cq.data = `confirm_ai:${toWhatsAppDigits(phone || ref)}:${tierRaw}`;
  await handleConfirmAi(cq);
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

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return okResponse();

    if (body.callback_query) {
      const cq = body.callback_query;
      const data = String(cq.data || '');

      if (data.startsWith('confirm:')) {
        await handleConfirmGeneric(cq);
        return okResponse();
      }
      if (data.startsWith('confirm_ai:')) {
        await handleConfirmAi(cq);
        return okResponse();
      }
      if (data.startsWith('confirm_acc:')) {
        await handleConfirmAcc(cq);
        return okResponse();
      }
      // Legacy AI path only: approve_order:<phone|ref>:<tier>
      // Checkout / keyboard order approval: approve_order:<orderId> or approve:<orderId>
      if (data.startsWith('approve_order:')) {
        const rest = data.slice('approve_order:'.length);
        const segs = rest.split(':').filter(Boolean);
        if (segs.length >= 2) {
          await handleApproveOrderCallback(cq);
          return okResponse();
        }
        // Single-segment orderId → fall through to approval webhook
      }

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
    if (!process.env.TELEGRAM_BOT_TOKEN) {
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
      features: ['/gen', 'confirm_ai', 'confirm_acc', 'approve_order'],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
