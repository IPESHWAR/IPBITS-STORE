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
        messageText: cq.message?.text || cq.message?.caption || '',
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
      messageText: cq.message?.text || cq.message?.caption || '',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

/** Pull customer fields from the original Telegram order caption when DB row is missing. */
function parseOrderFromCaption(text) {
  const raw = String(text || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch = raw.match(/📞\s*واتساپ:\s*(.+)/);
  const kindMatch = raw.match(/🏷\s*جۆر:\s*(.+)/);
  const name = String(nameMatch?.[1] || '').trim();
  const phone = String(phoneMatch?.[1] || '').trim();
  const kind = String(kindMatch?.[1] || '').trim();
  return {
    name: name && name !== 'نەدیار' ? name : '',
    phone: phone && phone !== 'نینە' ? phone : '',
    planType: /AI Hub/i.test(kind) ? 'trial' : 'account_service',
  };
}

function orderPhone(order) {
  return order?.customer_phone || order?.phone || '';
}

function orderName(order) {
  return order?.customer_name || order?.name || '';
}

async function handleApprove({
  orderId,
  chatId,
  messageId,
  hasPhoto,
  callbackId,
  messageText,
}) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  const parsed = parseOrderFromCaption(messageText);
  const name = orderName(order) || parsed.name || '—';
  const phone = orderPhone(order) || parsed.phone || '';
  const planType = order?.plan_type || parsed.planType || 'trial';
  const durationDays = order?.duration_days ?? null;
  const items = order?.items || [];

  if (order?.status === 'approved' && order.license_key) {
    await answerCallbackQuery(callbackId, 'ئۆردەر چالاک بوویە ✅', true);
    await editTelegramMessage({
      chatId,
      messageId,
      text: approvedMessage(order.license_key, name, phone),
      isCaption: hasPhoto,
    });
    return;
  }

  if (order?.status === 'rejected') {
    await answerCallbackQuery(callbackId, '❌ Already rejected', true);
    return;
  }

  let license;
  try {
    license = await generateLicenseForOrder({
      orderId: orderId || order?.id,
      phone,
      name,
      planType,
      durationDays,
      items,
    });
  } catch (err) {
    console.error('Key gen on approve failed:', err);
    await answerCallbackQuery(callbackId, `❌ ${err.message || 'Key error'}`, true);
    return;
  }

  if (order?.id) {
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
      }
    }
  } else {
    // Order row missing — still fulfill; try a best-effort upsert so later lookups work
    const { error: upsertErr } = await supabaseAdmin.from('orders').upsert(
      {
        id: orderId,
        phone: phone || null,
        customer_name: name !== '—' ? name : null,
        customer_phone: phone || null,
        status: 'approved',
        license_key: license.key_code,
        plan_type: planType,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
    if (upsertErr) {
      console.warn('Approve upsert skipped:', upsertErr.message);
    }
  }

  await answerCallbackQuery(callbackId, 'ئۆردەر چالاک بوویە ✅', true);
  await editTelegramMessage({
    chatId,
    messageId,
    text: approvedMessage(license.key_code, name, phone),
    isCaption: hasPhoto,
  });
}

function approvedMessage(keyCode, name, phone) {
  return (
    `✅ ئۆردەر هاتە پەسەندکرن ب سەرکەفتیانە!\n` +
    `🔑 کلیلا دروستکری: \`${keyCode}\`\n` +
    `👤 بۆ: ${name} (${phone || '—'})`
  );
}

async function handleReject({
  orderId,
  chatId,
  messageId,
  hasPhoto,
  callbackId,
  messageText,
}) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  const parsed = parseOrderFromCaption(messageText);
  const name = orderName(order) || parsed.name || '—';
  const phone = orderPhone(order) || parsed.phone || '—';

  if (order?.status === 'approved') {
    await answerCallbackQuery(callbackId, '❌ Already approved', true);
    return;
  }

  if (order?.id) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }

  await answerCallbackQuery(callbackId, '❌ هاتە ڕەتکرن', true);
  await editTelegramMessage({
    chatId,
    messageId,
    text:
      `❌ ئۆردەر هاتە ڕەتکرن\n` +
      `🆔 \`${orderId}\`\n` +
      `👤 ${name} (${phone})`,
    isCaption: hasPhoto,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: '/api/telegram/webhook' });
}
