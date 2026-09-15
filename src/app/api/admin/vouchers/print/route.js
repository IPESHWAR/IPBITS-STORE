import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeVoucherCode } from '@/lib/voucherStore';

function randomCode() {
  const chunk = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IPBITS-${chunk()}-${chunk()}`;
}

function isMissingSchema(message) {
  return /column|schema cache|does not exist|relation/i.test(String(message || ''));
}

function isAvailableRow(row, unprintedOnly) {
  if (row.is_used === true) return false;
  const status = String(row.status || 'available').trim().toLowerCase();
  if (status !== 'available') return false;
  if (unprintedOnly && row.is_printed === true) return false;
  return true;
}

async function queryAvailable(amountIqd, unprintedOnly) {
  const attempts = [
    {
      table: 'vouchers',
      select: 'id, code, amount_iqd, is_used, status, is_printed',
      amountCol: 'amount_iqd',
      filters: { status: true, printed: true },
    },
    {
      table: 'vouchers',
      select: 'code, amount_iqd, is_used, is_printed',
      amountCol: 'amount_iqd',
      filters: { status: false, printed: true },
    },
    {
      table: 'vouchers',
      select: 'code, amount_iqd, is_used',
      amountCol: 'amount_iqd',
      filters: { status: false, printed: false },
    },
    {
      table: 'gift_cards',
      select: 'id, code, amount_iqd, is_used, status, is_printed',
      amountCol: 'amount_iqd',
      filters: { status: true, printed: true },
    },
    {
      table: 'gift_cards',
      select: 'code, amount, is_used',
      amountCol: 'amount',
      filters: { status: false, printed: false },
    },
  ];

  const seen = new Set();
  const rows = [];
  let lastError = '';

  for (const attempt of attempts) {
    let query = supabaseAdmin
      .from(attempt.table)
      .select(attempt.select)
      .eq(attempt.amountCol, amountIqd)
      .eq('is_used', false)
      .limit(400);

    if (attempt.filters.status) query = query.eq('status', 'available');
    if (unprintedOnly && attempt.filters.printed) query = query.eq('is_printed', false);

    const { data, error } = await query;
    if (error) {
      lastError = error.message || lastError;
      if (isMissingSchema(error.message)) continue;
      return { error: error.message, rows };
    }

    for (const row of data || []) {
      if (!isAvailableRow(row, unprintedOnly)) continue;
      const code = normalizeVoucherCode(row.code);
      if (!code || seen.has(code)) continue;
      seen.add(code);
      rows.push({
        id: row.id || null,
        code,
        amount_iqd: Number(row[attempt.amountCol] || row.amount_iqd || amountIqd),
      });
    }

    if (attempt.table === 'vouchers') break;
  }

  return { rows, error: rows.length || !lastError ? '' : lastError };
}

async function createMissing(amountIqd, needed) {
  if (needed < 1) return [];
  const rows = Array.from({ length: needed }, () => ({
    code: randomCode(),
    amount_iqd: amountIqd,
    is_used: false,
    is_printed: false,
    status: 'available',
  }));

  const payloads = [
    rows,
    rows.map(({ status, ...row }) => row),
    rows.map(({ is_printed, status, ...row }) => row),
  ];

  for (const payload of payloads) {
    let { data, error } = await supabaseAdmin.from('vouchers').insert(payload).select('id, code, amount_iqd');
    if (error && isMissingSchema(error.message)) {
      ({ data, error } = await supabaseAdmin.from('vouchers').insert(payload).select('code, amount_iqd'));
    }
    if (!error && data?.length) {
      return data.map((row) => ({
        id: row.id || null,
        code: normalizeVoucherCode(row.code),
        amount_iqd: Number(row.amount_iqd || amountIqd),
      }));
    }
    if (error && !isMissingSchema(error.message)) {
      throw new Error(error.message);
    }
  }

  return [];
}

async function markPrinted({ ids = [], codes = [] }) {
  const now = new Date().toISOString();
  const uniqueCodes = [...new Set(codes.map(normalizeVoucherCode).filter(Boolean))];
  if (!uniqueCodes.length) return { marked: 0 };

  const payloads = [
    { is_printed: true, printed_at: now },
    { is_printed: true },
  ];

  for (const payload of payloads) {
    const { data, error } = await supabaseAdmin
      .from('vouchers')
      .update(payload)
      .in('code', uniqueCodes)
      .select('code');
    if (!error) return { marked: data?.length || 0 };
    if (!isMissingSchema(error.message)) return { marked: 0, error: error.message };
  }

  return { marked: 0 };
}

export async function GET(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable', vouchers: [] }, { status: 503 });
  }

  const amountIqd = Math.round(Number(req.nextUrl.searchParams.get('amount_iqd') || req.nextUrl.searchParams.get('amount') || 0));
  const limit = Math.min(200, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get('limit') || req.nextUrl.searchParams.get('qty') || 10))));
  const fill = req.nextUrl.searchParams.get('fill') !== '0';
  const unprintedOnly = !['0', 'false'].includes(String(req.nextUrl.searchParams.get('unprinted') || '1').toLowerCase());
  const mark = req.nextUrl.searchParams.get('mark') !== '0';

  if (!Number.isFinite(amountIqd) || amountIqd < 1000) {
    return NextResponse.json({ error: 'invalid_amount', vouchers: [] }, { status: 400 });
  }

  try {
    const loaded = await queryAvailable(amountIqd, unprintedOnly);
    let vouchers = loaded.rows.slice(0, limit);
    let created = 0;

    if (fill && vouchers.length < limit) {
      const extra = await createMissing(amountIqd, limit - vouchers.length);
      created = extra.length;
      vouchers = [...vouchers, ...extra];
    }

    let marked = 0;
    if (mark && vouchers.length) {
      const result = await markPrinted({
        ids: vouchers.map((row) => row.id).filter(Boolean),
        codes: vouchers.map((row) => row.code),
      });
      marked = result.marked || 0;
    }

    return NextResponse.json({
      success: true,
      amount_iqd: amountIqd,
      requested: limit,
      unprinted: unprintedOnly,
      vouchers,
      created,
      available_before: loaded.rows.length,
      marked,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'print_failed', vouchers: [] }, { status: 500 });
  }
}

export async function POST(req) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'db_unavailable' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await markPrinted({
    ids: Array.isArray(body.ids) ? body.ids : [],
    codes: Array.isArray(body.codes) ? body.codes : [],
  });

  return NextResponse.json({ success: true, marked: result.marked || 0 });
}
