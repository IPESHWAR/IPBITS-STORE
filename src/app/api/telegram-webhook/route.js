import { NextResponse } from 'next/server';
import { generateBulkKeys } from '@/lib/bulkKeyGenerator';
import { resolveBulkKeyTier } from '@/lib/bulkKeyTiers';
import { getBotToken } from '@/lib/telegramApprove';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_GEN_COUNT = 5;
const READY_REPLY = 'سیستەمێ کلیلان یێ ئامادەیە.';

function ok() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function configuredChatId() {
  return String(process.env.TELEGRAM_CHAT_ID || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

/** Only the authorized TELEGRAM_CHAT_ID may run commands. */
function isAuthorizedChat(message) {
  const allowed = configuredChatId();
  if (!allowed) {
    console.error('[telegram-webhook] TELEGRAM_CHAT_ID is not set');
    return false;
  }

  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;

  if (chatId != null && String(chatId) === String(allowed)) return true;
  if (fromId != null && String(fromId) === String(allowed)) return true;

  // Optional @username in env
  const bare = allowed.replace(/^@/, '');
  if (bare && !/^-?\d+$/.test(bare)) {
    const chatUser = message?.chat?.username
      ? String(message.chat.username).replace(/^@/, '')
      : '';
    const fromUser = message?.from?.username
      ? String(message.from.username).replace(/^@/, '')
      : '';
    if (
      (chatUser && chatUser.toLowerCase() === bare.toLowerCase()) ||
      (fromUser && fromUser.toLowerCase() === bare.toLowerCase())
    ) {
      return true;
    }
  }

  return false;
}

async function sendMessage(chatId, text, { html = true } = {}) {
  const botToken = getBotToken();
  if (!botToken || chatId == null) return;

  const body = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (html) body.parse_mode = 'HTML';

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.error('[telegram-webhook] sendMessage network error:', err?.message || err);
    return null;
  });

  if (!res) return;
  const json = await res.json().catch(() => ({}));
  if (!json.ok) {
    console.error('[telegram-webhook] sendMessage failed:', json.description || json);
    // Retry without HTML if parse failed
    if (html) {
      await sendMessage(
        chatId,
        String(text).replace(/<[^>]+>/g, ''),
        { html: false }
      );
    }
  }
}

/**
 * Parse `/gen daily`, `/gen Daily 2`, `/gen@Bot monthly`, etc.
 * Case-insensitive; collapses extra spaces.
 */
function parseGenCommand(text) {
  const normalized = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = normalized.match(/^\/gen(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/i);
  if (!match) return null;

  const args = String(match[1] || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!args.length) {
    return { ok: false, error: 'missing_tier' };
  }

  const tier = resolveBulkKeyTier(args[0]);
  if (!tier) {
    return { ok: false, error: 'invalid_tier', tierRaw: args[0] };
  }

  const count = args[1] ? Number.parseInt(args[1], 10) : 1;
  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, error: 'invalid_count' };
  }

  return {
    ok: true,
    tier,
    count: Math.min(MAX_GEN_COUNT, count),
  };
}

function isStartOrTest(text) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^\/start(?:@[A-Za-z0-9_]+)?$/i.test(t)) return true;
  if (/^test$/i.test(t)) return true;
  return false;
}

function formatKeysReply(result) {
  const tier = result.tier;
  const items = result.items || [];
  const lines = [
    `✅ <b>${items.length}× ${escapeHtml(tier.label)}</b>`,
    `💵 ${Number(tier.amount_iqd).toLocaleString()} IQD · $${tier.limit_usd}`,
    '',
  ];

  for (const item of items) {
    lines.push(`<code>${escapeHtml(item.code)}</code>`);
    const expires = item.openrouter?.expires_at
      ? new Date(item.openrouter.expires_at).toISOString().slice(0, 10)
      : `${tier.days}d`;
    lines.push(`⏱ ${escapeHtml(expires)}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

async function handleAuthorizedText(message) {
  const chatId = message.chat?.id;
  const text = message.text || '';

  if (isStartOrTest(text)) {
    await sendMessage(chatId, READY_REPLY, { html: false });
    return;
  }

  const parsed = parseGenCommand(text);
  if (!parsed) {
    // Not a handled command — ignore quietly
    return;
  }

  if (!parsed.ok) {
    await sendMessage(
      chatId,
      `❌ ${escapeHtml(parsed.error)}\n` +
        `Usage: <code>/gen daily</code> · <code>/gen monthly 2</code>\n` +
        `Tiers: daily, weekly, monthly, 3months, yearly (max ${MAX_GEN_COUNT})`
    );
    return;
  }

  await sendMessage(
    chatId,
    `⏳ Generating <b>${parsed.count}× ${escapeHtml(parsed.tier.label)}</b>…`
  );

  try {
    // Same OpenRouter + Supabase voucher path as admin / generate-bulk-keys flow
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
      console.error('[telegram-webhook] generation failed:', detail, result.failures);
      await sendMessage(chatId, `❌ Failed\n<code>${escapeHtml(detail)}</code>`);
      return;
    }

    await sendMessage(chatId, formatKeysReply(result));
  } catch (err) {
    console.error('[telegram-webhook] generateBulkKeys error:', err);
    await sendMessage(
      chatId,
      `❌ Error\n<code>${escapeHtml(err?.message || 'unknown')}</code>`
    );
  }
}

/**
 * Telegram webhook — /gen voucher keys for the authorized chat only.
 * Checkout / order callbacks are forwarded to the existing approval webhook
 * without modifying that route.
 */
export async function POST(req) {
  try {
    if (!getBotToken()) {
      console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN missing');
      return ok();
    }

    const update = await req.json().catch(() => null);
    if (!update) return ok();

    // Preserve existing order / top-up approval callbacks (do not rewrite that logic)
    if (update.callback_query) {
      try {
        const { POST: handleApprovalWebhook } = await import(
          '@/app/api/telegram/webhook/route'
        );
        const forwarded = new Request(req.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(update),
        });
        await handleApprovalWebhook(forwarded);
      } catch (err) {
        console.error('[telegram-webhook] callback forward error:', err);
      }
      return ok();
    }

    const message = update.message || update.edited_message;
    if (!message?.text) return ok();

    // Unauthorized chats: ignore silently
    if (!isAuthorizedChat(message)) {
      return ok();
    }

    await handleAuthorizedText(message);
    return ok();
  } catch (error) {
    console.error('[telegram-webhook] unhandled error:', error);
    return ok();
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/telegram-webhook',
    commands: ['/start', 'test', '/gen daily', '/gen monthly [1-5]'],
  });
}
