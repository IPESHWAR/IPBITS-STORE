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
 * 1D / 7D / 30D / 90D / 365D
 */
export function normalizePlanPrefix(planSuffix = '30D') {
  const raw = String(planSuffix || '30D').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const aliases = {
    TST: '1D',
    '1DAY': '1D',
    DAY: '1D',
    DAILY: '1D',
    TEST: '1D',
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
  return aliases[raw] || raw || '30D';
}

/**
 * Generate a license key: IPBITS-{PLAN}-{RANDOM8}
 * e.g. IPBITS-1D-N273WNU5, IPBITS-365D-K82M19PL
 */
export function generateLicenseKey(planSuffix = '30D') {
  const suffix = normalizePlanPrefix(planSuffix);
  const random = randomSegment(8);
  return `IPBITS-${suffix}-${random}`;
}

/**
 * Customer-facing code — same format as generateLicenseKey (duration prefix + 8 chars).
 */
export function generateShortLicenseCode(planSuffix = '30D') {
  return generateLicenseKey(planSuffix);
}

export { KEY_CHARSET };
