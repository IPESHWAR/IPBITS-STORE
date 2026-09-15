import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createOpenRouterSubKey } from '@/lib/openRouterProvisioning';
import {
  generateBulkVoucherCode,
  resolveBulkKeyTier,
} from '@/lib/bulkKeyTiers';

const MAX_BATCH = 100;
const CODE_RETRIES = 6;

function expiresAtFromDays(days) {
  return new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString();
}

async function insertVoucherRow(code, amountIqd) {
  const attempts = [
    { code, amount_iqd: amountIqd, is_used: false, is_printed: false, status: 'available' },
    { code, amount_iqd: amountIqd, is_used: false, is_printed: false },
    { code, amount_iqd: amountIqd, is_used: false },
  ];

  let lastError = null;
  for (const payload of attempts) {
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .insert(payload)
      .select('code, amount_iqd, is_used')
      .single();

    if (!error && data) return { ok: true, row: data };
    lastError = error;
    if (error && /duplicate|unique|already exists/i.test(error.message || '')) {
      return { ok: false, code: 'duplicate', error };
    }
    if (error && !/column|schema cache/i.test(error.message || '')) {
      return { ok: false, code: 'insert_failed', error };
    }
  }
  return { ok: false, code: 'insert_failed', error: lastError };
}

/**
 * Provision OpenRouter sub-keys + insert unused vouchers for a pricing tier.
 * @param {{ tier: string, quantity: number, provisionOpenRouter?: boolean }} opts
 */
export async function generateBulkKeys({
  tier: tierRaw,
  quantity,
  provisionOpenRouter = true,
} = {}) {
  if (!supabaseAdmin) {
    return { ok: false, code: 'db_unavailable', error: 'Supabase is not configured' };
  }

  const tier = resolveBulkKeyTier(tierRaw);
  if (!tier) {
    return { ok: false, code: 'invalid_tier', error: 'Unknown pricing tier' };
  }

  const qty = Math.min(MAX_BATCH, Math.max(1, Math.round(Number(quantity) || 0)));
  if (!Number.isFinite(qty) || qty < 1) {
    return { ok: false, code: 'invalid_quantity', error: 'Quantity must be 1–100' };
  }

  const generated = [];
  const failures = [];
  const expiresAt = expiresAtFromDays(tier.days);

  for (let i = 0; i < qty; i += 1) {
    let code = null;
    let orMeta = null;

    if (provisionOpenRouter) {
      // Allocate code first so OpenRouter key name matches the voucher
      for (let attempt = 0; attempt < CODE_RETRIES; attempt += 1) {
        code = generateBulkVoucherCode(tier.prefix);
        const created = await createOpenRouterSubKey({
          name: code.slice(0, 64),
          creditLimitUsd: tier.limit_usd,
          expiresAt,
        });
        if (!created.ok) {
          failures.push({
            index: i,
            error: created.error || created.code || 'openrouter_failed',
          });
          code = null;
          break;
        }
        orMeta = {
          hash: created.hash,
          limit: created.limit,
          expires_at: created.expires_at || expiresAt,
        };
        break;
      }
      if (!code) continue;
    } else {
      code = generateBulkVoucherCode(tier.prefix);
    }

    let inserted = null;
    for (let attempt = 0; attempt < CODE_RETRIES; attempt += 1) {
      const tryCode = attempt === 0 ? code : generateBulkVoucherCode(tier.prefix);
      const result = await insertVoucherRow(tryCode, tier.amount_iqd);
      if (result.ok) {
        inserted = result.row;
        code = tryCode;
        break;
      }
      if (result.code !== 'duplicate') {
        failures.push({
          index: i,
          code: tryCode,
          error: result.error?.message || result.code,
        });
        inserted = null;
        break;
      }
    }

    if (!inserted) continue;

    generated.push({
      code: inserted.code,
      amount_iqd: inserted.amount_iqd,
      is_used: false,
      tier: tier.id,
      days: tier.days,
      limit_usd: tier.limit_usd,
      prefix: tier.prefix,
      openrouter: orMeta,
    });
  }

  return {
    ok: generated.length > 0,
    tier,
    requested: qty,
    created: generated.length,
    codes: generated.map((g) => g.code),
    items: generated,
    failures,
  };
}

export { MAX_BATCH };
