/**
 * Built-in gift-card catalog used when a code is not yet in Supabase
 * (or when the vouchers table is empty). Redeemed mock codes
 * are tracked in-process so they cannot be reused on this server.
 */

const MOCK_VOUCHERS = {
  'IPBITS-5K': { amount_iqd: 5000, amount_usd: 3.5 },
  'IPBITS-10K': { amount_iqd: 10000, amount_usd: 7 },
  'IPBITS-25K': { amount_iqd: 25000, amount_usd: 17 },
  'GIFT-5000': { amount_iqd: 5000, amount_usd: 3.5 },
};

const redeemedMock = new Map();

export function normalizeVoucherCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function lookupMockVoucher(code) {
  const key = normalizeVoucherCode(code);
  const pack = MOCK_VOUCHERS[key];
  if (!pack) return { found: false };
  if (redeemedMock.has(key)) {
    return { found: true, is_used: true, used_by: redeemedMock.get(key), ...pack, code: key };
  }
  return { found: true, is_used: false, ...pack, code: key };
}

export function markMockVoucherUsed(code, phone) {
  const key = normalizeVoucherCode(code);
  redeemedMock.set(key, phone);
}

export const VOUCHER_TOPUP_DESCRIPTION = 'پڕکرن ب کارتی';
export const VOUCHER_INVALID_MSG = 'ئەڤ کۆدە یێ خەلەتە یان بەری نوکە هاتیە مەزاختن';
