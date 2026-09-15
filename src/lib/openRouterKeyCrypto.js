import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function encryptionKey() {
  const secret =
    process.env.OPENROUTER_KEY_SECRET ||
    process.env.OPENROUTER_MANAGEMENT_API_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.AI_HUB_SECRET ||
    'ipbits-or-key-fallback';
  return createHash('sha256').update(secret).digest();
}

export function encryptOpenRouterKey(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptOpenRouterKey(payload) {
  const raw = String(payload || '');
  const [version, ivB64, tagB64, dataB64] = raw.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('invalid_key_payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

export function maskOpenRouterKey(key) {
  const value = String(key || '');
  if (value.length < 12) return 'sk-or-••••';
  return `${value.slice(0, 10)}…${value.slice(-4)}`;
}
