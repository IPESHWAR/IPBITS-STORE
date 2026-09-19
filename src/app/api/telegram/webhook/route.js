import { NextResponse } from 'next/server';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { generateLicenseKey } from '@/lib/generateKey';
import { approveTopup, rejectTopup } from '@/lib/walletService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { inferPlanFromText, resolvePlanFromOrderContext } from '@/config/plans';
import {
  answerCallbackQuery,
  buildReceiptKeyboard,
  classifyOrderKind,
  editTelegramMessage,
  getAdminChatId,
  getOrderReceiptUrl,
  isAuthorizedAdminChat,
  sendTelegramText,
  toWhatsAppDigits,
} from '@/lib/telegramApprove';

const CALLBACK_PLAN_RE =
  /^(1D|7D|30D|90D|365D|1Y|TEST|TEST_1D|WEEKLY|MONTHLY|YEARLY|TST|WK|MO|3M|YR)$/i;
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

    console.log('[telegram/webhook] callback_query received', {
      data,
      chatId: String(chatId || ''),
      messageId,
      hasPhoto,
    });

    if (!isAuthorizedAdminChat(chat, adminChatId)) {
      console.warn('[telegram/webhook] unauthorized chat', {
        chatId: String(chatId || ''),
        adminChatId,
      });
      await answerCallbackQuery(cq.id, '❌ Unauthorized', true);
      return NextResponse.json({ ok: true });
    }

    const isApproveOrder =
      data.startsWith('confirm_order:') ||
      data.startsWith('approve_order:') ||
      data.startsWith('approve:');
    const isRejectOrder = data.startsWith('reject_order:');
    const isApproveTopup = data.startsWith('approve_topup:');
    const isRejectTopup = data.startsWith('reject_topup:');

    if (!isApproveOrder && !isRejectOrder && !isApproveTopup && !isRejectTopup) {
      await answerCallbackQuery(cq.id, 'Unknown action', true);
      return NextResponse.json({ ok: true });
    }

    // Topups / rejects need DB; confirm can still emit an ephemeral key without it.
    if (!supabaseAdmin && (isApproveTopup || isRejectTopup || isRejectOrder)) {
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

    if (isApproveOrder) {
      let rest = '';
      if (data.startsWith('confirm_order:')) rest = data.slice('confirm_order:'.length).trim();
      else if (data.startsWith('approve_order:')) rest = data.slice('approve_order:'.length).trim();
      else rest = data.slice('approve:'.length).trim();
      const parts = rest.split(':').filter(Boolean);
      const orderId = parts[0] || '';
      const planIdFromCallback = parts[1] || '';
      console.log('[telegram/webhook] confirm_order → handleApprove', {
        orderId,
        planIdFromCallback,
      });
      await handleApprove({
        orderId,
        planId: planIdFromCallback,
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
  const productMatch =
    raw.match(/📦\s*بەرهەم:\s*(.+)/) ||
    raw.match(/پشکداری[اێ]?[:\s]+(.+)/i) ||
    raw.match(/AI Hub\s*[-–:]\s*(.+)/i);
  const name = String(nameMatch?.[1] || '').trim();
  const phone = String(phoneMatch?.[1] || '').trim();
  const kind = String(kindMatch?.[1] || '').trim();
  const product = String(productMatch?.[1] || '').trim();
  const captionKind = /AI Hub/i.test(kind) || /AI Hub/i.test(raw)
    ? 'ai'
    : /Account Service/i.test(kind)
      ? 'account'
      : '';
  // Do NOT default to account_service — that silently skips license generation.
  let planType = '';
  if (captionKind === 'ai' || /تێست|تیست|تست|هەفتانە|مانگانە|مەهانە|ساڵانە|سالانە|AI Hub|پلان:\s*\d+D/i.test(raw)) {
    const inferred = inferPlanFromText(`${product} ${raw}`);
    planType = inferred?.plan_type || 'test_1d';
  } else if (captionKind === 'account') {
    planType = 'account_service';
  }
  return {
    name: name && name !== 'نەدیار' ? name : '',
    phone: phone && phone !== 'نینە' ? phone : '',
    product: product && product !== '—' ? product : '',
    planType,
    captionKind:
      captionKind ||
      (planType && planType !== 'account_service' ? 'ai' : captionKind),
  };
}

function orderPhone(order) {
  return order?.customer_phone || order?.phone || '';
}

function orderName(order) {
  return order?.customer_name || order?.name || '';
}

function productTitleFromOrder(order, items, itemsLabel, parsedProduct) {
  if (parsedProduct) return parsedProduct;
  if (order?.items_label) return String(order.items_label).split(',')[0].trim();
  const list = Array.isArray(items) ? items : [];
  const fromItem = list[0]?.name || list[0]?.title;
  if (fromItem) return String(fromItem).trim();
  if (itemsLabel) return String(itemsLabel).split(',')[0].trim();
  return 'Subscription';
}

/** Account Services must never generate IPBITS voucher keys. */
function isAccountServiceOrder({
  order,
  items,
  itemsLabel,
  planType,
  messageText,
  totalIQD,
  captionKind,
  planIdFromCallback,
}) {
  const msg = String(messageText || '');
  const explicitAccount =
    captionKind === 'account' ||
    planType === 'account_service' ||
    /Account Service/i.test(msg);
  const explicitAiCaption = captionKind === 'ai' || /AI Hub/i.test(msg);
  const callbackHasPlan =
    !!planIdFromCallback && CALLBACK_PLAN_RE.test(String(planIdFromCallback));

  // Caption/DB Account Service wins over a bare duration tag (legacy :1D default).
  if (explicitAccount && !explicitAiCaption) return true;
  if (explicitAiCaption) return false;
  // No account signal + plan duration in callback → AI Hub voucher path.
  if (callbackHasPlan) return false;

  const list = Array.isArray(items) ? items : [];
  const hay = [
    itemsLabel,
    order?.items_label,
    ...list.map((i) => `${i?.id || ''} ${i?.slug || ''} ${i?.name || ''} ${i?.title || ''}`),
    messageText,
  ]
    .join(' ')
    .toLowerCase();

  const accountRe =
    /claude|chatgpt|chat\s*gpt|netflix|canva|youtube|spotify|disney|prime\s*video|adobe|grammarly|midjourney|perplexity|shahid|osn|account\s*service|ئەکاونت/;
  if (accountRe.test(hay)) return true;

  const aiPlanTypes = new Set([
    'trial',
    'test',
    'daily',
    'weekly',
    'monthly',
    '3months',
    'three_months',
    'yearly',
    'test_1d',
    'weekly_7d',
    'monthly_30d',
    'quarterly_90d',
    'yearly_1y',
  ]);
  if (planType && aiPlanTypes.has(String(planType))) return false;

  const { kind } = classifyOrderKind(items, itemsLabel || order?.items_label || '', totalIQD);
  return kind === 'account';
}

function accountApprovedMessage(productTitle, customerName, customerPhone, orderId) {
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Baghdad', hour12: false });
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `📅 کات: ${when}\n` +
    `📦 بەرهەم: ${productTitle}\n` +
    `👤 کڕیار: ${customerName}\n` +
    `📞 واتساپ: ${customerPhone || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🖨 چاپکرنا وەسڵێ:\n` +
    `${getOrderReceiptUrl(orderId)}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `تکایە زانیاریێن ئەکاونتی (ئیمەیڵ و پاسۆرد) ب ڕێکا واتساپێ بۆ کڕیاری بفرێژە.`
  );
}

function buildAccountWaKeyboard(cleanPhone, productTitle) {
  if (!cleanPhone) return { inline_keyboard: [] };
  const waText =
    `سڵاڤ کڕیارێ هێژا، داخوازییا تە یا (${productTitle}) هاتە پەسەندکرن. ئەڤە زانیاریێن ئەکاونتێ تە نە:\n` +
    `ئیمەیڵ:\n` +
    `پاسۆرد:`;
  return {
    inline_keyboard: [
      [
        {
          text: '📲 ناردن ب واتساپێ',
          url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`,
        },
      ],
    ],
  };
}

