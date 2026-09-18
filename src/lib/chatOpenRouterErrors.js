/**
 * OpenRouter error helpers: paid-slug fallback + Kurdish UI messages.
 */

export function extractOpenRouterErrorMessage(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (data.error?.message) return String(data.error.message);
  if (typeof data.message === 'string') return data.message;
  try {
    return JSON.stringify(data.error || data);
  } catch {
    return '';
  }
}

/**
 * Parse OpenRouter "free unavailable → use paid slug" messages.
 * Example: "This model is unavailable for free... use this slug instead: meta-llama/llama-3.2-3b-instruct"
 */
export function parseRecommendedPaidSlug(errorText, currentModel = '') {
  const msg = String(errorText || '');
  const patterns = [
    /use this slug instead:\s*[`']?([a-z0-9][a-z0-9_./:-]*)[`']?/i,
    /paid version[^.]*?(?:slug|model)?\s*[:=]\s*[`']?([a-z0-9][a-z0-9_./:-]*)[`']?/i,
    /try\s+(?:using\s+)?[`']?([a-z0-9]+\/[a-z0-9_./-]+(?::[a-z0-9_-]+)?)[`']?\s+instead/i,
    /available now[^:]*:\s*[`']?([a-z0-9][a-z0-9_./:-]*)[`']?/i,
  ];
  for (const re of patterns) {
    const m = msg.match(re);
    if (m?.[1]) {
      return String(m[1]).replace(/^:+/, '').replace(/:free$/i, '').trim();
    }
  }

  if (
    /unavailable for free|no longer free|not available for free|free tier.*(unavailable|disabled)|only available as a paid/i.test(
      msg
    )
  ) {
    const stripped = String(currentModel || '')
      .replace(/:free$/i, '')
      .trim();
    return stripped && stripped !== currentModel ? stripped : stripped || null;
  }

  return null;
}

/** Strip `:free` suffix for paid retry. */
export function toPaidModelSlug(modelId) {
  return String(modelId || '')
    .replace(/:free$/i, '')
    .trim();
}

/** Map raw OpenRouter / network errors → clean Badini Kurdish UI copy. */
export function friendlyOpenRouterErrorKu(errorText) {
  const msg = String(errorText || '');
  const lower = msg.toLowerCase();

  if (/rate.?limit|too many requests|\b429\b|temporarily rate/i.test(lower)) {
    return 'تکایە کەمێک چاوەڕێ بکە — زۆر داواکاری هاتووە. پاش ساتێک دووبارە هەوڵ بدە.';
  }
  if (/insufficient|out of credits|credit limit|payment required|\b402\b|billing/i.test(lower)) {
    return 'باڵانسی خاڵەکان یا کلیلی API بەس نینە. هیڤیە باڵانسێ خۆ پڕ بکەڤە.';
  }
  if (/unavailable for free|no longer free|not available for free/i.test(lower)) {
    return 'ئەڤ مۆدێلە یا بەلاش ئێدی بەردەست نینە. هیڤیە مۆدێلەکێ دی هەلبژێرە یان باڵانس بکاربهێنە.';
  }
  if (/no endpoints|model.?not.?found|\b404\b|is not a valid model/i.test(lower)) {
    return 'ئەڤ مۆدێلە نوکە بەردەست نینە. هیڤیە مۆدێلەکێ دی ژ لیستێ هەلبژێرە.';
  }
  if (/timeout|timed out|gateway|\b504\b|\b502\b/i.test(lower)) {
    return 'پەیوەندی درەنگ بوو. هیڤیە دووبارە هەوڵ بدە.';
  }
  if (/invalid.*api.?key|unauthorized|\b401\b|forbidden|\b403\b|user not found/i.test(lower)) {
    return 'کلیلا خزمەتگوزاریێ یا نەچالاکە. هیڤیە دووبارە چالاک بکە.';
  }
  if (/context.?length|too many tokens|maximum context/i.test(lower)) {
    return 'پەیاما تە زۆر درێژە. هیڤیە کورتر بنڤیسە یان گفتوگۆیەک نوو دەستپێ بکە.';
  }
  if (/moderation|content.?policy|safety/i.test(lower)) {
    return 'ئەڤ داواکاریە نەهاتە قەبوڵکرن ژبەر سیاسەتا ناڤەرۆکێ. هیڤیە پرسیارەکێ دی تاقی بکە.';
  }

  // Never dump raw JSON / English provider text to the UI
  if (!msg || /[{[]/.test(msg) || msg.length > 180 || /openrouter|slug instead/i.test(msg)) {
    return 'ببورە، ئاریشەیەک چێبوو د کاتی وەڵامدانێ دا. هیڤیە دووبارە هەوڵ بدە.';
  }

  return 'ببورە، ئاریشەیەک چێبوو د کاتی وەڵامدانێ دا. هیڤیە دووبارە هەوڵ بدە.';
}

/** Kurdish notice: text/vision LLMs cannot do direct pixel photo editing. */
export const PIXEL_EDIT_NOTICE_KU =
  'دەستکاریکرنا ڕاستەوخۆ یا پیکسلێن وێنە (وەک گۆڕینی ڕەنگ، پاشبنەما، یان "change my back to red") پێدڤی ب مۆدێلێن تایبەت یێن دەستکاریکرنا وێنە یە. مۆدێلێن تێکست/ڤیژن ناتوانن وێنەکێ ڕاستەوخۆ بگۆڕن. هیڤیە مۆدێلەکێ وێنە (وەک FLUX) ژ تابێ 🎨 وێنە هەلبژێرە، یان وێنە بار بکە و بێژە چ دەتەوێت — ئەز دەتوانم ڕێنمایی و پرۆمپتێن باش بدەمە تە.';
