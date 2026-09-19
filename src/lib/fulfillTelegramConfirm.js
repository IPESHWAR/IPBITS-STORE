/**
 * Bulletproof Telegram Confirm → license key.
 * Never hangs on DB/OpenRouter — key + Telegram reply happen first.
 */
import { normalizePlanPrefix } from '@/lib/generateKey';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { inferPlanFromPrice, SUBSCRIPTION_PLANS } from '@/config/plans';
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

const PLAN_META = {
  '1D': { plan_type: 'test_1d', duration_days: 1, label: '1 Day / Trial' },
  '7D': { plan_type: 'weekly_7d', duration_days: 7, label: 'Weekly (7 Days)' },
  '30D': { plan_type: 'monthly_30d', duration_days: 30, label: 'Monthly (30 Days)' },
  '90D': { plan_type: 'quarterly_90d', duration_days: 90, label: '3 Months (90 Days)' },
  '365D': { plan_type: 'yearly_1y', duration_days: 365, label: 'Annual (365 Days)' },
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
  return /AI\s*Hub|Al\s*Hub|AIHub/i.test(String(text || ''));
}

/**
 * English-first planKey extraction for storefront names like:
 * "AI Hub - Weekly (7 Days) (x1)"
 */
export function extractPlanKey(text = '', callbackPlanId = '') {
  const fromCb = normalizePlanPrefix(callbackPlanId);
  if (callbackPlanId && CALLBACK_PLAN_RE.test(String(callbackPlanId).trim()) && fromCb) {
    return fromCb;
  }

  const raw = String(text || '');
  const hay = raw
    .normalize('NFC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();

  // Explicit English storefront shapes FIRST (before Kurdish-only / ambiguous 1d)
  // Weekly (7 Days) / 7 Days / weekly
  if (
    /weekly\s*\(\s*7\s*days?\s*\)|weekly|\b7\s*days?\b|\b7\s*d\b|7_days|ai_bundle_7|هەفتانە|حەفتیانە|هفتانه|٧\s*ڕۆژ|٧\s*رۆژ/.test(
      hay
    )
  ) {
    return '7D';
  }

  // Annual / 365 Days / 1 Year — before monthly
  if (
    /annual|yearly|\b365\s*days?\b|\b365\s*d\b|\b1\s*year\b|\b1y\b|1_year|ai_bundle_1_year|ساڵانە|سالانە|١\s*ساڵ|١\s*سال/.test(
      hay
    )
  ) {
    return '365D';
  }

  // 3 Months / 90 Days
  if (
    /3\s*months?|90\s*days?|\b90\s*d\b|90_days|quarterly|٣\s*هەیڤ|٣\s*مانگ|٣\s*مەه|٩٠\s*ڕۆژ|٩٠\s*رۆژ|ai_bundle_90/.test(
      hay
    )
  ) {
    return '90D';
  }

  // Monthly (30 Days)
  if (
    /monthly\s*\(\s*30\s*days?\s*\)|monthly|\b30\s*days?\b|\b30\s*d\b|30_days|ai_bundle_30|مانگانە|مەهانە|هەیڤانە|٣٠\s*ڕۆژ|٣٠\s*رۆژ/.test(
      hay
    )
  ) {
    return '30D';
  }

  // 1 Day / Trial / Test — AFTER weekly/monthly so "(x1)" cannot steal Weekly
  if (
    /1\s*day|\b1\s*d\b|trial|\btest\b|daily|تێست|تیست|تست|١\s*ڕۆژ|١\s*رۆژ|ai_bundle_1_day|1_day/.test(
      hay
    )
  ) {
    return '1D';
  }

  // Caption tag 🏷 پلان: 7D
  const planTag = raw.match(/🏷\s*پلان:\s*([A-Za-z0-9]+)/i);
  if (planTag?.[1]) {
    const n = normalizePlanPrefix(planTag[1]);
    if (n) return n;
  }

  return '7D';
}

/** Guaranteed key: IPBITS-7D-XXXX-XXXX */
export function generateConfirmLicenseKey(planKey = '7D') {
  const suffix = normalizePlanPrefix(planKey || '7D');
  const a = Math.random().toString(36).substring(2, 6).toUpperCase();
  const b = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IPBITS-${suffix}-${a}-${b}`;
}

function parseCaption(text) {
  const raw = String(text || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch = raw.match(/📞\s*واتساپ:\s*(.+)/);
  const kindMatch = raw.match(/🏷\s*جۆر:\s*(.+)/);
  const productMatch =
    raw.match(/📦\s*بەرهەم:\s*(.+)/) ||
    raw.match(/(?:AI|Al)\s*Hub\s*[-–:]\s*(.+)/i);
  const kind = String(kindMatch?.[1] || '').trim();
  const captionKind = isAiHubText(kind) || isAiHubText(raw)
    ? 'ai'
    : /Account Service/i.test(kind) || /Account Service/i.test(raw)
      ? 'account'
      : '';
  return {
    name: String(nameMatch?.[1] || '')
      .trim()
      .replace(/^نەدیار$/, ''),
    phone: String(phoneMatch?.[1] || '')
      .trim()
      .replace(/^نینە$/, ''),
    product: String(productMatch?.[1] || '').trim(),
    captionKind,
  };
}

function isAccountService({ captionKind, messageText, planId }) {
  const msg = String(messageText || '');
  const explicitAccount =
    captionKind === 'account' || /Account Service/i.test(msg);
  const explicitAi =
    captionKind === 'ai' ||
    isAiHubText(msg) ||
    /Weekly|Monthly|Annual|1 Day|7 Days|30 Days|90 Days|365 Days|تێست|هەفت|مەهانە|ساڵانە/i.test(
      msg
    );
  if (explicitAccount && !explicitAi) return true;
  if (explicitAi) return false;
  if (planId && CALLBACK_PLAN_RE.test(String(planId))) return false;
  return false;
}

function buildConfirmMessage({ keyCode, orderId, name, planName }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `👤 ناڤ: ${name || '—'}\n` +
    `📦 پاکێج: ${planName || '—'}\n` +
    `🔑 کۆدێ چالاککرنێ (License Key):\n` +
    `${keyCode || '—'}\n` +
    `🖨 دەستخۆش! وەسڵ هاتە پەسەندکرن.\n` +
    `🆔 ${orderId || '—'}\n` +
    `${getOrderReceiptUrl(orderId)}`
  );
}

function buildAccountMessage({ orderId, name, phone, product }) {
  return (
    `✅ داخوازی هاتە پەسەندکرن\n` +
    `👤 ناڤ: ${name || '—'}\n` +
    `📦 پاکێج: ${product || '—'}\n` +
    `📞 واتساپ: ${phone || '—'}\n` +
    `🖨 دەستخۆش! وەسڵ هاتە پەسەندکرن.\n` +
    `${getOrderReceiptUrl(orderId)}`
  );
}

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function publish({ chatId, messageId, hasPhoto, text, orderId, extraRows = [] }) {
  const markup = buildReceiptKeyboard(orderId, extraRows);
  try {
    await editTelegramMessage({
      chatId,
      messageId,
      text,
      isCaption: hasPhoto,
      parseMode: null,
      replyMarkup: markup,
    });
  } catch (err) {
    console.error('[fulfillTelegramConfirm] editMessage failed:', err?.message || err);
  }
  try {
    await sendTelegramText({
      chatId,
      text,
      replyMarkup: markup,
    });
  } catch (err) {
    console.error('[fulfillTelegramConfirm] sendMessage failed:', err?.message || err);
  }
}

async function persistLicenseBestEffort({
  orderId,
  phone,
  name,
  keyCode,
  planType,
  durationDays,
  itemsLabel,
}) {
  if (!supabaseAdmin || !orderId) return;
  try {
    const payload = {
      plan_type: planType || null,
      duration_days: durationDays || null,
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    };
    if (keyCode) payload.license_key = keyCode;

    await withTimeout(
      (async () => {
        let { error } = await supabaseAdmin.from('orders').update(payload).eq('id', orderId);
        if (error) {
          ({ error } = await supabaseAdmin
            .from('orders')
            .update({ ...payload, status: 'approved' })
            .eq('id', orderId));
        }
        if (error) {
          await supabaseAdmin.from('orders').upsert(
            {
              id: orderId,
              phone: phone || null,
              customer_name: name && name !== '—' ? name : null,
              customer_phone: phone || null,
              items_label: itemsLabel || null,
              ...payload,
            },
            { onConflict: 'id' }
          );
        }
      })(),
      4000,
      'orders.persist'
    );
  } catch (err) {
    console.error('[fulfillTelegramConfirm] persist skipped:', err?.message || err);
  }
}

/**
 * Fulfill Confirm button. Answer → parse English plan → generate key → reply → then DB.
 */
export async function fulfillTelegramConfirm(cq, opts = {}) {
  const data = String(cq?.data || '');
  const chatId = cq?.message?.chat?.id;
  const messageId = cq?.message?.message_id;
  const hasPhoto = !!(cq?.message?.photo && cq.message.photo.length);
  const messageText = cq?.message?.text || cq?.message?.caption || '';
  const { orderId, planId } = parseCallback(data);

  console.log('[fulfillTelegramConfirm] start', { data, orderId, planId, chatId });

  // STEP 1 — acknowledge immediately (never hang spinner)
  try {
    if (!opts.skipAnswer && cq?.id) {
      await answerCallbackQuery(cq.id, 'داخوازی هاتە پەسەندکرن...', false);
    }
  } catch (err) {
    console.error('[fulfillTelegramConfirm] answerCallbackQuery failed:', err?.message || err);
  }

  try {
    const parsed = parseCaption(messageText);

    // Optional DB lookup with hard timeout — never block key gen
    let order = null;
    if (supabaseAdmin && orderId) {
      try {
        const row = await withTimeout(
          supabaseAdmin.from('orders').select('*').eq('id', orderId).maybeSingle(),
          3000,
          'orders.select'
        );
        order = row?.data || null;
        if (row?.error) {
          console.warn('[fulfillTelegramConfirm] DB miss:', row.error.message);
        }
      } catch (err) {
        console.error('[fulfillTelegramConfirm] DB lookup skipped:', err?.message || err);
      }
    }

    const name = order?.customer_name || order?.name || parsed.name || '—';
    const phone = order?.customer_phone || order?.phone || parsed.phone || '';
    const itemsLabel = order?.items_label || parsed.product || '';
    const productTitle = parsed.product || itemsLabel || 'AI Hub';

    if (String(order?.status || '').toLowerCase() === 'rejected') {
      await sendTelegramText({
        chatId,
        text: `❌ ئەڤ ئۆردەرە بەری نوکە هاتە ڕەتکرن.\n🆔 ${orderId}`,
      });
      return { ok: false, reason: 'rejected' };
    }

    if (
      isAccountService({
        captionKind: parsed.captionKind,
        messageText,
        planId,
      })
    ) {
      await persistLicenseBestEffort({
        orderId,
        phone,
        name,
        keyCode: null,
        planType: 'account_service',
        durationDays: null,
        itemsLabel: productTitle,
      });
      const cleanPhone = toWhatsAppDigits(phone);
      const waRows = cleanPhone
        ? [
            [
              {
                text: '📲 ناردن ب واتساپێ',
                url: `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                  `سڵاڤ کڕیارێ هێژا، داخوازییا تە یا (${productTitle}) هاتە پەسەندکرن.`
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

    // STEP 2 — extract duration from message + callback (English Weekly (7 Days) first)
    const hayForPlan = [messageText, productTitle, itemsLabel, planId].filter(Boolean).join(' ');
    let planKey = extractPlanKey(hayForPlan, planId);

    // Price fallback if still default and order has amount
    if (planKey === '7D' && order && (order.total_iqd || order.total_usd)) {
      const fromPrice = inferPlanFromPrice({
        totalIQD: Number(order.total_iqd || 0),
        totalUSD: Number(order.total_usd || 0),
      });
      if (fromPrice?.plan_suffix) {
        planKey = normalizePlanPrefix(fromPrice.plan_suffix);
      }
    }

    const meta = PLAN_META[planKey] || PLAN_META['7D'];
    const planName =
      productTitle && /weekly|monthly|annual|day|days|تێست|هەفت|مەه|ساڵ/i.test(productTitle)
        ? productTitle.replace(/\s*\(x\d+\)\s*$/i, '').trim()
        : meta.label;

    console.log('[fulfillTelegramConfirm] planKey', {
      planKey,
      planName,
      orderId,
      sample: hayForPlan.slice(0, 120),
    });

    // Re-send existing key if already confirmed
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
          planName,
        }),
        orderId,
      });
      return { ok: true, kind: 'ai', key: order.license_key, reused: true };
    }

    // STEP 3 — generate key synchronously (never depends on DB/OpenRouter)
    let keyCode = generateConfirmLicenseKey(planKey);
    console.log('[fulfillTelegramConfirm] guaranteed key', keyCode);

    // STEP 4 — reply immediately with key + receipt button
    await publish({
      chatId,
      messageId,
      hasPhoto,
      text: buildConfirmMessage({
        keyCode,
        orderId,
        name,
        planName,
      }),
      orderId,
    });

    // Best-effort: try full license pipeline (may replace key if it succeeds quickly)
    try {
      const license = await withTimeout(
        generateLicenseForOrder({
          orderId: orderId || order?.id,
          phone,
          name,
          planType: meta.plan_type,
          durationDays: meta.duration_days,
          planSuffix: planKey,
          items: order?.items || [],
          itemsLabel,
        }),
        8000,
        'generateLicenseForOrder'
      );
      if (license?.key_code && license.key_code !== keyCode) {
        keyCode = license.key_code;
        console.log('[fulfillTelegramConfirm] upgraded key from service', keyCode);
        await sendTelegramText({
          chatId,
          text:
            `🔑 کۆدێ چالاککرنێ (نوێکرا):\n` +
            `${keyCode}\n` +
            `🆔 ${orderId || '—'}`,
          replyMarkup: buildReceiptKeyboard(orderId),
        });
      }
    } catch (err) {
      console.error(
        '[fulfillTelegramConfirm] generateLicenseForOrder skipped — kept guaranteed key:',
        err?.message || err
      );
    }

    // STEP 5 — persist (best effort)
    await persistLicenseBestEffort({
      orderId,
      phone,
      name,
      keyCode,
      planType: meta.plan_type,
      durationDays: meta.duration_days,
      itemsLabel: itemsLabel || productTitle,
    });

    return { ok: true, kind: 'ai', key: keyCode, planKey };
  } catch (err) {
    console.error('[fulfillTelegramConfirm] fatal:', err);
    try {
      // Last-resort key so Confirm never ends empty
      const planKey = extractPlanKey(messageText, planId) || '7D';
      const keyCode = generateConfirmLicenseKey(planKey);
      await sendTelegramText({
        chatId,
        text: buildConfirmMessage({
          keyCode,
          orderId,
          name: '—',
          planName: PLAN_META[planKey]?.label || planKey,
        }),
        replyMarkup: buildReceiptKeyboard(orderId),
      });
      return { ok: true, kind: 'ai', key: keyCode, emergency: true };
    } catch (err2) {
      console.error('[fulfillTelegramConfirm] emergency send failed:', err2?.message || err2);
      return { ok: false, error: String(err?.message || err) };
    }
  }
}
