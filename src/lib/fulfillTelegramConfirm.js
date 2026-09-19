/**
 * Bulletproof Telegram Confirm → license key flow.
 * Called directly from /api/telegram-webhook (no cross-route import).
 */
import { generateLicenseKey, normalizePlanPrefix } from '@/lib/generateKey';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { inferPlanFromText, resolvePlanFromOrderContext } from '@/config/plans';
import {
  answerCallbackQuery,
  buildReceiptKeyboard,
  editTelegramMessage,
  getOrderReceiptUrl,
  sendTelegramText,
  toWhatsAppDigits,
} from '@/lib/telegramApprove';

const CALLBACK_PLAN_RE =
  /^(1D|7D|30D|90D|365D|1Y|TEST|TEST_1D|WEEKLY|MONTHLY|YEARLY|TST|WK|MO|3M|YR)$/i;

function parseCallback(data) {
  const raw = String(data || '');
  let rest = '';
  if (raw.startsWith('confirm_order:')) rest = raw.slice('confirm_order:'.length);
  else if (raw.startsWith('approve_order:')) rest = raw.slice('approve_order:'.length);
  else if (raw.startsWith('approve:')) rest = raw.slice('approve:'.length);
  else return { orderId: '', planId: '' };
  const parts = rest.split(':').filter(Boolean);
  return { orderId: parts[0] || '', planId: parts[1] || '' };
}

function parseCaption(text) {
  const raw = String(text || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch = raw.match(/📞\s*واتساپ:\s*(.+)/);
  const kindMatch = raw.match(/🏷\s*جۆر:\s*(.+)/);
  const planMatch = raw.match(/🏷\s*پلان:\s*([A-Za-z0-9]+)/);
  const productMatch =
    raw.match(/📦\s*بەرهەم:\s*(.+)/) ||
    raw.match(/AI Hub\s*[-–:]\s*(.+)/i);
  const kind = String(kindMatch?.[1] || '').trim();
  const captionKind = /AI Hub/i.test(kind) || /AI Hub/i.test(raw)
    ? 'ai'
    : /Account Service/i.test(kind) || /Account Service/i.test(raw)
      ? 'account'
      : '';
  let planType = '';
  if (captionKind === 'ai' || /تێست|تیست|هەفت|مەهانە|ساڵانە|AI Hub/i.test(raw)) {
    const inferred = inferPlanFromText(`${productMatch?.[1] || ''} ${raw}`);
    planType = inferred?.plan_type || 'test_1d';
  } else if (captionKind === 'account') {
    planType = 'account_service';
  }
  return {
    name: String(nameMatch?.[1] || '').trim(),
    phone: String(phoneMatch?.[1] || '').trim(),
    product: String(productMatch?.[1] || '').trim(),
    planFromCaption: String(planMatch?.[1] || '').trim(),
    planType,
    captionKind,
  };
}

function isAccountService({ captionKind, planType, messageText, planId }) {
  const msg = String(messageText || '');
  const explicitAccount =
    captionKind === 'account' ||
    planType === 'account_service' ||
    /Account Service/i.test(msg);
  const explicitAi = captionKind === 'ai' || /AI Hub/i.test(msg);
  if (explicitAccount && !explicitAi) return true;
  if (explicitAi) return false;
  if (planId && CALLBACK_PLAN_RE.test(String(planId))) return false;
  return false;
}

function buildConfirmMessage({ keyCode, orderId, name, phone, planSuffix }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `👤 کڕیار: ${name || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    (planSuffix ? `📦 پلان: ${planSuffix}\n` : '') +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🔑 کۆدێ ئەکتیڤکرنێ: ${keyCode || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🖨 وەسڵ حازرە بۆ چاپکرنێ\n` +
    `${getOrderReceiptUrl(orderId)}`
  );
}

