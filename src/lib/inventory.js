export function inferInventoryItemType(line, fallback = 'gift_code') {
  const text = String(line || '').trim();
  if (!text) return fallback;
  if (/@/.test(text) && /[:|]/.test(text)) return 'credentials';
  return fallback;
}

export function splitInventoryLines(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseDeliveryPayload(payload, itemType = 'gift_code') {
  const raw = String(payload || '').trim();
  if (itemType === 'credentials') {
    if (raw.includes('|')) {
      const [email, ...rest] = raw.split('|');
      return { kind: 'credentials', email: email.trim(), password: rest.join('|').trim(), raw };
    }
    const atColon = raw.match(/^([^\s:]+@[^\s:]+)\s*:\s*(.+)$/);
    if (atColon) {
      return { kind: 'credentials', email: atColon[1].trim(), password: atColon[2].trim(), raw };
    }
  }
  return { kind: itemType === 'credentials' ? 'credentials' : 'gift_code', raw };
}