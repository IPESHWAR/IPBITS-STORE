import { NextResponse } from 'next/server';
import { getBotToken } from '@/lib/telegramApprove';

function resolveAppUrl(req) {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return '';
}

/**
 * One-click Telegram webhook registration.
 * GET /api/telegram/setup-webhook
 * Optional: ?secret=LICENSE_ADMIN_SECRET to protect in production.
 */
export async function GET(req) {
  try {
    const botToken = getBotToken();
    if (!botToken) {
      return NextResponse.json({ ok: false, error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const setupSecret = process.env.LICENSE_ADMIN_SECRET || process.env.TELEGRAM_SETUP_SECRET;
    if (setupSecret) {
      const provided = searchParams.get('secret') || '';
      if (provided !== setupSecret) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    const appUrl = resolveAppUrl(req);
    if (!appUrl || appUrl.includes('localhost')) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Public APP URL required. Set NEXT_PUBLIC_APP_URL to your HTTPS domain (Telegram cannot reach localhost).',
          hint: 'Example: NEXT_PUBLIC_APP_URL=https://your-domain.com then open /api/telegram/setup-webhook',
        },
        { status: 400 }
      );
    }

    const webhookUrl = `${appUrl}/api/telegram-webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
    const params = new URLSearchParams({
      url: webhookUrl,
      allowed_updates: JSON.stringify(['callback_query', 'message']),
      drop_pending_updates: 'false',
    });
    if (secret) params.set('secret_token', secret);

    const setRes = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook?${params.toString()}`
    );
    const setJson = await setRes.json();

    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const infoJson = await infoRes.json();

    return NextResponse.json({
      ok: !!setJson.ok,
      webhookUrl,
      setWebhook: setJson,
      webhookInfo: infoJson.result || infoJson,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
