/**
 * Shared client/server order validation for anti-spam checkout.
 */

export const IRAQI_MOBILE_RE = /^07[3-9]\d{8}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const INTL_PHONE_RE = /^\+?\d{10,15}$/;

export function normalizePhone(phone) {
  return String(phone || '').replace(/[\s\-()]/g, '');
}

export function isValidIraqiPhone(phone) {
  return IRAQI_MOBILE_RE.test(normalizePhone(phone));
}

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

/** WhatsApp / phone: Iraqi 07… or international digits. */
export function isValidWhatsAppPhone(phone) {
  const value = normalizePhone(phone);
  return isValidIraqiPhone(value) || INTL_PHONE_RE.test(value);
}

/** Streamlined checkout accepts either a valid Iraqi phone number or an email address. */
export function isValidContact(contact) {
  const value = String(contact || '').trim();
  return isValidIraqiPhone(value) || isValidEmail(value);
}

export function isValidFullName(name) {
  const cleaned = String(name || '').trim().replace(/\s+/g, ' ');
  if (cleaned.length < 3) return false;
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 1) return false;
  const letters = cleaned.match(/\p{L}/gu) || [];
  if (letters.length < 2) return false;
  if (/^[\d\s._\-]+$/.test(cleaned)) return false;
  return true;
}

export function hasPaymentProof({ transactionId, hasImage }) {
  const tx = String(transactionId || '').trim();
  return tx.length >= 4 || !!hasImage;
}

/**
 * Manual Telegram checkout: customer name + WhatsApp phone + cart required.
 * TxID / screenshot are optional proof fields.
 *
 * @returns {{ ok: true } | { ok: false, code: string }}
 */
export function validateOrderPayload({ name, phone, totalIQD, items, paymentMethod }) {
  const total = Number(totalIQD || 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { ok: false, code: 'empty_cart' };
  }

  const itemCount = Array.isArray(items)
    ? items.length
    : String(items || '').trim()
      ? 1
      : 0;
  if (itemCount <= 0) {
    return { ok: false, code: 'empty_cart' };
  }

  if (!isValidFullName(name)) {
    return { ok: false, code: 'invalid_name' };
  }

  if (!isValidWhatsAppPhone(phone) && !isValidContact(phone)) {
    return { ok: false, code: 'invalid_phone' };
  }

  if (paymentMethod && !['FIB', 'FastPay', 'ZainCash', 'QiCard'].includes(paymentMethod)) {
    return { ok: false, code: 'invalid_payment' };
  }

  return { ok: true };
}
