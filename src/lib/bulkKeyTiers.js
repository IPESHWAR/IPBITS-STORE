/**
 * IPBITS pricing tiers for bulk voucher / OpenRouter key generation.
 * Prefixes match customer-facing codes: IPBITS-{PREFIX}-{XXXX}
 */

export const BULK_KEY_TIERS = {
  test: {
    id: 'test',
    label: 'Test (1 day)',
    days: 1,
    limit_usd: 0.75,
    amount_iqd: 2500,
    prefix: '1D',
  },
  weekly: {
    id: 'weekly',
    label: 'Weekly (7 days)',
    days: 7,
    limit_usd: 1.75,
    amount_iqd: 5000,
    prefix: '7D',
  },
  monthly: {
    id: 'monthly',
    label: 'Monthly (30 days)',
    days: 30,
    limit_usd: 4.0,
    amount_iqd: 12000,
    prefix: '30D',
  },
  '3months': {
    id: '3months',
    label: '3 Months (90 days)',
    days: 90,
    limit_usd: 8.5,
    amount_iqd: 25000,
    prefix: '90D',
  },
  yearly: {
    id: 'yearly',
    label: 'Yearly (365 days)',
    days: 365,
    limit_usd: 18.0,
    amount_iqd: 50000,
    prefix: '365D',
  },
};

const TIER_ALIASES = {
  test: 'test',
  tst: 'test',
  daily: 'test',
  day: 'test',
  '1d': 'test',
  '1_day': 'test',
  weekly: 'weekly',
  wk: 'weekly',
  '7d': 'weekly',
  '7_days': 'weekly',
  monthly: 'monthly',
  mo: 'monthly',
  '30d': 'monthly',
  '30_days': 'monthly',
  '3months': '3months',
  '3m': '3months',
  '3_months': '3months',
  three_months: '3months',
  quarterly: '3months',
  '90d': '3months',
  yearly: 'yearly',
  yr: 'yearly',
  '1y': 'yearly',
  '1_year': 'yearly',
  '365d': 'yearly',
};

export function listBulkKeyTiers() {
  return Object.values(BULK_KEY_TIERS);
}

export function resolveBulkKeyTier(raw) {
  const key = TIER_ALIASES[String(raw || '').trim().toLowerCase()] || String(raw || '').trim().toLowerCase();
  return BULK_KEY_TIERS[key] || null;
}

const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function randomCodeSegment(length = 4) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return out;
}

/** Customer-facing code: IPBITS-30D-XXXXXXXX */
export function generateBulkVoucherCode(prefix = '30D') {
  const clean = String(prefix || '30D').toUpperCase().replace(/[^A-Z0-9]/g, '') || '30D';
  return `IPBITS-${clean}-${randomCodeSegment(8)}`;
}
