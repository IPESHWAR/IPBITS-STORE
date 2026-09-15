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
 * Generate a license key: IPBITS-{PLAN}-{RANDOM8}
 * e.g. IPBITS-30D-K8F2M9X4 or IPBITS-VIP-4A9B8C7D
 */
export function generateLicenseKey(planSuffix = 'VIP') {
  const suffix = String(planSuffix || 'VIP').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const random = randomSegment(8);
  return `IPBITS-${suffix}-${random}`;
}

/**
 * Short customer-facing code: IPBITS-WK-XXXX
 */
export function generateShortLicenseCode(planSuffix = 'MO') {
  const suffix = String(planSuffix || 'MO').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `IPBITS-${suffix}-${randomSegment(4)}`;
}

export { KEY_CHARSET };
