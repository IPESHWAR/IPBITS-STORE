export function isFreeAiModel(model, modelName = '') {
  const id = String(model || '').toLowerCase();
  const name = String(modelName || '').toLowerCase();
  if (!id && !name) return false;
  if (id.endsWith(':free') || id.includes(':free')) return true;
  if (/\bfree\b/.test(id) || /\bfree\b/.test(name)) return true;
  if (name.includes('(free)')) return true;
  if (name.includes('north mini') || id.includes('north-mini') || id.includes('north_mini')) return true;
  return false;
}

export const AI_TOKEN_LIMITS = {
  free: 4096,
  paid: 16384,
};

export function paidAccessGranted({ license, balanceIqd, requiredIqd = 0 }) {
  if (license?.key_code) {
    if (!license.expires_at || new Date(license.expires_at) >= new Date()) return true;
  }
  return Number(balanceIqd || 0) >= Number(requiredIqd || 0) && Number(balanceIqd || 0) > 0;
}
