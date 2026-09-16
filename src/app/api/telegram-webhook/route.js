import { generateBulkKeys } from '@/lib/bulkKeyGenerator';
import { resolveBulkKeyTier } from '@/lib/bulkKeyTiers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_GEN_COUNT = 5;

function okResponse() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function sendTelegramMessage(botToken, chatId, text, parseMode) {
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

function parseGenArgs(text) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  const rest = normalized.replace(/^\/gen(?:@[A-Za-z0-9_]+)?/i, '').trim();
  const parts = rest.split(/\s+/).filter(Boolean);
  const tierRaw = parts[0] || 'daily';
  const countRaw = parts[1] ? Number.parseInt(parts[1], 10) : 1;
  const count = Number.isFinite(countRaw) && countRaw > 0 ? Math.min(MAX_GEN_COUNT, countRaw) : 1;
  const tier = resolveBulkKeyTier(tierRaw);
  return { tier, tierRaw, count };
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
    const authorizedId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken) {
      console.error('[telegram-webhook] TELEGRAM_BOT_TOKEN missing');
      return okResponse();
    }

    // Security check
    if (String(chatId) !== String(authorizedId)) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Unauthorized ID: ${chatId}`,
        }),
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    if (text.toLowerCase().startsWith('/gen')) {
      try {
        const { tier, tierRaw, count } = parseGenArgs(text);
        if (!tier) {
          await sendTelegramMessage(
            botToken,
            chatId,
            `❌ خەلەتی: unknown tier "${tierRaw}"\nبۆ چێکرنا کلیلێ بنڤیسە: /gen daily`
          );
          return okResponse();
        }

        const result = await generateBulkKeys({
          tier: tier.id,
          quantity: count,
          provisionOpenRouter: true,
        });

        if (!result.ok || !result.created || !result.codes?.length) {
          const detail =
            result.error ||
            result.failures?.[0]?.error ||
            result.code ||
            'generation_failed';
          throw new Error(String(detail));
        }

        const keysBlock = result.codes.map((code) => `<code>${code}</code>`).join('\n');

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ کلیل هاتە دروستکرن:\n${keysBlock}`,
            parse_mode: 'HTML',
          }),
        });
      } catch (err) {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `❌ خەلەتی: ${err?.message || err}`,
          }),
        });
      }

      return okResponse();
    }

    // /start or anything else
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'بۆت کار دکەت! بۆ چێکرنا کلیلێ بنڤیسە: /gen daily',
      }),
    });

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
