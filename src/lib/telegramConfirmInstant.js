/**
 * September 19 style Telegram Confirm — shared by all webhook endpoints.
 * Generates IPBITS-{PREFIX}-{8CHARS} AND registers it in Supabase so
 * /api/licenses/verify and chat unlock accept the key.
 */
import { generateLicenseKey } from '@/lib/generateKey';
import { createLicenseKey } from '@/lib/licenseService';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  computePlanExpiresAt,
  resolvePlanFromPlanId,
  resolveSubscriptionPlan,
} from '@/config/plans';
import {
  answerCallbackQuery,
  editTelegramMessage,
  getBotToken,
} from '@/lib/telegramApprove';

const TIER_PREFIXES = ['1D', '7D', '30D', '90D', '365D'];

const DEFAULT_NAME = 'pshwar farhad';
const DEFAULT_PHONE = '07504060378';

const TIER_IQD = {
  '1D': 2500,
  '7D': 5000,
  '30D': 12000,
  '90D': 25000,
  '365D': 78000,
};

export function isConfirmCallbackData(data) {
  const d = String(data || '');
  return (
    d.startsWith('confirm_order') ||
    d.startsWith('approve_order') ||
    d.startsWith('confirm:') ||
    d.startsWith('approve:') ||
    d === 'confirm_test' ||
    d.startsWith('confirm_test')
  );
}

function parseOrderAndTier(data) {
  const raw = String(data || '');
  let rest = '';
  if (raw.startsWith('confirm_order:')) rest = raw.slice('confirm_order:'.length);
  else if (raw.startsWith('approve_order:')) rest = raw.slice('approve_order:'.length);
  else if (raw.startsWith('confirm:')) rest = raw.slice('confirm:'.length);
  else if (raw.startsWith('approve:')) rest = raw.slice('approve:'.length);
  else rest = '';

  const segs = rest.split(':').filter(Boolean);
  let orderId = '';
  let tierParam = '';

  if (segs.length >= 2) {
    orderId = segs[0];
    tierParam = segs[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
  } else if (segs[0]) {
    if (TIER_PREFIXES.includes(segs[0].toUpperCase())) {
      tierParam = segs[0].toUpperCase();
    } else {
      orderId = segs[0];
    }
  }

  if (!orderId) orderId = `ord_${Date.now()}`;
  return { orderId, tierParam };
}

/** Parse duration → 1D / 7D / 30D / 90D / 365D (default 7D). */
export function detectTierPrefix(tierParam, messageText) {
  const param = String(tierParam || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (TIER_PREFIXES.includes(param)) return param;

  const aliases = {
    TEST: '1D',
    TEST1D: '1D',
    TST: '1D',
    DAILY: '1D',
    TRIAL: '1D',
    WEEKLY: '7D',
    WK: '7D',
    MONTHLY: '30D',
    MO: '30D',
    '3M': '90D',
    QUARTERLY: '90D',
    YEARLY: '365D',
    YR: '365D',
    '1Y': '365D',
    ANNUAL: '365D',
  };
  if (aliases[param]) return aliases[param];

  const msg = String(messageText || '')
    .normalize('NFC')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .toLowerCase();

  if (/هەفتانە|حەفتیانە|هفتانه|weekly|\b7\s*days?\b|\b7d\b|7_days/.test(msg)) {
    return '7D';
  }
  if (/ساڵانە|سالانە|yearly|annual|\b365\s*days?\b|\b365d\b|\b1\s*year\b|\b1y\b/.test(msg)) {
    return '365D';
  }
  if (/٣\s*مەهی|٣\s*مانگ|٣\s*هەیڤ|3\s*months?|\b90\s*days?\b|\b90d\b/.test(msg)) {
    return '90D';
  }
  if (/مەهانە|مانگانە|هەیڤانە|monthly|\b30\s*days?\b|\b30d\b|30_days/.test(msg)) {
    return '30D';
  }
  if (/تێست|تیست|تست|trial|\b1\s*day\b|\b1d\b|daily|test_1d|1_day/.test(msg)) {
    return '1D';
  }

  return '7D';
}

/** Sept 19 format: IPBITS-7D-4DSV7H5D (8 random chars). */
export function generateSept19LicenseKey(tierPrefix = '7D') {
  try {
    return generateLicenseKey(tierPrefix || '7D');
  } catch (err) {
    console.error('[telegramConfirmInstant] generateLicenseKey failed:', err?.message || err);
    const charset = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let rand8 = '';
    for (let i = 0; i < 8; i += 1) {
      rand8 += charset[Math.floor(Math.random() * charset.length)];
    }
    const prefix = TIER_PREFIXES.includes(tierPrefix) ? tierPrefix : '7D';
    return `IPBITS-${prefix}-${rand8}`;
  }
}

function planForPrefix(tierPrefix) {
  return (
    resolvePlanFromPlanId(tierPrefix) ||
    resolveSubscriptionPlan(tierPrefix) ||
    resolveSubscriptionPlan('weekly')
  );
}

function extractCustomer(messageText) {
  const raw = String(messageText || '');
  const nameMatch = raw.match(/👤\s*کڕیار:\s*(.+)/);
  const phoneMatch =
    raw.match(/📞\s*واتساپ:\s*(.+)/) ||
    raw.match(/(07[3-9]\d{8})/) ||
    raw.match(/(\+?9647[3-9]\d{8})/);

  let name = String(nameMatch?.[1] || '')
    .trim()
    .split('\n')[0]
    .trim();
  let phone = String(phoneMatch?.[1] || phoneMatch?.[0] || '')
    .trim()
    .split('\n')[0]
    .trim();

  if (!name || name === 'نەدیار' || name === '—') name = DEFAULT_NAME;
  if (!phone || phone === 'نینە' || phone === '—') phone = DEFAULT_PHONE;

  return { name, phone };
}

function buildSept19Message({ keyCode, name, phone }) {
  return (
    `✅ ئۆردەر هاتە پەسەندکرن ب سەرکەفتیانە!\n` +
    `🔑 کلیلا دروستکری:\n` +
    `\`${keyCode}\`\n` +
    `👤 بۆ: ${name} (${phone})`
  );
}

async function sendPlainMessage(chatId, text) {
  const botToken = getBotToken() || process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || chatId == null) return;
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: String(text || ''),
    }),
  }).catch((err) => {
    console.error('[telegramConfirmInstant] sendMessage failed:', err?.message || err);
  });
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

