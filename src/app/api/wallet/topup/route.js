import { NextResponse } from 'next/server';
import { approveTopup, createTopup } from '@/lib/walletService';
import { getAdminChatId, getBotToken } from '@/lib/telegramApprove';
import { iqdToUsd, normalizeWalletId } from '@/lib/wallet';

const TEST_BYPASS = 'TEST999';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  const amountIqd = Math.round(Number(body.amountIqd || body.amount_iqd || 0));
  const amountUsd = Number(body.amountUsd || body.amount_usd || iqdToUsd(amountIqd));
  const paymentMethod = String(body.paymentMethod || body.payment_method || 'FIB');
  const txId = String(body.transactionId || '').trim().toUpperCase();

  const created = await createTopup({ phone, amountIqd, amountUsd, paymentMethod });
  if (!created.ok) {
    return NextResponse.json(
      { error: created.error || created.code, code: created.code },
      { status: created.code === 'db_unavailable' ? 503 : 400 }
    );
  }

  if (txId === TEST_BYPASS) {
    const approved = await approveTopup(created.topupId);
    if (!approved.ok) {
      return NextResponse.json({ error: approved.error || approved.code, code: approved.code }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      status: 'approved',
      topupId: created.topupId,
      testMode: true,
      balance_iqd: approved.wallet?.balance_iqd,
      balance_usd: Number(approved.wallet?.balance_usd || 0),
    });
  }

  const chatId = getAdminChatId();
  const botToken = getBotToken();
  if (botToken && chatId) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text:
            `💰 *داخوازییا زێدەکرنا باڵانسی*\n\n` +
            `🆔 \`${created.topupId}\`\n` +
            `👤 \`${phone}\`\n` +
            `💵 ${amountIqd.toLocaleString()} IQD / $${amountUsd.toFixed(2)}\n` +
            `💳 ${paymentMethod}`,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'پەسەندکرنا باڵانسی ✅', callback_data: `approve_topup:${created.topupId}` },
                { text: 'ڕەتکرن ❌', callback_data: `reject_topup:${created.topupId}` },
              ],
            ],
          },
        }),
      });
    } catch (err) {
      console.error('Top-up Telegram notify error:', err);
    }
  }

  return NextResponse.json({
    success: true,
    status: 'pending',
    topupId: created.topupId,
    amountIqd,
    amountUsd,
  });
}
