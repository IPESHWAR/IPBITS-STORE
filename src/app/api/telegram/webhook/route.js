import { NextResponse } from 'next/server';
import { approveTopup, rejectTopup } from '@/lib/walletService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  handleInstantConfirmCallback,
  isConfirmCallbackData,
} from '@/lib/telegramConfirmInstant';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getAdminChatId,
  isAuthorizedAdminChat,
  sendTelegramText,
} from '@/lib/telegramApprove';

export async function POST(req) {
  try {
    const update = await req.json().catch(() => null);
    if (!update?.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const cq = update.callback_query;
    const data = String(cq.data || '');
    const chat = cq.message?.chat || {};
    const chatId = chat.id;
    const messageId = cq.message?.message_id;
    const hasPhoto = !!(cq.message?.photo && cq.message.photo.length);

    console.log('[telegram/webhook] callback_query received', {
      data,
      chatId: String(chatId || ''),
      messageId,
      hasPhoto,
    });

    // Confirm / approve — NO auth gate, NO DB required (guaranteed key)
    if (isConfirmCallbackData(data)) {
      const result = await handleInstantConfirmCallback(cq);
      console.log('[telegram/webhook] instant confirm result', result);
      return NextResponse.json({ ok: true, result });
    }

    const adminChatId = getAdminChatId();
    if (!isAuthorizedAdminChat(chat, adminChatId)) {
      console.warn('[telegram/webhook] unauthorized chat', {
        chatId: String(chatId || ''),
        adminChatId,
      });
      await answerCallbackQuery(cq.id, '❌ Unauthorized', true);
      return NextResponse.json({ ok: true });
    }

    const isRejectOrder = data.startsWith('reject_order:');
    const isApproveTopup = data.startsWith('approve_topup:');
    const isRejectTopup = data.startsWith('reject_topup:');

    if (!isRejectOrder && !isApproveTopup && !isRejectTopup) {
      await answerCallbackQuery(cq.id, 'Unknown action', true);
      return NextResponse.json({ ok: true });
    }

    if (!supabaseAdmin) {
      await answerCallbackQuery(cq.id, '❌ Database not configured', true);
      return NextResponse.json({ ok: true });
    }

    if (isApproveTopup) {
      const topupId = data.slice('approve_topup:'.length).trim();
      const result = await approveTopup(topupId);
      if (!result.ok) {
        await answerCallbackQuery(cq.id, `❌ ${result.code}`, true);
        return NextResponse.json({ ok: true });
      }
      await answerCallbackQuery(cq.id, 'باڵانس هاتە زێدەکرن ✅', true);
      await editTelegramMessage({
        chatId,
        messageId,
        text:
          `✅ باڵانس هاتە زێدەکرن\n` +
          `🆔 ${topupId}\n` +
          `👤 ${result.topup?.phone || ''}\n` +
          `💵 ${Number(result.topup?.amount_iqd || 0).toLocaleString()} IQD`,
        isCaption: hasPhoto,
      });
      return NextResponse.json({ ok: true });
    }

    if (isRejectTopup) {
      const topupId = data.slice('reject_topup:'.length).trim();
      await rejectTopup(topupId);
      await answerCallbackQuery(cq.id, '❌ هاتە ڕەتکرن', true);
      await editTelegramMessage({
        chatId,
        messageId,
        text: `❌ داخوازییا باڵانسی هاتە ڕەتکرن\n🆔 ${topupId}`,
        isCaption: hasPhoto,
      });
      return NextResponse.json({ ok: true });
    }

    const orderId = data.slice('reject_order:'.length).trim();
    await answerCallbackQuery(cq.id, '❌ ڕەتکرن…', false);
    if (orderId) {
      try {
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle();
        if (
          ['approved', 'confirmed', 'completed'].includes(
            String(order?.status || '').toLowerCase()
          )
        ) {
          await sendTelegramText({
            chatId,
            text: `❌ ناتوانرێت ڕەت بکرێت — ئۆردەر بەری نوکە پەسەندکرییە.\n🆔 ${orderId}`,
          });
          return NextResponse.json({ ok: true });
        }
        await supabaseAdmin
          .from('orders')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
          .eq('id', orderId);
      } catch (err) {
        console.error('[telegram/webhook] reject persist failed:', err?.message || err);
      }
    }
    await editTelegramMessage({
      chatId,
      messageId,
      text: `❌ داخوازی هاتە ڕەتکرن\n🆔 ${orderId}`,
      isCaption: hasPhoto,
      replyMarkup: { inline_keyboard: [] },
    });
    await sendTelegramText({
      chatId,
      text: `❌ داخوازی هاتە ڕەتکرن\n🆔 ${orderId}`,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/telegram/webhook',
    features: ['confirm_order', 'approve_order', 'confirm:', 'approve:'],
  });
}
