import { NextResponse } from 'next/server';
import { purchaseWithBalance, getOrCreateWallet, applyWalletChange } from '@/lib/walletService';
import { iqdToUsd, normalizeWalletId } from '@/lib/wallet';
import { getInstantCatalogProduct, resolveCatalogUnit } from '@/lib/catalog';

function purchaseErrorStatus(code) {
  if (code === 'insufficient_balance') return 402;
  if (code === 'out_of_stock') return 409;
  if (code === 'db_unavailable') return 503;
  return 400;
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizeWalletId(body.phone);
  const singleSlug = body.slug || body.p_slug || body.product_slug || '';
  const singlePrice = body.price || body.p_price || body.price_iqd;
  const allowDevBypass =
    process.env.NODE_ENV === 'development' && Boolean(body.devBypass);

  const units = [];
  if (Array.isArray(body.items) && body.items.length > 0) {
    for (const item of body.items) {
      const slug = item.id || item.slug;
      const product = getInstantCatalogProduct(slug);
      if (!product) {
        return NextResponse.json({ success: false, error: 'invalid_slug', code: 'invalid_slug' }, { status: 400 });
      }
      const unit = resolveCatalogUnit(slug);
      const qty = Math.max(1, Math.round(Number(item.quantity || 1)));
      for (let i = 0; i < qty; i += 1) {
        units.push({ slug: slug || product.id, price: unit.priceIQD });
      }
    }
  } else if (singleSlug) {
    const product = getInstantCatalogProduct(singleSlug);
    if (!product) {
      return NextResponse.json({ success: false, error: 'invalid_slug', code: 'invalid_slug' }, { status: 400 });
    }
    const unit = resolveCatalogUnit(singleSlug);
    units.push({ slug: singleSlug || product.id, price: singlePrice || unit.priceIQD });
  }

  if (!phone) {
    return NextResponse.json({ success: false, error: 'invalid_phone', code: 'invalid_phone' }, { status: 400 });
  }
  if (units.length === 0) {
    return NextResponse.json({ success: false, error: 'empty_cart', code: 'empty_cart' }, { status: 400 });
  }

  if (allowDevBypass) {
    const needed = units.reduce((sum, u) => sum + Number(u.price || 0), 0);
    const walletRes = await getOrCreateWallet(phone);
    if (walletRes.ok && Number(walletRes.wallet.balance_iqd) < needed) {
      const gap = Math.ceil(needed - Number(walletRes.wallet.balance_iqd) + 1);
      await applyWalletChange({
        phone,
        type: 'top_up',
        amountIqd: gap,
        amountUsd: iqdToUsd(gap),
        description: 'DEV bypass top-up',
      });
    }
  }

  const deliveries = [];
  let wallet = null;

  for (const unit of units) {
    const result = await purchaseWithBalance({
      phone,
      slug: unit.slug,
      price: unit.price,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.code,
          code: result.code,
          balance_iqd: result.balanceIqd,
          deliveries,
        },
        { status: purchaseErrorStatus(result.code) }
      );
    }
    wallet = result.wallet;
    deliveries.push(result.delivery);
  }

  return NextResponse.json({
    success: true,
    phone: wallet?.phone || phone,
    balance_iqd: wallet?.balance_iqd,
    balance_usd: Number(wallet?.balance_usd || 0),
    deliveries,
    delivery: deliveries[0] || null,
  });
}
