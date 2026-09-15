import { AI_HUB_SESSION_KEY, clearAiHubSession } from '@/lib/aiHubSession';
import { clearLicenseSession } from '@/lib/licenseSession';
import { LICENSE_STORAGE_KEY } from '@/lib/licensePlans';

const AUTH_STORAGE_KEYS = [
  AI_HUB_SESSION_KEY,
  LICENSE_STORAGE_KEY,
  'ipbits-guest-session',
  'auth_key',
  'active_license',
  'activeLicense',
  'license_key',
  'access_key',
];

const AUTH_COOKIE_NAMES = [
  'auth_key',
  'active_license',
  'activeLicense',
  AI_HUB_SESSION_KEY,
  LICENSE_STORAGE_KEY,
];

function wipeStore(store) {
  if (!store) return;
  AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      store.removeItem(key);
    } catch {
      /* ignore */
    }
  });
  const extra = [];
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key && /license|auth_key|hub.?session|sub[-_]?key|openrouter.?key|access_key/i.test(key)) {
        extra.push(key);
      }
    }
    extra.forEach((key) => store.removeItem(key));
  } catch {
    /* ignore */
  }
}

function wipeCookies() {
  if (typeof document === 'undefined') return;
  const names = new Set(AUTH_COOKIE_NAMES);
  document.cookie.split(';').forEach((part) => {
    const name = part.split('=')[0]?.trim();
    if (name) names.add(name);
  });
  names.forEach((name) => {
    if (!/auth_key|active_license|license|ai_session|access_key/i.test(name)) return;
    document.cookie = `${name}=; Max-Age=0; path=/`;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  });
}

export function purgeChatAuth() {
  clearAiHubSession();
  clearLicenseSession();
  if (typeof window === 'undefined') return;
  wipeStore(window.localStorage);
  wipeStore(window.sessionStorage);
  wipeCookies();
}
