import { NextResponse } from 'next/server';
import { generateBulkKeys } from '@/lib/bulkKeyGenerator';
import { listBulkKeyTiers, resolveBulkKeyTier } from '@/lib/bulkKeyTiers';
import { getBotToken } from '@/lib/telegramApprove';

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
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

function formatExpiry(iso) {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

/** Normalize env chat id: trim, strip quotes, optional leading @ */
function normalizeChatIdEnv(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function getConfiguredChatId() {
  return normalizeChatIdEnv(
    process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_CHAT_ID || ''
  );
}

/**
 * Authorize by TELEGRAM_CHAT_ID against chat.id and/or from.id
 * (private chats: chat.id === user id).
 */
function isAuthorizedGenSender(message) {
  const configured = getConfiguredChatId();
  const chat = message?.chat || {};
  const chatId = chat.id;
  const fromId = message?.from?.id;

  if (!configured) {
    console.error('[telegram-webhook] TELEGRAM_CHAT_ID is missing — rejecting /gen');
    return { ok: false, reason: 'missing_env_chat_id', chatId, fromId, configured: '' };
  }

  const configuredBare = configured.replace(/^@/, '');
  const chatIdStr = String(chatId ?? '');
  const fromIdStr = fromId == null ? '' : String(fromId);

  if (chatIdStr && chatIdStr === String(configured)) {
    return { ok: true, chatId, fromId, configured };
  }
  if (fromIdStr && fromIdStr === String(configured)) {
    return { ok: true, chatId, fromId, configured };
  }

  // Username match (env like @ipeshwar or ipeshwar)
  const chatUser = chat.username ? String(chat.username).replace(/^@/, '') : '';
  const fromUser = message?.from?.username
    ? String(message.from.username).replace(/^@/, '')
    : '';
  if (
    configuredBare &&
    !/^-?\d+$/.test(configuredBare) &&
    ((chatUser && chatUser.toLowerCase() === configuredBare.toLowerCase()) ||
      (fromUser && fromUser.toLowerCase() === configuredBare.toLowerCase()))
  ) {
    return { ok: true, chatId, fromId, configured };
  }

  console.warn('[telegram-webhook] unauthorized /gen attempt', {
    chatId: chatIdStr,
    fromId: fromIdStr,
    chatUsername: chatUser || null,
    fromUsername: fromUser || null,
    configured,
    match: `${chatIdStr} === ${configured} ? ${chatIdStr === String(configured)}`,
  });

  return {
    ok: false,
    reason: 'chat_id_mismatch',
    chatId: chatIdStr,
    fromId: fromIdStr,
    configured,
  };
}

/**
 * Case-insensitive /gen parser. Collapses extra whitespace.
 * Accepts: /gen daily, /gen Daily, /gen@Bot DAILY 2, etc.
 */
function parseGenCommand(text) {
  const raw = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = raw.match(/^\/gen(?:@[A-Za-z0-9_]+)?(?:\s+(.*))?$/i);
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
  const count = Number.parseInt(String(countRaw).trim(), 10);

  if (!Number.isFinite(count) || count < 1) {
    return { ok: false, error: 'invalid_count', countRaw };
  }

  const tier = resolveBulkKeyTier(tierRaw);
  if (!tier) {
    return { ok: false, error: 'invalid_tier', tierRaw };
  }

  return {
    ok: true,
    tier,
    count: Math.min(MAX_GEN_COUNT, Math.max(1, count)),
  };
}

async function sendTelegramMessage(chatId, htmlText, extra = {}) {
  const botToken = getBotToken();
  if (!botToken || chatId == null) {
    console.error('[telegram-webhook] sendMessage skipped — missing bot token or chatId', {
      hasToken: Boolean(botToken),
      chatId,
    });
    return { ok: false };
  }

  const payloadBase = {
    chat_id: chatId,
    disable_web_page_preview: true,
    ...extra,
  };

  // Prefer HTML; fall back to plain text if Telegram rejects parse_mode
  const htmlRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payloadBase,
      text: htmlText,
      parse_mode: 'HTML',
    }),
  }).catch((err) => {
    console.error('[telegram-webhook] sendMessage network error:', err?.message || err);
    return null;
  });

  if (!htmlRes) return { ok: false };

  const htmlJson = await htmlRes.json().catch(() => ({}));
  if (htmlJson.ok) return { ok: true, json: htmlJson };

  console.error('[telegram-webhook] HTML sendMessage failed, retrying plain text:', {
    description: htmlJson.description,
    error_code: htmlJson.error_code,
    chatId: String(chatId),
  });

  const plain = stripHtml(htmlText);
  const plainRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payloadBase,
      text: plain,
    }),
  }).catch((err) => {
    console.error('[telegram-webhook] plain sendMessage network error:', err?.message || err);
    return null;
  });

  if (!plainRes) return { ok: false };
  const plainJson = await plainRes.json().catch(() => ({}));
  if (!plainJson.ok) {
    console.error('[telegram-webhook] plain sendMessage also failed:', plainJson);
  }
  return { ok: !!plainJson.ok, json: plainJson };
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
  const botToken = getBotToken();
  if (!botToken) {
    console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN missing');
    return NextResponse.json({ ok: false, error: 'bot_token_missing' }, { status: 500 });
  }

  const auth = isAuthorizedGenSender(message);
  const chatId = message.chat?.id;

  if (!auth.ok) {
    // Clear server log + reply with caller's chatId (so you can fix TELEGRAM_CHAT_ID)
    console.error('[telegram-webhook] unauthorized', auth);
    if (chatId != null) {
      await sendTelegramMessage(
        chatId,
        `❌ Unauthorized\n` +
          `Your chatId: <code>${escapeHtml(auth.chatId)}</code>\n` +
          `from.id: <code>${escapeHtml(auth.fromId || 'n/a')}</code>\n` +
          `Set <code>TELEGRAM_CHAT_ID</code> to one of these values.`
      );
    }
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: auth.reason,
      chatId: auth.chatId,
    });
  }

  const allowedUser = normalizeChatIdEnv(process.env.TELEGRAM_ADMIN_USER_ID || '');
  if (allowedUser && message.from?.id != null && String(message.from.id) !== String(allowedUser)) {
    console.warn('[telegram-webhook] TELEGRAM_ADMIN_USER_ID mismatch', {
      fromId: String(message.from.id),
      allowedUser,
    });
    await sendTelegramMessage(
      chatId,
      `❌ Unauthorized user\nfrom.id: <code>${escapeHtml(message.from.id)}</code>`
    );
    return NextResponse.json({ ok: true, ignored: true, reason: 'admin_user_mismatch' });
  }

  const parsed = parseGenCommand(message.text);
  if (!parsed) {
    return NextResponse.json({ ok: true });
  }

  console.log('[telegram-webhook] /gen command', {
    text: message.text,
    tier: parsed.ok ? parsed.tier.id : parsed.tierRaw || parsed.error,
    count: parsed.ok ? parsed.count : null,
    chatId: String(chatId),
  });

  if (!parsed.ok) {
    const tiers = listBulkKeyTiers()
      .map((t) => escapeHtml(t.id === 'test' ? 'Daily' : t.id))
      .join(', ');
    await sendTelegramMessage(
      chatId,
      parsed.help
        ? HELP_TEXT
        : `❌ ${escapeHtml(parsed.error)}${
            parsed.tierRaw ? ` (${escapeHtml(parsed.tierRaw)})` : ''
          }\n\nAvailable: ${tiers}\n\n${HELP_TEXT}`,
      { reply_to_message_id: message.message_id }
    );
    return NextResponse.json({ ok: true });
  }

  const pending = await sendTelegramMessage(
    chatId,
    `⏳ Generating <b>${parsed.count}× ${escapeHtml(parsed.tier.label)}</b>…`,
    { reply_to_message_id: message.message_id }
  );
  if (!pending.ok) {
    console.error('[telegram-webhook] failed to send pending status message');
  }

  let result;
  try {
    result = await generateBulkKeys({
      tier: parsed.tier.id,
      quantity: parsed.count,
      provisionOpenRouter: true,
    });
  } catch (err) {
    console.error('[telegram-webhook] generateBulkKeys threw:', err);
    await sendTelegramMessage(
      chatId,
      `❌ Key generation error\n<code>${escapeHtml(err?.message || 'unknown')}</code>`,
      { reply_to_message_id: message.message_id }
    );
    return NextResponse.json({ ok: true, generated: 0 });
  }

  if (!result.ok || !result.created) {
    const detail =
      result.error ||
      result.failures?.[0]?.error ||
      result.code ||
      'generation_failed';
    console.error('[telegram-webhook] generation failed:', {
      detail,
      failures: result.failures,
    });
    await sendTelegramMessage(
      chatId,
      `❌ Key generation failed\n<code>${escapeHtml(detail)}</code>`,
      { reply_to_message_id: message.message_id }
    );
    return NextResponse.json({ ok: true, generated: 0 });
  }

  const sent = await sendTelegramMessage(chatId, buildSuccessMessage(result), {
    reply_to_message_id: message.message_id,
  });
  if (!sent.ok) {
    console.error('[telegram-webhook] failed to deliver success message with codes', result.codes);
  }

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

    const configuredSecret = normalizeChatIdEnv(process.env.TELEGRAM_WEBHOOK_SECRET || '');
    if (configuredSecret) {
      const headerSecret = req.headers.get('x-telegram-bot-api-secret-token') || '';
      if (headerSecret !== configuredSecret) {
        console.warn('[telegram-webhook] secret_token mismatch');
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
      }
    }

    const update = await req.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: false, error: 'invalid_body' }, { status: 400 });
    }

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
    console.error('[telegram-webhook] unhandled error:', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/telegram-webhook',
    commands: ['/gen Daily [1-5]', '/gen Weekly [1-5]', '/gen Monthly [1-5]'],
    chatIdConfigured: Boolean(getConfiguredChatId()),
  });
}