function buildAccountMessage({ orderId, name, phone, product }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `📦 بەرهەم: ${product || '—'}\n` +
    `👤 کڕیار: ${name || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🖨 وەسڵ حازرە بۆ چاپکرنێ\n` +
    `${getOrderReceiptUrl(orderId)}\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `تکایە زانیاریێن ئەکاونتی (ئیمەیڵ و پاسۆرد) ب ڕێکا واتساپێ بۆ کڕیاری بفرێژە.`
  );
}

async function publish({ chatId, messageId, hasPhoto, text, orderId, extraRows = [] }) {
  const markup = buildReceiptKeyboard(orderId, extraRows);
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
    replyMarkup: markup,
  });
}

async function persistLicense({ orderId, phone, name, keyCode, planType, durationDays, itemsLabel }) {
  if (!supabaseAdmin || !orderId) return;
  const payload = {
    plan_type: planType || null,
    duration_days: durationDays || null,
    status: 'confirmed',
    updated_at: new Date().toISOString(),
  };
  if (keyCode) payload.license_key = keyCode;

  let { error } = await supabaseAdmin.from('orders').update(payload).eq('id', orderId);
  if (error) {
    ({ error } = await supabaseAdmin
      .from('orders')
      .update({ ...payload, status: 'approved' })
      .eq('id', orderId));
  }
  if (error) {
    const upsert = {
      id: orderId,
      phone: phone || null,
      customer_name: name && name !== '—' ? name : null,
      customer_phone: phone || null,
      items_label: itemsLabel || null,
      ...payload,
    };
    ({ error } = await supabaseAdmin.from('orders').upsert(upsert, { onConflict: 'id' }));
    if (error) {
      console.warn('[fulfillTelegramConfirm] persist skipped:', error.message);
    }
  }
}

/**
 * Fulfill Confirm button click. Always answers callback + always emits a key for AI Hub.
 * @param {object} cq Telegram callback_query
 * @param {{ skipAnswer?: boolean }} [opts]
 */
export async function fulfillTelegramConfirm(cq, opts = {}) {
  const data = String(cq?.data || '');
  const chatId = cq?.message?.chat?.id;
  const messageId = cq?.message?.message_id;
  const hasPhoto = !!(cq?.message?.photo && cq.message.photo.length);
  const messageText = cq?.message?.text || cq?.message?.caption || '';
  const { orderId, planId } = parseCallback(data);

  console.log('[fulfillTelegramConfirm] start', { data, orderId, planId, chatId });

  if (!opts.skipAnswer && cq?.id) {
    await answerCallbackQuery(cq.id, 'داخوازی هاتە پەسەندکرن!', false);
  }

  const parsed = parseCaption(messageText);

  let order = null;
  if (supabaseAdmin && orderId) {
    const { data: row, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) {
      console.warn('[fulfillTelegramConfirm] DB miss (using caption/callback):', error.message);
    }
    order = row || null;
  } else if (!orderId) {
    console.warn('[fulfillTelegramConfirm] no orderId in callback — caption/plan fallback only');
  }

  const name = order?.customer_name || order?.name || parsed.name || '—';
  const phone = order?.customer_phone || order?.phone || parsed.phone || '';
  const items = order?.items || [];
  const itemsLabel = order?.items_label || parsed.product || '';
  const productTitle = parsed.product || itemsLabel || 'AI Hub';

  if (order?.status === 'rejected') {
    await sendTelegramText({
      chatId,
      text: `❌ ئەڤ ئۆردەرە بەری نوکە هاتە ڕەتکرن.\n🆔 ${orderId}`,
    });
    return { ok: false, reason: 'rejected' };
  }

  const account = isAccountService({
    captionKind: parsed.captionKind,
    planType: order?.plan_type || parsed.planType,
    messageText,
    planId,
  });

  if (account) {
    if (supabaseAdmin && orderId) {
      await persistLicense({
        orderId,
        phone,
        name,
        keyCode: null,
        planType: 'account_service',
        durationDays: null,
        itemsLabel: productTitle,
      });
    }
    const cleanPhone = toWhatsAppDigits(phone);
    const waRows = cleanPhone
      ? [
          [
            {
              text: '📲 ناردن ب واتساپێ',
              url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `سڵاڤ کڕیارێ هێژا، داخوازییا تە یا (${productTitle}) هاتە پەسەندکرن. ئەڤە زانیاریێن ئەکاونتێ تە نە:\nئیمەیڵ:\nپاسۆرد:`
              )}`,
            },
          ],
        ]
      : [];
    await publish({
      chatId,
      messageId,
      hasPhoto,
      text: buildAccountMessage({ orderId, name, phone, product: productTitle }),
      orderId,
      extraRows: waRows,
    });
    return { ok: true, kind: 'account' };
  }

  // Already fulfilled — re-send existing key
  if (
    order?.license_key &&
    ['confirmed', 'approved', 'completed'].includes(String(order.status || '').toLowerCase())
  ) {
    const plan = resolvePlanFromOrderContext({
      planId: planId || parsed.planFromCaption,
      planType: order.plan_type,
      durationDays: order.duration_days,
      items,
      itemsLabel,
      messageText,
      productTitle,
      totalIQD: Number(order.total_iqd || 0),
      totalUSD: Number(order.total_usd || 0),
    });
    await publish({
      chatId,
      messageId,
      hasPhoto,
      text: buildConfirmMessage({
        keyCode: order.license_key,
        orderId,
        name,
        phone,
        planSuffix: plan.plan_suffix,
      }),
      orderId,
    });
    return { ok: true, kind: 'ai', key: order.license_key, reused: true };
  }

  // Resolve plan: callback → caption پلان line → message text → DB → default 30D
  const resolved = resolvePlanFromOrderContext({
    planId: planId || parsed.planFromCaption || undefined,
    planType: order?.plan_type || parsed.planType,
    durationDays: order?.duration_days,
    items,
    itemsLabel,
    messageText,
    productTitle,
    totalIQD: Number(order?.total_iqd || 0),
    totalUSD: Number(order?.total_usd || 0),
  });
  const planSuffix = normalizePlanPrefix(resolved.plan_suffix || planId || '30D');
  const planType = resolved.plan_type;
  const durationDays = resolved.duration_days;

  // GUARANTEED key — never blocked by DB / OpenRouter
  let keyCode = generateLicenseKey(planSuffix);
  console.log('[fulfillTelegramConfirm] guaranteed key', { keyCode, planSuffix, orderId });

  try {
    const license = await generateLicenseForOrder({
      orderId: orderId || order?.id,
      phone,
      name,
      planType,
      durationDays,
      planSuffix,
      items,
      itemsLabel,
    });
    if (license?.key_code) {
      keyCode = license.key_code;
      console.log('[fulfillTelegramConfirm] DB/OpenRouter key', {
        keyCode,
        source: license.source,
      });
    }
  } catch (err) {
    console.warn(
      '[fulfillTelegramConfirm] generateLicenseForOrder failed — using guaranteed key:',
      err?.message || err
    );
  }

  await persistLicense({
    orderId,
    phone,
    name,
    keyCode,
    planType,
    durationDays,
    itemsLabel: itemsLabel || productTitle,
  });

  await publish({
    chatId,
    messageId,
    hasPhoto,
    text: buildConfirmMessage({
      keyCode,
      orderId,
      name,
      phone,
      planSuffix,
    }),
    orderId,
  });

  return { ok: true, kind: 'ai', key: keyCode };
}
