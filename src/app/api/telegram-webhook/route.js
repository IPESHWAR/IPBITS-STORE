import { createClient } from '@supabase/supabase-js';

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

function getBotToken() {
  return process.env.TELEGRAM_BOT_TOKEN || '';
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

    const orKey = await createOpenRouterKey(`${code}-${Date.now()}`, tier.limit);
    if (!orKey) {
      throw new Error(`نەشیا کلیلێ بۆ ${code} ل OpenRouter دروست بکەت`);
    }

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

async function sendTelegramMessage(chatId, text, parseMode) {
  const botToken = getBotToken();
  if (!botToken) return;

  const payload = {
    chat_id: chatId,
    text,
  };
  if (parseMode) payload.parse_mode = parseMode;

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

/**
 * Telegram webhook — authorized /gen key generation only.
 * Does not modify checkout or order notification routes.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const message = body.message || body.channel_post || body.edited_message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN missing');
      return okResponse();
    }

    const isAuthorized =
      String(chatId) === HARDCODED_AUTHORIZED_CHAT_ID ||
      String(chatId) === String(process.env.TELEGRAM_CHAT_ID || '');

    if (!isAuthorized) {
      await sendTelegramMessage(chatId, `Unauthorized ID: ${chatId}`);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (text.toLowerCase().startsWith('/gen')) {
      try {
        const { tier, tierRaw, count } = parseGenArgs(text);
        if (!tier) {
          await sendTelegramMessage(
            chatId,
            `❌ خەلەتی: unknown tier "${tierRaw}"\nبۆ چێکرنا کلیلێ بنڤیسە: /gen daily`
          );
          return okResponse();
        }

        const codes = await generateKeysLikeScript(tier, count);
        if (!codes.length) {
          throw new Error('generation_failed');
        }

        await sendTelegramMessage(chatId, formatSuccessMessage(codes, tier), 'HTML');
      } catch (err) {
        await sendTelegramMessage(chatId, `❌ خەلەتی: ${err?.message || err}`);
      }

      return okResponse();
    }

    await sendTelegramMessage(
      chatId,
      'بۆت کار دکەت! بۆ چێکرنا کلیلێ بنڤیسە: /gen daily'
    );

    return okResponse();
  } catch (error) {
    console.error('[telegram-webhook] error:', error);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: '/api/telegram-webhook',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
