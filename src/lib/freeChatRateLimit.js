/**
 * In-memory sliding-window limiter for unauthenticated free-chat traffic.
 * Per-process only (fine for a single Node instance / serverless isolate).
 */

export const FREE_CHAT_LIMIT = 3;
export const FREE_CHAT_WINDOW_MS = 60_000;
export const FREE_CHAT_RATE_LIMIT_MESSAGE_KRD =
  'تە گەلەک پرسیار ب کورتی کرن! هیڤییە ٦٠ چرکەیان بڕاوەستە.';

const windows = new Map();

function pruneStale(stamps, now) {
  return stamps.filter((t) => now - t < FREE_CHAT_WINDOW_MS);
}

export function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded
      .split(',')
      .map((part) => part.trim())
      .find(Boolean);
    if (first) return first.slice(0, 128);
  }
  const real =
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-client-ip');
  if (real) return real.trim().slice(0, 128);
  return 'unknown';
}

export function consumeFreeChatRateLimit(ip, { limit = FREE_CHAT_LIMIT, windowMs = FREE_CHAT_WINDOW_MS } = {}) {
  const now = Date.now();
  const key = String(ip || 'unknown').slice(0, 128);
  const stamps = pruneStale(windows.get(key) || [], now);

  if (stamps.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((stamps[0] + windowMs - now) / 1000));
    windows.set(key, stamps);
    return { ok: false, retryAfter, remaining: 0 };
  }

  stamps.push(now);
  windows.set(key, stamps);

  if (windows.size > 8000) {
    for (const [mapKey, list] of windows) {
      const kept = pruneStale(list, now);
      if (!kept.length) windows.delete(mapKey);
      else windows.set(mapKey, kept);
    }
  }

  return { ok: true, retryAfter: 0, remaining: Math.max(0, limit - stamps.length) };
}
