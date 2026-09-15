export const AI_HUB_SESSION_KEY = 'ipbits_ai_session';

export function remainingDays(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / 86400000));
}

export function decodeAiHubToken(token) {
  const raw = String(token || '').replace(/^Bearer\s+/i, '').trim();
  const [body] = raw.split('.');
  if (!body) return null;
  try {
    const padded = body.replace(/-/g, '+').replace(/_/g, '/');
    const withPad = padded + '='.repeat((4 - (padded.length % 4)) % 4);
    const json = atob(withPad);
    const payload = JSON.parse(json);
    if (payload?.exp && new Date(payload.exp).getTime() < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readAiHubSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AI_HUB_SESSION_KEY);
    if (!raw) return null;
    if (raw.includes('.')) {
      const payload = decodeAiHubToken(raw);
      if (!payload) {
        window.localStorage.removeItem(AI_HUB_SESSION_KEY);
        return null;
      }
      return { token: raw, expires_at: payload.exp || null, key_code: payload.k, customer_phone: payload.p };
    }
    const parsed = JSON.parse(raw);
    if (parsed?.expires_at && new Date(parsed.expires_at) < new Date()) {
      window.localStorage.removeItem(AI_HUB_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    const fallback = String(window.localStorage.getItem(AI_HUB_SESSION_KEY) || '');
    return fallback ? { token: fallback } : null;
  }
}

export function writeAiHubSession(session) {
  if (typeof window === 'undefined' || !session) return;
  const token = session.token || session;
  window.localStorage.setItem(AI_HUB_SESSION_KEY, typeof token === 'string' ? token : JSON.stringify(session));
}

export function clearAiHubSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AI_HUB_SESSION_KEY);
}
