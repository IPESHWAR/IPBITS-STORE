import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { contactLookupKeys, iqdToUsd, normalizeWalletId, toWalletAmount } from '@/lib/wallet';
import { generateLicenseForOrder } from '@/lib/licenseService';
import { resolvePlanFromItems } from '@/lib/licensePlans';
import { lookupMockVoucher, markMockVoucherUsed, normalizeVoucherCode } from '@/lib/voucherStore';
import { catalogSlugCandidates, getInstantCatalogProduct, normalizeProductSlug, resolveCatalogUnit } from '@/lib/catalog';

function asWallet(row) {
  if (!row) return null;
  return {
    phone: row.phone,
    balance_iqd: toWalletAmount(row.balance_iqd),
    balance_usd: toWalletAmount(row.balance_usd),
    updated_at: row.updated_at || null,
  };
}

function pickBestProfile(rows) {
  const list = (rows || []).filter(Boolean);
  if (list.length === 0) return null;
  return [...list].sort((a, b) => toWalletAmount(b.balance_iqd) - toWalletAmount(a.balance_iqd))[0];
}

async function findWalletProfile(phone) {
  const keys = contactLookupKeys(phone);
  if (!supabaseAdmin || keys.length === 0) return null;

  const { data: byPhone } = await supabaseAdmin
    .from('profiles')
    .select('phone, balance_iqd, balance_usd, updated_at')
    .in('phone', keys);

  let best = pickBestProfile(byPhone);
  if (best) return best;

  const emailKey = keys.find((k) => k.includes('@'));
  if (emailKey) {
    const { data: byEmail } = await supabaseAdmin
      .from('profiles')
      .select('phone, email, balance_iqd, balance_usd, updated_at')
      .eq('email', emailKey)
      .maybeSingle();
    if (byEmail) return byEmail;
  }

  const local = keys.find((k) => /^07[3-9]\d{8}$/.test(k));
  const tail = local ? local.slice(-10) : '';
  if (tail) {
    const { data: fuzzy } = await supabaseAdmin
      .from('profiles')
      .select('phone, balance_iqd, balance_usd, updated_at')
      .or(`phone.ilike.%${tail},phone.ilike.%${local}`);
    best = pickBestProfile(fuzzy);
    if (best) return best;
  }

  return null;
}

export function walletNotConfigured() {
  return !supabaseAdmin;
}

