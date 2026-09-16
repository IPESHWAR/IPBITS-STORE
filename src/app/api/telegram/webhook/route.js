import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { approveTopup, rejectTopup } from '@/lib/walletService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getAdminChatId,
  isAuthorizedAdminChat,
} from '@/lib/telegramApprove';

export async function POST(req) {
  try {
    const update = await req.json();

    if (!update?.callback_query) {
      return NextResponse.json({ ok: true });
    }

    const cq = update.callback_query;
    const data = String(cq.data || '');
    const chat = cq.message?.chat || {};
    const chatId = chat.id;
    const messageId = cq.message?.message_id;
    const hasPhoto = !!(cq.message?.photo && cq.message.photo.length);
    const adminChatId = getAdminChatId();

    if (!adminChatId || !isAuthorizedAdminChat(chat, adminChatId)) {
      await answerCallbackQuery(cq.id, '❌ Unauthorized', true);
      return NextResponse.json({ ok: true });
    }

    const isApproveOrder =
      data.startsWith('approve_order:') || data.startsWith('approve:');
    const isRejectOrder = data.startsWith('reject_order:');
    const isApproveTopup = data.startsWith('approve_topup:');
    const isRejectTopup = data.startsWith('reject_topup:');

    if (!isApproveOrder && !isRejectOrder && !isApproveTopup && !isRejectTopup) {
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
          `🆔 \`${topupId}\`\n` +
          `👤 \`${result.topup?.phone || ''}\`\n` +
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
        text: `❌ داخوازییا باڵانسی هاتە ڕەتکرن\n🆔 \`${topupId}\``,
        isCaption: hasPhoto,
      });
      return NextResponse.json({ ok: true });
    }

    if (isApproveOrder) {
      const orderId = data.startsWith('approve_order:')
        ? data.slice('approve_order:'.length).trim()
        : data.slice('approve:'.length).trim();
      await handleApprove({
        orderId,
        chatId,
        messageId,
        hasPhoto,
        callbackId: cq.id,
      });
      return NextResponse.json({ ok: true });
    }

    const orderId = data.slice('reject_order:'.length).trim();
    await handleReject({
      orderId,
      chatId,
      messageId,
      hasPhoto,
      callbackId: cq.id,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

async function handleApprove({ orderId, chatId, messageId, hasPhoto, callbackId }) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    await answerCallbackQuery(callbackId, '❌ Order not found', true);
    return;
  }

  if (order.status === 'approved' && order.license_key) {
    await answerCallbackQuery(callbackId, 'ئۆردەر چالاک بوویە ✅', true);
    await editTelegramMessage({
      chatId,
      messageId,
      text: approvedMessage(order.license_key, order.customer_name, order.customer_phone),
      isCaption: hasPhoto,
    });
    return;
  }

  if (order.status === 'rejected') {
    await answerCallbackQuery(callbackId, '❌ Already rejected', true);
    return;
  }

  let license;
  try {
    license = await generateLicenseForOrder({
      orderId: order.id,
      phone: order.customer_phone,
      name: order.customer_name,
      planType: order.plan_type,
      durationDays: order.duration_days,
      items: order.items || [],
    });
  } catch (err) {
    console.error('Key gen on approve failed:', err);
    await answerCallbackQuery(callbackId, `❌ ${err.message || 'Key error'}`, true);
    return;
  }

  const { error: updErr } = await supabaseAdmin
    .from('orders')
    .update({
      status: 'approved',
      license_key: license.key_code,
      license_key_id: license.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (updErr) {
    // Fallback if license_key_id column does not exist yet
    const { error: fallbackErr } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'approved',
        license_key: license.key_code,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (fallbackErr) {
      console.error('Order approve update failed:', fallbackErr);
      await answerCallbackQuery(callbackId, '❌ DB update failed', true);
      return;
    }
  }

  await answerCallbackQuery(callbackId, 'ئۆردەر چالاک بوویە ✅', true);
  await editTelegramMessage({
    chatId,
    messageId,
    text: approvedMessage(license.key_code, order.customer_name, order.customer_phone),
    isCaption: hasPhoto,
  });
}

function approvedMessage(keyCode, name, phone) {
  return (
    `✅ ئۆردەر هاتە پەسەندکرن ب سەرکەفتیانە!\n` +
    `🔑 کلیلا دروستکری: \`${keyCode}\`\n` +
    `👤 بۆ: ${name} (${phone})`
  );
}

async function handleReject({ orderId, chatId, messageId, hasPhoto, callbackId }) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error || !order) {
    await answerCallbackQuery(callbackId, '❌ Order not found', true);
    return;
  }

  if (order.status === 'approved') {
    await answerCallbackQuery(callbackId, '❌ Already approved', true);
    return;
  }

  await supabaseAdmin
    .from('orders')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', orderId);

  await answerCallbackQuery(callbackId, '❌ هاتە ڕەتکرن', true);
  await editTelegramMessage({
    chatId,
    messageId,
    text:
      `❌ ئۆردەر هاتە ڕەتکرن\n` +
      `🆔 \`${orderId}\`\n` +
      `👤 ${order.customer_name} (${order.customer_phone})`,
    isCaption: hasPhoto,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: '/api/telegram/webhook' });
}
