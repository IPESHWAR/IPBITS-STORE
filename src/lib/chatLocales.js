/**
 * Strict chat error / status copy for Badini (ku), Arabic (ar), and English (en).
 * Used by both `/api/chat` and the chat UI — never mix languages in one message.
 */

export const CHAT_LOCALES = {
  ku: {
    placeholder: 'پرسیارا خۆ ل ڤێرێ بنڤیسە...',
    general_error: 'ببورە، ئاریشەیەک چێبوو. هیڤیە دووبارە هەول بدە.',
    invalid_key: 'کلیلا خزمەتگوزاریێ یا نەچالاکە یان نەهاتییە دیتن.',
    license_required: 'ئەڤ مۆدێلە پێدڤی ب کلیلێ هەیە. هیڤیە بەشداربوونا خۆ چالاک بکە.',
    model_busy: 'ئەڤ مۆدێلە نوکە یێ مژوولە، مۆدێلەکێ دی یێ بەلاش هەلبژێرە یان تاقی بکەڤە.',
    rate_limit_exceeded:
      'تە لیمیتێ خۆ یێ دەقیقەیێ دەرباز کر (٣ پەیام د خولەکەکێ دا). هیڤییە پاش هندەک دی تاقی بکە.',
    empty_reply: 'بەرسڤ نەهات.',
  },
  ar: {
    placeholder: 'اكتب رسالتك هنا...',
    general_error: 'عذراً، حدث خطأ ما. يرجى المحاولة مرة أخرى.',
    invalid_key: 'مفتاح الخدمة غير صالح أو غير متوفر حالياً.',
    license_required: 'هذا النموذج يتطلب ترخيصاً مفعلاً. يرجى تفعيل اشتراكك.',
    model_busy: 'هذا النموذج مشغول حالياً. اختر نموذجاً مجانياً آخر أو أعد المحاولة.',
    rate_limit_exceeded:
      'تجاوزت حد الدقيقة (٣ رسائل في الدقيقة). يرجى الانتظار قليلاً ثم المحاولة.',
    empty_reply: 'لم يتم استلام رد.',
  },
  en: {
    placeholder: 'Type your message here...',
    general_error: 'Sorry, an error occurred. Please try again.',
    invalid_key: 'The service API key is invalid or missing.',
    license_required: 'This model requires an active license key. Please activate your subscription.',
    model_busy: 'This model is busy right now. Pick another free model or try again.',
    rate_limit_exceeded:
      'You hit the per-minute limit (3 messages per minute). Please wait a moment and try again.',
    empty_reply: 'No reply received.',
  },
};

/** Map UI / request aliases → canonical locale id used in TRANSLATIONS + CHAT_LOCALES. */
export function normalizeChatLang(raw) {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v === 'ar' || v.startsWith('ar-')) return 'ar';
  if (v === 'en' || v.startsWith('en-')) return 'en';
  if (v === 'ku' || v === 'krd' || v === 'badini' || v === 'ckb' || v.startsWith('ku')) return 'ku';
  return 'ku';
}

export function getChatLocale(lang) {
  const id = normalizeChatLang(lang);
  return CHAT_LOCALES[id] || CHAT_LOCALES.ku;
}

/**
 * Map HTTP status / API error codes / upstream text → dictionary key.
 * Never returns raw provider text.
 */
export function resolveChatErrorKey({ status, code, upstream } = {}) {
  const c = String(code || '').toLowerCase();
  const msg = String(upstream || '');

  if (
    c === 'premium_required' ||
    c === 'license_required' ||
    c === 'missing_provisioned_key' ||
    status === 403
  ) {
    return 'license_required';
  }

  if (
    c === 'missing_server_api_key' ||
    c === 'server_api_key_failed' ||
    c === 'provisioned_api_key_failed' ||
    c === 'api_key_failed' ||
    c === 'missing_api_key' ||
    c === 'user_not_found' ||
    status === 401 ||
    status === 404 ||
    /user not found|invalid api key|unauthorized|forbidden|not found/i.test(msg)
  ) {
    return 'invalid_key';
  }

  if (c === 'rate_limit_exceeded') {
    return 'rate_limit_exceeded';
  }

  if (
    status === 429 ||
    status === 503 ||
    status === 400 ||
    c === 'model_busy' ||
    c === 'rate_limit' ||
    /only available|rate.?limit|busy|overloaded|capacity|temporarily|provider/i.test(msg)
  ) {
    return 'model_busy';
  }

  return 'general_error';
}

export function localizeChatError(lang, opts = {}) {
  const pack = getChatLocale(lang);
  const key = resolveChatErrorKey(opts);
  return pack[key] || pack.general_error;
}

/** True if a string looks like raw provider / JSON / English stack noise. */
export function looksLikeRawUpstreamError(text) {
  const s = String(text || '');
  if (!s) return true;
  if (/^\s*[{[]/.test(s)) return true;
  if (/thinkingmachines\/|openrouter|sk-or-|stack|traceback|only available on/i.test(s)) return true;
  if (/user not found|invalid api key|unauthorized|forbidden/i.test(s)) return true;
  if (/ECONN|ETIMEDOUT|fetch failed|Internal Server Error/i.test(s)) return true;
  return false;
}