export async function getOrCreateWallet(rawPhone) {
  const phone = normalizeWalletId(rawPhone);
  if (!phone) return { ok: false, code: 'invalid_phone' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const existing = await findWalletProfile(phone);
  if (existing) {
    return { ok: true, wallet: asWallet({ ...existing, phone: existing.phone || phone }) };
  }

  const { data: ensured, error: rpcErr } = await supabaseAdmin.rpc('ensure_wallet_profile', {
    p_phone: phone,
  });

  if (!rpcErr && ensured) {
    const row = Array.isArray(ensured) ? ensured[0] : ensured;
    if (row) return { ok: true, wallet: asWallet(row) };
  }

  const attempts = [
    { phone, balance_iqd: 0, balance_usd: 0 },
    {
      id: crypto.randomUUID(),
      phone,
      balance_iqd: 0,
      balance_usd: 0,
      email: `wallet+${phone.replace(/[^\w]/g, '')}@ipbits.local`,
    },
  ];

  let lastError = rpcErr?.message || null;
  for (const insertRow of attempts) {
    const { data: created, error: insErr } = await supabaseAdmin
      .from('profiles')
      .insert(insertRow)
      .select('phone, balance_iqd, balance_usd, updated_at')
      .single();

    if (!insErr && created) {
      return { ok: true, wallet: asWallet(created) };
    }

    lastError = insErr?.message || lastError;
    if (/duplicate|23505/i.test(insErr?.message || '')) {
      const { data: again } = await supabaseAdmin
        .from('profiles')
        .select('phone, balance_iqd, balance_usd, updated_at')
        .eq('phone', phone)
        .maybeSingle();
      if (again) return { ok: true, wallet: asWallet(again) };
    }
  }

  return { ok: false, code: 'db_error', error: lastError || 'profile_create_failed' };
}

async function resolveAccountPhone(rawPhone) {
  const id = normalizeWalletId(rawPhone);
  const found = await findWalletProfile(id || rawPhone);
  return found?.phone || id;
}

export async function applyWalletChange({ phone, type, amountIqd, amountUsd, description }) {
  const id = await resolveAccountPhone(phone);
  if (!id) return { ok: false, code: 'invalid_phone' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const { data, error } = await supabaseAdmin.rpc('wallet_apply', {
    p_phone: id,
    p_type: type,
    p_amount_iqd: amountIqd,
    p_amount_usd: amountUsd ?? iqdToUsd(Math.abs(amountIqd)) * Math.sign(amountIqd),
    p_description: description || null,
  });

  if (error) {
    if (/insufficient_balance/i.test(error.message || '')) {
      return { ok: false, code: 'insufficient_balance' };
    }
    return { ok: false, code: 'db_error', error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, wallet: asWallet(row) };
}

export async function getWalletHistory(rawPhone, limit = 30) {
  const phone = normalizeWalletId(rawPhone);
  if (!phone) return { ok: false, code: 'invalid_phone' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, type, amount_iqd, amount_usd, description, created_at')
    .eq('phone', phone)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false, code: 'db_error', error: error.message };
  return { ok: true, transactions: data || [] };
}

export async function redeemVoucher({ phone, code }) {
  const id = await resolveAccountPhone(phone);
  const voucher = normalizeVoucherCode(code);
  if (!id) return { ok: false, code: 'invalid_phone' };
  if (!voucher || voucher.length < 4) return { ok: false, code: 'invalid_voucher' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const runRedeem = async () =>
    supabaseAdmin.rpc('redeem_voucher', {
      p_phone: id,
      p_code: voucher,
    });

  let { data, error } = await runRedeem();

  if (error && /invalid_voucher/i.test(error.message || '')) {
    const mock = lookupMockVoucher(voucher);
    if (mock.found && !mock.is_used) {
      await supabaseAdmin.from('vouchers').upsert({
        code: voucher,
        amount_iqd: mock.amount_iqd,
        is_used: false,
      });
      markMockVoucherUsed(voucher, id);
      ({ data, error } = await runRedeem());
    }
  }

  if (error) {
    if (/invalid_voucher|voucher_used/i.test(error.message || '')) {
      return { ok: false, code: /used/i.test(error.message || '') ? 'voucher_used' : 'invalid_voucher' };
    }
    return { ok: false, code: 'db_error', error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    wallet: asWallet({
      phone: id,
      balance_iqd: row?.balance_iqd,
      balance_usd: row?.balance_usd,
    }),
    creditedIqd: Number(row?.credited_iqd || 0),
  };
}

export async function createTopup({ phone, amountIqd, amountUsd, paymentMethod }) {
  const id = normalizeWalletId(phone);
  const iqd = Math.round(Number(amountIqd || 0));
  if (!id) return { ok: false, code: 'invalid_phone' };
  if (!Number.isFinite(iqd) || iqd < 1000) return { ok: false, code: 'invalid_amount' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  await getOrCreateWallet(id);

  const topupId = `TOP-${Date.now().toString(36).toUpperCase()}`;
  const usd = Number(amountUsd || iqdToUsd(iqd));

  const { error } = await supabaseAdmin.from('wallet_topups').insert({
    id: topupId,
    phone: id,
    amount_iqd: iqd,
    amount_usd: usd,
    payment_method: paymentMethod || null,
    status: 'pending',
  });

  if (error) return { ok: false, code: 'db_error', error: error.message };
  return { ok: true, topupId, amountIqd: iqd, amountUsd: usd, phone: id, status: 'pending' };
}

export async function approveTopup(topupId) {
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const { data: topup, error } = await supabaseAdmin
    .from('wallet_topups')
    .select('*')
    .eq('id', topupId)
    .single();

  if (error || !topup) return { ok: false, code: 'not_found' };
  if (topup.status === 'approved') return { ok: true, already: true };

  const applied = await applyWalletChange({
    phone: topup.phone,
    type: 'top_up',
    amountIqd: topup.amount_iqd,
    amountUsd: Number(topup.amount_usd || iqdToUsd(topup.amount_iqd)),
    description: `Top-up ${topup.id} via ${topup.payment_method || 'wallet'}`,
  });

  if (!applied.ok) return applied;

  await supabaseAdmin
    .from('wallet_topups')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', topupId);

  return { ok: true, wallet: applied.wallet, topup };
}

export async function rejectTopup(topupId) {
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };
  const { error } = await supabaseAdmin
    .from('wallet_topups')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', topupId);
  if (error) return { ok: false, code: 'db_error', error: error.message };
  return { ok: true };
}

function isInventoryRowAvailable(row) {
  if (!row) return false;
  const used = row.is_used === true;
  const sold = row.is_sold === true;
  const status = String(row.status || 'available').trim().toLowerCase();
  return !used && !sold && status === 'available';
}

export async function checkInventoryAvailable(slug) {
  const selected = normalizeProductSlug(slug);
  if (!selected) return { ok: false, code: 'invalid_slug', available: false, count: 0 };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable', available: false, count: 0 };

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc('inventory_is_available', {
    p_slug: selected,
  });

  if (!rpcErr && typeof rpcData === 'boolean') {
    return { ok: true, available: rpcData, count: rpcData ? 1 : 0, slug: selected };
  }

  const candidates = catalogSlugCandidates(selected);
  const orFilter = candidates
    .flatMap((value) => [`product_slug.ilike.${value}`, `product_slug.ilike.${value}-%`, `product_slug.ilike.${value}_%`])
    .join(',');

  const selectAttempts = [
    'id, product_slug, is_used, is_sold, status',
    'id, product_slug, is_used, status',
    'id, product_slug, is_used',
  ];

  let rows = null;
  let lastError = rpcErr?.message || null;
  for (const columns of selectAttempts) {
    const { data, error } = await supabaseAdmin
      .from('product_inventory')
      .select(columns)
      .or(orFilter)
      .limit(80);
    if (!error) {
      rows = data || [];
      break;
    }
    lastError = error.message;
    if (!/column|schema cache|does not exist/i.test(error.message || '')) {
      return { ok: false, code: 'db_error', error: error.message, available: false, count: 0 };
    }
  }

  if (!rows) {
    return { ok: false, code: 'db_error', error: lastError, available: false, count: 0 };
  }

  const availableRows = rows.filter(isInventoryRowAvailable);
  return {
    ok: true,
    available: availableRows.length > 0,
    count: availableRows.length,
    slug: selected,
  };
}

export async function purchaseWithBalance({ phone, slug, price }) {
  const walletRes = await getOrCreateWallet(phone);
  const id = walletRes.ok ? walletRes.wallet.phone : normalizeWalletId(phone);
  const selectedSlug = normalizeProductSlug(slug);
  const product = getInstantCatalogProduct(selectedSlug || slug);
  if (!id) return { ok: false, code: 'invalid_phone' };
  if (!product) return { ok: false, code: 'invalid_slug' };
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };
  const unit = resolveCatalogUnit(selectedSlug || slug);
  const catalogPrice = Math.round(Number(unit.priceIQD || product.priceIQD));
  if (walletRes.ok && toWalletAmount(walletRes.wallet.balance_iqd) < catalogPrice) {
    return { ok: false, code: 'insufficient_balance', balanceIqd: walletRes.wallet.balance_iqd };
  }
  const requested = Math.round(Number(price || catalogPrice));
  if (!Number.isFinite(requested) || requested !== catalogPrice) {
    return { ok: false, code: 'invalid_price' };
  }

  const slugsToTry = [...new Set([selectedSlug, product.id, ...catalogSlugCandidates(selectedSlug || product.id)])];
  let data = null;
  let error = null;
  for (const trySlug of slugsToTry) {
    ({ data, error } = await supabaseAdmin.rpc('purchase_with_balance', {
      p_phone: id,
      p_slug: trySlug,
      p_price: catalogPrice,
    }));
    if (!error) break;
    if (!/out_of_stock|invalid_slug/i.test(error.message || '')) break;
  }

  if (error) {
    const message = error.message || '';
    if (/insufficient_balance/i.test(message)) return { ok: false, code: 'insufficient_balance' };
    if (/out_of_stock/i.test(message)) return { ok: false, code: 'out_of_stock' };
    if (/could not find the function|schema cache|does not exist/i.test(message)) {
      return { ok: false, code: 'db_unavailable', error: message };
    }
    return { ok: false, code: 'db_error', error: message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.payload) {
    return { ok: false, code: 'out_of_stock' };
  }

  return {
    ok: true,
    wallet: asWallet({
      phone: id,
      balance_iqd: row.balance_iqd,
      balance_usd: row.balance_usd,
    }),
    delivery: {
      payload: row.payload,
      item_type: row.item_type || 'gift_code',
      product_slug: row.product_slug || product.id,
      inventory_id: row.inventory_id || null,
    },
  };
}

/**
 * Instant purchase: deduct wallet, write approved order, issue license.
 */
export async function payWithBalance({ phone, items, totalIQD, totalUSD, name }) {
  const id = normalizeWalletId(phone);
  const iqd = Math.round(Number(totalIQD || 0));
  const usd = Number(totalUSD || iqdToUsd(iqd));
  const itemsList = Array.isArray(items) ? items : [];

  if (!id) return { ok: false, code: 'invalid_phone' };
  if (!Number.isFinite(iqd) || iqd <= 0 || itemsList.length === 0) {
    return { ok: false, code: 'empty_cart' };
  }
  if (!supabaseAdmin) return { ok: false, code: 'db_unavailable' };

  const walletRes = await getOrCreateWallet(id);
  if (!walletRes.ok) return walletRes;
  if (Number(walletRes.wallet.balance_iqd) < iqd) {
    return {
      ok: false,
      code: 'insufficient_balance',
      balanceIqd: walletRes.wallet.balance_iqd,
    };
  }

  const itemsFormatted = itemsList
    .map((i) => `${i.name || i.title || 'بەرهەم'} (x${i.quantity || 1})`)
    .join(', ');
  const plan = resolvePlanFromItems(itemsList);
  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const deducted = await applyWalletChange({
    phone: id,
    type: 'purchase',
    amountIqd: -iqd,
    amountUsd: -usd,
    description: itemsFormatted,
  });
  if (!deducted.ok) return deducted;

  let license;
  try {
    license = await generateLicenseForOrder({
      items: itemsList,
      phone: id,
      name: name || id,
      planType: plan.planType,
      durationDays: plan.durationDays,
      planSuffix: plan.planSuffix,
      orderId,
    });
  } catch (err) {
    await applyWalletChange({
      phone: id,
      type: 'top_up',
      amountIqd: iqd,
      amountUsd: usd,
      description: `Refund failed purchase ${orderId}`,
    });
    return { ok: false, code: 'license_error', error: err.message };
  }

  const approvedRow = {
    id: orderId,
    customer_name: name || id,
    customer_phone: id,
    items: itemsList,
    items_label: itemsFormatted,
    total_iqd: iqd,
    total_usd: usd,
    payment_method: 'WALLET',
    transaction_id: `WALLET-${orderId}`,
    plan_type: plan.planType,
    duration_days: plan.durationDays,
    status: 'approved',
    license_key: license.key_code,
    license_key_id: license.id || null,
  };

  let { error: insertErr } = await supabaseAdmin.from('orders').insert(approvedRow);
  if (insertErr && /license_key_id/i.test(insertErr.message || '')) {
    delete approvedRow.license_key_id;
    ({ error: insertErr } = await supabaseAdmin.from('orders').insert(approvedRow));
  }
  if (insertErr) {
    console.error('Wallet order insert error:', insertErr);
  }

  return {
    ok: true,
    orderId,
    status: 'approved',
    licenseKey: license,
    wallet: deducted.wallet,
  };
}

export async function consumeAiUsage({ phone, amountIqd, amountUsd, description }) {
  const iqd = Math.round(Number(amountIqd || 0));
  if (iqd <= 0) return { ok: false, code: 'invalid_amount' };

  const walletRes = await getOrCreateWallet(phone);
  if (!walletRes.ok) return walletRes;
  if (Number(walletRes.wallet.balance_iqd) < iqd) {
    return {
      ok: false,
      code: 'insufficient_balance',
      balanceIqd: walletRes.wallet.balance_iqd,
    };
  }

  return applyWalletChange({
    phone,
    type: 'ai_usage',
    amountIqd: -iqd,
    amountUsd: -(amountUsd ?? iqdToUsd(iqd)),
    description: description || 'AI Hub usage',
  });
}
