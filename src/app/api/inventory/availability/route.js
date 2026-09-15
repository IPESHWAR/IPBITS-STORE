import { NextResponse } from 'next/server';
import { checkInventoryAvailable } from '@/lib/walletService';
import { getInstantCatalogProduct, normalizeProductSlug } from '@/lib/catalog';

export async function GET(req) {
  const raw = req.nextUrl.searchParams.get('slug') || req.nextUrl.searchParams.get('product_slug') || '';
  const slug = normalizeProductSlug(raw);
  if (!slug) {
    return NextResponse.json({ available: false, error: 'invalid_slug', code: 'invalid_slug' }, { status: 400 });
  }

  const product = getInstantCatalogProduct(slug);
  const result = await checkInventoryAvailable(slug);
  if (!result.ok && result.code === 'db_unavailable') {
    return NextResponse.json(
      { available: false, count: 0, slug, catalog_slug: product?.id || slug, code: result.code },
      { status: 503 }
    );
  }

  return NextResponse.json({
    available: Boolean(result.available),
    count: Number(result.count || 0),
    slug,
    catalog_slug: product?.id || slug,
  });
}