function approvedReceipt({
  keyCode,
  name,
  phone,
  orderId,
  productTitle,
  planSuffix,
  durationDays,
  totalIQD,
  totalUSD,
  paymentMethod,
  transactionId,
}) {
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Baghdad', hour12: false });
  const money =
    Number(totalUSD) > 0
      ? `$${Number(totalUSD).toFixed(2)}` +
        (Number(totalIQD) > 0 ? ` · IQD ${Number(totalIQD).toLocaleString('en-US')}` : '')
      : Number(totalIQD) > 0
        ? `IQD ${Number(totalIQD).toLocaleString('en-US')}`
        : '—';
  const planLine = [productTitle, planSuffix ? `(${planSuffix})` : '', durationDays ? `· ${durationDays} ڕۆژ` : '']
    .filter(Boolean)
    .join(' ');

  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `📅 کات: ${when}\n` +
    `👤 کڕیار: ${name || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    `📦 پلان: ${planLine || '—'}\n` +
    `💰 گشتی: ${money}\n` +
    (paymentMethod ? `💳 پارەدان: ${paymentMethod}\n` : '') +
    (transactionId ? `🔢 وەسڵ: ${transactionId}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🔑 کۆدێ چالاککرنێ:\n` +
    `${keyCode || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🖨 چاپکرنا وەسڵێ:\n` +
    `${getOrderReceiptUrl(orderId)}`
  );
}

function isFulfilledStatus(status) {
  const s = String(status || '').toLowerCase();
  return s === 'approved' || s === 'confirmed' || s === 'completed';
}

async function publishConfirmation({
  chatId,
  messageId,
  hasPhoto,
  text,
  orderId,
  replyMarkup,
}) {
  const markup =
    replyMarkup ||
    (orderId ? buildReceiptKeyboard(orderId) : { inline_keyboard: [] });

  await editTelegramMessage({
    chatId,
    messageId,
    text,
    isCaption: hasPhoto,
    parseMode: null,
    replyMarkup: markup,
  });
  await sendTelegramText({
    chatId,
    text,
    replyMarkup: markup?.inline_keyboard?.length ? markup : undefined,
  });
}

async function markOrderConfirmed(orderId, extra = {}) {
  if (!orderId || !supabaseAdmin) return;
  const base = {
    updated_at: new Date().toISOString(),
    ...extra,
  };
  // Prefer "confirmed"; fall back to "approved" if DB constraint rejects it
  let { error } = await supabaseAdmin
    .from('orders')
    .update({ ...base, status: 'confirmed' })
    .eq('id', orderId);
  if (error) {
    ({ error } = await supabaseAdmin
      .from('orders')
      .update({ ...base, status: 'approved' })
      .eq('id', orderId));
  }
  if (error) {
    console.warn('Order confirm update failed:', error.message);
  }
}

async function handleApprove({
  orderId,
  planId,
  chatId,
  messageId,
  hasPhoto,
  callbackId,
  messageText,
}) {
  // Stop Telegram loading spinner immediately (callback can only be answered once)
  await answerCallbackQuery(callbackId, 'داخوازی هاتە پەسەندکرن!', false);

  let order = null;
  if (supabaseAdmin && orderId) {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) {
      console.warn('[handleApprove] order lookup failed:', error.message, { orderId });
    }
    order = data || null;
  }

  console.log('[handleApprove] start', {
    orderId,
    planId,
    foundOrder: !!order?.id,
    orderStatus: order?.status || null,
    orderPlanType: order?.plan_type || null,
  });

  const parsed = parseOrderFromCaption(messageText);
  const name = orderName(order) || parsed.name || '—';
  const phone = orderPhone(order) || parsed.phone || '';
  const items = order?.items || [];
  const itemsLabel = order?.items_label || parsed.product || '';
  const totalIQD = Number(order?.total_iqd || 0);
  const totalUSD = Number(order?.total_usd || 0);
  const paymentMethod = order?.payment_method || '';
  const transactionId = order?.transaction_id || '';
  const productTitle = productTitleFromOrder(order, items, itemsLabel, parsed.product);
  const resolvedPlan = resolvePlanFromOrderContext({
    planId: planId || undefined,
    planType: order?.plan_type || parsed.planType,
    durationDays: order?.duration_days,
    items,
    itemsLabel,
    messageText,
    productTitle,
    totalIQD,
    totalUSD,
  });
  const planType = resolvedPlan.plan_type;
  const durationDays = resolvedPlan.duration_days;
  const planSuffix = resolvedPlan.plan_suffix;
  const cleanPhone = toWhatsAppDigits(phone);
  const accountService = isAccountServiceOrder({
    order,
    items,
    itemsLabel,
    planType: order?.plan_type || parsed.planType,
    messageText,
    totalIQD,
    captionKind: parsed.captionKind,
    planIdFromCallback: planId,
  });

  console.log('[handleApprove] resolved', {
    planType,
    planSuffix,
    durationDays,
    accountService,
    captionKind: parsed.captionKind,
  });

  if (order?.status === 'rejected') {
    await sendTelegramText({
      chatId,
      text: `❌ ئەڤ ئۆردەرە بەری نوکە هاتە ڕەتکرن.\n🆔 ${orderId}`,
    });
    return;
  }

  // ——— Account Services: never generate IPBITS voucher keys ———
  if (accountService) {
    if (order?.id) {
      await markOrderConfirmed(orderId, { plan_type: 'account_service' });
    } else if (orderId && supabaseAdmin) {
      const upsertPayload = {
        id: orderId,
        phone: phone || null,
        customer_name: name !== '—' ? name : null,
        customer_phone: phone || null,
        items_label: productTitle,
        plan_type: 'account_service',
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      };
      let { error: upsertErr } = await supabaseAdmin
        .from('orders')
        .upsert(upsertPayload, { onConflict: 'id' });
      if (upsertErr) {
        upsertPayload.status = 'approved';
        ({ error: upsertErr } = await supabaseAdmin
          .from('orders')
          .upsert(upsertPayload, { onConflict: 'id' }));
      }
      if (upsertErr) console.warn('Account confirm upsert skipped:', upsertErr.message);
    }

    const text = accountApprovedMessage(productTitle, name, phone, orderId);
    const waRows = buildAccountWaKeyboard(cleanPhone, productTitle).inline_keyboard || [];
    await publishConfirmation({
      chatId,
      messageId,
      hasPhoto,
      text,
      orderId,
      replyMarkup: buildReceiptKeyboard(orderId, waRows),
    });
    return;
  }

  // ——— AI Hub only: generate voucher / license keys ———
  if (isFulfilledStatus(order?.status) && order.license_key) {
    const text = approvedReceipt({
      keyCode: order.license_key,
      name,
      phone,
      orderId,
      productTitle,
      planSuffix,
      durationDays: order.duration_days || durationDays,
      totalIQD,
      totalUSD,
      paymentMethod,
      transactionId,
    });
    await publishConfirmation({ chatId, messageId, hasPhoto, text, orderId });
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
      planSuffix,
      items,
      itemsLabel,
    });
  } catch (err) {
    console.error('Key gen on confirm failed, using local fallback:', err);
    const fallbackCode = generateLicenseKey(planSuffix || '30D');
    license = {
      key_code: fallbackCode,
      plan_type: planType,
      duration_days: durationDays,
      source: 'local_fallback',
    };
  }

  console.log('[handleApprove] license ready', {
    key: license?.key_code,
    source: license?.source,
  });

  const licenseUpdate = {
    license_key: license.key_code,
    license_key_id: license.id || null,
    plan_type: planType,
    duration_days: durationDays,
    updated_at: new Date().toISOString(),
  };

  if (supabaseAdmin && order?.id) {
    let { error: updErr } = await supabaseAdmin
      .from('orders')
      .update({ ...licenseUpdate, status: 'confirmed' })
      .eq('id', orderId);

    if (updErr) {
      ({ error: updErr } = await supabaseAdmin
        .from('orders')
        .update({
          status: 'approved',
          license_key: license.key_code,
          plan_type: planType,
          duration_days: durationDays,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId));
    }

    if (updErr) {
      console.error('Order confirm update failed:', updErr);
    }
  } else if (supabaseAdmin && orderId) {
    const upsertPayload = {
      id: orderId,
      phone: phone || null,
      customer_name: name !== '—' ? name : null,
      customer_phone: phone || null,
      status: 'confirmed',
      license_key: license.key_code,
      plan_type: planType,
      duration_days: durationDays,
      items_label: itemsLabel || productTitle || null,
      total_iqd: totalIQD || null,
      total_usd: totalUSD || null,
      updated_at: new Date().toISOString(),
    };
    let { error: upsertErr } = await supabaseAdmin
      .from('orders')
      .upsert(upsertPayload, { onConflict: 'id' });
    if (upsertErr) {
      upsertPayload.status = 'approved';
      ({ error: upsertErr } = await supabaseAdmin
        .from('orders')
        .upsert(upsertPayload, { onConflict: 'id' }));
    }
    if (upsertErr) {
      console.warn('Confirm upsert skipped:', upsertErr.message);
    }
  }

  const text = approvedReceipt({
    keyCode: license.key_code,
    name,
    phone,
    orderId,
    productTitle,
    planSuffix,
    durationDays,
    totalIQD,
    totalUSD,
    paymentMethod,
    transactionId,
  });
  await publishConfirmation({ chatId, messageId, hasPhoto, text, orderId });
}

async function handleReject({
  orderId,
  chatId,
  messageId,
  hasPhoto,
  callbackId,
  messageText,
}) {
  await answerCallbackQuery(callbackId, '❌ ڕەتکرن…', false);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  const parsed = parseOrderFromCaption(messageText);
  const name = orderName(order) || parsed.name || '—';
  const phone = orderPhone(order) || parsed.phone || '—';

  if (order?.status === 'approved' || order?.status === 'confirmed') {
    await sendTelegramText({
      chatId,
      text: `❌ ناتوانرێت ڕەت بکرێت — ئۆردەر بەری نوکە پەسەندکرییە.\n🆔 ${orderId}`,
    });
    return;
  }

  if (order?.id) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', orderId);
  }

  const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Baghdad', hour12: false });
  const text =
    `❌ ئۆردەر هاتە ڕەتکرن\n` +
    `🆔 ${orderId}\n` +
    `📅 کات: ${when}\n` +
    `👤 ${name} (${phone})`;

  await editTelegramMessage({
    chatId,
    messageId,
    text,
    isCaption: hasPhoto,
    parseMode: null,
  });
  await sendTelegramText({ chatId, text });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: '/api/telegram/webhook' });
}
