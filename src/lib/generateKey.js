import crypto from 'crypto';

/** Uppercase alphanumeric excluding ambiguous chars: 0/O, 1/I/L */
const KEY_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function randomSegment(length = 4) {
  return Array.from({ length }, () => {
    const idx = crypto.randomInt(0, KEY_CHARSET.length);
    return KEY_CHARSET[idx];
  }).join('');
}

/**
 * Resolve plan duration tag for customer-facing codes.
 * 1D / 7D / 30D / 90D / 365D — default 7D when unknown.
 */
export function normalizePlanPrefix(planSuffix = '7D') {
  const raw = String(planSuffix || '7D').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases = {
    TST: '1D',
    '1DAY': '1D',
    DAY: '1D',
    DAILY: '1D',
    TEST: '1D',
    TRIAL: '1D',
    WK: '7D',
    WEEK: '7D',
    WEEKLY: '7D',
    MO: '30D',
    MONTH: '30D',
    MONTHLY: '30D',
    '3M': '90D',
    QUARTER: '90D',
    QUARTERLY: '90D',
    YR: '365D',
    '1Y': '365D',
    YEAR: '365D',
    YEARLY: '365D',
    ANNUAL: '365D',
    VIP: '30D',
  };
  const mapped = aliases[raw] || raw;
  if (/^(1D|7D|30D|90D|365D)$/.test(mapped)) return mapped;
  return '7D';
}

/**
 * Generate a license key: IPBITS-{PLAN}-{RANDOM8}
 * e.g. IPBITS-1D-N273WNU5, IPBITS-365D-K82M19PL
 */
export function generateLicenseKey(planSuffix = '7D') {
  const suffix = normalizePlanPrefix(planSuffix);
  const random = randomSegment(8);
  return `IPBITS-${suffix}-${random}`;
}

/**
 * Customer-facing code — same format as generateLicenseKey (duration prefix + 8 chars).
 */
export function generateShortLicenseCode(planSuffix = '7D') {
  return generateLicenseKey(planSuffix);
}

export { KEY_CHARSET };