/**
 * Register key so /api/licenses/verify + chat unlock succeed.
 * Writes license_keys (primary), vouchers (wallet/unlock fallback), orders (optional).
 * Uses SUPABASE_SERVICE_ROLE_KEY via supabaseAdmin (bypasses RLS).
 */
export async function persistRedeemableLicenseKey({
  code,
  tierPrefix,
  name,
  phone,
  orderId,
}) {
  if (!code) return { ok: false, reason: 'missing_code' };
  if (!supabaseAdmin) {
    console.error('[telegramConfirmInstant] supabaseAdmin missing — key NOT registered');
    return { ok: false, reason: 'no_supabase' };
  }

  const plan = planForPrefix(tierPrefix);
  const durationDays = Number(plan.duration_days) || 7;
  const planType = plan.plan_type || 'weekly_7d';
  const expiresAt = computePlanExpiresAt(durationDays);
  const amountIqd = TIER_IQD[tierPrefix] || Number(plan.price_iqd) || 5000;
  const results = { license_keys: false, vouchers: false, orders: false, licenses: false };

  // 1) license_keys — activateLicenseKey primary legacy path
  try {
    const payload = {
      key_code: code,
      plan_type: planType,
      duration_days: durationDays,
      customer_phone: phone || null,
      customer_name: name || null,
      order_id: orderId || null,
      is_active: true,
      expires_at: expiresAt,
    };
    let { error } = await supabaseAdmin.from('license_keys').insert(payload);
    if (error && /duplicate|unique|23505/i.test(error.message || '')) {
      results.license_keys = true;
    } else if (error) {
      // Minimal columns fallback
      ({ error } = await supabaseAdmin.from('license_keys').insert({
        key_code: code,
        plan_type: planType,
        duration_days: durationDays,
        is_active: true,
      }));
      if (error) console.error('[persist] license_keys:', error.message);
      else results.license_keys = true;
    } else {
      results.license_keys = true;
    }
  } catch (err) {
    console.error('[persist] license_keys exception:', err?.message || err);
  }

  // 2) licenses table (canonical) — best effort, schema varies
  try {
    const licensePayloads = [
      {
        license_code: code,
        package_type: plan.id || 'weekly',
        duration_days: durationDays,
        credit_limit_usd: plan.credit_limit || null,
        expires_at: expiresAt,
        is_active: true,
        customer_phone: phone || null,
        customer_name: name || null,
      },
      {
        license_code: code,
        package_type: plan.id || 'weekly',
        duration_days: durationDays,
        expires_at: expiresAt,
        is_active: true,
      },
      {
        license_code: code,
        is_active: true,
        duration_days: durationDays,
      },
    ];
    for (const row of licensePayloads) {
      const { error } = await supabaseAdmin.from('licenses').insert(row);
      if (!error || /duplicate|unique|23505/i.test(error.message || '')) {
        results.licenses = true;
        break;
      }
      if (!/column|schema cache|does not exist/i.test(error.message || '')) {
        console.warn('[persist] licenses:', error.message);
        break;
      }
    }
  } catch (err) {
    console.warn('[persist] licenses exception:', err?.message || err);
  }

  // 3) vouchers — wallet redeem + /api/vouchers/unlock fallback
  try {
    const voucherPayloads = [
      { code, amount_iqd: amountIqd, is_used: false, is_printed: false, status: 'available' },
      { code, amount_iqd: amountIqd, is_used: false },
      { code, amount_iqd: amountIqd },
    ];
    for (const row of voucherPayloads) {
      const { error } = await supabaseAdmin.from('vouchers').insert(row);
      if (!error || /duplicate|unique|23505/i.test(error.message || '')) {
        results.vouchers = true;
        break;
      }
      if (!/column|schema cache|does not exist/i.test(error.message || '')) {
        console.warn('[persist] vouchers:', error.message);
        break;
      }
    }
  } catch (err) {
    console.warn('[persist] vouchers exception:', err?.message || err);
  }

  // 4) Stamp order row
  if (orderId) {
    try {
      const { error } = await supabaseAdmin
        .from('orders')
        .update({
          license_key: code,
          plan_type: planType,
          duration_days: durationDays,
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
      if (error) {
        await supabaseAdmin
          .from('orders')
          .update({
            license_key: code,
            status: 'approved',
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }
      results.orders = true;
    } catch (err) {
      console.warn('[persist] orders exception:', err?.message || err);
    }
  }

  const ok = results.license_keys || results.licenses || results.vouchers;
  console.log('[telegramConfirmInstant] persist result', { code, ...results, ok });
  return { ok, results, planType, durationDays, amountIqd };
}

/**
 * Issue a redeemable key: prefer createLicenseKey (OpenRouter + DB), else local + persist.
 */
export async function issueRedeemableConfirmKey({
  tierPrefix,
  name,
  phone,
  orderId,
}) {
  const plan = planForPrefix(tierPrefix);

  // Prefer full provisioning path (licenses + license_keys)
  try {
    const license = await withTimeout(
      createLicenseKey({
        planType: plan.plan_type || plan.id || tierPrefix,
        durationDays: plan.duration_days,
        planSuffix: tierPrefix,
        customerPhone: phone,
        customerName: name,
        orderId,
      }),
      12000,
      'createLicenseKey'
    );
    if (license?.key_code) {
      // Also mirror into vouchers for wallet unlock forms
      await persistRedeemableLicenseKey({
        code: license.key_code,
        tierPrefix,
        name,
        phone,
        orderId,
      });
      return {
        code: license.key_code,
        source: license.source || 'createLicenseKey',
        registered: true,
      };
    }
  } catch (err) {
    console.warn(
      '[telegramConfirmInstant] createLicenseKey skipped:',
      err?.message || err
    );
  }

  // Guaranteed local key + explicit Supabase registration
  const code = generateSept19LicenseKey(tierPrefix);
  const persist = await persistRedeemableLicenseKey({
    code,
    tierPrefix,
    name,
    phone,
    orderId,
  });
  return {
    code,
    source: 'local+persist',
    registered: !!persist.ok,
    persist,
  };
}

/**
 * Exact Sept 19 confirm flow + DB registration for site validation.
 */
export async function handleInstantConfirmCallback(cq) {
  const data = String(cq?.data || '');
  const chatId = cq?.message?.chat?.id;
  const messageId = cq?.message?.message_id;
  const hasPhoto = !!(cq?.message?.photo && cq.message.photo.length);
  const msgText = String(cq?.message?.caption || cq?.message?.text || '');

  console.log('[telegramConfirmInstant] callback', {
    data,
    chatId: String(chatId || ''),
    messageId,
  });

  try {
    if (cq?.id) {
      await answerCallbackQuery(cq.id, 'داخوازی هاتە پەسەندکرن ب سەرکەفتیانە!', false);
    }
  } catch (err) {
    console.error('[telegramConfirmInstant] answerCallbackQuery:', err?.message || err);
  }

  try {
    const { orderId, tierParam } = parseOrderAndTier(data);
    const tierPrefix = detectTierPrefix(tierParam, msgText);
    const { name, phone } = extractCustomer(msgText);

    const issued = await issueRedeemableConfirmKey({
      tierPrefix,
      name,
      phone,
      orderId,
    });
    const code = issued.code;

    console.log('[telegramConfirmInstant] key ready', {
      orderId,
      tierPrefix,
      code,
      name,
      phone,
      source: issued.source,
      registered: issued.registered,
    });

    if (messageId && chatId != null) {
      try {
        await editTelegramMessage({
          chatId,
          messageId,
          isCaption: hasPhoto,
          text: `${msgText}\n\n━━━━━━━━━━━━━━━━━━━\n✅ هاتە پەسەندکرن ب سەرکەفتیانە`,
          replyMarkup: { inline_keyboard: [] },
        });
      } catch (err) {
        console.error('[telegramConfirmInstant] edit failed:', err?.message || err);
      }
    }

    // Always send key to admin (even if DB registration partially failed)
    await sendPlainMessage(chatId, buildSept19Message({ keyCode: code, name, phone }));

    if (!issued.registered) {
      await sendPlainMessage(
        chatId,
        `⚠️ ئاگاهداری: کلیل هاتە دروستکرن بەلێ تۆمارکرنا د داتابەیسێ دا تەواو نەبوو. تکایە د لۆگان دا چاڤلێکە.\n\`${code}\``
      );
    }

    return {
      ok: true,
      code,
      orderId,
      tierPrefix,
      name,
      phone,
      registered: issued.registered,
      source: issued.source,
    };
  } catch (err) {
    console.error('[telegramConfirmInstant] fatal:', err);
    try {
      const tierPrefix = detectTierPrefix('', msgText);
      const { name, phone } = extractCustomer(msgText);
      const code = generateSept19LicenseKey(tierPrefix);
      await persistRedeemableLicenseKey({
        code,
        tierPrefix,
        name,
        phone,
        orderId: `ord_${Date.now()}`,
      });
      await sendPlainMessage(chatId, buildSept19Message({ keyCode: code, name, phone }));
      return { ok: true, code, emergency: true };
    } catch (err2) {
      console.error('[telegramConfirmInstant] emergency failed:', err2?.message || err2);
      return { ok: false, error: String(err?.message || err) };
    }
  }
}
