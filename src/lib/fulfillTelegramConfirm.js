/**
 * Bulletproof Telegram Confirm → license key flow.
 * Called directly from /api/telegram-webhook (no cross-route import).
 */
import { generateLicenseKey, normalizePlanPrefix } from '@/lib/generateKey';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  inferPlanFromPrice,
  inferPlanFromText,
  resolvePlanFromOrderContext,
  resolvePlanFromPlanId,
  SUBSCRIPTION_PLANS,
} from '@/config/plans';
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

const PLAN_BY_SUFFIX = {
  '1D': SUBSCRIPTION_PLANS.test,
  '7D': SUBSCRIPTION_PLANS.weekly,
  '30D': SUBSCRIPTION_PLANS.monthly,
  '90D': SUBSCRIPTION_PLANS.three_months,
  '365D': SUBSCRIPTION_PLANS.yearly,
};

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

function isAiHubText(text) {
  const t = String(text || '');
  return /AI\s*Hub|Al\s*Hub|AIHub/i.test(t);
}

function parseCaption(text) {
  const raw = String(text || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch = raw.match(/📞\s*واتساپ:\s*(.+)/);
  const kindMatch = raw.match(/🏷\s*جۆر:\s*(.+)/);
  const planMatch = raw.match(/🏷\s*پلان:\s*([A-Za-z0-9]+)/);
  const productMatch =
    raw.match(/📦\s*بەرهەم:\s*(.+)/) ||
    raw.match(/(?:AI|Al)\s*Hub\s*[-–:]\s*(.+)/i);
  const kind = String(kindMatch?.[1] || '').trim();
  const captionKind = isAiHubText(kind) || isAiHubText(raw)
    ? 'ai'
    : /Account Service/i.test(kind) || /Account Service/i.test(raw)
      ? 'account'
      : '';
  let planType = '';
  if (
    captionKind === 'ai' ||
    isAiHubText(raw) ||
    /تێست|تیست|تست|هەفت|حەفت|مەهانە|مانگانە|هەیڤ|ساڵانە|سالانە/i.test(raw)
  ) {
    const inferred = inferPlanFromText(`${productMatch?.[1] || ''} ${raw}`);
    planType = inferred?.plan_type || 'weekly_7d';
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
  const explicitAi = captionKind === 'ai' || isAiHubText(msg);
  if (explicitAccount && !explicitAi) return true;
  if (explicitAi) return false;
  if (planId && CALLBACK_PLAN_RE.test(String(planId))) return false;
  return false;
}

/**
 * Resolve plan suffix for IPBITS-{suffix}-… keys.
 * Priority: callback planId → caption پلان line → message/product text → price → DB → 7D.
 */
function resolveConfirmPlan({
  planId,
  planFromCaption,
  messageText,
  productTitle,
  items,
  itemsLabel,
  order,
}) {
  const candidates = [
    planId,
    planFromCaption,
    order?.plan_type,
    order?.duration_days != null ? `${order.duration_days}D` : '',
  ].filter(Boolean);

  for (const c of candidates) {
    const fromId = resolvePlanFromPlanId(c);
    if (fromId?.plan_suffix) {
      return {
        plan_suffix: normalizePlanPrefix(fromId.plan_suffix),
        plan_type: fromId.plan_type,
        duration_days: fromId.duration_days,
        source: `id:${c}`,
      };
    }
  }

  const list = Array.isArray(items) ? items : [];
  const itemHay = list
    .map((i) => `${i?.id || ''} ${i?.planId || ''} ${i?.name || ''} ${i?.title || ''}`)
    .join(' ');
  const hay = [messageText, productTitle, itemsLabel, itemHay].filter(Boolean).join(' ');
  const fromText = inferPlanFromText(hay);
  if (fromText?.plan_suffix) {
    return {
      plan_suffix: normalizePlanPrefix(fromText.plan_suffix),
      plan_type: fromText.plan_type,
      duration_days: fromText.duration_days,
      source: 'text',
    };
  }

  const fromPrice = inferPlanFromPrice({
    totalIQD: Number(order?.total_iqd || 0),
    totalUSD: Number(order?.total_usd || 0),
  });
  if (fromPrice?.plan_suffix) {
    return {
      plan_suffix: normalizePlanPrefix(fromPrice.plan_suffix),
      plan_type: fromPrice.plan_type,
      duration_days: fromPrice.duration_days,
      source: 'price',
    };
  }

  const fromContext = resolvePlanFromOrderContext({
    planId: planId || planFromCaption || undefined,
    planType: order?.plan_type,
    durationDays: order?.duration_days,
    items,
    itemsLabel,
    messageText,
    productTitle,
    totalIQD: Number(order?.total_iqd || 0),
    totalUSD: Number(order?.total_usd || 0),
  });
  if (fromContext?.plan_suffix) {
    return {
      plan_suffix: normalizePlanPrefix(fromContext.plan_suffix),
      plan_type: fromContext.plan_type,
      duration_days: fromContext.duration_days,
      source: 'context',
    };
  }

  // Safe default: weekly 7D (never throw / never silent-fail)
  const weekly = PLAN_BY_SUFFIX['7D'];
  return {
    plan_suffix: '7D',
    plan_type: weekly.plan_type,
    duration_days: weekly.duration_days,
    source: 'default_7d',
  };
}

function buildConfirmMessage({ keyCode, orderId, name, phone, planSuffix }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `🔑 کۆدێ ئەکتیڤکرنێ: \`${keyCode || '—'}\`\n` +
    (planSuffix ? `📦 پلان: ${planSuffix}\n` : '') +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `👤 کڕیار: ${name || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    `🖨 وەسڵ حازرە بۆ چاپکرنێ\n` +
    `${getOrderReceiptUrl(orderId)}`
  );
}

function buildAccountMessage({ orderId, name, phone, product }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `🆔 ئۆردەر: ${orderId || '—'}\n` +
    `📦 بەرهەم: ${product || '—'}\n` +
    `👤 کڕیار: ${name || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    `🖨 وەسڵ حازرە بۆ چاپکرنێ\n` +
    `${getOrderReceiptUrl(orderId)}\n` +
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
  // Plain-text follow-up (no Markdown) so backticks still show the key clearly
  await sendTelegramText({
    chatId,
    text: text.replace(/`/g, ''),
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

  const resolved = resolveConfirmPlan({
    planId,
    planFromCaption: parsed.planFromCaption,
    messageText,
    productTitle,
    items,
    itemsLabel,
    order,
  });
  const planSuffix = resolved.plan_suffix;
  const planType = resolved.plan_type;
  const durationDays = resolved.duration_days;

  console.log('[fulfillTelegramConfirm] plan resolved', {
    planSuffix,
    planType,
    durationDays,
    source: resolved.source,
  });

  // Already fulfilled — re-send existing key
  if (
    order?.license_key &&
    ['confirmed', 'approved', 'completed'].includes(String(order.status || '').toLowerCase())
  ) {
    await publish({
      chatId,
      messageId,
      hasPhoto,
      text: buildConfirmMessage({
        keyCode: order.license_key,
        orderId,
        name,
        phone,
        planSuffix,
      }),
      orderId,
    });
    return { ok: true, kind: 'ai', key: order.license_key, reused: true };
  }

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

  return { ok: true, kind: 'ai', key: keyCode, planSuffix, source: resolved.source };
}
