import { NextResponse } from 'next/server';
import { generateBulkKeys } from '@/lib/bulkKeyGenerator';
import { listBulkKeyTiers, resolveBulkKeyTier } from '@/lib/bulkKeyTiers';
import {
  getAdminChatId,
  getBotToken,
  isAuthorizedAdminChat,
} from '@/lib/telegramApprove';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_GEN_COUNT = 5;
const HELP_TEXT =
  'Usage:\n' +
  '<code>/gen Daily</code>\n' +
  '<code>/gen Weekly 2</code>\n' +
  '<code>/gen Monthly 5</code>\n\n' +
  'Tiers: Daily, Weekly, Monthly, 3months, Yearly\n' +
  'Count: 1–5 (default 1)';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatExpiry(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function parseGenCommand(text) {
  const raw = String(text || '').trim();
  // /gen, /gen@BotName, optional args
  const match = raw.match(/^\/gen(?:@\w+)?(?:\s+(.+))?$/i);
  if (!match) return null;

  const args = String(match[1] || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!args.length) {
    return { ok: false, error: 'missing_tier', help: true };
  }

  const tierRaw = args[0];
  const countRaw = args[1] ?? '1';
  const count = Number.parseInt(countRaw, 10);

  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, error: 'invalid_count' };
  }

  const tier = resolveBulkKeyTier(tierRaw);
  if (!tier) {
    return { ok: false, error: 'invalid_tier', tierRaw };
  }

  return {
    ok: true,
    tier,
    count: Math.min(MAX_GEN_COUNT, count),
  };
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  const botToken = getBotToken();
  if (!botToken || chatId == null) return { ok: false };

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    }),
  }).catch(() => null);

  if (!res) return { ok: false };
  const json = await res.json().catch(() => ({}));
  return { ok: !!json.ok, json };
}

function buildSuccessMessage(result) {
  const tier = result.tier;
  const items = result.items || [];
  const lines = [
    `✅ <b>Generated ${items.length}× ${escapeHtml(tier.label)}</b>`,
    `💵 ${Number(tier.amount_iqd).toLocaleString()} IQD · $${tier.limit_usd} limit`,
    '',
  ];

  for (const item of items) {
    const expiry = formatExpiry(item.openrouter?.expires_at);
    lines.push(`<code>${escapeHtml(item.code)}</code>`);
    lines.push(`⏱ Expires: ${escapeHtml(expiry)} · ${tier.days} day(s)`);
    lines.push('');
  }

  if (result.failures?.length) {
    lines.push(`⚠️ Failed: ${result.failures.length}`);
  }

  return lines.join('\n').trim();
}

async function handleGenMessage(message) {
  const chat = message.chat || {};
  const chatId = chat.id;
  const adminChatId = getAdminChatId();
  const botToken = getBotToken();

  if (!botToken) {
    return NextResponse.json({ ok: false, error: 'bot_token_missing' }, { status: 500 });
  }

  if (!adminChatId || !isAuthorizedAdminChat(chat, adminChatId)) {
    // Silent ignore for unauthorized chats (do not leak capability)
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Also reject if from_user id is configured separately and mismatches
  const allowedUser = String(process.env.TELEGRAM_ADMIN_USER_ID || '').trim();
  if (allowedUser && message.from?.id != null && String(message.from.id) !== allowedUser) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const parsed = parseGenCommand(message.text);
  if (!parsed) {
    return NextResponse.json({ ok: true });
  }

  if (!parsed.ok) {
    const tiers = listBulkKeyTiers()
      .map((t) => escapeHtml(t.id === 'test' ? 'Daily' : t.id))
      .join(', ');
    await sendTelegramMessage(
      chatId,
      parsed.help
        ? HELP_TEXT
        : `❌ ${escapeHtml(parsed.error)}\n\nAvailable: ${tiers}\n\n${HELP_TEXT}`,
      { reply_to_message_id: message.message_id }
    );
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage(
    chatId,
    `⏳ Generating <b>${parsed.count}× ${escapeHtml(parsed.tier.label)}</b>…`,
    { reply_to_message_id: message.message_id }
  );

  const result = await generateBulkKeys({
    tier: parsed.tier.id,
    quantity: parsed.count,
    provisionOpenRouter: true,
  });

  if (!result.ok || !result.created) {
    const detail =
      result.error ||
      result.failures?.[0]?.error ||
      result.code ||
      'generation_failed';
    await sendTelegramMessage(
      chatId,
      `❌ Key generation failed\n<code>${escapeHtml(detail)}</code>`,
      { reply_to_message_id: message.message_id }
    );
    return NextResponse.json({ ok: true, generated: 0 });
  }

  await sendTelegramMessage(chatId, buildSuccessMessage(result), {
    reply_to_message_id: message.message_id,
  });

  return NextResponse.json({
    ok: true,
    generated: result.created,
    codes: result.codes,
  });
}

/**
 * Secure admin-only Telegram webhook for /gen voucher commands.
 * Also forwards callback_query updates to the existing approval webhook.
 *
 * POST /api/telegram-webhook
 */
export async function POST(req) {
  try {
    const botToken = getBotToken();
    if (!botToken) {
      return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 });
    }

    // Optional shared secret (set the same value in setWebhook secret_token)
    const configuredSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    if (configuredSecret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token') || '';
      if (headerSecret !== configuredSecret) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
      }
    }

    const update = await req.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
    }

    // Keep order-approval / top-up callbacks working on the same webhook URL
    if (update.callback_query) {
      const { POST: handleApprovalWebhook } = await import('@/app/api/telegram/webhook/route');
      const forwarded = new Request(req.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(update),
      });
      return handleApprovalWebhook(forwarded);
    }

    const message = update.message || update.edited_message;
    if (!message?.text) {
      return NextResponse.json({ ok: true });
    }

    return handleGenMessage(message);
  } catch (error) {
    console.error('telegram-webhook error:', error);
    // Always 200 to Telegram after accept to avoid retry storms on app bugs
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/telegram-webhook',
    commands: ['/gen Daily [1-5]', '/gen Weekly [1-5]', '/gen Monthly [1-5]'],
  });
}
