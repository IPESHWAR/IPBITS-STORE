import { isValidEmail, isValidIraqiPhone, normalizePhone } from '@/lib/orderValidation';

/** Official store rate used by top-up packages: 5,000 IQD ≈ $3.50 */
export const IQD_PER_USD_PACKAGE = 5000 / 3.5;

export const TOPUP_PACKAGES = [
  { id: '5k', amountIqd: 5000, amountUsd: 3.5 },
  { id: '10k', amountIqd: 10000, amountUsd: 7 },
  { id: '25k', amountIqd: 25000, amountUsd: 17 },
  { id: '50k', amountIqd: 50000, amountUsd: 34 },
];

export const AI_USAGE_COST = {
  free: { iqd: 100, usd: 0.07 },
  paid: { iqd: 400, usd: 0.28 },
  image: { iqd: 800, usd: 0.56 },
};

export const WALLET_STORAGE_KEY = 'ipbits-wallet-session';

export function iqdToUsd(iqd) {
  const n = Number(iqd || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((n / IQD_PER_USD_PACKAGE) * 100) / 100;
}

export function normalizeWalletId(contact) {
  const raw = String(contact || '').trim();
  if (!raw) return '';
  const phone = normalizePhone(raw);
  if (isValidIraqiPhone(phone)) return phone;
  if (isValidEmail(raw)) return raw.toLowerCase();
  return phone || raw.toLowerCase();
}

/** All common ways an Iraqi number / email may be stored on profiles.phone */
export function contactLookupKeys(contact) {
  const id = normalizeWalletId(contact);
  const keys = new Set();
  if (id) keys.add(id);

  const raw = String(contact || '').trim();
  if (isValidEmail(raw)) {
    keys.add(raw.toLowerCase());
    return [...keys];
  }

  let digits = raw.replace(/\D/g, '');
  if (!digits) return [...keys];
  if (digits.startsWith('00964')) digits = digits.slice(4);
  else if (digits.startsWith('964')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length < 8) return [...keys];

  keys.add(digits);
  keys.add(`0${digits}`);
  keys.add(`964${digits}`);
  keys.add(`+964${digits}`);
  keys.add(`00964${digits}`);
  return [...keys];
}

export function toWalletAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isFreeAiModel(model, modelName = '') {
  const id = String(model || '').toLowerCase();
  const name = String(modelName || '').toLowerCase();
  if (!id && !name) return false;
  if (id.endsWith(':free') || id.includes(':free')) return true;
  if (/\bfree\b/.test(id) || /\bfree\b/.test(name)) return true;
  if (name.includes('(free)')) return true;
  // Common free coding / mini models surfaced by OpenRouter catalogs
  if (name.includes('north mini') || id.includes('north-mini') || id.includes('north_mini')) return true;
  return false;
}

export function estimateAiUsageCost(model, isImage = false) {
  if (isImage) return AI_USAGE_COST.image;
  return isFreeAiModel(model) ? AI_USAGE_COST.free : AI_USAGE_COST.paid;
}
