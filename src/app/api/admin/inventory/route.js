import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { catalogSlugCandidates, getInstantCatalogProduct, getProductFulfillment } from '@/lib/catalog';
import { inferInventoryItemType, splitInventoryLines } from '@/lib/inventory';

function isAvailableRow(row) {
  const used = row.is_used === true;
  const sold = row.is_sold === true;
  const status = String(row.status || 'available').trim().toLowerCase();
  return !used && !sold && status === 'available';
}

export async function GET(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable', items: [], counts: [] }, { status: 503 });
  }

  const slug = req.nextUrl.searchParams.get('slug') || '';
  const selectAttempts = [
    'id, product_slug, payload, item_type, is_used, is_sold, status, used_by, used_at, created_at',
    'id, product_slug, payload, item_type, is_used, used_by, used_at, created_at',
  ];

  let data = null;
  let error = null;
  for (const columns of selectAttempts) {
    let query = supabaseAdmin
      .from('product_inventory')
      .select(columns)
      .order('created_at', { ascending: false })
      .limit(300);

    if (slug) {
      const candidates = catalogSlugCandidates(slug);
      query = query.or(candidates.map((value) => `product_slug.ilike.${value}`).join(','));
    }

    ({ data, error } = await query);
    if (!error) break;
    if (!/column|schema cache/i.test(error.message || '')) break;
  }

  if (error) {
    return NextResponse.json({ error: error.message, items: [], counts: [] }, { status: 500 });
  }

  const countsMap = {};
  for (const row of data || []) {
    if (!countsMap[row.product_slug]) {
      countsMap[row.product_slug] = { product_slug: row.product_slug, available: 0, used: 0 };
    }
    if (isAvailableRow(row)) countsMap[row.product_slug].available += 1;
    else countsMap[row.product_slug].used += 1;
  }

  return NextResponse.json({
    items: data || [],
    counts: Object.values(countsMap),
  });
}

export async function POST(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const product = getInstantCatalogProduct(body.product_slug || body.slug);
  if (!product) {
    return NextResponse.json({ error: 'invalid_slug', code: 'invalid_slug' }, { status: 400 });
  }

  const fallbackType =
    body.item_type === 'credentials' || body.item_type === 'gift_code'
      ? body.item_type
      : getProductFulfillment(product.id);

  const lines = splitInventoryLines(body.lines || body.payloads || body.text || '');
  if (lines.length === 0) {
    return NextResponse.json({ error: 'empty_lines', code: 'empty_lines' }, { status: 400 });
  }

  const rows = lines.map((line) => ({
    product_slug: product.id,
    payload: line,
    item_type: inferInventoryItemType(line, fallbackType),
    is_used: false,
    is_sold: false,
    status: 'available',
  }));

  let { data, error } = await supabaseAdmin
    .from('product_inventory')
    .insert(rows)
    .select('id, product_slug, payload, item_type, is_used, is_sold, status, created_at');

  if (error && /column|schema cache/i.test(error.message || '')) {
    const basic = rows.map(({ is_sold, status, ...row }) => row);
    ({ data, error } = await supabaseAdmin
      .from('product_inventory')
      .insert(basic)
      .select('id, product_slug, payload, item_type, is_used, created_at'));
  }

  if (error) {
    return NextResponse.json({ error: error.message, code: 'db_error' }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: data?.length || 0, items: data || [] });
}
