const STORAGE_KEY = 'ipbits-guest-session';

export function createGuestSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `guest-session-${rand}`;
}

export function getOrCreateGuestSession() {
  if (typeof window === 'undefined') return createGuestSessionId();
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing && existing.startsWith('guest-session-')) return existing;
    const next = createGuestSessionId();
    window.localStorage.setItem(STORAGE_KEY, next);
    return next;
  } catch {
    return createGuestSessionId();
  }
}

export function isGuestSessionId(value) {
  return String(value || '').startsWith('guest-session-');
}
